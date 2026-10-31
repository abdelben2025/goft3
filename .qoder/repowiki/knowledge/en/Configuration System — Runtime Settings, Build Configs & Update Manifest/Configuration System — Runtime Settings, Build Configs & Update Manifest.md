---
kind: configuration_system
name: Configuration System — Runtime Settings, Build Configs & Update Manifest
category: configuration_system
scope:
    - '**'
source_files:
    - vite.config.ts
    - electron.js
    - preload.js
    - package.json
    - src-tauri/tauri.conf.json
    - src-tauri/Cargo.toml
    - src-tauri/src/main.rs
    - src-tauri/src/lib.rs
    - src-tauri/latest.json
    - services/supabaseClient.ts
    - pages/SettingsPage.tsx
    - utils/updateService.ts
---

## Overview

GOFT3 is a dual-runtime desktop app (Electron + Tauri) wrapping a React/TypeScript frontend. Configuration lives in three distinct layers:

1. **Build / packaging configuration** (Vite, Electron Builder, Tauri, Cargo)
2. **Runtime user configuration** (Supabase URL + anon key persisted in `localStorage`)
3. **Update manifest** (`latest.json` served from GitHub Releases)

There is no centralized `.env`, YAML, or TOML config loader for the TypeScript layer; environment variables are only used by Vite/Tauri build tooling.

---

## 1. Build & Packaging Configuration

### Vite (`vite.config.ts`)
- `base: './'` — relative asset paths for both Electron and Tauri webviews.
- `server.port: 3000`, `strictPort: true`, `host: '0.0.0.0'` — dev server binding.
- `envPrefix: ['VITE_', 'TAURI_ENV_*']` — only env vars with those prefixes are injected into the browser bundle.
- Node polyfills via `vite-plugin-node-polyfills`; `fs` is aliased to `./fs-stub.js` so Node APIs don't leak into the renderer.
- `exceljs` is aliased to `lib/exceljs.browser.js` because the Node entry pulls in `fs/stream/buffer` which fail inside the Tauri webview.
- Rollup manual chunking splits large vendors (`exceljs`, `jspdf`+`html2canvas`, `@supabase`, `framer-motion`, `lucide-react`+`bootstrap-icons`) into separate chunks.

### Electron (`electron.js`)
- Loads `http://localhost:3000` in development, `dist/index.html` in production.
- Uses `contextIsolation: true`, `nodeIntegration: false` — security posture.
- Preload script path is configured but `preload.js` is intentionally empty (commented: "no longer needed for local DB access as the app uses Supabase").
- External links opened via `shell.openExternal`.

### Electron Builder (`package.json` → `build` section)
- `appId: com.goft3.app`, `productName: GOFT3`.
- Windows NSIS installer (`oneClick: false`, `perMachine: true`, creates desktop/start-menu shortcuts named "GOFT3").
- Linux deb target with category `Office`.
- Output directory: `release/`.

### Tauri (`src-tauri/tauri.conf.json`)
- `productName: GOFT3`, `version: 1.1.19`, `identifier: com.goft3.app` — mirrors `package.json`.
- Dev: `beforeDevCommand: npm run dev`, `devUrl: http://localhost:3000`, `frontendDist: ../dist`.
- Single window: 1280×850, min 950×650, centered, resizable.
- CSP: strict — `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https: ws://localhost:3000 wss:`.
- Bundler: `targets: all`, icons listed under `icons/`.
- Updater plugin endpoint: `https://github.com/abdelben2025/goft3/releases/latest/download/latest.json` with an embedded minisign public key.

### Rust backend (`src-tauri/Cargo.toml`)
- Crate `goft3` (lib name `goft3_lib`), edition 2021.
- Dependencies: `tauri 2`, `rusqlite 0.31 (bundled)`, `aes-gcm`, `pbkdf2`, `sha2`, `chrono`, `serde_json`.
- Conditional `windows-sys` dependency for EFS file protection on Windows.

