import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { CollapsibleFileTree } from "./file-tree";

export function AppSidebar() {
  return (
    <Sidebar layout="inline" className="h-full shrink-0">
      <SidebarContent className="h-full overflow-hidden">
        <CollapsibleFileTree />
      </SidebarContent>
    </Sidebar>
  );
}
