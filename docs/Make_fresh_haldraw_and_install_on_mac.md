# Make a fresh haldraw build and install it on a Mac

Record of the refresh-and-install done on the M2 Mac Studio on 2026-09-13, written as a repeatable procedure. Assumes Apple Silicon, an existing clone of the repo, and Xcode Command Line Tools (needed to compile the `better-sqlite3` native module).

## 0. Decide whether the existing build is stale

The packaged app in `dist/` is only as new as the last `npm run package`. Compare the bundle's timestamp against the last source commit:

```bash
cd ~/p33_haldraw_info_and_repo/haldraw
git fetch -q && git status -sb                       # expect: ## main...origin/main, clean
stat -f '%Sm %N' dist/mac-arm64/haldraw.app          # when was it last built?
git log --since="<that timestamp>" --name-only --format='== %h %ci' -- src electron shared package.json
```

If the second command lists any files, the built app predates real code changes and must be rebuilt. On 2026-09-13 the bundle was from 2026-04-18 12:49 but ten commits touching `src/` and `electron/` landed later that afternoon, so it was rebuilt.

Also check what, if anything, is installed:

```bash
ls -ld /Applications/haldraw.app ~/Applications/haldraw.app
defaults read /Applications/haldraw.app/Contents/Info.plist CFBundleShortVersionString
```

## 1. Bump the version (if the release is meant to be distinguishable)

Only `package.json` needs editing. The renderer reads `APP_VERSION` from `package.json` (`src/util/version.ts`) and the main process uses `app.getVersion()`, so both pick the new number up at build time. Add a matching entry at the top of `CHANGELOG.md`, then commit.

## 2. Build

```bash
npm install          # only if node_modules is missing or package.json deps changed
npm run package      # electron-vite build + electron-builder --mac --arm64, ~60-90 s
```

Output:

- `dist/mac-arm64/haldraw.app` — raw bundle, ~273 MB
- `dist/haldraw-<version>-arm64.dmg` — installer, ~100 MB

Code signing is intentionally disabled (`"identity": null` in `package.json`), so the log line `skipped macOS code signing` is expected. electron-builder downloads the matching Electron zip on first run of a given version and caches it afterward.

## 3. Install on this machine

Copy the raw bundle rather than mounting the DMG; it is faster and scriptable. Clear the quarantine flag because the app is unsigned.

```bash
ditto dist/mac-arm64/haldraw.app /Applications/haldraw.app
xattr -cr /Applications/haldraw.app
defaults read /Applications/haldraw.app/Contents/Info.plist CFBundleShortVersionString
open -a /Applications/haldraw.app
```

`ditto` overwrites an existing install in place. Quit the running app first if it is open.

## 4. Install on another Mac

Copy `dist/haldraw-<version>-arm64.dmg` over (AirDrop, iCloud, scp), open it, drag `haldraw.app` to Applications. Because the app is unsigned, the first launch needs right-click, Open, then confirm in the Gatekeeper dialog. Alternatively run the `xattr -cr` line above on that machine.

User data lives in the app's SQLite database under `~/Library/Application Support/haldraw/` and is not touched by reinstalling.

## Verify

```bash
pgrep -fl 'haldraw.app/Contents/MacOS/haldraw'
```

The About dialog and the project picker show the version string from `package.json`.
