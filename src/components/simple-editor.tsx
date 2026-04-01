import { useEffect, useState } from "react";
import { Bot, FileText, Settings2 } from "lucide-react";

import { AgentSettingsDialog } from "@/components/agent-settings-dialog";
import { AgentChatSidebar } from "@/components/agent-chat-sidebar";
import { EditableNoteTitle } from "@/components/editable-note-title";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useVault } from "@/context/vault-context";
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
import { cn } from "@/lib/utils";
import { stripMarkdownExtensionFromPath } from "@/lib/vault-bridge";

/** 与 Tailwind `xl`（1280px）一致：以上并排侧栏，以下用抽屉避免 Agent 堆在编辑器下方 */
const AGENT_DOCK_MIN_PX = 1280;

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

  const isAgentDocked = useIsBreakpoint("min", AGENT_DOCK_MIN_PX);
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);

  useEffect(() => {
    if (isAgentDocked) {
      setAgentSheetOpen(false);
    }
  }, [isAgentDocked]);

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
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 bg-background",
        isAgentDocked ? "flex-row" : "flex-col",
      )}
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="min-w-0 flex-1">
            <EditableNoteTitle className="h-8 border-0 bg-transparent px-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-0" />
            {activeFile ? (
              <p className="truncate text-xs text-muted-foreground">
                {stripMarkdownExtensionFromPath(activeFile.relativePath)}
                {saving ? " · 保存中" : dirty ? " · 正在同步" : " · 已保存"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                在左侧选择笔记
              </p>
            )}
          </div>
          {!isAgentDocked ? (
            <div className="flex shrink-0 items-center gap-2">
              <AgentSettingsDialog
                trigger={
                  <Button type="button" variant="outline" size="icon-sm" className="shrink-0">
                    <Settings2 className="size-4" />
                    <span className="sr-only">Open agent settings</span>
                  </Button>
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setAgentSheetOpen(true)}
              >
                <Bot className="size-4" />
                Agent
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <p className="shrink-0 px-4 py-2 text-sm text-destructive">{error}</p> : null}

        <div className="min-h-0 flex-1">
          {activeFile ? (
            <SimpleEditor
              key={activeFile.relativePath}
              documentId={activeFile.relativePath}
              initialMarkdown={content}
              noteRelativePath={activeFile.relativePath}
              vaultPath={vaultPath}
              editable={!loading}
              onMarkdownChange={setContent}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              在左侧选择笔记，或使用菜单新建
            </div>
          )}
        </div>
      </section>

      {isAgentDocked ? (
        <aside className="flex h-full min-h-0 w-[23rem] shrink-0 border-l border-sidebar-border bg-sidebar">
          <AgentChatSidebar activePath={activeFile?.relativePath} noteContent={content} />
        </aside>
      ) : (
        <Sheet open={agentSheetOpen} onOpenChange={setAgentSheetOpen}>
          <SheetContent
            side="right"
            showCloseButton
            className="flex h-full min-h-0 w-[min(100vw,23rem)] max-w-[23rem] flex-col gap-0 border-l border-sidebar-border bg-sidebar p-0 sm:max-w-[23rem]"
          >
            <AgentChatSidebar activePath={activeFile?.relativePath} noteContent={content} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
