mod commands;
mod db;
mod security;

use db::{get_db_path, init_database, DatabaseState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let db_path = get_db_path(&handle).expect("Failed to get db path");
            let conn = init_database(&db_path).expect("Failed to initialize database");

            app.manage(DatabaseState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_database,
            commands::export_database,
            commands::add_item,
            commands::upsert_item,
            commands::update_item,
            commands::delete_item,
            commands::delete_operation_cascade,
            commands::reset_database,
            commands::import_database,
            commands::save_backup,
            commands::read_backup,
            commands::export_sqlite_db,
            commands::export_supabase_sqlite,
            commands::get_local_db_path,
            commands::set_window_close_enabled,
            commands::save_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
