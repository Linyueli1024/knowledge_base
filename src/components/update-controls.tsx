import { RefreshCw } from "lucide-react";
import { useAppUpdater } from "@/context/app-updater-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getButtonLabel(isBusy: boolean, message: string) {
  if (!isBusy) {
    return "检查更新";
  }

  if (message.includes("下载") || message.includes("安装") || message.includes("重启")) {
    return "更新中...";
  }

  return "检查中...";
}

export function UpdateControls() {
  const { checkForUpdates, isBusy, isTauriApp, status } = useAppUpdater();

  if (!isTauriApp) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {status.message ? (
        <span
          className={cn(
            "max-w-72 truncate text-xs",
            status.phase === "error" ? "text-destructive" : "text-muted-foreground",
          )}
          title={status.message}
        >
          {status.message}
        </span>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        disabled={isBusy}
        onClick={() => void checkForUpdates()}
      >
        <RefreshCw className={cn("size-3.5", isBusy && "animate-spin")} />
        {getButtonLabel(isBusy, status.message)}
      </Button>
    </div>
  );
}
