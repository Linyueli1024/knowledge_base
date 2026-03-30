import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRightIcon, FileIcon, FolderIcon, Plus, RefreshCw } from "lucide-react";
import { confirm } from "@tauri-apps/plugin-dialog";

import { RenameEntryDialog } from "@/components/rename-entry-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVaultExplorer } from "@/context/vault-context";
import {
  stripMarkdownExtension,
  type VaultDirectoryEntry,
  type VaultFileEntry,
} from "@/lib/vault-bridge";

type DirNode = { kind: "dir"; name: string; path: string; children: TreeNode[] };
type FileNode = { kind: "file" } & VaultFileEntry;
type TreeNode = DirNode | FileNode;
type RenameTarget =
  | { kind: "dir"; path: string; name: string }
  | { kind: "file"; path: string; name: string };

function getAncestorPaths(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let i = 1; i < parts.length; i += 1) {
    ancestors.push(parts.slice(0, i).join("/"));
  }

  return ancestors;
}

function buildTree(
  directories: VaultDirectoryEntry[],
  files: VaultFileEntry[],
): TreeNode[] {
  type Branch = { dirs: Map<string, Branch>; files: VaultFileEntry[] };
  const root: Branch = { dirs: new Map(), files: [] };

  function ensureBranch(path: string): Branch {
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    let cur = root;
    for (const dir of parts) {
      if (!cur.dirs.has(dir)) {
        cur.dirs.set(dir, { dirs: new Map(), files: [] });
      }
      cur = cur.dirs.get(dir)!;
    }
    return cur;
  }

  for (const dir of directories) {
    ensureBranch(dir.relativePath);
  }

  for (const f of files) {
    const parts = f.relativePath.replace(/\\/g, "/").split("/");
    const fileName = parts.pop();
    if (!fileName) continue;
    const cur = ensureBranch(parts.join("/"));
    cur.files.push({ ...f, name: stripMarkdownExtension(fileName) });
  }

  function branchToNodes(branch: Branch, prefix: string): TreeNode[] {
    const nodes: TreeNode[] = [];
    const dirEntries = [...branch.dirs.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "zh-CN"),
    );
    for (const [name, sub] of dirEntries) {
      const path = prefix ? `${prefix}/${name}` : name;
      nodes.push({
        kind: "dir",
        name,
        path,
        children: branchToNodes(sub, path),
      });
    }
    const sortedFiles = [...branch.files].sort((a, b) =>
      a.name.localeCompare(b.name, "zh-CN"),
    );
    for (const file of sortedFiles) {
      nodes.push({ kind: "file", ...file });
    }
    return nodes;
  }

  return branchToNodes(root, "");
}

function getParentPathLabel(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/") || "知识库根目录";
}

