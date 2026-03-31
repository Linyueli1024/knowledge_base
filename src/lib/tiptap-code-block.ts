import { textblockTypeInputRule } from "@tiptap/core"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { common, createLowlight } from "lowlight"

import { CodeBlockNode } from "@/components/tiptap-node/code-block-node/code-block-node"

export const CODE_BLOCK_LANGUAGE_OPTIONS = [
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

const CODE_BLOCK_LANGUAGE_ALIASES: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  plaintext: "text",
  bash: "sh",
  yaml: "yml",
  markdown: "md",
  python: "py",
  rust: "rs",
}

const CODE_BLOCK_LANGUAGE_CANONICAL: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  py: "python",
  rs: "rust",
  html: "xml",
}

export const lowlight = createLowlight(common)

const codeBlockBacktickInputRegex = /^```([a-z0-9_+-]+)?[\s\n]$/i
const codeBlockTildeInputRegex = /^~~~([a-z0-9_+-]+)?[\s\n]$/i

export function normalizeCodeBlockLanguage(language?: string | null) {
  if (!language) return null

  const normalized = language.trim().toLowerCase()

  if (!normalized || normalized === "auto") {
    return null
  }

  return CODE_BLOCK_LANGUAGE_CANONICAL[normalized] ?? normalized
}

export function serializeCodeBlockLanguage(language?: string | null) {
  const normalized = normalizeCodeBlockLanguage(language)

  if (!normalized) {
    return ""
  }

  return CODE_BLOCK_LANGUAGE_ALIASES[normalized] ?? normalized
}

export const CodeBlockHighlight = CodeBlockLowlight.extend({
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: codeBlockBacktickInputRegex,
        type: this.type,
        getAttributes: (match) => ({
          language: normalizeCodeBlockLanguage(match[1]),
        }),
      }),
      textblockTypeInputRule({
        find: codeBlockTildeInputRegex,
        type: this.type,
        getAttributes: (match) => ({
          language: normalizeCodeBlockLanguage(match[1]),
        }),
      }),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNode)
  },
})
