import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { CollapsibleFileTree } from "./file-tree";

export function AppSidebar() {
  return (
    <Sidebar className="fixed bottom-0 top-[32px] h-full">
      <SidebarContent className="h-full overflow-auto">
        <CollapsibleFileTree />
      </SidebarContent>
    </Sidebar>
  );
}
