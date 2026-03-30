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

type RenameEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => Promise<void>;
  initialName: string;
  title: string;
  label: string;
  confirmText: string;
  placeholder?: string;
  loading?: boolean;
  locationHint?: string;
  description?: string;
  inputId: string;
};

export function RenameEntryDialog({
  open,
  onOpenChange,
  onConfirm,
  initialName,
  title,
  label,
  confirmText,
  placeholder,
  loading = false,
  locationHint,
  description,
  inputId,
}: RenameEntryDialogProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [initialName, open]);

  const handleConfirm = useCallback(async () => {
    await onConfirm(name);
  }, [name, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const el = document.getElementById(inputId) as HTMLInputElement | null;
          el?.focus();
          el?.select();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <Label htmlFor={inputId}>{label}</Label>
          <Input
            id={inputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          />
          {locationHint ? (
            <p className="text-sm text-muted-foreground">位置：{locationHint}</p>
          ) : null}
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
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
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
