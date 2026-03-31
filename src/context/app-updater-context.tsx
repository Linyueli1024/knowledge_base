import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

type UpdatePhase =
  | "idle"
  | "checking"
  | "upToDate"
  | "downloading"
  | "installing"
  | "relaunching"
  | "error";

type UpdateStatus = {
  phase: UpdatePhase;
  message: string;
  version?: string;
  downloadedBytes?: number;
  contentLength?: number;
};

type CheckOptions = {
  silentIfNoUpdate?: boolean;
  silentIfError?: boolean;
};

type AppUpdaterContextValue = {
  isTauriApp: boolean;
  isBusy: boolean;
  status: UpdateStatus;
  checkForUpdates: (options?: CheckOptions) => Promise<{ hasUpdate: boolean; version?: string }>;
};

const defaultStatus: UpdateStatus = {
  phase: "idle",
  message: "",
};

const AppUpdaterContext = createContext<AppUpdaterContextValue | null>(null);

let startupCheckTriggered = false;

export function AppUpdaterProvider({ children }: { children: ReactNode }) {
  const isTauriApp = isTauri();
  const [status, setStatus] = useState<UpdateStatus>(defaultStatus);
  const [isBusy, setIsBusy] = useState(false);

  const checkForUpdates = useCallback(
    async ({ silentIfNoUpdate = false, silentIfError = false }: CheckOptions = {}) => {
      if (!isTauriApp || isBusy) {
        return { hasUpdate: false };
      }

      setIsBusy(true);
      setStatus({
        phase: "checking",
        message: "正在检查更新...",
      });

      try {
        const update = await check();

        if (!update) {
          setStatus(
            silentIfNoUpdate
              ? defaultStatus
              : {
                  phase: "upToDate",
                  message: "当前已经是最新版本",
                },
          );
          return { hasUpdate: false };
        }

        let downloadedBytes = 0;
        let contentLength = 0;

        setStatus({
          phase: "downloading",
          message: `发现新版本 ${update.version}，正在下载...`,
          version: update.version,
          downloadedBytes,
          contentLength,
        });

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              contentLength = event.data.contentLength ?? 0;
              setStatus({
                phase: "downloading",
                message: `发现新版本 ${update.version}，正在下载...`,
                version: update.version,
                downloadedBytes,
                contentLength,
              });
              break;
            case "Progress":
              downloadedBytes += event.data.chunkLength;
              setStatus({
                phase: "downloading",
                message:
                  contentLength > 0
                    ? `正在下载更新 ${downloadedBytes}/${contentLength} 字节`
                    : "正在下载更新...",
                version: update.version,
                downloadedBytes,
                contentLength,
              });
              break;
            case "Finished":
              setStatus({
                phase: "installing",
                message: `更新 ${update.version} 下载完成，正在安装...`,
                version: update.version,
                downloadedBytes,
                contentLength,
              });
              break;
          }
        });

        setStatus({
          phase: "relaunching",
          message: `更新 ${update.version} 已安装，正在重启应用...`,
          version: update.version,
        });

        await relaunch();

        return { hasUpdate: true, version: update.version };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (silentIfError) {
          setStatus(defaultStatus);
        } else {
          const normalizedMessage = message.includes("Could not fetch a valid release JSON")
            ? "更新失败：未能获取有效的 latest.json，请确认 GitHub Release 已上传 updater 产物，并且该地址可直接访问。"
            : `更新失败：${message}`;

          setStatus({
            phase: "error",
            message: normalizedMessage,
          });
        }
        return { hasUpdate: false };
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, isTauriApp],
  );

  useEffect(() => {
    if (!isTauriApp || startupCheckTriggered) {
      return;
    }

    startupCheckTriggered = true;
    void checkForUpdates({ silentIfNoUpdate: true, silentIfError: true });
  }, [checkForUpdates, isTauriApp]);

  const value = useMemo<AppUpdaterContextValue>(
    () => ({
      isTauriApp,
      isBusy,
      status,
      checkForUpdates,
    }),
    [checkForUpdates, isBusy, isTauriApp, status],
  );

  return <AppUpdaterContext.Provider value={value}>{children}</AppUpdaterContext.Provider>;
}

export function useAppUpdater() {
  const context = useContext(AppUpdaterContext);

  if (!context) {
    throw new Error("useAppUpdater must be used within an AppUpdaterProvider");
  }

  return context;
}
