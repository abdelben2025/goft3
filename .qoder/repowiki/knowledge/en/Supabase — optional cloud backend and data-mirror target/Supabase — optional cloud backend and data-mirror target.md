---
kind: external_dependency
name: Supabase — optional cloud backend and data-mirror target
slug: supabase
category: external_dependency
category_hints:
    - vendor_identity
    - sdk_real_api
scope:
    - '**'
---

### Supabase
- Role: optional remote database / sync target. The app ships with a fully offline SQLite-first mode; Supabase is configured at runtime via `goft3_supabase_url` + `goft3_supabase_key` stored in `localStorage` (`services/supabaseClient.ts`).
- Stable gotcha: Supabase payloads contain cloud-only fields (e.g. `created_at`) that do not exist in the local schema — both `import_database` and `export_supabase_sqlite` explicitly filter by `PRAGMA table_info` before inserting, so adding new columns requires no client change.
- Verify exact Supabase REST/JS API surface against the official docs.