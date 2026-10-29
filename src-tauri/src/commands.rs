use crate::db::DatabaseState;
use rusqlite::params;
use serde_json::Value;
use tauri::State;

const ALLOWED_TABLES: [&str; 20] = [
    "T_USER",
    "T_BENEFICIAIRE",
    "T_COMPTE_BANCAIRE",
    "T_CATEGORIE",
    "T_SCATEGORIE",
    "T_OPERATION",
    "T_RUBRIQUE",
    "T_PIECE",
    "T_ENGAGEMENT",
    "T_PAIEMENT",
    "T_CP",
    "T_LOT_OPERATION",
    "T_LOT_PIECE",
    "T_RUBRIQUE_OP",
    "T_SCATEGORIE_OP",
    "T_ODS",
    "T_DIRECTION",
    "T_PROGRAMME",
    "T_SPROGRAMME",
    "T_BORDEREAU",
];

const TABLE_ID_FIELDS: [(&str, &str); 20] = [
    ("T_USER", "ID_USER"),
    ("T_BENEFICIAIRE", "ID_BENEFICIAIRE"),
    ("T_COMPTE_BANCAIRE", "ID_COMPTE"),
    ("T_CATEGORIE", "ID_CATEGORIE"),
    ("T_SCATEGORIE", "ID_SCATEGORIE"),
    ("T_OPERATION", "ID_OPERATION"),
    ("T_RUBRIQUE", "ID_RUBRIQUE"),
    ("T_PIECE", "ID_PIECE"),
    ("T_ENGAGEMENT", "ID_ENGAGEMENT"),
    ("T_PAIEMENT", "ID_PAIEMENT"),
    ("T_CP", "ID_CP"),
    ("T_LOT_OPERATION", "ID_LOT"),
    ("T_LOT_PIECE", "ID_LOT_PIECE"),
    ("T_RUBRIQUE_OP", "ID_RUBRIQUE_OP"),
    ("T_SCATEGORIE_OP", "ID_SCATEGORIE_OP"),
    ("T_ODS", "ID_ODS"),
    ("T_DIRECTION", "ID_DIRECTION"),
    ("T_PROGRAMME", "ID_PROGRAMME"),
    ("T_SPROGRAMME", "ID_SPROGRAMME"),
    ("T_BORDEREAU", "ID_BORDEREAU"),
];

fn is_valid_identifier(name: &str) -> bool {
    let mut chars = name.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn validate_table(table: &str) -> Result<(), String> {
    if !is_valid_identifier(table) || !ALLOWED_TABLES.contains(&table) {
        return Err(format!("Invalid table: {}", table));
    }
    Ok(())
}

fn validate_identifier(name: &str) -> Result<(), String> {
    if !is_valid_identifier(name) {
        return Err(format!("Invalid identifier: {}", name));
    }
    Ok(())
}

fn id_field_for(table: &str) -> Result<&'static str, String> {
    TABLE_ID_FIELDS
        .iter()
        .find(|(t, _)| *t == table)
        .map(|(_, f)| *f)
        .ok_or_else(|| format!("Unknown table: {}", table))
}

fn json_to_sql(v: &Value) -> rusqlite::types::Value {
    match v {
        Value::Null => rusqlite::types::Value::Null,
        Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
        Value::Number(num) => {
            if let Some(i) = num.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = num.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                rusqlite::types::Value::Null
            }
        }
        Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        _ => rusqlite::types::Value::Text(v.to_string()),
    }
}

