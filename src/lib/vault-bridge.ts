import { invoke } from "@tauri-apps/api/core";

export type VaultFileEntry = {
  relativePath: string;
  name: string;
};

export type VaultDirectoryEntry = {
  relativePath: string;
  name: string;
};

export type VaultListing = {
  directories: VaultDirectoryEntry[];
  files: VaultFileEntry[];
};

export function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

export function stripMarkdownExtensionFromPath(relativePath: string): string {
  return relativePath.replace(/\.md$/i, "");
}

export function listMarkdown(vault: string): Promise<VaultListing> {
  return invoke<VaultListing>("vault_list_markdown", { vault }).then((listing) => ({
    directories: listing.directories,
    files: listing.files.map((file) => ({
      ...file,
      name: stripMarkdownExtension(file.name),
    })),
  }));
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

export function createVaultDirectory(
  vault: string,
  relativePath: string,
): Promise<void> {
  return invoke("vault_create_dir", { vault, relativePath });
}

export function deleteVaultFile(
  vault: string,
  relativePath: string,
): Promise<void> {
  return invoke("vault_delete_file", { vault, relativePath });
}

export function deleteVaultDirectory(
  vault: string,
  relativePath: string,
): Promise<void> {
  return invoke("vault_delete_dir", { vault, relativePath });
}

export function renameVaultFile(
  vault: string,
  oldRelativePath: string,
  newRelativePath: string,
): Promise<void> {
  return invoke("vault_rename_file", { vault, oldRelativePath, newRelativePath });
}

export function renameVaultDirectory(
  vault: string,
  oldRelativePath: string,
  newRelativePath: string,
): Promise<void> {
  return invoke("vault_rename_dir", { vault, oldRelativePath, newRelativePath });
}
