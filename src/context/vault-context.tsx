import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  createMarkdownFile,
  createVaultDirectory,
  deleteVaultDirectory,
  deleteVaultFile,
  listMarkdown,
  renameVaultDirectory,
  renameVaultFile,
  readMarkdownFile,
  stripMarkdownExtension,
  writeMarkdownFile,
  type VaultDirectoryEntry,
  type VaultFileEntry,
} from "@/lib/vault-bridge";
import { CreateFileDialog } from "@/components/create-file-dialog";
import { CreateFolderDialog } from "@/components/create-folder-dialog";
const VAULT_STORAGE_KEY = "knowledge-base-vault-path";
export const MAX_OPEN_FILES = 10;

function sanitizeParentDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function splitRelativePath(relativePath: string): { parent: string; name: string } {
  const normalized = sanitizeParentDir(relativePath);
  const parts = normalized.split("/").filter(Boolean);
  const name = parts.pop() ?? "";
  return {
    parent: parts.join("/"),
    name,
  };
}

function normalizeNoteBaseName(rawName: string): string {
  return stripMarkdownExtension(rawName.trim());
}

function toMarkdownRelativePath(relativePath: string): string {
  const normalized = sanitizeParentDir(relativePath);
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

type VaultContextValue = {
  vaultPath: string | null;
  activeFile: VaultFileEntry | null;
  openFiles: VaultFileEntry[];
  content: string;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setContent: (value: string) => void;
  save: () => Promise<void>;
  selectFile: (file: VaultFileEntry) => Promise<void>;
  closeFile: (relativePath: string) => Promise<void>;
  closeAllFiles: (shouldPersist: boolean) => Promise<void>;
  renameNote: (relativePath: string, nextName: string) => Promise<void>;
  isTauriApp: boolean;
};

type VaultExplorerContextValue = {
  vaultPath: string | null;
  directories: VaultDirectoryEntry[];
  files: VaultFileEntry[];
  activeFile: VaultFileEntry | null;
  loading: boolean;
  error: string | null;
  openVaultFolder: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  selectFile: (file: VaultFileEntry) => Promise<void>;
  newNote: () => void;
  /** 相对知识库根目录的父文件夹路径，空字符串表示根目录 */
  openNewNoteInDirectory: (relativeParentDir: string) => void;
  openNewFolderInDirectory: (relativeParentDir: string) => void;
  deleteNote: (relativePath: string) => Promise<void>;
  deleteFolder: (relativePath: string) => Promise<void>;
  renameNote: (relativePath: string, nextName: string) => Promise<void>;
  renameFolder: (relativePath: string, nextName: string) => Promise<void>;
  isTauriApp: boolean;
};

const VaultContext = createContext<VaultContextValue | null>(null);
const VaultExplorerContext = createContext<VaultExplorerContextValue | null>(null);

type FileSessionState = {
  content: string;
  savedContent: string;
};

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultPath, setVaultPath] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VAULT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [directories, setDirectories] = useState<VaultDirectoryEntry[]>([]);
  const [files, setFiles] = useState<VaultFileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<VaultFileEntry | null>(null);
  const [openFiles, setOpenFiles] = useState<VaultFileEntry[]>([]);
  const [fileSessions, setFileSessions] = useState<Record<string, FileSessionState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createNoteDialogOpen, setCreateNoteDialogOpen] = useState(false);
  const [noteParentDir, setNoteParentDir] = useState("");
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [folderParentDir, setFolderParentDir] = useState("");

  const isTauriApp = isTauri();
  const autosaveTimerRef = useRef<number | null>(null);

  const content = activeFile ? (fileSessions[activeFile.relativePath]?.content ?? "") : "";
  const savedContent = activeFile
    ? (fileSessions[activeFile.relativePath]?.savedContent ?? "")
    : "";
  const dirty = content !== savedContent;

  const upsertOpenFile = useCallback((file: VaultFileEntry) => {
    setOpenFiles((prev) => {
      const index = prev.findIndex((entry) => entry.relativePath === file.relativePath);
      if (index === -1) {
        return [...prev, file];
      }

      const next = [...prev];
      next[index] = file;
      return next;
    });
  }, []);

  const persistFileContent = useCallback(
    async (relativePath: string) => {
      if (!vaultPath || !isTauriApp) return;

      const session = fileSessions[relativePath];
      if (!session || session.content === session.savedContent) return;

      if (autosaveTimerRef.current !== null && activeFile?.relativePath === relativePath) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      setSaving(true);
      try {
        const contentToSave = session.content;
        await writeMarkdownFile(vaultPath, relativePath, contentToSave);
        setFileSessions((prev) => {
          const current = prev[relativePath];
          if (!current) return prev;

          return {
            ...prev,
            [relativePath]: {
              ...current,
              savedContent: contentToSave,
            },
          };
        });
      } finally {
        setSaving(false);
      }
    },
    [vaultPath, isTauriApp, fileSessions, activeFile],
  );

  const persistActiveContent = useCallback(async () => {
    if (!activeFile) return;
    await persistFileContent(activeFile.relativePath);
  }, [activeFile, persistFileContent]);

  const refreshFiles = useCallback(async () => {
    if (!vaultPath || !isTauriApp) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listMarkdown(vaultPath);
      setDirectories(list.directories);
      setFiles(list.files);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [vaultPath, isTauriApp]);

  useEffect(() => {
    if (vaultPath && isTauriApp) {
      void refreshFiles();
    }
  }, [vaultPath, isTauriApp, refreshFiles]);

  useEffect(() => {
    if (!vaultPath || !activeFile || !isTauriApp) return;
    if (content === savedContent) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      setSaving(true);
      setError(null);
      const activePath = activeFile.relativePath;
      const contentToSave = content;
      void writeMarkdownFile(vaultPath, activePath, contentToSave)
        .then(() => {
          setFileSessions((prev) => {
            const session = prev[activePath];
            if (!session) return prev;

            return {
              ...prev,
              [activePath]: {
                ...session,
                savedContent: contentToSave,
              },
            };
          });
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          setSaving(false);
        });
    }, 250);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [vaultPath, activeFile, content, savedContent, isTauriApp]);

  const loadFile = useCallback(
    async (file: VaultFileEntry) => {
      if (!vaultPath || !isTauriApp) return;
      const existingSession = fileSessions[file.relativePath];
      if (existingSession) {
        setError(null);
        upsertOpenFile(file);
        setActiveFile(file);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const text = await readMarkdownFile(vaultPath, file.relativePath);
        upsertOpenFile(file);
        setActiveFile(file);
        setFileSessions((prev) => ({
          ...prev,
          [file.relativePath]: {
            content: text,
            savedContent: text,
          },
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, fileSessions, openFiles.length, upsertOpenFile],
  );

  const openVaultFolder = useCallback(async () => {
    if (!isTauriApp) {
      setError("请在 Tauri 桌面应用中打开文件夹。");
      return;
    }
    setError(null);
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择知识库文件夹",
    });
    if (selected === null || selected === undefined) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return;
    setVaultPath(path);
    try {
      localStorage.setItem(VAULT_STORAGE_KEY, path);
    } catch {
      /* ignore */
    }
    setActiveFile(null);
    setOpenFiles([]);
    setFileSessions({});
  }, [isTauriApp]);

  const selectFile = useCallback(
    async (file: VaultFileEntry) => {
      if (!vaultPath || !isTauriApp) return;
      if (activeFile?.relativePath && activeFile.relativePath !== file.relativePath) {
        await persistFileContent(activeFile.relativePath);
      }
      await loadFile(file);
    },
    [vaultPath, isTauriApp, activeFile, persistFileContent, loadFile],
  );

  const setContent = useCallback((value: string) => {
    setFileSessions((prev) => {
      if (!activeFile) return prev;

      const session = prev[activeFile.relativePath];
      if (!session || session.content === value) return prev;

      return {
        ...prev,
        [activeFile.relativePath]: {
          ...session,
          content: value,
        },
      };
    });
  }, [activeFile]);

  const save = useCallback(async () => {
    if (!activeFile) return;
    setLoading(true);
    setError(null);
    try {
      await persistFileContent(activeFile.relativePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeFile, persistFileContent]);

  const closeFileInternal = useCallback(
    async (relativePath: string, shouldPersist: boolean) => {
      if (shouldPersist) {
        await persistFileContent(relativePath);
      }

      let closingIndex = -1;
      let nextOpenFiles: VaultFileEntry[] = [];

      setOpenFiles((prev) => {
        closingIndex = prev.findIndex((file) => file.relativePath === relativePath);
        if (closingIndex === -1) {
          nextOpenFiles = prev;
          return prev;
        }

        nextOpenFiles = prev.filter((file) => file.relativePath !== relativePath);
        return nextOpenFiles;
      });

      if (closingIndex === -1) return;

      setFileSessions((prev) => {
        if (!(relativePath in prev)) return prev;

        const next = { ...prev };
        delete next[relativePath];
        return next;
      });

      setActiveFile((prev) => {
        if (prev?.relativePath !== relativePath) {
          return prev;
        }

        if (nextOpenFiles.length === 0) {
          return null;
        }

        return nextOpenFiles[Math.min(closingIndex, nextOpenFiles.length - 1)];
      });
    },
    [persistFileContent],
  );

  const closeFile = useCallback(
    async (relativePath: string) => {
      await closeFileInternal(relativePath, true);
    },
    [closeFileInternal],
  );
  const closeAllFiles = useCallback(
    async (shouldPersist: boolean) => {
      if (shouldPersist) {
        for (const file of openFiles) {
          await persistFileContent(file.relativePath);
        }
      }
      setOpenFiles([]);
      setActiveFile(null);
      setFileSessions({}); 
    },
    [openFiles, persistFileContent],
  );

  const commitNewNote = useCallback(
    async (rawName: string) => {
      if (!vaultPath || !isTauriApp) return;
      const baseName = normalizeNoteBaseName(rawName);
      if (!baseName) {
        setError("请输入有效的文件名。");
        return;
      }
      if (
        baseName.includes("/") ||
        baseName.includes("\\") ||
        baseName === "." ||
        baseName === ".."
      ) {
        setError("文件名不能包含路径分隔符或为 . / ..。");
        return;
      }
      const base = baseName;
      const parent = sanitizeParentDir(noteParentDir);
      const underParent = parent ? `${parent}/${base}` : base;
      let relativePath = toMarkdownRelativePath(underParent);
      let n = 1;
      while (files.some((f) => f.relativePath === relativePath)) {
        const suffix = parent ? `${parent}/${baseName}` : baseName;
        relativePath = toMarkdownRelativePath(`${suffix}-${n}`);
        n += 1;
      }
      setLoading(true);
      setError(null);
      try {
        await createMarkdownFile(vaultPath, relativePath);
        await refreshFiles();
        const entry: VaultFileEntry = {
          relativePath,
          name: stripMarkdownExtension(relativePath.split("/").pop() ?? relativePath),
        };
        await loadFile(entry);
        setCreateNoteDialogOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, files, refreshFiles, loadFile, noteParentDir],
  );

  const commitNewFolder = useCallback(
    async (rawName: string) => {
      if (!vaultPath || !isTauriApp) return;
      const segment = rawName.trim();
      if (!segment) {
        setError("请输入有效的文件夹名称。");
        return;
      }
      if (
        segment.includes("/") ||
        segment.includes("\\") ||
        segment === "." ||
        segment === ".."
      ) {
        setError("文件夹名不能包含路径分隔符或为 . / ..。");
        return;
      }
      const parent = sanitizeParentDir(folderParentDir);
      const relativePath = parent ? `${parent}/${segment}` : segment;
      setLoading(true);
      setError(null);
      try {
        await createVaultDirectory(vaultPath, relativePath);
        await refreshFiles();
        setCreateFolderDialogOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, folderParentDir, refreshFiles],
  );

  const newNote = useCallback(() => {
    if (!vaultPath || !isTauriApp) {
      setError("请先打开知识库文件夹。");
      return;
    }
    setError(null);
    setNoteParentDir("");
    setCreateNoteDialogOpen(true);
  }, [vaultPath, isTauriApp]);

  const openNewNoteInDirectory = useCallback(
    (relativeParentDir: string) => {
      if (!vaultPath || !isTauriApp) {
        setError("请先打开知识库文件夹。");
        return;
      }
      setError(null);
      setNoteParentDir(sanitizeParentDir(relativeParentDir));
      setCreateNoteDialogOpen(true);
    },
    [vaultPath, isTauriApp],
  );

  const openNewFolderInDirectory = useCallback(
    (relativeParentDir: string) => {
      if (!vaultPath || !isTauriApp) {
        setError("请先打开知识库文件夹。");
        return;
      }
      setError(null);
      setFolderParentDir(sanitizeParentDir(relativeParentDir));
      setCreateFolderDialogOpen(true);
    },
    [vaultPath, isTauriApp],
  );

  const deleteNote = useCallback(
    async (relativePath: string) => {
      if (!vaultPath || !isTauriApp) {
        setError("请先打开知识库文件夹。");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await deleteVaultFile(vaultPath, relativePath);
        await closeFileInternal(relativePath, false);
        await refreshFiles();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, closeFileInternal, refreshFiles],
  );

  const deleteFolder = useCallback(
    async (relativePath: string) => {
      if (!vaultPath || !isTauriApp) {
        setError("请先打开知识库文件夹。");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await deleteVaultDirectory(vaultPath, relativePath);
        const pathsToClose = openFiles
          .filter(
            (file) =>
              file.relativePath === relativePath ||
              file.relativePath.startsWith(`${relativePath}/`),
          )
          .map((file) => file.relativePath);

        for (const path of pathsToClose) {
          await closeFileInternal(path, false);
        }
        await refreshFiles();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, openFiles, closeFileInternal, refreshFiles],
  );

  const renameNote = useCallback(
    async (relativePath: string, nextName: string) => {
      if (!vaultPath || !isTauriApp) {
        setError("请先打开知识库文件夹。");
        return;
      }

      const baseName = normalizeNoteBaseName(nextName);
      if (!baseName) {
        setError("请输入有效的文件名。");
        return;
      }
      if (
        baseName.includes("/") ||
        baseName.includes("\\") ||
        baseName === "." ||
        baseName === ".."
      ) {
        setError("文件名不能包含路径分隔符或为 . / ..。");
        return;
      }
      const targetFileName = baseName;

      const { parent, name } = splitRelativePath(relativePath);
      if (targetFileName === stripMarkdownExtension(name)) return;

      const nextRelativePath = toMarkdownRelativePath(
        parent ? `${parent}/${targetFileName}` : targetFileName,
      );

      setLoading(true);
      setError(null);
      try {
        if (activeFile?.relativePath === relativePath) {
          await persistActiveContent();
        }
        await renameVaultFile(vaultPath, relativePath, nextRelativePath);
        await refreshFiles();
        const renamedFile = {
          relativePath: nextRelativePath,
          name: baseName,
        };
        setOpenFiles((prev) =>
          prev.map((file) => (file.relativePath === relativePath ? renamedFile : file)),
        );
        setFileSessions((prev) => {
          const session = prev[relativePath];
          if (!session) return prev;

          const next = { ...prev };
          delete next[relativePath];
          next[nextRelativePath] = session;
          return next;
        });
        setActiveFile((prev) =>
          prev?.relativePath === relativePath ? renamedFile : prev,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, activeFile, persistActiveContent, refreshFiles],
  );

  const renameFolder = useCallback(
    async (relativePath: string, nextName: string) => {
      if (!vaultPath || !isTauriApp) {
        setError("请先打开知识库文件夹。");
        return;
      }

      const targetName = nextName.trim();
      if (!targetName) {
        setError("请输入有效的文件夹名称。");
        return;
      }
      if (
        targetName.includes("/") ||
        targetName.includes("\\") ||
        targetName === "." ||
        targetName === ".."
      ) {
        setError("文件夹名不能包含路径分隔符或为 . / ..。");
        return;
      }

      const { parent, name } = splitRelativePath(relativePath);
      if (targetName === name) return;

      const nextRelativePath = parent ? `${parent}/${targetName}` : targetName;

      setLoading(true);
      setError(null);
      try {
        const activePath = activeFile?.relativePath;
        const activeInsideFolder =
          activePath === relativePath || activePath?.startsWith(`${relativePath}/`);

        if (activeInsideFolder) {
          await persistActiveContent();
        }

        await renameVaultDirectory(vaultPath, relativePath, nextRelativePath);
        await refreshFiles();

        setOpenFiles((prev) =>
          prev.map((file) => {
            if (
              file.relativePath !== relativePath &&
              !file.relativePath.startsWith(`${relativePath}/`)
            ) {
              return file;
            }

            const suffix =
              file.relativePath === relativePath
                ? ""
                : file.relativePath.slice(relativePath.length);
            const updatedRelativePath = `${nextRelativePath}${suffix}`;

            return {
              relativePath: updatedRelativePath,
              name: stripMarkdownExtension(
                updatedRelativePath.split("/").pop() ?? updatedRelativePath,
              ),
            };
          }),
        );
        setFileSessions((prev) => {
          const next: Record<string, FileSessionState> = {};

          for (const [path, session] of Object.entries(prev)) {
            if (path !== relativePath && !path.startsWith(`${relativePath}/`)) {
              next[path] = session;
              continue;
            }

            const suffix = path === relativePath ? "" : path.slice(relativePath.length);
            next[`${nextRelativePath}${suffix}`] = session;
          }

          return next;
        });
        setActiveFile((prev) => {
          if (!prev) return prev;
          if (
            prev.relativePath !== relativePath &&
            !prev.relativePath.startsWith(`${relativePath}/`)
          ) {
            return prev;
          }

          const suffix =
            prev.relativePath === relativePath
              ? ""
              : prev.relativePath.slice(relativePath.length);
          const updatedRelativePath = `${nextRelativePath}${suffix}`;

          return {
            relativePath: updatedRelativePath,
            name: stripMarkdownExtension(
              updatedRelativePath.split("/").pop() ?? updatedRelativePath,
            ),
          };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, activeFile, persistActiveContent, refreshFiles],
  );

  useEffect(() => {
    if (files.length === 0) return;

    const fileMap = new Map(files.map((file) => [file.relativePath, file]));

    setOpenFiles((prev) =>
      prev.map((file) => fileMap.get(file.relativePath) ?? file),
    );
    setActiveFile((prev) => (prev ? (fileMap.get(prev.relativePath) ?? prev) : prev));
  }, [files]);

  const value = useMemo<VaultContextValue>(
    () => ({
      vaultPath,
      activeFile,
      openFiles,
      content,
      dirty,
      loading,
      saving,
      error,
      setContent,
      save,
      selectFile,
      closeFile,
      closeAllFiles,
      renameNote,
      isTauriApp,
    }),
    [
      vaultPath,
      activeFile,
      openFiles,
      content,
      dirty,
      loading,
      saving,
      error,
      setContent,
      save,
      selectFile,
      closeFile,
      closeAllFiles,
      renameNote,
      isTauriApp,
    ],
  );

  const explorerValue = useMemo<VaultExplorerContextValue>(
    () => ({
      vaultPath,
      directories,
      files,
      activeFile,
      loading,
      error,
      openVaultFolder,
      refreshFiles,
      selectFile,
      newNote,
      openNewNoteInDirectory,
      openNewFolderInDirectory,
      deleteNote,
      deleteFolder,
      renameNote,
      renameFolder,
      isTauriApp,
    }),
    [
      vaultPath,
      directories,
      files,
      activeFile,
      loading,
      error,
      openVaultFolder,
      refreshFiles,
      selectFile,
      newNote,
      openNewNoteInDirectory,
      openNewFolderInDirectory,
      deleteNote,
      deleteFolder,
      renameNote,
      renameFolder,
      isTauriApp,
    ],
  );

  return (
    <VaultExplorerContext.Provider value={explorerValue}>
      <VaultContext.Provider value={value}>
        {children}
        <CreateFileDialog
          open={createNoteDialogOpen}
          onOpenChange={setCreateNoteDialogOpen}
          onCreate={commitNewNote}
          loading={loading}
          parentRelativePath={noteParentDir || undefined}
        />
        <CreateFolderDialog
          open={createFolderDialogOpen}
          onOpenChange={setCreateFolderDialogOpen}
          onCreate={commitNewFolder}
          loading={loading}
          parentRelativePath={folderParentDir || undefined}
        />
      </VaultContext.Provider>
    </VaultExplorerContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within VaultProvider");
  }
  return ctx;
}

export function useVaultExplorer() {
  const ctx = useContext(VaultExplorerContext);
  if (!ctx) {
    throw new Error("useVaultExplorer must be used within VaultProvider");
  }
  return ctx;
}
