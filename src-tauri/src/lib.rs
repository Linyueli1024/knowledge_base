use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFile {
    pub relative_path: String,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultDirectory {
    pub relative_path: String,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultListing {
    pub directories: Vec<VaultDirectory>,
    pub files: Vec<VaultFile>,
}

fn resolve_vault_path(vault: &str, relative: &str) -> Result<PathBuf, String> {
    let vault_path = Path::new(vault).canonicalize().map_err(|e| e.to_string())?;
    let rel = relative.trim();
    if rel.is_empty() {
        return Err("路径不能为空".into());
    }
    let mut path = vault_path.clone();
    for part in rel.replace('\\', "/").split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err("非法路径".into());
        }
        path.push(part);
    }
    Ok(path)
}

#[tauri::command]
fn vault_list_markdown(vault: String) -> Result<VaultListing, String> {
    let root = Path::new(&vault).canonicalize().map_err(|e| e.to_string())?;
    if !root.is_dir() {
        return Err("不是有效文件夹".into());
    }
    let mut directories = Vec::new();
    let mut files = Vec::new();
    walk_vault_entries(&root, &root, &mut directories, &mut files)?;
    directories.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(VaultListing { directories, files })
}

fn walk_vault_entries(
    dir: &Path,
    vault_root: &Path,
    directories: &mut Vec<VaultDirectory>,
    files: &mut Vec<VaultFile>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if meta.is_dir() {
            let rel = path
                .strip_prefix(vault_root)
                .map_err(|_| "路径错误".to_string())?;
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            directories.push(VaultDirectory {
                relative_path: rel_str,
                name,
            });
            walk_vault_entries(&path, vault_root, directories, files)?;
        } else if is_markdown(&path) {
            let rel = path
                .strip_prefix(vault_root)
                .map_err(|_| "路径错误".to_string())?;
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            files.push(VaultFile {
                relative_path: rel_str,
                name,
            });
        }
    }
    Ok(())
}

fn is_markdown(path: &Path) -> bool {
    match path.extension().and_then(|s| s.to_str()) {
        Some(ext) => ext.eq_ignore_ascii_case("md"),
        None => true,
    }
}

#[tauri::command]
fn vault_read_file(vault: String, relative_path: String) -> Result<String, String> {
    let path = resolve_vault_path(&vault, &relative_path)?;
    if !path.is_file() {
        return Err("文件不存在".into());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_write_file(vault: String, relative_path: String, content: String) -> Result<(), String> {
    let path = resolve_vault_path(&vault, &relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_create_file(vault: String, relative_path: String) -> Result<(), String> {
    let path = resolve_vault_path(&vault, &relative_path)?;
    if path.exists() {
        return Err("文件已存在".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "# \n").map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_create_dir(vault: String, relative_path: String) -> Result<(), String> {
    let path = resolve_vault_path(&vault, &relative_path)?;
    if path.exists() {
        return Err("路径已存在".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::create_dir(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_delete_file(vault: String, relative_path: String) -> Result<(), String> {
    let path = resolve_vault_path(&vault, &relative_path)?;
    if !path.is_file() {
        return Err("文件不存在".into());
    }
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_delete_dir(vault: String, relative_path: String) -> Result<(), String> {
    let path = resolve_vault_path(&vault, &relative_path)?;
    if !path.is_dir() {
        return Err("文件夹不存在".into());
    }
    fs::remove_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_rename_file(
    vault: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
    let old_path = resolve_vault_path(&vault, &old_relative_path)?;
    if !old_path.is_file() {
        return Err("文件不存在".into());
    }

    let new_path = resolve_vault_path(&vault, &new_relative_path)?;
    if new_path.exists() {
        return Err("目标文件已存在".into());
    }

    if let Some(parent) = new_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_rename_dir(
    vault: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
    let old_path = resolve_vault_path(&vault, &old_relative_path)?;
    if !old_path.is_dir() {
        return Err("文件夹不存在".into());
    }

    let new_path = resolve_vault_path(&vault, &new_relative_path)?;
    if new_path.exists() {
        return Err("目标文件夹已存在".into());
    }

    if let Some(parent) = new_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            vault_list_markdown,
            vault_read_file,
            vault_write_file,
            vault_create_file,
            vault_create_dir,
            vault_delete_file,
            vault_delete_dir,
            vault_rename_file,
            vault_rename_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
