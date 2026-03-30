import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
  loading?: boolean;
  parentRelativePath?: string;
};

export function CreateFolderDialog({
  open,
  onOpenChange,
  onCreate,
  loading = false,
  parentRelativePath,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("新建文件夹");

  useEffect(() => {
    if (open) {
      setName("新建文件夹");
    }
  }, [open]);

  const handleConfirm = useCallback(async () => {
    await onCreate(name);
  }, [name, onCreate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const el = document.getElementById("folder-name") as HTMLInputElement | null;
          el?.focus();
          el?.select();
        }}
      >
        <DialogHeader>
          <DialogTitle>新建文件夹</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <Label htmlFor="folder-name">文件夹名称</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入名称"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          />
          <p className="text-sm text-muted-foreground">
            {parentRelativePath
              ? `位置：${parentRelativePath}`
              : "将创建于知识库根目录"}
          </p>
          <p className="text-sm text-muted-foreground">
            名称中勿使用 / 或 \\（单层文件夹名）
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={loading || !name.trim()}
            onClick={() => void handleConfirm()}
          >
            确认创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
