import { useEffect } from "react";
import { useVault } from "@/context/vault-context";
import { Button } from "@/components/ui/button";
import { Save, FileText } from "lucide-react";

export function MarkdownEditor() {
  const {
    vaultPath,
    activeFile,
    content,
    setContent,
    save,
    dirty,
    loading,
    error,
    isTauriApp,
  } = useVault();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  if (!isTauriApp) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <FileText className="size-10 opacity-50" />
        <p>使用 <code className="text-foreground">yarn tauri dev</code> 启动桌面版以管理本地 Markdown 笔记。</p>
      </div>
    );
  }

  if (!vaultPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <FileText className="size-10 opacity-50" />
        <p>请通过菜单 <span className="text-foreground">文件 → 打开知识库文件夹</span> 选择一个目录作为笔记库。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-2 p-4 pt-2">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium text-foreground">
            {activeFile ? activeFile.name : "未打开文件"}
          </h1>
          {activeFile ? (
            <p className="truncate text-xs text-muted-foreground">
              {activeFile.relativePath}
              {dirty ? " · 未保存" : " · 已保存"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              在左侧选择笔记，或使用菜单新建
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!activeFile || loading || !dirty}
          onClick={() => void save()}
        >
          <Save className="size-4" />
          保存
        </Button>
      </div>
      {error ? (
        <p className="shrink-0 text-sm text-destructive">{error}</p>
      ) : null}
      <textarea
        className="min-h-0 w-full flex-1 resize-none rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        spellCheck={false}
        placeholder={activeFile ? "在此编辑 Markdown…" : "请先打开或新建笔记"}
        value={content}
        disabled={!activeFile || loading}
        onChange={(e) => setContent(e.target.value)}
      />
    </div>
  );
}
