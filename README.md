# haldraw

Local infinite-canvas diagramming app. Excalidraw/tldraw-style, runs as a native macOS Electron app, stores everything in a single local SQLite file.

## Run

```bash
npm install
npm run dev        # launches Electron with HMR
```

Data lives at `~/Library/Application Support/haldraw/haldraw.db`.

## Package

```bash
npm run package    # produces .dmg under dist/
```

(Packaging uses `build/icon.png` for the app icon.)

## Features

- **Projects & boards** — unlimited, renameable, deletable. Autosave on every change.
- **Infinite canvas** — pan with `Space`+drag or middle-mouse, zoom with `⌘`+scroll.
- **Shapes** — rectangle, square (1:1 lock), ellipse/circle, line, arrow, text. All resizable, rotatable through a full 360°.
- **Text** — rotatable to any angle (uphill, downhill, upside-down), double-click to edit, works on shapes too as a centered label.
- **Connectors** — `C` to drag from one shape to another; endpoints track shapes when moved. Pick routing (straight, right-angle, curved) and arrowheads on either or both ends in the properties panel.
- **Icons** — `I` opens the full Lucide icon library with search; icons are movable, resizable, rotatable, recolorable.
- **Screenshots / images** — `⌘+V` to paste a screenshot, or drag-drop image files. Stored deduped by SHA-256 in the local DB.
- **Styles** — per-shape fill, stroke color/width/dash, font size/weight/alignment, opacity.
- **Layers** — `⌘]` / `⌘[` (with `⇧` for front/back).
- **Grid & snap** — toggleable dot grid and snap-to-grid.
- **Multi-select** — marquee select, shift-click to add/remove, `⌘C/V/X/D` copy/paste/cut/duplicate, `⌘A` select all.
- **Undo/redo** — `⌘Z` / `⌘⇧Z`.
- **Minimap** — bottom-right, shows all content + viewport; click to recenter.
- **Dark/light theme** — toggle in toolbar, persisted in DB.
- **PNG export** — `⌘E` opens a save dialog. Export is cropped to content bounding box with padding.
- **Shortcut overlay** — press `?` anywhere.

## Keyboard

| Key | Action |
|---|---|
| V | Select |
| R / S / O | Rectangle / Square / Ellipse |
| L / A | Line / Arrow |
| T | Text |
| C | Connector |
| I | Icon library |
| Space+drag | Pan |
| ⌘+scroll | Zoom |
| ⌘0 / ⌘1 | Reset zoom / Fit to content |
| ⌘Z / ⌘⇧Z | Undo / Redo |
| ⌘C/V/X/D | Copy/Paste/Cut/Duplicate |
| ⌘A | Select all |
| ⌘] / ⌘[ (add ⇧ for front/back) | Bring forward / Send back |
| Arrows (+⇧) | Nudge 1px (10px) |
| Delete / Backspace | Delete selection |
| ⌘E | Export PNG |
| Esc | Deselect / cancel editing |
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
