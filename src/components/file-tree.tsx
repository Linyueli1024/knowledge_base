import { ChevronRightIcon, FileIcon, FolderIcon, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVault } from "@/context/vault-context";
import type { VaultFileEntry } from "@/lib/vault-bridge";

type DirNode = { kind: "dir"; name: string; path: string; children: TreeNode[] };
type FileNode = { kind: "file" } & VaultFileEntry;
type TreeNode = DirNode | FileNode;

function buildTree(files: VaultFileEntry[]): TreeNode[] {
  type Branch = { dirs: Map<string, Branch>; files: VaultFileEntry[] };
  const root: Branch = { dirs: new Map(), files: [] };

  for (const f of files) {
    const parts = f.relativePath.replace(/\\/g, "/").split("/");
    const fileName = parts.pop();
    if (!fileName) continue;
    let cur = root;
    for (const dir of parts) {
      if (!dir) continue;
      if (!cur.dirs.has(dir)) {
        cur.dirs.set(dir, { dirs: new Map(), files: [] });
      }
      cur = cur.dirs.get(dir)!;
    }
    cur.files.push({ ...f, name: fileName });
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

export function CollapsibleFileTree() {
  const {
    files,
    activeFile,
    selectFile,
    vaultPath,
    refreshFiles,
    newNote,
    loading,
    isTauriApp,
  } = useVault();

  const tree = buildTree(files);

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.kind === "dir") {
      return (
        <Collapsible key={node.path} defaultOpen>
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
      );
    }

    const selected = activeFile?.relativePath === node.relativePath;
    return (
      <Button
        key={node.relativePath}
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
    );
  };

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
      <CardContent className="pt-0">
        {!isTauriApp ? (
          <p className="px-2 text-xs text-muted-foreground">桌面版下可用</p>
        ) : !vaultPath ? (
          <p className="px-2 text-xs text-muted-foreground">请先打开知识库文件夹</p>
        ) : tree.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">暂无 .md 文件，点击「新建」创建</p>
        ) : (
          <div className="flex flex-col gap-0.5">{tree.map((n) => renderNode(n, 0))}</div>
        )}
      </CardContent>
    </Card>
  );
}
