import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useVaultExplorer } from "@/context/vault-context";

export function MenubarDemo() {
  const { openVaultFolder, newNote, isTauriApp } = useVaultExplorer();

  return (
    <Menubar className="h-8 w-full rounded-none">
      <MenubarMenu>
        <MenubarTrigger>文件</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem
              disabled={!isTauriApp}
              onClick={() => void openVaultFolder()}
            >
              打开知识库文件夹…
            </MenubarItem>
            <MenubarItem
              disabled={!isTauriApp}
              onClick={() => void newNote()}
            >
              新建笔记
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
