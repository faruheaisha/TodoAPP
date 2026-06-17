use std::path::PathBuf;
use tauri::Manager;
use uuid::Uuid;

/// Copy an audio file from user-chosen path into the app's music library directory.
/// Returns the absolute destination path for the frontend to store.
#[tauri::command]
pub fn import_audio(app: tauri::AppHandle, source: String) -> Result<String, String> {
    let src = PathBuf::from(&source);

    // Validate file exists
    if !src.exists() {
        return Err("文件不存在".to_string());
    }

    // Validate audio extension (case-insensitive)
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .filter(|e| {
            matches!(
                e.as_str(),
                "mp3" | "wav" | "ogg" | "flac" | "m4a" | "aac" | "wma" | "opus"
            )
        })
        .ok_or_else(|| "不支持的音频格式，仅支持 MP3/WAV/OGG/FLAC/M4A/AAC/WMA/Opus".to_string())?;

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "无效的文件名".to_string())?;

    // Ensure destination directory exists
    let dest_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("music_library");
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    // UUID prefix avoids name collisions
    let uuid = Uuid::new_v4();
    let dest_name = format!("{}_{}.{}", uuid, stem, ext);
    let dest_path = dest_dir.join(&dest_name);

    std::fs::copy(&src, &dest_path).map_err(|e| format!("复制文件失败: {}", e))?;

    Ok(dest_path
        .to_str()
        .ok_or_else(|| "路径编码错误".to_string())?
        .to_string())
}

/// Download an audio file from an HTTPS URL into the app's music library directory.
/// Security: only https:// allowed, validates audio extension, caps size at 50 MB.
/// Returns the absolute destination path for the frontend to store.
#[tauri::command]
pub async fn download_audio(
    app: tauri::AppHandle,
    url: String,
    name: String,
) -> Result<String, String> {
    // Only allow HTTPS to avoid plaintext / local-file scheme abuse
    if !url.to_lowercase().starts_with("https://") {
        return Err("仅支持 https:// 链接".to_string());
    }

    // Validate audio extension from the provided name (case-insensitive)
    let ext = name
        .rsplit('.')
        .next()
        .map(|e| e.to_lowercase())
        .filter(|e| {
            matches!(
                e.as_str(),
                "mp3" | "wav" | "ogg" | "flac" | "m4a" | "aac" | "wma" | "opus"
            )
        })
        .ok_or_else(|| "文件名需带受支持的音频扩展名（mp3/wav/ogg/flac/m4a/aac/wma/opus）".to_string())?;

    let stem_src = name.trim_end_matches(&format!(".{}", ext));
    let stem: String = stem_src
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .take(60)
        .collect();
    let stem = if stem.trim().is_empty() { "track".to_string() } else { stem };

    // Fetch bytes
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("下载失败: HTTP {}", resp.status().as_u16()));
    }

    // Reject oversized files early via Content-Length when available (50 MB cap)
    const MAX_BYTES: u64 = 50 * 1024 * 1024;
    if let Some(len) = resp.content_length() {
        if len > MAX_BYTES {
            return Err("文件过大（超过 50MB）".to_string());
        }
    }

    let bytes = resp.bytes().await.map_err(|e| format!("读取数据失败: {}", e))?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("文件过大（超过 50MB）".to_string());
    }
    if bytes.is_empty() {
        return Err("下载内容为空".to_string());
    }

    // Ensure destination directory exists
    let dest_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("music_library");
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let uuid = Uuid::new_v4();
    let dest_name = format!("{}_{}.{}", uuid, stem, ext);
    let dest_path = dest_dir.join(&dest_name);

    std::fs::write(&dest_path, &bytes).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(dest_path
        .to_str()
        .ok_or_else(|| "路径编码错误".to_string())?
        .to_string())
}

/// Delete an audio file from the music library directory.
/// Validates the path is within the app's music_library dir before deleting.
#[tauri::command]
pub fn delete_audio(app: tauri::AppHandle, file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    let music_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("music_library");

    // Security: ensure file is within the music library directory
    let path_str = path.to_str().ok_or_else(|| "无效路径".to_string())?;
    let music_str = music_dir
        .to_str()
        .ok_or_else(|| "目录路径错误".to_string())?;
    if !path_str.starts_with(music_str) {
        return Err("权限错误：文件不在音乐库目录中".to_string());
    }

    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    Ok(())
}