export function CollapsibleFileTree() {
  const {
    directories,
    files,
    activeFile,
    selectFile,
    vaultPath,
    refreshFiles,
    newNote,
    openNewNoteInDirectory,
    openNewFolderInDirectory,
    deleteNote,
    deleteFolder,
    renameNote,
    renameFolder,
    loading,
    isTauriApp,
  } = useVaultExplorer();
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);

  const tree = useMemo(() => buildTree(directories, files), [directories, files]);

  useEffect(() => {
    setExpandedDirs(new Set());
  }, [vaultPath]);

  useEffect(() => {
    if (!activeFile) return;

    const ancestorPaths = getAncestorPaths(activeFile.relativePath);
    if (ancestorPaths.length === 0) return;

    setExpandedDirs((prev) => {
      let changed = false;
      const next = new Set(prev);

      for (const path of ancestorPaths) {
        if (!next.has(path)) {
          next.add(path);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [activeFile]);

  const setDirOpen = useCallback((path: string, open: boolean) => {
    setExpandedDirs((prev) => {
      const alreadyOpen = prev.has(path);
      if (alreadyOpen === open) return prev;

      const next = new Set(prev);
      if (open) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

  const confirmDeleteFolder = async (node: DirNode) => {
    const ok = await confirm(`确定删除文件夹“${node.name}”吗？其中内容会一并删除。`, {
      title: "删除文件夹",
      kind: "warning",
      okLabel: "删除",
      cancelLabel: "取消",
    });
    if (ok) {
      await deleteFolder(node.path);
    }
  };

  const confirmDeleteFile = async (node: FileNode) => {
    const ok = await confirm(`确定删除文件“${node.name}”吗？`, {
      title: "删除文件",
      kind: "warning",
      okLabel: "删除",
      cancelLabel: "取消",
    });
    if (ok) {
      await deleteNote(node.relativePath);
    }
  };

  const handleRenameConfirm = useCallback(
    async (nextName: string) => {
      if (!renameTarget) return;

      try {
        if (renameTarget.kind === "dir") {
          await renameFolder(renameTarget.path, nextName);
        } else {
          await renameNote(renameTarget.path, nextName);
        }

        setRenameTarget(null);
      } catch {
        // Keep the dialog open so the user can adjust the name and retry.
      }
    },
    [renameFolder, renameNote, renameTarget],
  );

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.kind === "dir") {
      const isOpen = expandedDirs.has(node.path);

      return (
        <div
          key={node.path}
          className="w-full"
          onContextMenu={(e) => e.stopPropagation()}
        >
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="w-full">
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) => setDirOpen(node.path, open)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="group w-full justify-start transition-none hover:bg-accent hover:text-accent-foreground"
                      style={{ paddingLeft: 8 + depth * 12 }}
                    >
                      <ChevronRightIcon className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                      <FolderIcon className="size-4 shrink-0" />
                      <span className="truncate">{node.name}</span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1">
                    <div className="flex flex-col gap-0.5">
                      {node.children.map((child) => renderNode(child, depth + 1))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel>{node.name}</ContextMenuLabel>
              <ContextMenuItem
                disabled={loading}
                onSelect={() => openNewNoteInDirectory(node.path)}
              >
                新建笔记
              </ContextMenuItem>
              <ContextMenuItem
                disabled={loading}
                onSelect={() => openNewFolderInDirectory(node.path)}
              >
                新建文件夹
              </ContextMenuItem>
              <ContextMenuItem
                disabled={loading}
                onSelect={() =>
                  setRenameTarget({ kind: "dir", path: node.path, name: node.name })
                }
              >
                重命名
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={loading}
                onSelect={() => void confirmDeleteFolder(node)}
              >
                删除文件夹
              </ContextMenuItem>
              <ContextMenuItem disabled={loading} onSelect={() => void refreshFiles()}>
                刷新
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      );
    }

    const selected = activeFile?.relativePath === node.relativePath;
    return (
      <div
        key={node.relativePath}
        className="w-full"
        onContextMenu={(e) => e.stopPropagation()}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Button
              variant={selected ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start gap-2 font-normal"
              style={{ paddingLeft: 12 + depth * 12 }}
              disabled={loading}
              onClick={() => void selectFile(node)}
            >
              <FileIcon className="size-4 shrink-0 opacity-70" />
              <span className="truncate">{node.name}</span>
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>{node.name}</ContextMenuLabel>
            <ContextMenuItem
              disabled={loading}
              onSelect={() =>
                setRenameTarget({
                  kind: "file",
                  path: node.relativePath,
                  name: node.name,
                })
              }
            >
              重命名
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={loading}
              onSelect={() => void confirmDeleteFile(node)}
            >
              删除文件
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={loading} onSelect={() => void refreshFiles()}>
              刷新
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  };

  const explorerBody =
    !isTauriApp ? (
      <p className="px-2 text-xs text-muted-foreground">桌面版下可用</p>
    ) : !vaultPath ? (
      <p className="px-2 text-xs text-muted-foreground">请先打开知识库文件夹</p>
    ) : tree.length === 0 ? (
      <p className="px-2 text-xs text-muted-foreground">暂无内容，点击「新建」或右键此处创建</p>
    ) : (
      <div className="flex flex-col gap-0.5 w-full">{tree.map((n) => renderNode(n, 0))}</div>
    );

  return (
    <Card className="mx-auto h-full w-full gap-2 rounded-none border-0 shadow-none" size="sm">
      <CardHeader className="gap-2 pb-2">
        <Tabs defaultValue="explorer">
          <TabsList className="w-full">
            <TabsTrigger value="explorer">笔记</TabsTrigger>
            <TabsTrigger value="outline" disabled>
              大纲
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {isTauriApp && vaultPath ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={loading}
              onClick={() => void newNote()}
            >
              <Plus className="size-4" />
              新建
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={loading}
              title="刷新列表"
              onClick={() => void refreshFiles()}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex h-full min-h-0 flex-1 flex-col pt-0 overflow-auto">
        {isTauriApp && vaultPath ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="flex min-h-32 flex-1 rounded-md px-0 py-1 outline-none w-full">
                {explorerBody}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                disabled={loading}
                onSelect={() => openNewNoteInDirectory("")}
              >
                新建笔记
              </ContextMenuItem>
              <ContextMenuItem
                disabled={loading}
                onSelect={() => openNewFolderInDirectory("")}
              >
                新建文件夹
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem disabled={loading} onSelect={() => void refreshFiles()}>
                刷新
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : (
          explorerBody
        )}
      </CardContent>
      <RenameEntryDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
        onConfirm={handleRenameConfirm}
        initialName={renameTarget?.name ?? ""}
        title={renameTarget?.kind === "dir" ? "重命名文件夹" : "重命名文件"}
        label={renameTarget?.kind === "dir" ? "文件夹名称" : "文件名"}
        confirmText="确认重命名"
        placeholder={renameTarget?.kind === "dir" ? "请输入文件夹名称" : "请输入文件名"}
        loading={loading}
        locationHint={renameTarget ? getParentPathLabel(renameTarget.path) : undefined}
        description={
          renameTarget?.kind === "dir"
            ? "名称中勿使用 / 或 \\\\（单层文件夹名）"
            : "直接输入笔记名称即可"
        }
        inputId={renameTarget?.kind === "dir" ? "rename-folder-name" : "rename-file-name"}
      />
    </Card>
  );
}