### Rust entry points
- `src-tauri/src/main.rs`: minimal — just calls `goft3_lib::run()` and hides console on Windows release (`#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")`).
- `src-tauri/src/lib.rs`: registers Tauri plugins (`opener`, `dialog`, `updater`, `process`), initializes SQLite database via `db::{get_db_path, init_database}`, exposes ~17 commands through `generate_handler!`.

---

## 2. Runtime User Configuration (Supabase Credentials)

**File:** `services/supabaseClient.ts`

- Keys stored in `localStorage` under fixed names:
  - `goft3_supabase_url` — project URL
  - `goft3_supabase_key` — anon/public API key
- On module load, reads these keys synchronously and either exports a fully-initialized `createClient(...)` instance or `null`.
- `isConfigured` flag guards against "Invalid URL" errors during initialization when no credentials exist.
- `saveConfiguration(url, key)` writes both values and triggers `window.location.reload()` to re-initialize the client.
- `resetConfiguration()` removes both keys and reloads.

**UI surface:** `pages/SettingsPage.tsx` renders a modal form collecting Project URL and anon key, calling `saveConfig(setupUrl, setupKey)` from `DataContext`. The form validates that the URL field is of type `url` and the key is non-empty.

**Constraint enforced by code:** A valid Supabase client is only created when both `storedUrl && isValidUrl(storedUrl) && storedKey` hold — otherwise `supabase` is `null` and features requiring it (e.g., Supabase→SQLite export) are gated behind `!supabase || !isOnline || !isDbConfigured` checks.

---

## 3. Application Version & Auto-Update

- `APP_VERSION` is imported from `types.ts` (consumed by `SettingsPage.tsx` to display current version).
- `utils/updateService.ts` wraps the Tauri updater plugin to check `https://github.com/.../releases/latest/download/latest.json`.
- `src-tauri/latest.json` is the published manifest containing `version`, `notes`, `pub_date`, and per-platform entries with `signature` (minisign) and `url`.
- `tauri.conf.json` declares the same endpoint and embeds the minisign public key for verification.

The UI flow in `SettingsPage.tsx`:
1. User clicks "التحقق من وجود تحديث".
2. `checkForUpdates()` returns `{ hasUpdate, latestVersion, notSupported, offline, checkFailed }`.
3. If `hasUpdate`, a native confirmation prompts download; `performUpdate(progressCb)` applies the update and restarts the app.
4. Progress is rendered as a percentage bar.

---

## 4. Environment Variables

No `.env` files are committed. The only env var mechanism is Vite's `define` injection:
- `envPrefix: ['VITE_', 'TAURI_ENV_*']` means any `VITE_*` or `TAURI_ENV_*` variable set at build time is statically substituted into the bundle.
- No runtime `.env` parser (dotenv, etc.) is present in dependencies.

---

## 5. Conventions Observed

- **Dual-runtime parity**: Both Electron (`electron.js`) and Tauri (`tauri.conf.json`) point at the same dev server (`localhost:3000`) and production output (`dist/index.html`).
- **Version synchronization**: `package.json.version`, `src-tauri/tauri.conf.json.version`, and `src-tauri/Cargo.toml.version` are kept in sync (all `1.1.19`).
- **App identity**: `com.goft3.app` appears in both `package.json.build.appId` and `tauri.conf.json.identifier`.
- **Supabase credentials are user-provided at runtime**, never baked into the build — stored in `localStorage` and validated before use.
- **Tauri-only features** (encrypted backup, SQLite export/import, window control) are guarded by `isTauri()` checks in the UI.
- **Security defaults**: Electron uses `contextIsolation: true` / `nodeIntegration: false`; Tauri enforces a restrictive CSP; updater signatures are verified via minisign.
- **No feature flags system**: Feature toggles are absent — behavior differences are driven by runtime detection (`isTauri()`, `isConfigured`, `isOnline`).
- **No secrets management**: Supabase keys are plain-text `localStorage` values; there is no OS keychain integration.