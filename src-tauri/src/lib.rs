use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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
    let root = Path::new(&vault)
        .canonicalize()
        .map_err(|e| e.to_string())?;
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
            if path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name == ".attachments")
                .unwrap_or(false)
            {
                continue;
            }
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

fn normalize_relative_path(relative: &str) -> PathBuf {
    let mut path = PathBuf::new();
    for part in relative.replace('\\', "/").split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        path.push(part);
    }
    path
}

fn to_unix_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn sanitize_file_stem(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");

    let sanitized = stem
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "image".into()
    } else {
        sanitized
    }
}

fn attachment_directory_for_note(note_relative_path: &str) -> PathBuf {
    let note_path = normalize_relative_path(note_relative_path);
    let mut attachment_dir = PathBuf::from(".attachments");

    if let Some(parent) = note_path.parent() {
        if !parent.as_os_str().is_empty() {
            attachment_dir.push(parent);
        }
    }

    let stem = note_path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("note");

    attachment_dir.push(stem);
    attachment_dir
}

fn make_relative_path(from: &Path, to: &Path) -> PathBuf {
    let from_components = from.components().collect::<Vec<_>>();
    let to_components = to.components().collect::<Vec<_>>();

    let mut shared = 0usize;
    while shared < from_components.len()
        && shared < to_components.len()
        && from_components[shared] == to_components[shared]
    {
        shared += 1;
    }

    let mut result = PathBuf::new();

    for _ in shared..from_components.len() {
        result.push("..");
    }

    for component in &to_components[shared..] {
        result.push(component.as_os_str());
    }

    result
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
fn vault_write_attachment(
    vault: String,
    note_relative_path: String,
    file_name: String,
    contents_base64: String,
) -> Result<String, String> {
    let _note_path = resolve_vault_path(&vault, &note_relative_path)?;
    let attachment_dir_relative = attachment_directory_for_note(&note_relative_path);
    let attachment_dir_path = resolve_vault_path(&vault, &to_unix_path(&attachment_dir_relative))?;
    fs::create_dir_all(&attachment_dir_path).map_err(|e| e.to_string())?;

    let extension = Path::new(&file_name)
        .extension()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map(|value| format!(".{}", value))
        .unwrap_or_default();
    let file_stem = sanitize_file_stem(&file_name);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let mut counter = 0usize;
    let saved_relative_path = loop {
        let suffix = if counter == 0 {
            format!("{}", timestamp)
        } else {
            format!("{}-{}", timestamp, counter)
        };
        let file_name = format!("{}-{}{}", file_stem, suffix, extension);
        let candidate_relative = attachment_dir_relative.join(file_name);
        let candidate_path = resolve_vault_path(&vault, &to_unix_path(&candidate_relative))?;
        if !candidate_path.exists() {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(contents_base64.as_bytes())
                .map_err(|e| e.to_string())?;
            fs::write(&candidate_path, bytes).map_err(|e| e.to_string())?;
            break candidate_relative;
        }
        counter += 1;
    };

    let note_dir = normalize_relative_path(&note_relative_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let markdown_relative_path = make_relative_path(&note_dir, &saved_relative_path);

    Ok(to_unix_path(&markdown_relative_path))
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            vault_list_markdown,
            vault_read_file,
            vault_write_file,
            vault_write_attachment,
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
