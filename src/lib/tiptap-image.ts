import Image from "@tiptap/extension-image";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

import { writeVaultAttachment } from "@/lib/vault-bridge";

export const ATTACHMENTS_DIRECTORY = ".attachments";

type ImageContext = {
  noteRelativePath?: string | null;
  vaultPath?: string | null;
};

type UploadImageContext = {
  noteRelativePath: string;
  vaultPath: string;
};

function normalizeSegments(value: string): string[] {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== ".");
}

function joinRelativePath(...parts: Array<string | null | undefined>): string {
  const output: string[] = [];

  for (const part of parts) {
    if (!part) continue;

    for (const segment of normalizeSegments(part)) {
      if (segment === "..") {
        output.pop();
      } else {
        output.push(segment);
      }
    }
  }

  return output.join("/");
}

function dirname(relativePath?: string | null): string {
  if (!relativePath) return "";
  const segments = normalizeSegments(relativePath);
  segments.pop();
  return segments.join("/");
}

function isProbablyExternalSource(src?: string | null): boolean {
  if (!src) return false;
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(src) || src.startsWith("//");
}

function isLocalVaultImageSource(src?: string | null): src is string {
  if (!src) return false;
  if (src.startsWith("/")) return false;
  return !isProbablyExternalSource(src);
}

function buildAbsoluteVaultPath(
  vaultPath: string,
  noteRelativePath: string,
  localSrc: string,
): string {
  const noteDir = dirname(noteRelativePath);
  const relativeToVault = joinRelativePath(noteDir, localSrc);
  return [vaultPath.replace(/[\\/]+$/, ""), relativeToVault].filter(Boolean).join("/");
}

export function resolveImageAttrs(
  attrs: Record<string, unknown> | null | undefined,
  context?: ImageContext,
): Record<string, unknown> | null | undefined {
  if (!attrs) return attrs;

  const src = typeof attrs.src === "string" ? attrs.src : null;
  if (!src || !isLocalVaultImageSource(src)) {
    return attrs;
  }

  if (!context?.vaultPath || !context.noteRelativePath || !isTauri()) {
    return {
      ...attrs,
      localSrc: src,
    };
  }

  const absolutePath = buildAbsoluteVaultPath(
    context.vaultPath,
    context.noteRelativePath,
    src,
  );

  return {
    ...attrs,
    src: convertFileSrc(absolutePath),
    localSrc: src,
  };
}

export function serializeImageAttrs(
  attrs: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!attrs) return attrs;

  const localSrc = typeof attrs.localSrc === "string" ? attrs.localSrc : null;
  const { localSrc: _localSrc, ...rest } = attrs;

  return {
    ...rest,
    src: localSrc ?? attrs.src,
  };
}

export async function createVaultImageUpload(
  file: File,
  context: UploadImageContext,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal,
): Promise<{ src: string; localSrc: string }> {
  if (abortSignal?.aborted) {
    throw new Error("Upload cancelled");
  }

  onProgress?.({ progress: 0 });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    const handleAbort = () => {
      reader.abort();
      reject(new Error("Upload cancelled"));
    };

    abortSignal?.addEventListener("abort", handleAbort, { once: true });

    reader.onload = () => {
      abortSignal?.removeEventListener("abort", handleAbort);
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read image file"));
        return;
      }
      resolve(reader.result);
    };

    reader.onerror = () => {
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(reader.error ?? new Error("Failed to read image file"));
    };

    reader.onabort = () => {
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(new Error("Upload cancelled"));
    };

    reader.readAsDataURL(file);
  });

  const base64Content = dataUrl.replace(/^data:[^;]+;base64,/, "");
  const localSrc = await writeVaultAttachment(
    context.vaultPath,
    context.noteRelativePath,
    file.name,
    base64Content,
  );

  onProgress?.({ progress: 100 });

  const absolutePath = buildAbsoluteVaultPath(
    context.vaultPath,
    context.noteRelativePath,
    localSrc,
  );

  return {
    src: convertFileSrc(absolutePath),
    localSrc,
  };
}

export const VaultImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      localSrc: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-local-src"),
        renderHTML: (attributes) => {
          if (!attributes.localSrc) {
            return {};
          }

          return {
            "data-local-src": attributes.localSrc,
          };
        },
      },
    };
  },
});
