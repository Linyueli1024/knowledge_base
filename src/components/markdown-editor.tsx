import { useMemo } from "react";
import { FileText } from "lucide-react";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import {
  EditorProvider,
  useCurrentEditor,
  useEditorState,
  type JSONContent,
} from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/core";
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  schema as markdownSchema,
} from "@tiptap/pm/markdown";

import { EditableNoteTitle } from "@/components/editable-note-title";
import { Button } from "@/components/ui/button";
import { useVault } from "@/context/vault-context";
import {
  CodeBlockHighlight,
  lowlight,
  normalizeCodeBlockLanguage,
  serializeCodeBlockLanguage,
} from "@/lib/tiptap-code-block";
import { stripMarkdownExtensionFromPath } from "@/lib/vault-bridge";

function mapPmToTiptap(node: any): any {
  if (!node || typeof node !== "object") return node;

  const typeMap: Record<string, string> = {
    bullet_list: "bulletList",
    ordered_list: "orderedList",
    list_item: "listItem",
    code_block: "codeBlock",
    horizontal_rule: "horizontalRule",
    hard_break: "hardBreak",
    image: "image",
  };

  const markMap: Record<string, string> = {
    strong: "bold",
    em: "italic",
  };

  const attrs =
    node.type === "code_block"
      ? {
          ...node.attrs,
          language: normalizeCodeBlockLanguage(node.attrs?.params),
        }
      : node.attrs;

  return {
    ...node,
    type: typeMap[node.type] ?? node.type,
    attrs,
    marks: Array.isArray(node.marks)
      ? node.marks.map((mark: any) => ({
          ...mark,
          type: markMap[mark.type] ?? mark.type,
        }))
      : node.marks,
    content: Array.isArray(node.content) ? node.content.map(mapPmToTiptap) : node.content,
  };
}

function mapTiptapToPm(node: any): any {
  if (!node || typeof node !== "object") return node;

  const typeMap: Record<string, string> = {
    bulletList: "bullet_list",
    orderedList: "ordered_list",
    listItem: "list_item",
    codeBlock: "code_block",
    horizontalRule: "horizontal_rule",
    hardBreak: "hard_break",
  };

  const markMap: Record<string, string> = {
    bold: "strong",
    italic: "em",
  };

  const attrs =
    node.type === "codeBlock"
      ? {
          ...node.attrs,
          params: serializeCodeBlockLanguage(node.attrs?.language),
        }
      : node.attrs;

  return {
    ...node,
    type: typeMap[node.type] ?? node.type,
    attrs,
    marks: Array.isArray(node.marks)
      ? node.marks.map((mark: any) => ({
          ...mark,
          type: markMap[mark.type] ?? mark.type,
        }))
      : node.marks,
    content: Array.isArray(node.content) ? node.content.map(mapTiptapToPm) : node.content,
  };
}

function fallbackDocFromText(markdown: string): JSONContent {
  return {
    type: "doc",
    content: markdown
      ? markdown.split("\n").map((line) => ({
          type: "paragraph",
          content: line ? [{ type: "text", text: line }] : [],
        }))
      : [{ type: "paragraph" }],
  };
}

export function markdownToTiptap(markdown: string): JSONContent {
  try {
    const pmDoc = defaultMarkdownParser.parse(markdown);
    return mapPmToTiptap(pmDoc.toJSON());
  } catch {
    return fallbackDocFromText(markdown);
  }
}

