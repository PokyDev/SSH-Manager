mod commands;
mod errors;

use commands::ssh::{ssh_connect, ssh_exec, ssh_test_connection};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![ssh_test_connection, ssh_connect, ssh_exec])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}