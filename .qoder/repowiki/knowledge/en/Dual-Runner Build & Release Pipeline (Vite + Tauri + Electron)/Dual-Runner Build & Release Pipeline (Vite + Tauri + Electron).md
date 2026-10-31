---
kind: build_system
name: Dual-Runner Build & Release Pipeline (Vite + Tauri + Electron)
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - .github/workflows/release.yml
    - src-tauri/Cargo.toml
    - src-tauri/build.rs
    - scripts/make-latest-json.ps1
---

## Build System Overview

GOFT3 is a dual-runtime desktop application with two parallel build targets:

1. **Tauri target** — the primary production path, bundling a Rust backend (`src-tauri/`) with a Vite-built React frontend into native Windows installers.
2. **Electron target** — an alternative runtime using `electron.js` and `electron-builder`, invoked via npm scripts but not part of the automated release pipeline.

The project uses **Vite** for frontend compilation, **Rust/Cargo** for the Tauri backend, and **GitHub Actions** for CI-driven releases triggered by Git tags.

## Key Files and Responsibilities

- `package.json` — Frontend entry point (`main: "electron.js"`), version source of truth (`version: "1.1.19"`), npm scripts for both runtimes, and `electron-builder` configuration (NSIS installer on Windows, `.deb` on Linux).
- `vite.config.ts` — Vite build configuration for the React/TypeScript frontend.
- `src-tauri/Cargo.toml` — Rust crate manifest; declares Tauri v2 plugins (`opener`, `dialog`, `updater`, `process`), SQLite (`rusqlite` bundled), AES-GCM encryption, PBKDF2, SHA2, and platform-specific `windows-sys` dependency.
- `src-tauri/build.rs` — Thin wrapper calling `tauri_build::build()` to generate Tauri schema files under `src-tauri/gen/schemas/`.
- `src-tauri/tauri.conf.json` — Tauri app configuration (not read here but referenced by the build).
- `.github/workflows/release.yml` — The only CI workflow; runs on `push` to tags matching `v*`.
- `scripts/make-latest-json.ps1` — PowerShell script that generates the Tauri updater manifest `latest.json` from the signed NSIS installer artifact.

## Build Flow

### Local Development

- `npm run dev` — Starts the Vite dev server for the frontend.
- `npm run tauri:dev` — Launches the Tauri dev server (Rust + Vite HMR).
- `npm run electron:start` — Runs the Electron runtime directly against the built dist.

### Production Builds

- `npm run build` — Compiles the frontend via Vite into `dist/`.
- `npm run tauri:build` — Invokes `tauri build`, which compiles the Rust backend and bundles the Vite output into platform-native artifacts.
- `npm run electron:build` / `electron:build:win` / `electron:build:linux` — Shorthand scripts that run `vite build` then delegate packaging to `electron-builder`.

### CI Release (`.github/workflows/release.yml`)

1. Triggered by pushing a tag matching `v*`.
2. Checks out the repo on `windows-latest`.
3. Sets up Node 22 (with npm cache) and Rust stable toolchain.
4. Caches Cargo registry/git/target keyed on `Cargo.lock`.
5. Installs dependencies via `npm ci`.
6. Runs `npm run tauri:build -- --bundles nsis` — builds only the NSIS bundle, gated by `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets for code signing.
7. Executes `scripts/make-latest-json.ps1 -Version <pkg.version> -Tag $env:GITHUB_REF_NAME` to produce `latest.json` alongside the installer.
8. Uploads three assets via `softprops/action-gh-release@v3`: the signed `*-setup.exe`, its `.sig` file, and `latest.json`.

## Versioning Strategy

- The application version lives in two places and must be kept in sync manually: `package.json#version` and `src-tauri/Cargo.toml#version` (both currently `1.1.19`).
- Releases are identified by Git tags following the `v<major>.<minor>.<patch>` convention (e.g. `v1.1.19`); the CI reads the tag as `$env:GITHUB_REF_NAME` and passes it to the updater manifest generator.
- The updater manifest (`latest.json`) embeds the version string from `package.json` and publishes the installer URL pointing at `https://github.com/<repo>/releases/download/<tag>/<installer>`.

## Platform Targets

- **Windows**: NSIS installer (`*.exe` + `*.sig`) produced by Tauri; Electron target also configured for NSIS with per-machine install, desktop/start-menu shortcuts, and custom icons.
- **Linux**: `.deb` package via `electron-builder`; no Tauri Linux build is included in CI.
- **macOS/iOS/Android**: Icons exist under `src-tauri/icons/{ios,android}` suggesting mobile targets were considered, but no build configuration or CI job exists for them.

## Constraints and Enforced Rules

- **CI runs only on Windows** (`runs-on: windows-latest`); Tauri code signing requires the Windows signing key stored in GitHub Secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
- **Release automation is tag-gated**: the workflow triggers exclusively on `push` events where the ref matches `v*`.
- **Updater manifest generation is mandatory before upload**: `make-latest-json.ps1` aborts if no `*-setup.exe` or corresponding `.sig` file is found, ensuring unsigned builds cannot be published through CI.
- **Both installer and manifest must be uploaded together**: the script prints instructions to upload both the `.exe` and `latest.json`, and the CI step lists both paths with `fail_on_unmatched_files: true`.
- **Node/Rust toolchains are pinned**: CI uses Node 22 and the Rust `stable` toolchain; local development requires Node ≥20 and npm ≥10 (declared in `engines`).
- **Frontend-only lint/test commands exist** (`npm run lint`, `npm run test` → `vitest run`); there is no equivalent Rust lint/test step in CI.