export function tiptapToMarkdown(editor: Editor): string {
  try {
    const pmJson = mapTiptapToPm(editor.getJSON());
    const pmDoc = markdownSchema.nodeFromJSON(pmJson);
    return defaultMarkdownSerializer.serialize(pmDoc);
  } catch {
    return editor.getText();
  }
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

function TiptapMenus({ disabled }: { disabled: boolean }) {
  const { editor } = useCurrentEditor();

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) return null;
      return {
        isBold: currentEditor.isActive("bold"),
        isItalic: currentEditor.isActive("italic"),
        isStrike: currentEditor.isActive("strike"),
        isBulletList: currentEditor.isActive("bulletList"),
        isOrderedList: currentEditor.isActive("orderedList"),
        isBlockquote: currentEditor.isActive("blockquote"),
        isCodeBlock: currentEditor.isActive("codeBlock"),
        isHeading1: currentEditor.isActive("heading", { level: 1 }),
        isHeading2: currentEditor.isActive("heading", { level: 2 }),
      };
    },
  });

  if (!editor || !editorState) return null;

  return (
    <>
      <BubbleMenu editor={editor}>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1 shadow-md">
          <ToolbarButton
            active={editorState.isBold}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleBold().run()}
          >
            粗体
          </ToolbarButton>
          <ToolbarButton
            active={editorState.isItalic}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleItalic().run()}
          >
            斜体
          </ToolbarButton>
          <ToolbarButton
            active={editorState.isStrike}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleStrike().run()}
          >
            删除线
          </ToolbarButton>
        </div>
      </BubbleMenu>

      <FloatingMenu editor={editor}>
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background p-1 shadow-md">
          <ToolbarButton
            active={editorState.isHeading1}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            active={editorState.isHeading2}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editorState.isBulletList}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleBulletList().run()}
          >
            列表
          </ToolbarButton>
          <ToolbarButton
            active={editorState.isOrderedList}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleOrderedList().run()}
          >
            编号
          </ToolbarButton>
          <ToolbarButton
            active={editorState.isBlockquote}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleBlockquote().run()}
          >
            引用
          </ToolbarButton>
          <ToolbarButton
            active={editorState.isCodeBlock}
            disabled={disabled}
            onClick={() => void editor.chain().focus().toggleCodeBlock().run()}
          >
            代码
          </ToolbarButton>
        </div>
      </FloatingMenu>
    </>
  );
}

function TiptapDocument({
  initialMarkdown,
  disabled,
  onMarkdownChange,
}: {
  initialMarkdown: string;
  disabled: boolean;
  onMarkdownChange: (markdown: string) => void;
}) {
  const initialContent = useMemo(
    () => markdownToTiptap(initialMarkdown),
    [initialMarkdown],
  );

  return (
    <EditorProvider
      immediatelyRender
      shouldRerenderOnTransaction={false}
      extensions={[
        StarterKit.configure({
          codeBlock: false,
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
        }),
        CodeBlockHighlight.configure({
          lowlight,
          defaultLanguage: "plaintext",
          HTMLAttributes: {
            class: "rounded-md bg-muted px-3 py-2 font-mono text-sm",
          },
        }),
        Link.configure({
          openOnClick: true,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            class: "text-primary underline underline-offset-4",
          },
        }),
      ]}
      content={initialContent}
      editable={!disabled}
      editorProps={{
        attributes: {
          class:
            "prose prose-sm max-w-none min-h-full px-3 py-3 text-foreground outline-none focus:outline-none prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-blockquote:border-l-border prose-blockquote:text-muted-foreground prose-pre:bg-muted prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
        },
      }}
      onUpdate={({ editor }) => {
        onMarkdownChange(tiptapToMarkdown(editor));
      }}
      slotAfter={<TiptapMenus disabled={disabled} />}
    />
  );
}

export function MarkdownEditor() {
  const {
    vaultPath,
    activeFile,
    content,
    setContent,
    dirty,
    loading,
    saving,
    error,
    isTauriApp,
  } = useVault();

  if (!isTauriApp) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <FileText className="size-10 opacity-50" />
        <p>
          使用 <code className="text-foreground">yarn tauri dev</code> 启动桌面版以管理本地
          Markdown 笔记。
        </p>
      </div>
    );
  }

  if (!vaultPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <FileText className="size-10 opacity-50" />
        <p>
          请通过菜单 <span className="text-foreground">文件 → 打开知识库文件夹</span>{" "}
          选择一个目录作为笔记库。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-2 p-4 pt-2">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
        <div className="min-w-0 flex-1">
          <EditableNoteTitle className="h-8 border-0 bg-transparent px-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-0" />
          {activeFile ? (
            <p className="truncate text-xs text-muted-foreground">
              {stripMarkdownExtensionFromPath(activeFile.relativePath)}
              {saving ? " · 保存中" : dirty ? " · 正在同步" : " · 已保存"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">在左侧选择笔记，或使用菜单新建</p>
          )}
        </div>
      </div>
      {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-input bg-background">
        {activeFile ? (
          <div className="min-h-full">
            <TiptapDocument
              key={activeFile.relativePath}
              initialMarkdown={content}
              disabled={loading}
              onMarkdownChange={setContent}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            在左侧选择笔记，或使用菜单新建
          </div>
        )}
      </div>
    </div>
  );
}
