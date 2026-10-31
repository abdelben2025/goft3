---
kind: error_handling
name: 'Error Handling: Toast-Driven User Feedback with Centralized Message Normalization'
category: error_handling
scope:
    - '**'
source_files:
    - utils/errorMessage.ts
    - context/ToastContext.tsx
    - components/Toast.tsx
    - services/supabaseClient.ts
    - hooks/useDatabase.ts
    - src-tauri/src/commands.rs
    - App.tsx
---

## Approach

The application uses a **toast-driven user feedback** model rather than traditional exception propagation. Errors are surfaced to users through a global `ToastContext` (`context/ToastContext.tsx`) that renders a React component (`components/Toast.tsx`) with type-specific styling and sound feedback. There is no centralized error class hierarchy, no middleware pipeline, and no `panic`/`recover` equivalent — Rust errors in the Tauri backend are returned as plain `String`s via `Result<T, String>`.

## Key Files and Packages

- `utils/errorMessage.ts` — central normalizer that extracts a human-readable string from any thrown value (plain strings, Supabase error objects, Tauri command error strings, nested objects). It tries `message`, `msg`, `error_description`, `error`, `details`, then falls back to `code`/`hint`, then JSON serialization, then `String(err)`. The outer `try/catch` ensures the formatter itself never throws.
- `context/ToastContext.tsx` — provides `showToast(message, type)` where `type` is one of `'success' | 'error' | 'info' | 'loading' | 'event'`. Auto-dismisses after 3s (5s for `'event'`), never auto-dismisses `'loading'`.
- `components/Toast.tsx` — visual + audio presentation layer. Plays WAV sounds (`sounds/success.wav`, `sounds/error.wav`, etc.) with a WebAudio oscillator fallback when files are unavailable.
- `services/supabaseClient.ts` — guards against unconfigured Supabase by exporting `supabase = null` when URL/key are missing; callers must check before use.
- `hooks/useDatabase.ts` — throws `Error("Supabase not configured")` and `Error("Failed to fetch summary data")` when the client is absent or queries return errors; these bubble up to React Query's error boundary.
- `src-tauri/src/commands.rs` — all Tauri commands return `Result<T, String>`; validation helpers `validate_table`, `validate_identifier`, `id_field_for` return `Err(String)` for invalid inputs (e.g. `"Invalid table: ..."`, `"No valid columns to insert"`, `"PASSPHRASE_REQUIRED"`).
- `App.tsx` — top-level consumer of `useToast`; wraps the app in `ToastProvider` and surfaces update-service failures via `showToast(errorMessage(updErr), 'error')`.

## Architecture and Conventions

1. **Errors are normalized at the UI boundary.** Callers catch raw errors and pass them through `errorMessage()` before calling `showToast(..., 'error')`. This pattern appears across pages and forms (e.g. `BeneficiairesPage.tsx`: `showToast(\`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}\`, 'error')`).
2. **Tauri backend errors are plain strings.** No custom error types exist in Rust; every `#[tauri::command]` returns `Result<T, String>`. Error categories are encoded as prefixes in messages (e.g. `"PASSPHRASE_REQUIRED"`, `"VACUUM INTO failed: ..."`, `"Insert into {} failed: ..."`).
3. **Validation is input-centric, not result-centric.** Table names and column identifiers are whitelisted via `ALLOWED_TABLES` and validated character-by-character before any SQL is constructed, preventing both injection and unknown-table errors from reaching the database layer.
4. **Import resilience.** In `import_database`, individual row inserts are wrapped in `match tx.execute(...) { Ok(_) => inserted += 1, Err(e) => skipped += 1 }` so a single bad row does not abort the whole import; only if *all* rows are rejected does it return an error.
5. **Supabase client is opt-in.** `supabase` is `null` until configured via `localStorage`; hooks explicitly throw when it is absent, making misconfiguration a developer error rather than a silent failure.
6. **Toast types encode semantics.** `'success'` / `'error'` / `'info'` / `'loading'` / `'event'` drive both visual style and sound selection. Deletions within success toasts are detected by Arabic keywords (`حذف|مسح|إزالة`) and play a distinct "delete" tone.
7. **React Query owns async error state.** Data fetching lives in `useQuery` hooks; errors thrown from `queryFn` are handled by React Query's built-in error state, not by try/catch in components.
8. **No panics/recover.** The Rust code uses `map_err` and `?` throughout; there is no `panic!` usage in the Tauri backend. JavaScript code avoids `throw` outside of configuration checks and explicit error paths.

## Conventions and Constraints

- All user-facing error messages go through `errorMessage()` before being passed to `showToast(..., 'error')` — observed consistently in `App.tsx`, `BeneficiairesPage.tsx`, and other pages/forms.
- Tauri commands return `Result<T, String>`; callers on the JS side receive the string payload and display it via toast.
- Table access is restricted to the `ALLOWED_TABLES` whitelist; any other table name produces an `Err("Invalid table: ...")` before SQL execution.
- Column identifiers are validated with `is_valid_identifier` (ASCII alpha start, alphanumeric + underscore body) before being interpolated into SQL.
- The `ToastProvider` must wrap consumers; `useToast()` throws `Error('useToast must be used within a ToastProvider')` if invoked outside the provider.
- Audio playback failures are swallowed silently and fall back to WebAudio synthesis; this path is intentionally non-fatal.
- Supabase operations propagate their native error object directly (`throw error`) from `useDatabase.ts`, relying on `errorMessage()` downstream to normalize it.