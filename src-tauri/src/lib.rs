use std::time::Duration as StdDuration;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            // Schedule startup prompt after 5 minutes
            tokio::spawn(async move {
                tokio::time::sleep(StdDuration::from_secs(300)).await;
                let _ = app_handle.emit("startup-prompt", ());
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running todoapp");
}
