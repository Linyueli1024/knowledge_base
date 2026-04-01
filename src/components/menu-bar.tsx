import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useAppUpdater } from "@/context/app-updater-context";
import { useVaultExplorer } from "@/context/vault-context";
import { UpdateControls } from "./update-controls";

export function MenubarDemo() {
  const { openVaultFolder, newNote, isTauriApp } = useVaultExplorer();
  // const { checkForUpdates, status } = useAppUpdater();

  return (
    <Menubar className="h-8 w-full rounded-none justify-between">
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

      {/* <MenubarMenu>
        <MenubarTrigger>更新</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem
              disabled={!isTauriApp}
              onClick={() => void checkForUpdates()}
            >
              检查更新
            </MenubarItem>
            {status.message ? (
              <>
                <MenubarSeparator />
                <MenubarItem disabled>{status.message}</MenubarItem>
              </>
            ) : null}
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu> */}
      <UpdateControls />
    </Menubar>
  );
}
