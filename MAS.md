# haldraw → Mac App Store distribution

Forward-looking roadmap for what it would take to move haldraw from unsigned `.dmg` sharing to proper Mac App Store distribution. Captured as a reference for when the app is ready for a wider audience; no work here is in-flight yet.

## Context

Current state (v0.2.0):

- Electron 33 + electron-builder 25, React/TS renderer, arm64 only.
- Unsigned `.dmg` produced by `npm run package`. `mac.identity: null` explicitly disables signing.
- `BrowserWindow` runs with `sandbox: false`. Preload uses `contextBridge` + `ipcRenderer`.
- Native dep: `better-sqlite3`. DB at `app.getPath('userData')/haldraw.db`.
- No network calls, no telemetry, no auto-update.

Two things that changed under Apple's surface since the last time shipped that are load-bearing for MAS in 2026:

1. **Privacy manifests** (`PrivacyInfo.xcprivacy`) have been required since mid-2024 — even for apps that collect nothing.
2. **Sandbox + hardened runtime + notarization** all still required, tooling around them (Transporter.app, `notarytool`, electron-builder's `mas` target) has shifted.

## Two rungs on the ladder

### Rung 1 — Developer ID notarized DMG (no MAS)

Proper version of today's flow. Users download the DMG and launch normally, no Gatekeeper prompt. No App Store, no sandbox, no review.

What it takes:

1. Renew **Apple Developer Program** ($99/yr individual).
2. **Developer ID Application** cert in Keychain.
3. **App-specific password** for `notarytool`.
4. `package.json` mac section: drop `identity: null` and `hardenedRuntime: false`; add `notarize: true`.
5. `build/entitlements.mac.plist` with `com.apple.security.cs.allow-jit` and `com.apple.security.cs.allow-unsigned-executable-memory` (V8 needs JIT).
6. Env vars: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
7. `npm run package` now signs, notarizes, staples.

Effort: half a day first time. Future releases are just `npm run package`.

### Rung 2 — Mac App Store submission

Order of magnitude more involved. Multi-phase.

#### A. Apple-side paperwork

- Bundle ID `net.cognosa.haldraw` registered in Developer portal.
- Two new certs: **3rd Party Mac Developer Application**, **3rd Party Mac Developer Installer**.
- **Mac App Store provisioning profile** downloaded.
- **App Store Connect** listing: name, subtitle, category, screenshots (arm64 resolutions), app icon, support/marketing/privacy policy URLs, tax + banking forms.
- Export compliance self-attestation (haldraw uses no crypto — "exempt").
- Age rating questionnaire.

#### B. App-side changes

1. **Flip `webPreferences.sandbox` to `true`** in [electron/main.ts](electron/main.ts). Current `sandbox: false` disqualifies.
2. `build/entitlements.mas.plist`:
   - `com.apple.security.app-sandbox` (required)
   - `com.apple.security.files.user-selected.read-write` (Save-PNG / Save-SVG)
   - `com.apple.security.cs.allow-jit`
   - `com.apple.security.cs.allow-unsigned-executable-memory`
3. `build/entitlements.mas.inherit.plist` — helper processes.
4. `build/PrivacyInfo.xcprivacy` — empty data collection, declare Required Reason APIs used by Electron + `better-sqlite3` (file timestamps via `stat`, UserDefaults, etc.). Electron ≥ v30 ships its own; audit for version we're on at submit time.
5. **DB path migration** in [electron/db.ts](electron/db.ts) — under sandbox, `app.getPath('userData')` becomes `~/Library/Containers/net.cognosa.haldraw/…`, stranding existing users' data at `~/Library/Application Support/haldraw/`. One-shot migration on first sandboxed launch copies the DB across.
6. `LSMinimumSystemVersion` set (via `mac.minimumSystemVersion` in electron-builder). macOS 10.15+ for Electron 33.
7. Audit image-paste, drag-drop, `shell.openExternal` all still work under sandbox (all should; clipboard + user-selected files + LaunchServices are allowed).

#### C. electron-builder configuration

Extend `package.json` build:

```jsonc
"mas": {
  "category": "public.app-category.productivity",
  "entitlements": "build/entitlements.mas.plist",
  "entitlementsInherit": "build/entitlements.mas.inherit.plist",
  "provisioningProfile": "build/embedded.provisionprofile",
  "hardenedRuntime": true,
  "type": "distribution"
},
"masDev": { "type": "development" }
```

New script: `"mas": "electron-vite build && electron-builder --mac mas --arm64"` — produces `.pkg` for upload.

#### D. Submission

1. Build `.pkg` via `npm run mas`.
2. Upload with **Transporter.app** (or `xcrun notarytool`).
3. Apple processes (~30 min), build appears in App Store Connect.
4. Fill submission metadata, send for review.
5. Review: 1–7 days. Expect one rejection round the first time (missing privacy-manifest entries, missing accessibility labels, broken metadata links are most common).

### Electron + MAS gotchas

- **Helper binaries** (Electron Helper, Helper (GPU), Helper (Renderer), Helper (Plugin)) all need signing. electron-builder handles, but inherit entitlements must cover them.
- **JIT entitlement** non-negotiable — without it, hardened runtime kills V8 on launch.
- **Sandbox DB path migration** is the trap — old users lose data without the one-shot copy.
- **`electron-updater` does NOT work for MAS** — Apple handles updates. Guard auto-update to Developer ID builds only.
- **Third-party library privacy manifests** — most of the JS stack (React, Zustand, Lucide, ulid) is fine; `better-sqlite3` is native and warrants a privacy-manifest audit.

## Effort & cost summary

| Rung | Unlocks | One-time | Recurring | $/yr |
|---|---|---|---|---|
| 1 — Developer ID | Zero-prompt DMG launch | ½ day | `npm run package` per release | $99 |
| 2 — Mac App Store | Discoverability, one-click install, Store reviews | 2–4 days first time (sandbox + rejection rounds) | ½ day per major release | Same $99 |

## Recommended sequencing

1. Stay on unsigned `.dmg` until someone non-friend is asking for the app. No sense paying $99 until there's a reason.
2. Jump to **Rung 1** when friction of "can't open, Apple says not safe" starts to hurt. Half-day, solves 90% of install pain.
3. Jump to **Rung 2** only if you want App Store discoverability or decide to charge. Budget a week for first submission including review cycles.

## Files this touches when executed

### Rung 1

- `package.json` — drop `identity: null` / `hardenedRuntime: false`, add `notarize: true`.
- `build/entitlements.mac.plist` — new, JIT allowances.
- `BUILD.md` — swap "sharing with a friend" Gatekeeper-bypass paragraph for the signed/notarized flow.

### Rung 2

- `package.json` — new `mas` / `masDev` blocks, new `npm run mas` script.
- `build/entitlements.mas.plist` and `build/entitlements.mas.inherit.plist` — new.
- `build/embedded.provisionprofile` — downloaded from Apple portal.
- `build/PrivacyInfo.xcprivacy` — new.
- `electron/main.ts` — `webPreferences.sandbox: true`, audit preload.
- `electron/db.ts` — one-shot migration from unsandboxed path.
- `BUILD.md` (or new `MAS_SUBMIT.md`) — documented submission workflow.

## Verification when executed

### Rung 1

1. `npm run package` → signed + notarized + stapled `.dmg`.
2. Open on a clean Mac — no Gatekeeper prompt.
3. `spctl -a -vvv dist/mac-arm64/haldraw.app` → "accepted" + Developer ID.
4. `codesign -dvvv` shows hardened runtime + valid Developer ID signature.

### Rung 2

1. `npm run mas` → `.pkg`.
2. Local install via development profile → app launches sandboxed, draws, persists across restart (DB migration confirmed).
3. `codesign -dvvv --entitlements :- …/haldraw.app` shows sandbox + no missing entitlements.
4. Transporter upload → "Delivery successful."
5. Submit in App Store Connect, reach "In Review."
6. After acceptance, fresh Store install launches cleanly.

## Open questions before executing Rung 2

- Free or paid? (Affects App Store Connect paperwork either way — Paid Apps agreement required.)
- Universal (arm64 + x64) or arm64-only?
- Any planned network features? (Changes sandbox entitlement story.)
- Accessibility audit — MAS reviewers flag missing a11y labels on toolbar buttons.

---

*This is a map, not a punch list. When you're ready to ship to the Store, re-open this doc and execute step-by-step.*
