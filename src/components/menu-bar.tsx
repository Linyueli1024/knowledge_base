import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useVault } from "@/context/vault-context";

export function MenubarDemo() {
  const { openVaultFolder, newNote, save, activeFile, dirty, isTauriApp } =
    useVault();

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
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem
              disabled={!isTauriApp || !activeFile || !dirty}
              onClick={() => void save()}
            >
              保存 <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>编辑</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem
              disabled={!isTauriApp}
              onClick={() => void save()}
            >
              保存笔记
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
