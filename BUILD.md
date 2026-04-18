# Building haldraw

How to produce a native `haldraw.app` and `.dmg` installer on macOS.

> **TL;DR** — `npm install` once, then `npm run package`. Output lands in `dist/`.

---

## What gets built

A single file: `dist/haldraw-<version>-arm64.dmg` (~100 MB). It contains the full Electron runtime + your app code + a SQLite-enabled native module, plus the haldraw app icon. Users drag `haldraw.app` from the mounted DMG into `Applications`; the app runs entirely locally with no network dependency.

The app icon is already in the repo at [`build/icon.png`](./build/icon.png) (1024×1024). `electron-builder` automatically converts it to the macOS `.icns` format during packaging — you don't need to generate anything by hand. If you want a different icon, replace that file and rebuild.

## Prerequisites

- macOS on Apple Silicon (current config only builds for `arm64`).
- **Node 20 LTS or 22 LTS recommended.** Node 25 works too, just bleeding-edge. Check with `node --version`.
- **Python 3.12 with `setuptools`** (or any 3.x where `distutils` still resolves). macOS ships a compatible Python at `/usr/local/bin/python3` when Xcode Command Line Tools are installed.
- **Xcode Command Line Tools** — `xcode-select --install` if you don't have them. Required for `better-sqlite3`'s native compile.

## Build commands

From the repo root (the folder containing `package.json`):

```bash
npm install               # once, after cloning — ~1 minute
npm run package           # produces dist/haldraw-<ver>-arm64.dmg — ~60–90 seconds
```

`npm run package` does three things in sequence:

1. `electron-vite build` — compiles the main process, preload script, and renderer to `out/`.
2. `@electron/rebuild` rebuilds `better-sqlite3` against Electron's bundled Node.
3. `electron-builder --mac --arm64` packages it all, codesign is disabled, produces the DMG.

When it finishes, look for the DMG in `dist/`:

```bash
ls dist/
# haldraw-0.2.0-arm64.dmg   mac-arm64/   builder-debug.yml
```

`mac-arm64/haldraw.app` is the raw app bundle if you prefer it over the DMG.

## Installing locally

```bash
open dist/haldraw-0.2.0-arm64.dmg     # adjust version number
```

Drag `haldraw` → `Applications`. First launch:

- macOS will say *"haldraw cannot be opened because Apple cannot check it for malicious software."*
- Right-click the app in Applications → **Open** → **Open**.
- After that it launches normally from anywhere.

Alternative one-liner to skip the prompt ahead of time (runs after installation):

```bash
xattr -dr com.apple.quarantine /Applications/haldraw.app
```

## Sharing with a friend

Send them the `.dmg` (iCloud Drive, Dropbox, etc.) plus the two lines of Gatekeeper-bypass instructions above. They need the same arm64 architecture (any M-series Mac) — the build currently doesn't target Intel.

Their data lives on their machine at `~/Library/Application Support/haldraw/haldraw.db`. Nothing syncs, nothing phones home.

## Rebuilding after code changes

You can keep using `npm run dev` for day-to-day development — no need to repackage. When you're ready to share a new build, just bump the version and repackage:

```bash
# edit package.json: "version": "0.3.0"
npm run package
# dist/haldraw-0.3.0-arm64.dmg
```

Different version numbers mean friends can install side-by-side (under different paths if they rename, or overwrite the previous).

## Making the app signed & notarized later

Not required for sharing with friends; required for "normal" launch without the Gatekeeper prompt.

You'll need:

1. An **Apple Developer Program** membership ($99/yr).
2. A **Developer ID Application** certificate installed in Keychain.
3. To remove the `identity: null` line from `package.json`'s `build.mac` section so `electron-builder` auto-discovers your cert.
4. Set up notarization — easiest via `electron-notarize`, which `electron-builder` can invoke. You configure Apple ID credentials via env vars (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) and add an `afterSign` hook.

Skip this for now. Come back to it only if haldraw outgrows the "share with a few friends" phase.

## Troubleshooting

**`npm install` fails with `ModuleNotFoundError: No module named 'distutils'`** — your Python 3.12+ is missing the compat shim. Fix: `python3 -m pip install --user --upgrade setuptools`, then delete `node_modules` + `package-lock.json` and rerun `npm install`. The v0.2.0 `better-sqlite3` upgrade should avoid this, but older clones of the repo trip on it.

**`npm run package` fails with "cannot find Xcode"** — run `xcode-select --install`.

**DMG won't open / "damaged" error** — make sure you ran `npm run package` (not `npm run build`, which only builds the JS/CSS). The DMG is only produced by the package step.

**App opens but crashes immediately** — check the Console.app for crash logs, filter by "haldraw". Common cause: stale `out/` directory from a previous build. `rm -rf out dist && npm run package`.

**Native-module architecture mismatch** — if you rebuilt on Intel Mac but target arm64 (or vice versa), delete `node_modules/` and reinstall in the intended target arch.

## What about Intel Macs, Windows, or Linux?

`package.json`'s `build.mac.target` is currently `arm64` only. To produce a universal Mac binary (Intel + Apple Silicon) add `"x64"` to the arch list — doubles the DMG size.

Windows / Linux require adding a matching `win` or `linux` section. `electron-builder`'s docs cover this; most of the work is choosing which installer format you want (e.g. `nsis` for Windows, `AppImage` for Linux) and whether you'll code-sign there too.
