---
kind: external_dependency
name: GitHub Releases — signed update feed for tauri-plugin-updater
slug: github-releases-updater
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

### GitHub Releases
- Client constraint: the JS layer intentionally does NOT pre-flight the endpoint via browser fetch — it delegates entirely to the Rust updater stack to avoid WebView CORS failures. A 404 is treated as "no release published yet" rather than a server outage.
- Platform targeting: current manifest only declares `windows-x86_64` with an NSIS installer; Linux/macOS entries must be added alongside their signatures when building those targets.