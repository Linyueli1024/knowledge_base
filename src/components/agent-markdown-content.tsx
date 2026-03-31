"use client";

import { createElement, type ReactNode } from "react";
import katex from "katex";

import { cn } from "@/lib/utils";

type MarkdownBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "code"; language: string; content: string }
  | { type: "math"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "blockquote"; lines: string[] }
  | { type: "hr" };

function isTableSeparatorRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;

  const cells = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderKatex(formula: string, displayMode: boolean) {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      output: "html",
      trust: false,
    });
  } catch {
    return "";
  }
}

function MathFormula({
  formula,
  displayMode,
}: {
  formula: string;
  displayMode: boolean;
}) {
  const html = renderKatex(formula, displayMode);

  if (!html) {
    return displayMode ? (
      <pre className="overflow-x-auto rounded-2xl border border-border bg-card px-4 py-3 font-mono text-[14px] leading-7 text-foreground">
        <code>{formula}</code>
      </pre>
    ) : (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
        {formula}
      </code>
    );
  }

  return (
    <span
      className={cn(displayMode ? "katex-display-wrapper block overflow-x-auto rounded-2xl border border-border bg-card px-4 py-3" : "katex-inline-wrapper")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function parseInline(content: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\\\([\\\s\S]*?\\\)|\\\[[\\\s\S]*?\\\]|\[[^\]]+\]\([^)]+\)|`[^`]+`|\$\$[^$]+\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${partIndex++}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("\\(") && token.endsWith("\\)")) {
      nodes.push(<MathFormula key={key} formula={token.slice(2, -2)} displayMode={false} />);
    } else if (token.startsWith("\\[") && token.endsWith("\\]")) {
      nodes.push(<MathFormula key={key} formula={token.slice(2, -2)} displayMode />);
    } else if (token.startsWith("$$") && token.endsWith("$$")) {
      nodes.push(<MathFormula key={key} formula={token.slice(2, -2)} displayMode={false} />);
    } else if (token.startsWith("$") && token.endsWith("$")) {
      nodes.push(<MathFormula key={key} formula={token.slice(1, -1)} displayMode={false} />);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("_") && token.endsWith("_")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes;
}

function parseMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeFenceMatch = trimmed.match(/^```([\w-]+)?\s*$/);
    if (codeFenceMatch) {
      const language = codeFenceMatch[1] ?? "";
      const contentLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        contentLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: "code", language, content: contentLines.join("\n") });
      continue;
    }

    if (trimmed === "\\[" || (/^\\\[/.test(trimmed) && !/\\\]$/.test(trimmed))) {
      const mathLines: string[] = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== "\\]") {
        mathLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: "math", content: mathLines.join("\n").trim() });
      continue;
    }

    const singleLineBracketMathMatch = trimmed.match(/^\\\[(.*)\\\]$/);
    if (singleLineBracketMathMatch) {
      blocks.push({ type: "math", content: singleLineBracketMathMatch[1].trim() });
      index += 1;
      continue;
    }

    if (trimmed === "$$" || (/^\$\$/.test(trimmed) && !/\$\$$/.test(trimmed.slice(2)))) {
      const mathLines: string[] = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== "$$") {
        mathLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: "math", content: mathLines.join("\n").trim() });
      continue;
    }

    const singleLineMathMatch = trimmed.match(/^\$\$(.*)\$\$$/);
    if (singleLineMathMatch) {
      blocks.push({ type: "math", content: singleLineMathMatch[1].trim() });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (
      trimmed.includes("|") &&
      index + 1 < lines.length &&
      isTableSeparatorRow(lines[index + 1])
    ) {
      const headers = splitTableRow(lines[index]);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length) {
        const rowLine = lines[index].trim();
        if (!rowLine || !rowLine.includes("|")) break;
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentLine = lines[index];
      const currentTrimmed = currentLine.trim();

      if (
        !currentTrimmed ||
        /^```/.test(currentTrimmed) ||
        /^\$\$/.test(currentTrimmed) ||
        /^\\\[/.test(currentTrimmed) ||
        /^(#{1,6})\s+/.test(currentTrimmed) ||
        /^>\s?/.test(currentTrimmed) ||
        /^[-*+]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed) ||
        (currentTrimmed.includes("|") &&
          index + 1 < lines.length &&
          isTableSeparatorRow(lines[index + 1])) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(currentTrimmed)
      ) {
        break;
      }

      paragraphLines.push(currentTrimmed);
      index += 1;
    }

    if (paragraphLines.length) {
      blocks.push({ type: "paragraph", content: paragraphLines.join(" ") });
      continue;
    }

    index += 1;
  }

  return blocks;
}

export function AgentMarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={cn("space-y-4 text-[15px] leading-7 text-foreground", className)}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "heading": {
            const headingTag = `h${Math.min(block.level, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
            return createElement(
              headingTag,
              {
                key,
                className: cn(
                  "font-semibold tracking-tight text-foreground",
                  block.level === 1 && "text-2xl",
                  block.level === 2 && "text-xl",
                  block.level === 3 && "text-lg",
                  block.level >= 4 && "text-base",
                ),
              },
              parseInline(block.content, key),
            );
          }

          case "paragraph":
            return <p key={key}>{parseInline(block.content, key)}</p>;

          case "code":
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-border bg-card">
                {block.language ? (
                  <div className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {block.language}
                  </div>
                ) : null}
                <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-6 text-foreground">
                  <code>{block.content}</code>
                </pre>
              </div>
            );

          case "math":
            return <MathFormula key={key} formula={block.content} displayMode />;

          case "ul":
            return (
              <ul key={key} className="list-disc space-y-2 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{parseInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={key} className="list-decimal space-y-2 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{parseInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ol>
            );

          case "table":
            return (
              <div key={key} className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {block.headers.map((header, headerIndex) => (
                        <th
                          key={`${key}-header-${headerIndex}`}
                          className="border-b border-border px-4 py-3 font-semibold text-foreground"
                        >
                          {parseInline(header, `${key}-header-${headerIndex}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${key}-row-${rowIndex}`} className="align-top">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${key}-cell-${rowIndex}-${cellIndex}`}
                            className="border-b border-border/70 px-4 py-3 leading-6 text-foreground last:border-b-0"
                          >
                            {parseInline(cell, `${key}-cell-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "blockquote":
            return (
              <blockquote
                key={key}
                className="border-l-3 border-border pl-4 text-muted-foreground"
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={`${key}-${lineIndex}`}>{parseInline(line, `${key}-${lineIndex}`)}</p>
                ))}
              </blockquote>
            );

          case "hr":
            return <div key={key} className="border-t border-border" />;

          default:
            return null;
        }
      })}
    </div>
  );
}
