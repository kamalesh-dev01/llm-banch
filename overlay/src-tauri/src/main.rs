// LLM Bench Overlay — Tauri backend
// Manages two windows (settings + overlay), system tray,
// and the Python sidecar that reads hardware metrics.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Start the Python sidecar
            let handle = app.handle().clone();
            start_sidecar(handle);

            // Build system tray menu
            let quit = MenuItem::with_id(
                app, "quit", "Quit", true, None::<&str>
            )?;
            let toggle_overlay = MenuItem::with_id(
                app, "toggle_overlay", "Toggle Overlay", true, None::<&str>
            )?;
            let show_settings = MenuItem::with_id(
                app, "show_settings", "Show Settings", true, None::<&str>
            )?;

            let menu = Menu::with_items(
                app,
                &[&show_settings, &toggle_overlay, &quit]
            )?;

            // Create tray icon
            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("LLM Bench Overlay")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show_settings" => {
                            if let Some(win) = app.get_webview_window("settings") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "toggle_overlay" => {
                            if let Some(win) = app.get_webview_window("overlay") {
                                if win.is_visible().unwrap_or(false) {
                                    let _ = win.hide();
                                } else {
                                    let _ = win.show();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("settings") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            toggle_overlay_window,
            set_overlay_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Start the Python hw_monitor.py sidecar
// Reads stdout line by line and emits hardware-metrics event to frontend
fn start_sidecar(app: AppHandle) {
    let shell = app.shell();
    let result = shell
        .sidecar("hw_monitor")
        .expect("hw_monitor sidecar not found")
        .spawn();

    match result {
        Ok((mut rx, _child)) => {
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            // Forward each JSON line to all frontend windows
                            let line_str = String::from_utf8_lossy(&line);
                            let _ = app.emit("hardware-metrics", line_str.trim());
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!(
                                "Sidecar error: {}",
                                String::from_utf8_lossy(&line)
                            );
                        }
                        _ => {}
                    }
                }
            });
        }
        Err(e) => {
            eprintln!("Failed to start sidecar: {}", e);
        }
    }
}

// Tauri command: toggle overlay window visibility
#[tauri::command]
fn toggle_overlay_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window("overlay") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
        }
    }
}

// Tauri command: move overlay to corner
#[tauri::command]
fn set_overlay_position(app: AppHandle, position: String) {
    if let Some(win) = app.get_webview_window("overlay") {
        if let Ok(monitor) = win.current_monitor() {
            if let Some(monitor) = monitor {
                let size = monitor.size();
                let (x, y) = match position.as_str() {
                    "top-left"     => (20, 20),
                    "top-right"    => (size.width as i32 - 260, 20),
                    "bottom-left"  => (20, size.height as i32 - 300),
                    "bottom-right" => (
                        size.width as i32 - 260,
                        size.height as i32 - 300
                    ),
                    _ => (20, 20),
                };
                let _ = win.set_position(
                    tauri::PhysicalPosition::new(x, y)
                );
            }
        }
    }
}
