import "./App.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { MenubarDemo } from "./components/menu-bar";
import { VaultProvider } from "@/context/vault-context";
import { MarkdownEditor } from "@/components/markdown-editor";

function App({ children }: { children?: React.ReactNode }) {
  return (
    <VaultProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <MenubarDemo />

        <SidebarProvider className="flex flex-1 min-h-0">
          <AppSidebar />

          <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
            <SidebarTrigger />
            {children ?? <MarkdownEditor />}
          </main>
        </SidebarProvider>
      </div>
    </VaultProvider>
  );
}

export default App;