fn table_rows_as_json(
    conn: &rusqlite::Connection,
    table: &str,
) -> Result<Value, String> {
    let query = format!("SELECT * FROM {}", table);
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let column_names: Vec<String> = stmt
        .column_names()
        .into_iter()
        .map(|s| s.to_string())
        .collect();

    let rows = stmt
        .query_map([], |row| {
            let mut map = serde_json::Map::new();
            for (i, col) in column_names.iter().enumerate() {
                let val: rusqlite::types::Value = row.get(i)?;
                let json_val = match val {
                    rusqlite::types::Value::Null => Value::Null,
                    rusqlite::types::Value::Integer(n) => {
                        if col == "SAI_ENG" || col == "SAI_PAI" || col == "ATTRIBUER" {
                            Value::Bool(n != 0)
                        } else {
                            Value::Number(serde_json::Number::from(n))
                        }
                    }
                    rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(f)
                        .map(Value::Number)
                        .unwrap_or(Value::Null),
                    rusqlite::types::Value::Text(t) => Value::String(t),
                    rusqlite::types::Value::Blob(_) => Value::Null,
                };
                map.insert(col.clone(), json_val);
            }
            Ok(Value::Object(map))
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }

    Ok(Value::Array(list))
}

#[tauri::command]
pub fn get_database(state: State<'_, DatabaseState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut db_json = serde_json::Map::new();
    for table in ALLOWED_TABLES {
        let rows = table_rows_as_json(&conn, table)?;
        db_json.insert(table.to_string(), rows);
    }

    Ok(Value::Object(db_json))
}

#[tauri::command]
pub fn export_database(state: State<'_, DatabaseState>) -> Result<Value, String> {
    get_database(state)
}

/// Existing column names of a table (used to skip unknown/cloud-only keys like `created_at`,
/// so offline inserts/updates never fail with "no such column").
fn table_columns(conn: &rusqlite::Connection, table: &str) -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();
    if let Ok(mut stmt) = conn.prepare(&format!("PRAGMA table_info({})", table)) {
        if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(1)) {
            for r in rows.flatten() {
                set.insert(r);
            }
        }
    }
    set
}

/// Insert or replace a row keeping its explicit primary key (used for Supabase → SQLite mirroring).
#[tauri::command]
pub fn upsert_item(
    state: State<'_, DatabaseState>,
    table: String,
    item: Value,
) -> Result<i64, String> {
    validate_table(&table)?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let obj = item.as_object().ok_or_else(|| "Item must be a JSON object".to_string())?;
    let known = table_columns(&conn, &table);
    let mut columns = Vec::new();
    let mut placeholders = Vec::new();
    let mut values: Vec<rusqlite::types::Value> = Vec::new();

    for (k, v) in obj {
        if !known.contains(k) {
            continue;
        }
        validate_identifier(k)?;
        columns.push(k.clone());
        placeholders.push("?");
        values.push(json_to_sql(v));
    }

    if columns.is_empty() {
        return Err("No valid columns to upsert".to_string());
    }

    let id_field = id_field_for(&table)?;
    let explicit_id = obj.get(id_field).and_then(|v| v.as_i64());

    let sql = format!(
        "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
        table,
        columns.join(", "),
        placeholders.join(", ")
    );

    let params_refs: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
    conn.execute(&sql, params_refs.as_slice()).map_err(|e| e.to_string())?;

    Ok(explicit_id.unwrap_or(conn.last_insert_rowid()))
}

/// Writes an AES-256-GCM encrypted backup (passphrase derived via PBKDF2).
/// Legacy plain-JSON backups remain importable through read_backup.
#[tauri::command]
pub fn save_backup(content: String, path: String, passphrase: String) -> Result<(), String> {
    if passphrase.trim().chars().count() < 6 {
        return Err("PASSPHRASE_REQUIRED: backup passphrase must be at least 6 characters".to_string());
    }
    let encrypted = crate::security::encrypt_backup(content.as_bytes(), passphrase.trim())
        .map_err(|e| format!("Failed to encrypt backup: {}", e))?;
    std::fs::write(&path, encrypted).map_err(|e| format!("Failed to write backup: {}", e))
}

#[tauri::command]
pub fn read_backup(path: String, passphrase: Option<String>) -> Result<String, String> {
    let data = std::fs::read(&path).map_err(|e| format!("Failed to read backup: {}", e))?;

    if crate::security::is_encrypted_backup(&data) {
        let pass = passphrase.unwrap_or_default();
        if pass.trim().chars().count() < 6 {
            return Err("PASSPHRASE_REQUIRED".to_string());
        }
        let plain = crate::security::decrypt_backup(&data, pass.trim())
            .map_err(|e| if e == "WRONG_PASSPHRASE" { e } else { format!("Decryption failed: {}", e) })?;
        String::from_utf8(plain).map_err(|e| format!("Invalid backup content: {}", e))
    } else {
        // Legacy unencrypted JSON backup
        String::from_utf8(data).map_err(|e| format!("Invalid backup file: {}", e))
    }
}

/// Export a consistent snapshot of the live SQLite database to the given path.
#[tauri::command]
pub fn export_sqlite_db(state: State<'_, DatabaseState>, path: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let dest = std::path::Path::new(&path);
    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    if dest.exists() {
        std::fs::remove_file(dest).map_err(|e| format!("Cannot overwrite existing file: {}", e))?;
    }

    // VACUUM INTO produces a clean, consistent single-file snapshot (includes WAL data)
    let escaped = path.replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}';", escaped))
        .map_err(|e| format!("VACUUM INTO failed: {}", e))?;

    Ok(())
}

