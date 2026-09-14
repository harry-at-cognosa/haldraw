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

If Round 3 layers ship first, implement this as layer visibility only; see the layers spec below.

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

## Round 3 — Object layers

Added 2026-09-13 after discussing the stacking model. Independent of 0.5.0; roughly the size of 0.4.0. Target: 0.6.0.

### Model

haldraw today has one flat stack per board: every node carries a z-index, ties are allowed, and connectors always draw beneath nodes. Layers add a second, coarser level of ordering above that, following the object-layer convention of Inkscape, draw.io and OmniGraffle rather than the pixel-layer model of GIMP and Photoshop.

- A **layer** is an ordered, named container of nodes within one board. Properties: name, order, visible, locked.
- Every node belongs to exactly one layer. Within a layer, the existing z-index still orders nodes.
- Render order is layer order first, then z-index. Connectors keep drawing beneath all nodes; a connector belongs to the layer of its `fromNode` (or the current layer when both ends are loose).
- Exactly one layer per board is **current**. New nodes, pastes, duplicates and imports land in it.
- Any node on a visible, unlocked layer is editable at any time. Selecting a node makes its layer current. There is no "must switch to layer N to edit layer N" mode; lock a layer to protect it.
- The view is always top-down. "Only this layer" is a **solo** toggle that temporarily hides every other layer; it is not a separate view mode and is not persisted.
- Every board has at least one layer. A new board gets one layer named "Layer 1". Deleting the last layer is refused; deleting a non-empty layer asks whether to delete its nodes or move them to the layer below.

### Interaction with the 0.4.0 lock and the 0.5.0 hide

- **New board from image** creates two layers: "Reference" (locked, holding the image) and "Drawing" (current, empty). Import into an existing board places the image on the current layer and offers a "Put on a new locked layer" checkbox, default on.
- The node-level `locked` flag stays. Layer lock is the normal way to protect a reference; node lock remains for pinning a single shape on an otherwise editable layer. Hit-testing treats a node as locked when either its own flag or its layer's flag is set.
- The 0.5.0 `hidden` flag and "exclude reference images from export" are subsumed: hidden layers are skipped by the canvas, hit-testing, `combinedBbox` and both exporters. If layers ship before 0.5.0 item 8, implement item 8 as layer visibility only and skip the per-node flag.

### Data model

```
layers
  id          TEXT PRIMARY KEY
  board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE
  name        TEXT NOT NULL
  position    INTEGER NOT NULL          -- 0 = bottom
  visible     INTEGER NOT NULL DEFAULT 1
  locked      INTEGER NOT NULL DEFAULT 0
  created_at, updated_at

nodes.layer_id        TEXT REFERENCES layers(id)   -- migration: NULL
boards.current_layer  TEXT                          -- migration: NULL
```

Migration on launch: for every board without layers, insert one layer "Layer 1" at position 0, set every node's `layer_id` to it, set `boards.current_layer`. This runs inside `migrate()` after `addColumnIfMissing`, wrapped in a transaction, and is idempotent.

`BoardSnapshot` gains `layers: Layer[]`. The canvas store gains `layers`, `currentLayerId`, `soloLayerId` (transient), and actions: `addLayer`, `renameLayer`, `deleteLayer(id, mode: 'delete' | 'merge-down')`, `reorderLayer`, `setLayerVisible`, `setLayerLocked`, `setCurrentLayer`, `moveNodesToLayer(ids, layerId)`. Undo covers all of them except solo.

While adding layers, renumber each layer's z-indices densely on load and make Bring forward / Send backward swap with the true neighbour instead of adding or subtracting one. This fixes the existing tie behaviour and keeps ordering deterministic.

### UI

- **Board panel ▸ Layers** (shown when nothing is selected, above Reference images, which this section replaces). One row per layer, top of stack first: eye toggle, padlock toggle, name (double-click to rename), node count. Current layer highlighted. Drag rows to reorder. Buttons: add, duplicate, delete, solo. Right-click row: merge down, select all on layer.
- **Toolbar breadcrumb** shows the current layer after the board name: `Project › Board · Layer 2`. Clicking it opens a small dropdown to switch.
- **Properties panel ▸ Layer section** (existing) gains a **Move to layer** dropdown when nodes are selected, alongside the existing z-order buttons.
- Shortcuts: `⌘⇧L` new layer; `⌘⌥]` / `⌘⌥[` move selection up / down one layer. Existing `⌘]` / `⌘[` stay within-layer.
- Selecting a node on a non-current layer switches the current layer and flashes the row briefly, so the user sees where they are.

### Export

- PNG and SVG skip hidden layers and, when solo is active, everything but the solo layer. `combinedBbox` follows the same filter so the crop is right.
- Export menu gains a **Layers…** sub-choice: all visible (default) or pick a subset, for producing per-layer overlays from one board.

### Regression checklist

1. **Migration.** Launch over a 0.4.x database. Every board opens with one "Layer 1" holding all its nodes; boards list the layer as current; nothing moved or reordered.
2. **New board.** Has "Layer 1", current. New board from image has "Reference" (locked, image) and "Drawing" (current, empty).
3. **Draw into current.** Draw a rectangle: it lands on the current layer. Switch layers, draw again: lands on the new one. Paste and ⌘D land on the current layer.
4. **Auto-switch on select.** With Layer 2 current, click a node on Layer 1: Layer 1 becomes current and the row flashes.
5. **Visibility.** Hide Layer 1: its nodes disappear, cannot be selected or marquee'd, ⌘A skips them, connectors to them vanish. Show: everything returns.
6. **Lock.** Lock Layer 1: nodes still render, cannot be selected or dragged, connector tool does not snap to them. Node-level lock on an unlocked layer behaves as in 0.4.0.
7. **Solo.** Solo Layer 2: only Layer 2 visible. Toggle off: previous visibility restored. Solo is not saved; relaunch shows all.
8. **Reorder.** Drag Layer 1 above Layer 2: Layer 1's nodes now draw on top regardless of z-index. Undo restores.
9. **Move nodes.** Select two nodes, Move to layer → Layer 2: they render in Layer 2's position and keep their relative order. ⌘⌥] / ⌘⌥[ move them one layer at a time.
10. **Delete layer.** Non-empty: dialog offers delete nodes or merge down; both work; undo restores. Last layer: refused with a message.
11. **Rename.** Double-click, rename, persists after relaunch.
12. **Within-layer order.** Bring forward on a node with a neighbour two z-steps above now moves it visibly above that neighbour. Ties no longer occur after load.
13. **Export.** Hidden layers absent from PNG and SVG; crop ignores them. Solo export contains only the solo layer. Layers… subset export contains exactly the chosen layers.
14. **Duplicate board.** Copies layers, order, visibility, lock, and current layer, with node membership intact.
15. **Persistence.** Everything above survives quit and relaunch.
16. **Re-run the 0.4.0 checklist** with all nodes on one layer; behaviour must be unchanged.

## Explicitly out of scope

Auto-vectorising a raster diagram into shapes and connectors. A pragmatic path later is a vision-model call that emits a board snapshot JSON, which depends on the roadmap's JSON import item.
