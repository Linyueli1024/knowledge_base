import "./App.css";
import { AgentSettingsDialog } from "@/components/agent-settings-dialog";
import { UpdateControls } from "@/components/update-controls";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { MenubarDemo } from "./components/menu-bar";
import { AppUpdaterProvider } from "@/context/app-updater-context";
import { VaultProvider } from "@/context/vault-context";
// import { MarkdownEditor } from "@/components/markdown-editor";
import { SimpleEditorComponent } from "@/components/simple-editor";

function App({ children }: { children?: React.ReactNode }) {
  return (
    <AppUpdaterProvider>
      <VaultProvider>
        <div className="flex h-screen w-screen flex-col overflow-hidden">
          <MenubarDemo />

          <SidebarProvider className="flex flex-1 min-h-0">
            <AppSidebar />

            <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <UpdateControls />
                  <AgentSettingsDialog />
                </div>
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
