"use client"

import { useCallback } from "react"
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react"

import {
  CODE_BLOCK_LANGUAGE_OPTIONS,
  normalizeCodeBlockLanguage,
} from "@/lib/tiptap-code-block"

export function CodeBlockNode({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const selectedValue =
    normalizeCodeBlockLanguage(node.attrs.language as string | null) ?? "auto"

  const handleLanguageChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value

      updateAttributes({
        language: value === "auto" ? null : value,
      })

      editor.commands.focus()
    },
    [editor.commands, updateAttributes]
  )

  return (
    <NodeViewWrapper className="code-block-node">
      {editor.isEditable && (
        <div
          className="code-block-node-toolbar"
          contentEditable={false}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <select
            className="code-block-node-language-select"
            aria-label="Select code block language"
            value={selectedValue}
            onChange={handleLanguageChange}
          >
            {CODE_BLOCK_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <pre className="code-block-node-pre">
        <code className="code-block-node-code">
          <NodeViewContent
            as={"span" as never}
            className="code-block-node-content"
          />
        </code>
      </pre>
    </NodeViewWrapper>
  )
}
