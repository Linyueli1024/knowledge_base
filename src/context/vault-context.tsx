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

type VaultContextValue = {
  vaultPath: string | null;
  activeFile: VaultFileEntry | null;
  content: string;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setContent: (value: string) => void;
  save: () => Promise<void>;
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
  const [content, setContentState] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createNoteDialogOpen, setCreateNoteDialogOpen] = useState(false);
  const [noteParentDir, setNoteParentDir] = useState("");
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [folderParentDir, setFolderParentDir] = useState("");

  const isTauriApp = isTauri();
  const autosaveTimerRef = useRef<number | null>(null);

  const dirty = content !== savedContent;

  const persistActiveContent = useCallback(async () => {
    if (!vaultPath || !activeFile || !isTauriApp) return;
    if (!dirty) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setSaving(true);
    try {
      await writeMarkdownFile(vaultPath, activeFile.relativePath, content);
      setSavedContent(content);
    } finally {
      setSaving(false);
    }
  }, [vaultPath, activeFile, isTauriApp, dirty, content]);

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
      void writeMarkdownFile(vaultPath, activeFile.relativePath, content)
        .then(() => {
          setSavedContent(content);
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
      setLoading(true);
      setError(null);
      try {
        const text = await readMarkdownFile(vaultPath, file.relativePath);
        setActiveFile(file);
        setContentState(text);
        setSavedContent(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp],
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
    setContentState("");
    setSavedContent("");
  }, [isTauriApp]);

  const selectFile = useCallback(
    async (file: VaultFileEntry) => {
      if (!vaultPath || !isTauriApp) return;
      await loadFile(file);
    },
    [vaultPath, isTauriApp, loadFile],
  );

  const setContent = useCallback((value: string) => {
    setContentState(value);
  }, []);

  const save = useCallback(async () => {
    if (!vaultPath || !activeFile || !isTauriApp) return;
    setLoading(true);
    setError(null);
    try {
      await writeMarkdownFile(vaultPath, activeFile.relativePath, content);
      setSavedContent(content);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [vaultPath, activeFile, content, isTauriApp]);

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
      let relativePath = underParent;
      let n = 1;
      while (files.some((f) => f.relativePath === relativePath)) {
        const suffix = parent ? `${parent}/${baseName}` : baseName;
        relativePath = `${suffix}-${n}`;
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
        if (activeFile?.relativePath === relativePath) {
          setActiveFile(null);
          setContentState("");
          setSavedContent("");
        }
        await refreshFiles();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, activeFile, refreshFiles],
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
        if (
          activeFile &&
          (activeFile.relativePath === relativePath ||
            activeFile.relativePath.startsWith(`${relativePath}/`))
        ) {
          setActiveFile(null);
          setContentState("");
          setSavedContent("");
        }
        await refreshFiles();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, activeFile, refreshFiles],
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
      if (targetFileName === name) return;

      const nextRelativePath = parent ? `${parent}/${targetFileName}` : targetFileName;

      setLoading(true);
      setError(null);
      try {
        if (activeFile?.relativePath === relativePath) {
          await persistActiveContent();
        }
        await renameVaultFile(vaultPath, relativePath, nextRelativePath);
        await refreshFiles();
        if (activeFile?.relativePath === relativePath) {
          setActiveFile({
            relativePath: nextRelativePath,
            name: baseName,
          });
        }
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

        if (activePath && activeInsideFolder) {
          const suffix = activePath === relativePath ? "" : activePath.slice(relativePath.length);
          const updatedRelativePath = `${nextRelativePath}${suffix}`;
          setActiveFile({
            relativePath: updatedRelativePath,
            name: stripMarkdownExtension(
              updatedRelativePath.split("/").pop() ?? updatedRelativePath,
            ),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [vaultPath, isTauriApp, activeFile, persistActiveContent, refreshFiles],
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      vaultPath,
      activeFile,
      content,
      dirty,
      loading,
      saving,
      error,
      setContent,
      save,
      renameNote,
      isTauriApp,
    }),
    [
      vaultPath,
      activeFile,
      content,
      dirty,
      loading,
      saving,
      error,
      setContent,
      save,
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
