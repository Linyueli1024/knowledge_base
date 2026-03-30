use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFile {
    pub relative_path: String,
    pub name: String,
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
fn vault_list_markdown(vault: String) -> Result<Vec<VaultFile>, String> {
    let root = Path::new(&vault).canonicalize().map_err(|e| e.to_string())?;
    if !root.is_dir() {
        return Err("不是有效文件夹".into());
    }
    let mut files = Vec::new();
    walk_md_files(&root, &root, &mut files)?;
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

fn walk_md_files(dir: &Path, vault_root: &Path, out: &mut Vec<VaultFile>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if meta.is_dir() {
            walk_md_files(&path, vault_root, out)?;
        } else if is_markdown(&path) {
            let rel = path
                .strip_prefix(vault_root)
                .map_err(|_| "路径错误".to_string())?;
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            out.push(VaultFile {
                relative_path: rel_str,
                name,
            });
        }
    }
    Ok(())
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
