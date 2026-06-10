use std::time::Duration as StdDuration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

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

            // ── 系统托盘 ────────────────────────────────────────────────────
            // 参考 Tauri v2 官方示例 + biliup-rs (⭐6.8k) 托盘菜单模式
            let show_item = MenuItem::with_id(app, "show", "显示 TodoApp", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("TodoApp")
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 双击托盘图标显示窗口
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── 关闭窗口时最小化到托盘（而非退出）──────────────────────────
            let win = app.get_webview_window("main").unwrap();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Some(w) = app_handle.get_webview_window("main") {
                        let _ = w.hide();
                    }
                }
            });

            // ── 开机启动提示（延迟 5 分钟 emit，前端已不监听但保留兼容）──────
            let ah2 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(StdDuration::from_secs(300)).await;
                let _ = ah2.emit("startup-prompt", ());
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running todoapp");
}
