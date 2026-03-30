import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  createMarkdownFile,
  listMarkdown,
  readMarkdownFile,
  writeMarkdownFile,
  type VaultFileEntry,
} from "@/lib/vault-bridge";

const VAULT_STORAGE_KEY = "knowledge-base-vault-path";

type VaultContextValue = {
  vaultPath: string | null;
  files: VaultFileEntry[];
  activeFile: VaultFileEntry | null;
  content: string;
  dirty: boolean;
  loading: boolean;
  error: string | null;
  openVaultFolder: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  selectFile: (file: VaultFileEntry) => Promise<void>;
  setContent: (value: string) => void;
  save: () => Promise<void>;
  newNote: () => Promise<void>;
  isTauriApp: boolean;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultPath, setVaultPath] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VAULT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [files, setFiles] = useState<VaultFileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<VaultFileEntry | null>(null);
  const [content, setContentState] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTauriApp = isTauri();

  const dirty = content !== savedContent;

  const refreshFiles = useCallback(async () => {
    if (!vaultPath || !isTauriApp) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listMarkdown(vaultPath);
      setFiles(list);
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
      if (dirty) {
        const ok = window.confirm("当前笔记未保存，确定切换文件？未保存的修改将丢失。");
        if (!ok) return;
      }
      await loadFile(file);
    },
    [vaultPath, isTauriApp, dirty, loadFile],
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

  const newNote = useCallback(async () => {
    if (!vaultPath || !isTauriApp) {
      setError("请先打开知识库文件夹。");
      return;
    }
    let base =
      window.prompt("新笔记文件名（可不含 .md，将自动补全）", "未命名")?.trim() ??
      "";
    if (!base) return;
    if (!base.toLowerCase().endsWith(".md")) {
      base = `${base}.md`;
    }
    let relativePath = base;
    let n = 1;
    while (files.some((f) => f.relativePath === relativePath)) {
      const stem = base.replace(/\.md$/i, "");
      relativePath = `${stem}-${n}.md`;
      n += 1;
    }
    setLoading(true);
    setError(null);
    try {
      await createMarkdownFile(vaultPath, relativePath);
      await refreshFiles();
      const entry: VaultFileEntry = {
        relativePath,
        name: relativePath.split("/").pop() ?? relativePath,
      };
      await loadFile(entry);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [vaultPath, isTauriApp, files, refreshFiles, loadFile]);

  const value = useMemo<VaultContextValue>(
    () => ({
      vaultPath,
      files,
      activeFile,
      content,
      dirty,
      loading,
      error,
      openVaultFolder,
      refreshFiles,
      selectFile,
      setContent,
      save,
      newNote,
      isTauriApp,
    }),
    [
      vaultPath,
      files,
      activeFile,
      content,
      dirty,
      loading,
      error,
      openVaultFolder,
      refreshFiles,
      selectFile,
      setContent,
      save,
      newNote,
      isTauriApp,
    ],
  );

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within VaultProvider");
  }
  return ctx;
}
