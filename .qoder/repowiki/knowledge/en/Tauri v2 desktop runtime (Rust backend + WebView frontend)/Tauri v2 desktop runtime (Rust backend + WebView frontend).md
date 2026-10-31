---
kind: external_dependency
name: Tauri v2 desktop runtime (Rust backend + WebView frontend)
slug: tauri-v2
category: external_dependency
category_hints:
    - framework_behavior
scope:
    - '**'
---

### Tauri v2
- Role: native application shell. The React/Vite frontend talks to a Rust backend through `@tauri-apps/api/core` `invoke`; commands are registered in `lib.rs` (`get_database`, `add_item`, `upsert_item`, `update_item`, `delete_item`, `delete_operation_cascade`, `reset_database`, `import_database`, `save_backup`, `read_backup`, `export_sqlite_db`, `export_supabase_sqlite`, `get_local_db_path`, `save_binary_file`, `close_window`, `set_window_close_enabled`).
- Active plugins: opener, dialog, updater, process (declared in Cargo.toml and initialized in `lib.rs`).
- Runtime detection: JS checks `window.__TAURI_INTERNALS__` / `window.__TAURI__` rather than relying on an import error, because the same code runs in Electron too (`electron.js` entry in `package.json`).
- Durable pattern: all DB mutations go through typed invoke wrappers in `services/tauriService.ts` — never call `invoke` directly from pages.