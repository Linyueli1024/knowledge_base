import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useVault } from "@/context/vault-context";

type EditableNoteTitleProps = {
  className?: string;
};

export function EditableNoteTitle({ className }: EditableNoteTitleProps) {
  const { activeFile, renameNote, loading } = useVault();
  const [draftName, setDraftName] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    setDraftName(activeFile?.name ?? "");
  }, [activeFile?.name, activeFile?.relativePath]);

  const submitRename = useCallback(async () => {
    if (!activeFile || submittingRef.current) return;

    const nextName = draftName.trim();
    if (!nextName || nextName === activeFile.name) {
      setDraftName(activeFile.name);
      return;
    }

    submittingRef.current = true;
    try {
      await renameNote(activeFile.relativePath, nextName);
    } catch {
      // Keep the current draft so the user can adjust and retry.
    } finally {
      submittingRef.current = false;
    }
  }, [activeFile, draftName, renameNote]);

  if (!activeFile) {
    return <h1 className="truncate text-sm font-medium text-foreground">未打开文件</h1>;
  }

  return (
    <Input
      value={draftName}
      onChange={(e) => setDraftName(e.target.value)}
      onBlur={() => void submitRename()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          void submitRename();
          e.currentTarget.blur();
        }
      }}
      disabled={loading}
      className={className}
      aria-label="笔记标题"
      placeholder="请输入文件名"
    />
  );
}
