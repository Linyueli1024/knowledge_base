import { FileText } from "lucide-react";

import { EditableNoteTitle } from "@/components/editable-note-title";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { useVault } from "@/context/vault-context";
import { stripMarkdownExtensionFromPath } from "@/lib/vault-bridge";

export function SimpleEditorComponent() {
  const {
    vaultPath,
    activeFile,
    content,
    setContent,
    dirty,
    loading,
    saving,
    error,
    isTauriApp,
  } = useVault();

  if (!isTauriApp) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <FileText className="size-10 opacity-50" />
        <p>
          使用 <code className="text-foreground">yarn tauri dev</code> 启动桌面版以管理本地
          Markdown 笔记。
        </p>
      </div>
    );
  }

  if (!vaultPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <FileText className="size-10 opacity-50" />
        <p>
          请通过菜单 <span className="text-foreground">文件 → 打开知识库文件夹</span>{" "}
          选择一个目录作为笔记库。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <EditableNoteTitle className="h-8 border-0 bg-transparent px-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-0" />
          {activeFile ? (
            <p className="truncate text-xs text-muted-foreground">
              {stripMarkdownExtensionFromPath(activeFile.relativePath)}
              {saving ? " · 保存中" : dirty ? " · 正在同步" : " · 已保存"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">在左侧选择笔记，或使用菜单新建</p>
          )}
        </div>
      </div>

      {error ? <p className="shrink-0 px-4 py-2 text-sm text-destructive">{error}</p> : null}

      <div className="min-h-0 flex-1">
        {activeFile ? (
          <SimpleEditor
            key={activeFile.relativePath}
            documentId={activeFile.relativePath}
            initialMarkdown={content}
            editable={!loading}
            onMarkdownChange={setContent}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            在左侧选择笔记，或使用菜单新建
          </div>
        )}
      </div>
    </div>
  );
}
