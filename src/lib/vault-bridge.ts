import { invoke } from "@tauri-apps/api/core";

export type VaultFileEntry = {
  relativePath: string;
  name: string;
};

export function listMarkdown(vault: string): Promise<VaultFileEntry[]> {
  return invoke<VaultFileEntry[]>("vault_list_markdown", { vault });
}

export function readMarkdownFile(
  vault: string,
  relativePath: string,
): Promise<string> {
  return invoke<string>("vault_read_file", {
    vault,
    relativePath,
  });
}

export function writeMarkdownFile(
  vault: string,
  relativePath: string,
  content: string,
): Promise<void> {
  return invoke("vault_write_file", { vault, relativePath, content });
}

export function createMarkdownFile(
  vault: string,
  relativePath: string,
): Promise<void> {
  return invoke("vault_create_file", { vault, relativePath });
}
