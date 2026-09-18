# haldraw

Local infinite-canvas diagramming app. Excalidraw/tldraw-style, runs as a native macOS Electron app, stores everything in a single local SQLite file.

## Run

Requirements: **Node 18+** (20+ recommended) and npm. macOS assumed; other platforms need small tweaks to the `build` section of `package.json`.

From the project root (the directory containing `package.json`):

```bash
npm install        # first time only — downloads deps + rebuilds better-sqlite3 for Electron
npm run dev        # every time after — compiles main+preload, runs Vite, opens the Electron window
```

That's it — the Electron window is the app. There is no separate "web" or "server" mode.

Data lives at `~/Library/Application Support/haldraw/haldraw.db`. Delete that file to reset the app to a clean slate.

## Package

```bash
npm run package    # produces .dmg under dist/
```

Packaging uses `build/icon.png` for the app icon. For full build & distribution instructions (prerequisites, how to install the built app, sharing with friends, troubleshooting), see [BUILD.md](./BUILD.md). For the forward-looking path to a signed Developer ID DMG or a Mac App Store submission, see [MAS.md](./MAS.md).

## Features

- **Projects & boards** — unlimited, renameable, deletable. Autosave on every change. `⌘K` jumps to any board or project by fuzzy search.
- **Infinite canvas** — pan with `Space`+drag or middle-mouse, zoom with `⌘`+scroll, `⌘=` / `⌘−` or the toolbar buttons; `⌘0` resets, `⌘1` fits.
- **Shapes** — rectangle, square (1:1 lock), ellipse/circle, diamond, 3D box, data store, collection, line, arrow, text, freehand ink (`P`). All resizable, rotatable through a full 360°. The Shape row in the properties panel turns a shape into another kind in place.
- **Text** — rotatable to any angle, double-click to edit, works on shapes too as a centred label that wraps; exports wrap the same way.
- **Connectors** — `C` to drag from one shape to another, or `L` / `A` from anywhere; endpoints track shapes when moved. Sixteen connection slots per shape: release a line end on a dot to attach there, or anywhere inside the shape for Auto. Routing (straight, right-angle, curved) and a head style for each end (none, arrow, open arrow, dot, diamond, crow's foot) in the properties panel; labels are draggable pills. Lines live on layers like shapes; hold `⌥` while drawing to skip snapping.
- **Vectorize** — select a reference image and press **Vectorize…** to get an editable draft of its boxes, text and connectors on a Draft layer above it, from a Claude vision model. Needs an Anthropic API key in the macOS keychain (Settings… shows the command). This is the app's only network call.
- **Icons** — `I` opens the full Lucide icon library with search; icons are movable, resizable, rotatable, recolourable.
- **Screenshots / images** — `⌘+V` to paste a screenshot, or drag-drop image files. Stored deduped by SHA-256 in the local DB. Lock as a reference to draw over it.
- **Styles** — per-shape fill, stroke colour/width/dash, font family/size/weight/alignment, opacity. The palette is editable: right-click a swatch to replace it via the native colour panel; Reset in Settings.
- **Layers** — named layers with show/hide, lock, solo and reorder; stacking within a layer with `⌘]` / `⌘[` (add `⇧` for front/back).
- **Grid & snap** — toggleable dot grid and snap-to-grid.
- **Multi-select** — marquee select, shift-click to add/remove, `⌘C/V/X/D` copy/paste/cut/duplicate, `⌘A` select all, align and distribute, `Shift`-resize scales text and strokes with the boxes.
- **Board search** — `⌘F` finds shapes and line labels by text and steps through them.
- **Undo/redo** — `⌘Z` / `⌘⇧Z`.
- **Minimap** — bottom-right, shows all content + viewport; click to recentre.
- **Dark/light theme** — toggle in toolbar, persisted in DB.
- **Export** — PNG (transparent or solid), SVG, or a portable `.haldraw` board file that re-imports anywhere. `⌘E` is PNG.
- **Backups** — a daily snapshot of the database in `~/Library/Application Support/haldraw/backups/`, newest 14 kept; Back up now and Reveal in Finder in Settings.
- **Shortcut overlay** — press `?` anywhere. Full list with panel controls: [docs/help_shortcuts_for_haldraw_v0.9.17.md](./docs/help_shortcuts_for_haldraw_v0.9.17.md).

## Keyboard

| Key | Action |
|---|---|
| V | Select |
| R / S / O / D | Rectangle / Square / Ellipse / Diamond |
| B / X / K | 3D box / Data store / Collection |
| L / A | Line / Arrow |
| T | Text |
| C | Connector |
| P | Pen (freehand ink) |
| I | Icon library |
| Space+drag | Pan |
| ⌘+scroll, ⌘= / ⌘− | Zoom |
| ⌘0 / ⌘1 | Reset zoom / Fit to content |
| ⌘K | Go to board or project |
| ⌘F | Find on this board |
| ⌘Z / ⌘⇧Z | Undo / Redo |
| ⌘C/V/X/D | Copy/Paste/Cut/Duplicate |
| ⌘G / ⌘⇧G | Group / Ungroup |
| ⌘A | Select all |
| ⌘] / ⌘[ (add ⇧ for front/back) | Bring forward / Send back |
| ⌘⌥] / ⌘⌥[ | Move selection up / down a layer |
| ⌘⇧L | New layer |
| Arrows (+⇧) | Nudge 1px (10px) |
| Delete / Backspace | Delete selection |
| ⌘E | Export PNG |
| ⌘, | Settings |
| Esc | Deselect / cancel editing / leave the pen |
| ? | Shortcut help |

## Architecture

- `electron/` — main process. SQLite via `better-sqlite3`, IPC handlers, native menu.
- `electron/preload.ts` — exposes a typed `window.haldraw` bridge via `contextBridge`.
- `src/` — React renderer. Zustand store (`src/store/canvasStore.ts`) is the single source of truth; autosave debounces 300 ms and flushes dirty node/edge deltas to SQLite.
- `src/canvas/` — SVG canvas, shape/edge renderers, connector routing, selection handles.
- `src/panels/` — sidebar, toolbar, properties, icon picker, minimap, shortcut help.
- `shared/types.ts` — types used by both main and renderer.

### Data model

`projects → boards → nodes + edges`. Connectors reference node IDs and recompute anchor points live from each node's current bbox + rotation, which is why lines stay attached when shapes move. Images are stored once in an `images` table, deduped by SHA-256, and referenced by node `content.imageId`.
