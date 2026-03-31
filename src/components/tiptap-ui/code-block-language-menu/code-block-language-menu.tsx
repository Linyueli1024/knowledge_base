import { useCallback, useMemo, useState } from "react"

import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/tiptap-ui-primitive/dropdown-menu"

const CODE_BLOCK_LANGUAGE_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "Plain Text", value: "plaintext" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "JSON", value: "json" },
  { label: "HTML", value: "xml" },
  { label: "CSS", value: "css" },
  { label: "SCSS", value: "scss" },
  { label: "Bash", value: "bash" },
  { label: "SQL", value: "sql" },
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "Go", value: "go" },
  { label: "Rust", value: "rust" },
  { label: "YAML", value: "yaml" },
  { label: "Markdown", value: "markdown" },
  { label: "Diff", value: "diff" },
] as const

export interface CodeBlockLanguageMenuProps
  extends Omit<ButtonProps, "type" | "onChange"> {
  editor?: ReturnType<typeof useTiptapEditor>["editor"]
  modal?: boolean
}

export function CodeBlockLanguageMenu({
  editor: providedEditor,
  modal = true,
  ...buttonProps
}: CodeBlockLanguageMenuProps) {
  const { editor } = useTiptapEditor(providedEditor)
  const [isOpen, setIsOpen] = useState(false)

  const isCodeBlockActive = editor?.isActive("codeBlock") ?? false
  const selectedLanguage =
    (editor?.getAttributes("codeBlock").language as string | null | undefined) ??
    null

  const selectedValue = selectedLanguage || "auto"

  const selectedLabel = useMemo(() => {
    return (
      CODE_BLOCK_LANGUAGE_OPTIONS.find(
        (option) => option.value === selectedValue
      )?.label ?? selectedValue
    )
  }, [selectedValue])

  const handleValueChange = useCallback(
    (value: string) => {
      if (!editor) return

      editor
        .chain()
        .focus()
        .updateAttributes("codeBlock", {
          language: value === "auto" ? null : value,
        })
        .run()
    },
    [editor]
  )

  if (!editor || !isCodeBlockActive) {
    return null
  }

  return (
    <DropdownMenu modal={modal} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="button"
          tabIndex={-1}
          aria-label="Select code block language"
          tooltip="Code Language"
          {...buttonProps}
        >
          <span className="tiptap-button-text">{selectedLabel}</span>
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={selectedValue}
            onValueChange={handleValueChange}
          >
            {CODE_BLOCK_LANGUAGE_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
