# Reference image import — design and release plan

Feature: start a haldraw board from an existing image (PNG, GIF, JPEG, WebP, SVG, BMP) and trace a diagram over it. Written 2026-09-13 after reviewing the 0.3.0 code. Split into two releases so each has a small, independently testable surface.

## Where 0.3.0 stands

- `image` is already a node type. Bytes live in the SQLite `images` table, content-addressed by SHA-256 (`electron/repo/images.ts`), referenced from the node by `content.imageId`.
- Two ingestion paths exist, both in `src/canvas/Canvas.tsx`: clipboard paste and drag-and-drop of image files onto the canvas. Any `image/*` MIME type is accepted. GIFs render as a static first frame inside an SVG `<image>`.
- Import scales the long side to 400 px, centers on the cursor, and produces an ordinary node: selectable, movable, resizable, groupable, exported.

Gaps for a trace-over workflow: no file-open dialog, no "new board from image" entry point, no lock, no opacity control for images in the panel, free resize distorts (`preserveAspectRatio="none"`), and the image captures clicks so drawing over it fights selection.

## Release 0.4.0 — core trace-over workflow (items 1–4)

### 1. Entry points

All funnel through one main-process IPC handler, `images:pickFile`, which opens the native open dialog with image filters and returns `{ name, mime, bytes }` or `null`. MIME is derived from the extension.

| Entry point | Where | Behaviour |
|---|---|---|
| **New board from image…** button | Project picker header, beside **New board** | Pick file → prompt for board name (default: file basename) → create board → open it with the image pending → placement dialog, defaulting to **origin** placement |
| Drop an image onto the project picker | Board grid area | Same as above, using the dropped file |
| **File ▸ Import Image…** (⌘⇧I) | Application menu | If a board is open: placement dialog, defaulting to **view centre**. If the picker is open with a project selected: same as **New board from image…** |
| Toolbar image button | Editor toolbar, next to the icon library | Same as File ▸ Import Image… |

Existing quick paths (paste, drop onto the canvas) are unchanged: they still insert an unlocked image at the cursor without a dialog.

The app previously ran on Electron's default menu. 0.4.0 installs an explicit application menu that reproduces the default Edit/Window roles (needed for ⌘C/⌘V to reach the renderer on macOS) and adds the File item. View-zoom roles are deliberately omitted because ⌘0 is the canvas zoom reset.

### 2. Reference-layer semantics (lock)

- `CanvasNode.locked: boolean`, persisted as a new `locked INTEGER NOT NULL DEFAULT 0` column on `nodes` (added by `addColumnIfMissing`, so existing databases migrate on launch).
- A locked node is invisible to interaction: pointer-down falls through to the background (so marquee and drawing work over it), marquee and ⌘A skip it, connectors and lines do not snap to it, double-click does nothing.
- A locked node still renders and still exports.
- **Board panel** (shown when nothing is selected) gains a **Reference images** section listing locked nodes with **Unlock** (unlocks and selects it) and **Remove**.
- **Properties panel** for an image node gains an **Image** section with a **Lock as reference** toggle. Locking a selected node clears it from the selection.

### 3. Placement dialog

Shown after the file is decoded. Fields:

- Read-only summary: file name, intrinsic pixel size, byte size.
- **Size**: Original (100 %) / Fit to view / Scale (%). Default: Original, so canvas units map to source pixels.
- **Position**: Origin (0, 0) / Centre of view. Default: Origin for new-board flow, Centre of view for import into an existing board.
- **Lock as reference** (default on).
- **Send to back** (default on).
- **Fit view to image after placing** (default on).

Cancel discards the node but not the stored blob (the images table is content-addressed and cheap; orphan cleanup is a later concern).

### 4. Aspect ratio

- Image nodes render with `preserveAspectRatio="xMidYMid meet"`, so a free resize letterboxes instead of distorting. Export follows automatically because the exporter clones the live SVG.
- Holding **Shift** while dragging a resize handle constrains the selection's bounding box to its starting aspect ratio. Applies to every node type.
- Import records the intrinsic size in `content.naturalWidth` / `content.naturalHeight`. The **Image** section offers **Reset to original size**, keeping the top-left corner fixed.

### Data-model changes, 0.4.0

```
nodes.locked            INTEGER NOT NULL DEFAULT 0      (migration)
CanvasNode.locked       boolean
NodeContent.naturalWidth?, naturalHeight?  number       (JSON, no migration)
HaldrawApi.images.pickFile()                            (new IPC)
HaldrawApi.onMenu(channel, cb)                          (menu → renderer)
```

### 0.4.0 regression checklist

Run against a database that already has boards from 0.3.0 (migration path) and against a fresh one.