/// Export the full Supabase dataset (provided as JSON) into a brand-new SQLite file
/// with the app's official schema (same as goft3_local.db, but containing only cloud rows).
#[tauri::command]
pub fn export_supabase_sqlite(path: String, db_json: Value) -> Result<u32, String> {
    if path.trim().is_empty() {
        return Err("Empty export path".into());
    }
    let dest = std::path::PathBuf::from(&path);
    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    // Fresh file only (remove previous export + WAL sidecars if present)
    for suffix in ["", "-wal", "-shm"] {
        let p = std::path::PathBuf::from(format!("{}{}", path, suffix));
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| format!("Cannot replace file: {}", e))?;
        }
    }

    // Create schema (init_database also seeds a default admin — cleared below)
    let mut conn = crate::db::init_database(&dest).map_err(|e| e.to_string())?;

    let table_order = [
        "T_USER",
        "T_BENEFICIAIRE",
        "T_CATEGORIE",
        "T_DIRECTION",
        "T_PROGRAMME",
        "T_RUBRIQUE",
        "T_SCATEGORIE",
        "T_SPROGRAMME",
        "T_OPERATION",
        "T_CP",
        "T_LOT_OPERATION",
        "T_RUBRIQUE_OP",
        "T_SCATEGORIE_OP",
        "T_PIECE",
        "T_ENGAGEMENT",
        "T_ODS",
        "T_LOT_PIECE",
        "T_PAIEMENT",
        "T_COMPTE_BANCAIRE",
        "T_BORDEREAU",
    ];

    conn.execute_batch("PRAGMA foreign_keys = OFF;").ok();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Clear seeded/legacy rows so the export contains ONLY Supabase data
    for t in table_order.iter().rev() {
        validate_table(t)?;
        tx.execute(&format!("DELETE FROM {}", t), [])
            .map_err(|e| e.to_string())?;
    }

    let mut total: u32 = 0;
    let obj = db_json
        .as_object()
        .ok_or_else(|| "db_json must be an object of tables".to_string())?;

    for tbl in table_order {
        validate_table(tbl)?;
        let rows_val = match obj.get(tbl) {
            Some(Value::Array(a)) => a,
            _ => continue,
        };
        if rows_val.is_empty() {
            continue;
        }

        // Only columns that exist in the official schema (skip e.g. Supabase created_at)
        let mut existing_cols: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        {
            let mut stmt = tx
                .prepare(&format!("PRAGMA table_info({})", tbl))
                .map_err(|e| e.to_string())?;
            let col_rows = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| e.to_string())?;
            for c in col_rows.flatten() {
                existing_cols.insert(c);
            }
        }

        for row_val in rows_val {
            if let Some(row_obj) = row_val.as_object() {
                let mut cols = Vec::new();
                let mut placeholders = Vec::new();
                let mut vals: Vec<rusqlite::types::Value> = Vec::new();

                for (k, v) in row_obj {
                    validate_identifier(k)?;
                    if !existing_cols.contains(k.as_str()) {
                        continue;
                    }
                    cols.push(k.clone());
                    placeholders.push("?");
                    vals.push(json_to_sql(v));
                }

                if !cols.is_empty() {
                    let sql = format!(
                        "INSERT INTO {} ({}) VALUES ({})",
                        tbl,
                        cols.join(", "),
                        placeholders.join(", ")
                    );
                    let params_refs: Vec<&dyn rusqlite::ToSql> =
                        vals.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
                    tx.execute(&sql, params_refs.as_slice())
                        .map_err(|e| format!("Insert into {} failed: {}", tbl, e))?;
                    total += 1;
                }
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA optimize;").ok();

    Ok(total)
}

/// Return the path of the active local SQLite database.
#[tauri::command]
pub fn get_local_db_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = crate::db::get_db_path(&app).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Enable/disable the native window close (X) button.
/// Called from JS on login (false) / logout (true) so the user must use the
/// in-app logout button while a session is open.
#[tauri::command]
pub fn set_window_close_enabled(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_closable(enabled).map_err(|e| e.to_string())
}

/// Write a binary file to the selected path. Used internally to save exported
/// Excel/CSV files because the WebView routinely blocks programmatic anchor
/// downloads (blob: URLs) inside the packaged desktop app.
#[tauri::command]
pub fn save_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let dest = std::path::Path::new(&path);
    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    std::fs::write(dest, contents).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn add_item(
    state: State<'_, DatabaseState>,
    table: String,
    item: Value,
) -> Result<i64, String> {
    validate_table(&table)?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let obj = item.as_object().ok_or_else(|| "Item must be a JSON object".to_string())?;
    let pk = id_field_for(&table)?;
    let known = table_columns(&conn, &table);
    let mut columns = Vec::new();
    let mut placeholders = Vec::new();
    let mut values: Vec<rusqlite::types::Value> = Vec::new();

    for (k, v) in obj {
        // Skip only the auto-increment primary key (assigned by SQLite);
        // keep foreign keys like ID_OPERATION / ID_BENEFICIAIRE — they are
        // required (NOT NULL) and must be inserted for the row to be saved.
        if k == &pk {
            continue;
        }
        if !known.contains(k) {
            continue;
        }
        validate_identifier(k)?;

        columns.push(k.clone());
        placeholders.push("?");
        values.push(json_to_sql(v));
    }

    if columns.is_empty() {
        return Err("No valid columns to insert".to_string());
    }

    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        table,
        columns.join(", "),
        placeholders.join(", ")
    );

    let params_refs: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
    conn.execute(&sql, params_refs.as_slice()).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_item(
    state: State<'_, DatabaseState>,
    table: String,
    id_field: String,
    id: i64,
    item: Value,
) -> Result<bool, String> {
    validate_table(&table)?;
    let expected_id_field = id_field_for(&table)?;
    if id_field != expected_id_field {
        return Err(format!(
            "Invalid id field for {}: expected {}",
            table, expected_id_field
        ));
    }

    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let obj = item.as_object().ok_or_else(|| "Item must be a JSON object".to_string())?;
    let known = table_columns(&conn, &table);
    let mut set_clauses = Vec::new();
    let mut values: Vec<rusqlite::types::Value> = Vec::new();

    for (k, v) in obj {
        if k == &id_field {
            continue;
        }
        if !known.contains(k) {
            continue;
        }
        validate_identifier(k)?;

        set_clauses.push(format!("{} = ?", k));
        values.push(json_to_sql(v));
    }

    if set_clauses.is_empty() {
        return Ok(false);
    }

    values.push(rusqlite::types::Value::Integer(id));

    let sql = format!(
        "UPDATE {} SET {} WHERE {} = ?",
        table,
        set_clauses.join(", "),
        id_field
    );

    let params_refs: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
    let rows_affected = conn.execute(&sql, params_refs.as_slice()).map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

#[tauri::command]
pub fn delete_item(
    state: State<'_, DatabaseState>,
    table: String,
    id_field: String,
    id: i64,
) -> Result<bool, String> {
    validate_table(&table)?;
    let expected_id_field = id_field_for(&table)?;
    if id_field != expected_id_field {
        return Err(format!(
            "Invalid id field for {}: expected {}",
            table, expected_id_field
        ));
    }

    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let sql = format!("DELETE FROM {} WHERE {} = ?1", table, id_field);
    let rows_affected = conn.execute(&sql, params![id]).map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

#[tauri::command]
pub fn delete_operation_cascade(
    state: State<'_, DatabaseState>,
    operation_id: i64,
) -> Result<bool, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let rows = tx
        .execute(
            "DELETE FROM T_OPERATION WHERE ID_OPERATION = ?1",
            params![operation_id],
        )
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    Ok(rows > 0)
}

#[tauri::command]
pub fn reset_database(state: State<'_, DatabaseState>) -> Result<bool, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let tables_to_delete = [
        "T_COMPTE_BANCAIRE",
        "T_PAIEMENT",
        "T_ENGAGEMENT",
        "T_ODS",
        "T_LOT_PIECE",
        "T_PIECE",
        "T_RUBRIQUE_OP",
        "T_SCATEGORIE_OP",
        "T_LOT_OPERATION",
        "T_CP",
        "T_OPERATION",
        "T_SPROGRAMME",
        "T_PROGRAMME",
        "T_SCATEGORIE",
        "T_CATEGORIE",
        "T_RUBRIQUE",
        "T_BENEFICIAIRE",
        "T_DIRECTION",
        "T_USER",
        "T_BORDEREAU",
    ];

    for t in tables_to_delete {
        tx.execute(&format!("DELETE FROM {}", t), [])
            .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "INSERT INTO T_USER (USERNAME, PASSWORD, ROLE) VALUES (?1, ?2, ?3)",
        params![
            "admin",
            "$2b$10$rA9vBL8p087PyWkp4gge1OkLV2tTLhb.ABfM2k/b.LlpyLoaKM68C",
            "admin"
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(true)
}

/// Replace all local rows with the provided dataset (Supabase mirror / file restore).
/// Resilient: ignores unknown columns (e.g. Supabase created_at), disables FK checks
/// during the bulk load, and skips broken rows instead of aborting the whole import.
#[tauri::command]
pub fn import_database(
    state: State<'_, DatabaseState>,
    db_json: Value,
) -> Result<u32, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    // FK enforcement must be toggled OUTSIDE the transaction
    conn.execute_batch("PRAGMA foreign_keys = OFF;").ok();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let tables_to_delete = [
        "T_COMPTE_BANCAIRE",
        "T_PAIEMENT",
        "T_ENGAGEMENT",
        "T_ODS",
        "T_LOT_PIECE",
        "T_PIECE",
        "T_RUBRIQUE_OP",
        "T_SCATEGORIE_OP",
        "T_LOT_OPERATION",
        "T_CP",
        "T_OPERATION",
        "T_SPROGRAMME",
        "T_PROGRAMME",
        "T_SCATEGORIE",
        "T_CATEGORIE",
        "T_RUBRIQUE",
        "T_BENEFICIAIRE",
        "T_DIRECTION",
        "T_USER",
        "T_BORDEREAU",
    ];

    for t in tables_to_delete {
        tx.execute(&format!("DELETE FROM {}", t), [])
            .map_err(|e| e.to_string())?;
    }

    let table_order = [
        "T_USER",
        "T_BENEFICIAIRE",
        "T_CATEGORIE",
        "T_DIRECTION",
        "T_PROGRAMME",
        "T_RUBRIQUE",
        "T_SCATEGORIE",
        "T_SPROGRAMME",
        "T_OPERATION",
        "T_CP",
        "T_LOT_OPERATION",
        "T_RUBRIQUE_OP",
        "T_SCATEGORIE_OP",
        "T_PIECE",
        "T_ENGAGEMENT",
        "T_ODS",
        "T_LOT_PIECE",
        "T_PAIEMENT",
        "T_COMPTE_BANCAIRE",
        "T_BORDEREAU",
    ];

    let obj = db_json
        .as_object()
        .ok_or_else(|| "Import payload must be a JSON object".to_string())?;

    let mut inserted: u32 = 0;
    let mut skipped: u32 = 0;

    for &tbl in &table_order {
        validate_table(tbl)?;
        let rows_val = match obj.get(tbl) {
            Some(Value::Array(a)) => a,
            _ => continue,
        };
        if rows_val.is_empty() {
            continue;
        }

        // Official columns only — skip cloud-only fields (created_at, etc.)
        let mut existing_cols: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        {
            let mut stmt = tx
                .prepare(&format!("PRAGMA table_info({})", tbl))
                .map_err(|e| e.to_string())?;
            let col_rows = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| e.to_string())?;
            for c in col_rows.flatten() {
                existing_cols.insert(c);
            }
        }

        for row_val in rows_val {
            if let Some(row_obj) = row_val.as_object() {
                let mut cols = Vec::new();
                let mut placeholders = Vec::new();
                let mut vals: Vec<rusqlite::types::Value> = Vec::new();

                for (k, v) in row_obj {
                    validate_identifier(k)?;
                    if !existing_cols.contains(k.as_str()) {
                        continue;
                    }
                    cols.push(k.clone());
                    placeholders.push("?");
                    vals.push(json_to_sql(v));
                }

                if cols.is_empty() {
                    skipped += 1;
                    continue;
                }

                let sql = format!(
                    "INSERT INTO {} ({}) VALUES ({})",
                    tbl,
                    cols.join(", "),
                    placeholders.join(", ")
                );
                let params_refs: Vec<&dyn rusqlite::ToSql> =
                    vals.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
                match tx.execute(&sql, params_refs.as_slice()) {
                    Ok(_) => inserted += 1,
                    Err(e) => {
                        // Skip broken row (CHECK/NOT NULL/UNIQUE) — keep the rest
                        skipped += 1;
                        println!("[import] skipped {}.{}: {}", tbl, inserted + skipped, e);
                    }
                }
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;").ok();

    if inserted == 0 && skipped > 0 {
        return Err(format!(
            "All {} rows were rejected by the local schema",
            skipped
        ));
    }

    Ok(inserted)
}
