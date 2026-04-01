import "./App.css";
import { AgentSettingsDialog } from "@/components/agent-settings-dialog";
import { FileTabs } from "@/components/file-tabs";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { MenubarDemo } from "./components/menu-bar";
import { AppUpdaterProvider } from "@/context/app-updater-context";
import { VaultProvider } from "@/context/vault-context";
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
import { SimpleEditorComponent } from "@/components/simple-editor";

const AGENT_DOCK_MIN_PX = 1280;

function App({ children }: { children?: React.ReactNode }) {
  const isAgentDocked = useIsBreakpoint("min", AGENT_DOCK_MIN_PX);

  return (
    <AppUpdaterProvider>
      <VaultProvider>
        <div className="flex h-screen w-screen flex-col overflow-hidden">
          <MenubarDemo />
          <SidebarProvider className="flex flex-1 min-h-0">
            <AppSidebar />

            <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center border-b border-border">
                <div className="flex shrink-0 items-center px-3 py-2">
                  <SidebarTrigger />
                </div>
                <div className="min-w-0 flex-1 border-l border-border px-4 py-2">
                  <FileTabs />
                </div>
                {isAgentDocked ? (
                  <div className="flex w-[23rem] shrink-0 items-center justify-between gap-3 border-l border-sidebar-border bg-sidebar px-4 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground">Agent 工作区</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <AgentSettingsDialog />
                    </div>
                  </div>
                ) : null}
              </div>
              {children ?? <SimpleEditorComponent />}
            </main>
          </SidebarProvider>
        </div>
      </VaultProvider>
    </AppUpdaterProvider>
  );
}

export default App;