Setup: a PNG about 1600×900, a small GIF, an SVG.

1. **Migration.** Launch 0.4.0 over a 0.3.0 database. Open an old board. Every node still loads, moves, and saves. `PRAGMA table_info(nodes)` shows `locked`.
2. **New board from image (button).** Picker ▸ New board from image… ▸ choose PNG ▸ accept default name ▸ dialog shows correct pixel size ▸ Place. Board opens with the image at (0, 0) at 100 %, view fitted, nothing selected.
3. **New board from image (drop).** Drop the GIF onto the picker's board grid. Same result; GIF shows first frame.
4. **Import into existing board (menu).** Open any board ▸ ⌘⇧I ▸ choose SVG ▸ Position defaults to Centre of view ▸ Place. Image is centred on the current view.
5. **Import into existing board (toolbar).** Same via the toolbar button.
6. **Cancel.** Start an import, cancel the file dialog: no change. Start another, cancel the placement dialog: no node added, undo stack unchanged.
7. **Lock behaviour.** With a locked image: click on it starts a marquee, not a drag. Marquee across it selects only unlocked shapes. ⌘A does not select it. Draw a rectangle over it with R. Connector tool over it does not snap to it. Double-click does nothing.
8. **Unlock from Board panel.** Deselect all ▸ Board panel lists the image ▸ Unlock ▸ image becomes selected and draggable. Lock again from the Image section ▸ selection clears, Board panel lists it again.
9. **Remove from Board panel.** Removes the node. Undo restores it locked.
10. **Send to back.** Draw shapes, import with Send to back on: image renders beneath them. Repeat with it off: image on top.
11. **Size options.** Fit to view produces an image that fits inside the canvas with padding. Scale 50 % halves both dimensions.
12. **Aspect ratio.** Resize an unlocked image freely: letterboxed, never stretched. Shift-drag a corner: box keeps its ratio. Shift-drag an edge handle: box keeps its ratio. Shift-resize a rectangle: same. Reset to original size restores intrinsic dimensions.
13. **Export.** PNG and SVG export include the reference image, letterboxed the same way as on screen.
14. **Persistence.** Quit and relaunch. Locked state, position, size, and natural size all survive.
15. **Paste and canvas drop unchanged.** ⌘V a screenshot and drop a file onto the canvas: both still insert an unlocked, cursor-centred image with no dialog.
16. **Existing shortcuts unchanged.** ⌘Z, ⌘C, ⌘V, ⌘A, ⌘0, ⌘1, ⌘D still behave as before (menu change).

## Release 0.5.0 — polish for real tracing sessions (items 5–8)

### 5. Opacity and dimming

- Expose an **Opacity** slider in the Image section (`style.opacity`, already rendered).
- Board panel **Dim references** toggle: renders every locked node at 40 % without changing stored opacity. Stored as board-level flag (`boards.dim_references`), so it persists per board and is skipped by export unless the user chooses.

### 6. Large images

- Downsample on import when the long side exceeds 4096 px, using an offscreen canvas; keep the original pixel size in `naturalWidth/Height` so the placement math is unchanged.
- Note the storage cost: bytes are stored raw in SQLite but shipped to the renderer as base64 data URLs, a 33 % inflation per load. If this becomes a problem, switch `images.get` to return a `file://` path under Application Support instead.

### 7. Animated GIF

Explicitly first-frame only. Document it in the placement dialog when the MIME is `image/gif`. Frame selection via `ImageDecoder` is out of scope.

### 8. Hide and exclude from export

- `CanvasNode.hidden: boolean` (new column). Hidden nodes do not render on the canvas, are skipped by hit-testing, and are excluded from both exporters and from `combinedBbox` so the export crop ignores them.
- Board panel reference rows gain a **Hide** toggle. Export menu gains **Exclude reference images** (default on), which treats locked nodes as hidden for that export only.

### 0.5.0 regression checklist

1. Opacity slider changes an image live and persists.
2. Dim references dims every locked node, persists per board, does not alter stored opacity, and is not baked into export unless chosen.
3. Import a 6000 px wide PNG: stored image is at most 4096 px on the long side, placement at 100 % still uses the original pixel dimensions.
4. Import a GIF: dialog notes first-frame only.
5. Hide a reference: gone from canvas, not selectable, absent from PNG and SVG export, export crop excludes it. Unhide restores it.
6. Export with Exclude reference images on: locked nodes absent, crop excludes them. Off: present.
7. Re-run the whole 0.4.0 checklist.

## Explicitly out of scope

Auto-vectorising a raster diagram into shapes and connectors. A pragmatic path later is a vision-model call that emits a board snapshot JSON, which depends on the roadmap's JSON import item.
