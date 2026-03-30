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

type CreateFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
  loading?: boolean;
  /** 非空时表示将创建在该相对目录下（展示用） */
  parentRelativePath?: string;
};

export function CreateFileDialog({
  open,
  onOpenChange,
  onCreate,
  loading = false,
  parentRelativePath,
}: CreateFileDialogProps) {
  const [name, setName] = useState("未命名");

  useEffect(() => {
    if (open) {
      setName("未命名");
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
          const el = document.getElementById("note-name") as HTMLInputElement | null;
          el?.focus();
          el?.select();
        }}
      >
        <DialogHeader>
          <DialogTitle>新建笔记</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <Label htmlFor="note-name">文件名</Label>
          <Input
            id="note-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入文件名"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          />
          <p className="text-sm text-muted-foreground">
            直接输入笔记名称即可
          </p>
          {parentRelativePath ? (
            <p className="text-sm text-muted-foreground">
              位置：{parentRelativePath}
            </p>
          ) : null}
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
