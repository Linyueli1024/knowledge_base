import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_OPEN_FILES, useVault } from "@/context/vault-context";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";
import { Button } from "./ui/button";

export function FileTabs() {
  const { openFiles, activeFile, dirty, selectFile, closeFile, closeAllFiles } = useVault();
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="flex flex-1 items-center gap-2 min-w-0">
      <div
        ref={tabsScrollRef}
        className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto border-border"
        onWheel={(event) => {
          const container = tabsScrollRef.current;
          if (!container) return;

          const nextDelta =
            Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

          if (nextDelta === 0) return;

          event.preventDefault();
          container.scrollLeft += nextDelta;
        }}
      >
        {openFiles.length > 0 ? (
          openFiles.map((file) => {
            const isActive = activeFile?.relativePath === file.relativePath;

            return (
              <div
                key={file.relativePath}
                className={cn(
                  "group flex h-8 shrink-0 items-center rounded-md border text-sm transition-colors",
                  isActive
                    ? "border-border bg-background text-foreground"
                    : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center px-3"
                  title={file.relativePath}
                  onClick={() => void selectFile(file)}
                >
                  <span className="max-w-44 truncate">{file.name}</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "mr-1 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                    isActive && dirty ? "text-foreground" : "",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    void closeFile(file.relativePath);
                  }}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })
        ) : null}
      </div>
      {
        openFiles.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={openFiles.length === 0}
                title="查看已打开文件"
              >
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 pt-0">
              <DropdownMenuLabel className="sticky top-0 z-10 -mx-1 border-b bg-popover px-2.5 py-2 text-[11px]">
                已打开文件 {openFiles.length}
              </DropdownMenuLabel>
              <DropdownMenuItem className="gap-1 px-1" onSelect={() => void closeAllFiles(true)}>
                <X className="size-3" />
                <span>全部关闭</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {openFiles.map((file) => {
                const isActive = activeFile?.relativePath === file.relativePath;

                return (
                  <DropdownMenuItem
                    key={file.relativePath}
                    className="gap-2"
                    onSelect={() => void selectFile(file)}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full bg-border",
                        isActive ? "bg-foreground" : "bg-muted-foreground/50",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{file.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {file.relativePath}
                      </div>
                    </div>
                    {isActive ? (
                      <span className="shrink-0 text-xs text-muted-foreground">当前</span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
    </div>
  );
}
