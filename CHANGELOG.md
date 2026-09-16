# Changelog

All notable changes to haldraw. Dates are calendar dates; version numbers follow [semver](https://semver.org/).

## 0.9.1 — 2026-09-15

### Changed

- **Vectorize drafts:** a shape whose fill the model could not read is now transparent, so the reference stays visible through it, instead of the light default fill. Text size is derived from the box the model measured: free text fits its line count and longest line; text inside a shape is sized to the shape's usable area (rectangles 75 %, ellipses 50 %, diamonds 40 %), clamped to 8–48 px.

## 0.9.0 — 2026-09-15

Vectorize: a first editable draft of a reference image. Spec: [docs/Vectorize_raster_design.md](./docs/Vectorize_raster_design.md), "Implementation plan — 0.9.0".

### Added

- **Vectorize…** in the properties panel's Image section (one image selected). Sends the image to a Claude vision model and places the shapes, text and connectors it finds on a "Draft" layer directly above the image's layer, grouped and selected, as one undo step. Low-confidence elements are dashed. Coordinates follow the image's placement, so a reference at 50 % gets a draft at 50 %.
- **Settings…** (File menu, `⌘,`, or the gear in the toolbar): model choice (Opus 5 default; Sonnet 5, Opus 4.8, Haiku 4.5), and the keychain status. The API key lives in the macOS keychain (`haldraw` / `anthropic-api-key`), read at call time, never stored by the app; the dialog shows the one-line `security` command to add it.
- First network dependency: `@anthropic-ai/sdk`, used only from the main process. haldraw makes no other network calls.

### Errors

- No key: the toast shows the keychain command; no request is made. Rejected key, unknown model, rate limit and no network each get their own message. Output the app cannot use is retried once with the validation error, then reported with the raw text.

## 0.8.3 — 2026-09-15

### Fixed

- **One ⌘Z reverses one change.** Style, rotation, link, label and text edits made from the properties panel recorded their undo point *after* the change, so the first ⌘Z appeared to do nothing and a second was needed. The undo point is now recorded before the change (`checkpoint` replaces `commit` in the store). Undo also skips entries identical to the present state, so a stale checkpoint can never show up as a dead ⌘Z.
- **Sliders undo as one step.** Width, font size, opacity, corner radius and rotation sliders recorded a step per tick; a drag is now one undo step (the undo point is taken at pointer-down or the first arrow key). The typed value boxes are one step per committed value.
- **Shortcuts work after a slider drag.** A slider kept keyboard focus after a drag and every shortcut, ⌘Z included, was ignored until you clicked elsewhere. Only text fields now capture the keyboard.
- **Typed fields undo per session.** The link and label fields record one undo point when focused instead of one per keystroke.
- **New text boxes undo in one step.** After typing into a freshly placed text box, one ⌘Z removes the box; previously the first ⌘Z only blanked it and left the invisible rectangle behind. Editing existing text still undoes to the previous text.

## 0.8.2 — 2026-09-15

### Added

- **Selection readout.** The properties panel header now says what is selected and where: type and content on the first line (`Text · “Quicken says…”`, `Rectangle · empty`, `Image · 1557 × 923 px · locked`, `Connector · “Schwab” → Rectangle`), then layer, z-rank within that layer, size and position on the second (`Drawing · z 3/7 · 220 × 52 at 1032, 418`). Multi-selections show counts by type and the bounding box. Replaces the bare `1 shape` / `Connector` title.

### Changed

- **Empty text boxes are removed.** Leaving a text box without typing anything (click away or Escape) deletes it instead of leaving an invisible 220 × 52 rectangle behind. Undo brings it back.

## 0.8.1 — 2026-09-15

### Fixed

- **Line colour and width no longer reset each other.** Changing any one style field of a line (colour, width, dash) replaced its whole style, so the other fields fell back to defaults: setting a width turned the line light grey, and picking a colour set the width back to 2. Present since 0.1.0; the properties panel now merges the field into the existing style.
- The line width slider goes to 12, matching the shape stroke slider (the text field still accepts up to 100).

## 0.8.0 — 2026-09-15

Edges on layers, head styles, no-snap drawing. Spec: [docs/Edge_layers_design.md](./docs/Edge_layers_design.md) (section 13 lists the deviations). Shortcuts: [docs/help_shortcuts_for_haldraw_v0.8.0.md](./docs/help_shortcuts_for_haldraw_v0.8.0.md).

### Added

- **Lines, arrows and connectors belong to a layer.** A new edge lands on the current layer, like a new shape. Each layer paints its edges beneath its own shapes, so an arrow on a layer above "Reference" now draws over the locked image instead of under it. Layer visibility, lock and solo apply to edges; the Layers list count reads `12 · 3` (shapes · lines) when a layer has both, and "select" on a row picks up its lines too.
- **Move edges between layers.** The properties panel's Layer section (On layer dropdown) and `⌘⌥]` / `⌘⌥[` work on a selected line. When shapes are moved to a layer, every edge attached at *both* ends to moved shapes moves with them; an edge with one end elsewhere stays.
- **Six head styles per end:** none, arrow, open arrow, dot, diamond, crow's foot. The properties panel's Arrowheads toggles are replaced by two rows of line previews (Start, End). The last-used heads are remembered for the next line; `A` still guarantees an arrow at the end.
- **`⌥`-drag with `L` / `A`** draws without snapping either end to a shape. `⌥`-drag an endpoint handle to detach it from its shape.

### Changed

- **Layer delete / merge** now delete or move the layer's edges along with its shapes.
- **Selecting a line** switches the current layer to the line's layer, as selecting a shape did.
- **`.haldraw` files** (still format v1) carry `layerId`, `headStart` and `headEnd` on each edge. Older files import with each edge on its from-node's layer and the old arrow booleans mapped to `arrow` / `none`. The writer still emits `arrowStart` / `arrowEnd` as mirrors so older builds can read new files.

### Migration

- `edges.layer_id`, `edges.head_start`, `edges.head_end`. Every existing edge is placed on the layer of its from-node (else its to-node, else the board's current layer, else the bottom layer) and its arrow booleans are copied into the head columns once. `arrow_start` / `arrow_end` stay in the table and are still written as mirrors, so a 0.7.x build can open the migrated database; heads changed from within 0.7.x are not picked up by 0.8.0 afterwards.

## 0.7.2 — 2026-09-14

### Changed

- **Delete keeps its place.** Deleting a single selected shape selects the next shape in stacking order (wrapping), so a Tab / Delete sweep over stray boxes flows without restarting. Deleting a multi-selection or a connector still leaves nothing selected.

## 0.7.1 — 2026-09-14

### Added

- **Tab / ⇧Tab** step the selection through every selectable shape in stacking order (layer, then z-index), wrapping at the ends, and pan the view so the shape is on screen. Skips hidden and locked layers and locked shapes, like ⌘A. Handy for finding empty or near-invisible text boxes.

## 0.7.0 — 2026-09-14

Object layers. Spec: [docs/Reference_image_import_design.md](./docs/Reference_image_import_design.md), "Round 3 — Object layers". Scenario tests: [docs/test_plan_2.md](./docs/test_plan_2.md).

### Added

- **Layers per board.** Named, ordered containers with visibility and lock. Render order is layer order first, then z-index within the layer. Connectors draw beneath nodes and hide when either end is on a hidden layer.
- **Current layer.** New shapes, pastes, duplicates and imports land on it. Selecting a shape switches the current layer to that shape's layer. Shown as a dropdown in the toolbar title; also set by clicking a row in the Layers list.
- **Layers list** in the Board panel (nothing selected): eye and padlock per row, double-click to rename, shape count, up / down reorder, solo (view only, not saved), select-all-on-layer, and delete with a merge-down option for non-empty layers. The last layer cannot be deleted.
- **Move to layer** dropdown in the properties panel's Layer section; `⌘⌥]` / `⌘⌥[` step the selection up / down a layer; `⌘⇧L` adds a layer.
- **Import on its own layer.** The placement dialog's new "Place on its own locked layer" option (default on) creates a locked "Reference" layer at the bottom. New board from image names the drawing layer "Drawing".
- **Export** skips hidden layers and respects solo; the crop follows. `.haldraw` files carry layers (format still v1; files without a `layers` block import onto one layer).
- **Migration.** `layers` table, `nodes.layer_id`, `boards.current_layer`. Every existing board gets "Layer 1" holding all its nodes; idempotent.

### Kept from 0.6.x

- Node-level lock (Lock as reference) still works for pinning a single shape; hit-testing treats a node as locked when either its own flag or its layer's flag is set.
- The Normal / Hide refs / Refs only buttons and "Include reference images" export checkbox still act on node-level lock.

### Not in this release

- Drag-to-reorder rows (use the arrows). Per-layer subset picker in the Export menu (hide layers instead). Row flash on auto-switch.

## 0.6.6 — 2026-09-13

### Changed

- **PNG and SVG export exclude locked reference images by default.** The Export menu gains an **Include reference images** checkbox (shown when the board has any locked image; session-only, default off). The export crop follows: with references excluded, the boundary is the drawing's bounding box plus margin. The `.haldraw` file always contains everything. The Normal / Hide refs / Refs only view buttons still never affect export.

## 0.6.5 — 2026-09-13

### Added

- **Custom colour well** on every colour row (shape fill, stroke, text; connector colour). The rainbow swatch at the end opens the native colour picker; once a custom colour is set the swatch shows it and is highlighted like a palette swatch.
- **Pure white and pure black** added to the front of the palette. The previous off-white and near-black remain, so existing shapes are unchanged.

## 0.6.4 — 2026-09-13

### Fixed

- The **Transparent** fill swatch used a dark-on-dark hatch that looked like a solid charcoal square on the light theme. It now uses the same grey-and-white hatch as the board background palette, with a "Transparent (no fill)" tooltip.

## 0.6.3 — 2026-09-13

### Added

- **Reference view toggles** in the Board panel (nothing selected, at least one locked image): **Normal**, **Hide refs** (check the drawing alone), **Refs only** (check the original alone; connectors hide too). Canvas-only and transient: not saved, resets to Normal on reopen, and exports always render the full board. Selection clears when switching away from Normal; ⌘A and marquee ignore hidden nodes.

## 0.6.2 — 2026-09-13

### Added

- **Stroke width numeric entry** for shapes and connectors, beside the existing sliders. Sliders keep their ranges (0–12 for shapes, 0.5–10 for connectors); the field accepts up to 100.

## 0.6.1 — 2026-09-13

### Added

- **Font family picker** in the Text section. Lists the fonts installed on the machine (Chromium local-font query, with a built-in macOS list as fallback) and accepts any typed family name. An empty field means the default (Inter) and stores nothing, so boards and `.haldraw` files that never set a font are unchanged.
- **Font size entry.** A numeric field beside the size slider accepts 4 to 999 px; the slider still covers 8 to 72 for quick adjustment.

### Notes

- SVG export records the family name only; a machine without that font substitutes. PNG export is rendered in-app and always matches.
- Text does not auto-grow its box; at large sizes resize the shape (Shift-drag keeps proportions).

## 0.6.0 — 2026-09-13

Portable board files. Format spec and checklist: [docs/Haldraw_file_format.md](./docs/Haldraw_file_format.md).

### Added

- **Export ▾ ▸ haldraw board (.haldraw).** Writes the open board as JSON: board metadata, nodes, edges, and every referenced image as base64. Works on an empty board.
- **Import.** Library **Import…** button, drop a `.haldraw` file on the board grid, or **File ▸ Import Board (.haldraw)…** (`⌘⇧O`). Creates a new board in the selected project (auto-creating a project if none), prompts for the name, and opens it. In the editor, `⌘⇧O` imports into the current project and opens the result.
- Node, edge and group ids are remapped on import so repeated imports are independent; image ids are content hashes and are kept. Structural validation with specific error messages.
- Generic `files.saveText` / `files.openText` IPC for future text formats.

## 0.5.0 — 2026-09-13

Reference-image polish (design doc items 5–7) plus a stacking-order fix. Item 8 (hide / exclude from export) is deferred to the object-layers release, where it becomes layer visibility.

### Added

- **Opacity slider** in the Image section of the properties panel.
- **Dim references on canvas.** Board panel checkbox renders every locked node at 35 % of its own opacity. Stored per board (`boards.dim_references`, migrated on launch). Canvas aid only: the exporters restore each node's stored opacity, so PNG and SVG output never include the dimming.
- **Large-image downsampling.** Rasters whose long side exceeds 4096 px are resampled to that size before storage (JPEG stays JPEG, everything else becomes PNG). Placement still uses the original pixel dimensions, so "Original (100 %)" is unchanged. SVG is never touched.
- GIF imports were already first-frame only; the placement dialog has said so since 0.4.0.

### Fixed

- **Bring forward / Send backward** now swap with the true neighbour in the stack instead of adding or subtracting one, so a single click always produces a visible change. Z-indices are renumbered densely on load and ties no longer survive a reload. Groundwork for object layers.

## 0.4.1 — 2026-09-13

First-run fixes found while testing 0.4.0 on an empty database.

### Fixed

- **Import with no project.** "From image…", ⌘⇧I, dropping an image on the board grid, and "New board" now create an "Untitled project" automatically when none is selected, instead of failing silently. The header buttons are always visible.

### Added

- **Library help.** Press `?` (or the keyboard icon in the header) on the project picker for a short help overlay. The editor's `?` overlay is unchanged.
- Empty-state text on the picker explains the three ways to start.

## 0.4.0 — 2026-09-13

Reference-image import: start a board from a PNG, GIF, JPEG, WebP, SVG or BMP and trace over it. Design and the two-release plan live in [docs/Reference_image_import_design.md](./docs/Reference_image_import_design.md).

### Added

- **New board from image.** Project picker gains a **From image…** button beside **New board**, and the board grid accepts a dropped image file. Either creates a board named after the file and opens it with the image pending placement.
- **File ▸ Import Image… (`⌘⇧I`)** and a toolbar button import into the open board. The app now installs an explicit application menu (Edit/Window roles preserved so `⌘C`/`⌘V` still reach the canvas; View zoom roles omitted because `⌘0` is the canvas zoom reset).
- **Placement dialog.** Preview, pixel size and byte size; Size = Original / Fit to view / Scale %; Position = Origin / Centre of view; toggles for Lock as reference, Send to back, Fit view after placing. Whole import is a single undo step.
- **Locked reference layer.** `locked` flag on nodes (new `nodes.locked` column, migrated on launch). Locked nodes render and export but ignore pointer-down, marquee, `⌘A`, double-click, and connector snapping, so drawing over them works. Board panel lists locked images with **Unlock** and **Remove**; the Image section of the properties panel has **Lock as reference**.
- **Aspect ratio.** Image nodes render with `preserveAspectRatio="xMidYMid meet"` (letterbox, never stretch). `⇧` while dragging any resize handle constrains the selection's bounding box to its starting ratio. Imports record `naturalWidth`/`naturalHeight`; **Reset to original size** restores them.

### Unchanged

- Clipboard paste and drag-drop onto the canvas still insert an unlocked, cursor-centred image with no dialog.

## 0.3.0 — 2026-09-13

Maintenance release. No new features; this cuts a versioned build that actually contains the 2026-04-18 afternoon fixes, which post-dated the 0.2.0 package.

### Included since the 0.2.0 build

- Text-edit focus and outside-click commit fixes.
- Larger default text-box size so typed text is visible.
- Light-theme-friendly default shape styles; default shape and edge colors follow the board background.
- Version string surfaced in the project picker and toolbar.

### Added

- `docs/Make_fresh_haldraw_and_install_on_mac.md` — repeatable build-and-install procedure for macOS.

## 0.2.0 — 2026-04-18

Round 1 of post-launch features, plus a pile of polish and bug fixes from first real use.

### Added

- **Per-node hyperlinks.** Any shape now has an optional URL in its properties panel.
  - `⌘-click` a shape with a link (or click the new **↗ badge** in its top-right corner) to open it.
  - `https://` / `mailto:` URLs open in your system browser via `shell.openExternal`.
  - `haldraw://board/<id>` links open that board inside the app — useful for DFD-style drill-downs (L0 → L1 → L2 diagrams).
  - In the library, hover a board card → new **link icon** copies its in-app link to the clipboard for pasting into a shape's Link field.
- **Groups.** Select 2+ shapes, `⌘G` groups them; `⌘⇧G` ungroups. Clicking any member selects the whole group; `⌥-click` isolates a single shape inside. Move/resize/delete/duplicate all operate on the whole group. Board duplication remaps group IDs so copies stay self-consistent.
- **Align & distribute.** When 2+ shapes are selected, a new **Align** section appears in the right panel — six alignment buttons (L/C/R horizontal, T/M/B vertical). With 3+ selected, distribute-horizontally and distribute-vertically appear below.
- **Draggable orthogonal elbow.** Select an orthogonal connector and a small square handle shows at its corner — drag to reshape the elbow. Resets to auto if you change routing.
- **Draggable connector labels.** When a connector is selected, its label becomes draggable — drop it anywhere on the canvas. Position persists.
- **Connector anchor picker.** Select a connector whose endpoint is attached to a shape — an **Anchors** section in the properties panel lets you force Auto / Top / Right / Bottom / Left / Center for each end.
- **Diamond shape** (`D`). Proper four-point flowchart decision shape.
- **Corner radius slider** for rectangles.
- **Vertical text alignment** (T / M / B) in the shape's Text section.
- **Per-board background color.** Pick from a soft pale palette — white, pearl, paper, mist, sage, cream, graphite, transparent — or use the custom color picker. Applies to the canvas and to Solid exports. Transparent shows a checker pattern in-app.
- **Last-used style memory.** Drawing a new rect / ellipse / diamond / text / line / arrow / connector re-uses whatever style you last set via the properties panel. A **Reset styles** button on the properties panel restores defaults and clears the memory for that shape type.
- **Duplicate board.** In the library, new **copy icon** on each board card; timestamped copy (`My Flow (copy 2026-04-18 2140)`). Inside the editor, `⌘⇧D` makes the same timestamped copy of the board you're editing.
- **`⌘S`** flushes autosave immediately with a "Saved" toast (muscle memory).
- **Light / dark theme toggle** in the top toolbar (Sun / Moon). Theme persists in the DB.
- **Export dropdown** with three formats: PNG (transparent background), PNG (solid board background), SVG.
- **Higher contrast** across the UI — brighter whites in dark mode, deeper blacks in light mode, bigger fonts (root 17 px).
- **Grid dots** are now much more visible on all backgrounds.
- **App icon** baked into the packaged `.dmg`.

### Fixed

- `window.prompt()` doesn't exist in Electron — replaced every project/board prompt with an in-app modal.
- `contentEditable` fields no longer reset on every keystroke when rendering children via React. Text edits (shape labels and standalone text blocks) now persist reliably.
- Clicking inside an already-editing text box used to cancel edit mode (the pointer event bubbled to the background handler). Fixed — editing stays active until you click outside.
- Lines and arrows auto-attach to shapes when you start or end the drag inside one; the target shape lights up unmistakably while dragging.
- Shape labels stay upright when the shape rotates — rotating a square into a diamond no longer tips its text 45°. Standalone text blocks still obey their own rotation.
- PNG export used to fail with a tainted-canvas error on diagrams containing text or icons (SVG `<foreignObject>` tainting Chromium's canvas). Export now serializes foreignObjects into native `<text>` and inline-SVG icons.
- Unused electron process shortcuts and app name fixed on macOS dock.
- Broader SQL schema migrations run defensively via `ALTER TABLE … ADD COLUMN IF MISSING` — existing boards pick up new features on the next launch without data loss.

### Changed

- Upgraded `better-sqlite3` from 11.7.0 → 12.9.0 so fresh installs work under Python 3.12 (older node-gyp imported the removed `distutils`).
- Default shape stroke / fill / text colors biased toward the theme (white on dark, black on light).
- PNG "transparent" is the default export; PNG "solid" uses the board's background color.

### Notes for next round

A few gaps surfaced during use, not yet built:

- Configurable grid spacing (dot size / snap granularity).
- Freehand / pen tool.
- Templates / stencils (flowchart, ERD, DFD starter packs).
- Export to JSON + portable `.haldraw` file format.
- Auto-backup (rotating daily SQLite snapshots).
- Presentation mode.
- Palette / cross-board search (`⌘K`).

## 0.1.0 — 2026-04-17

Initial commit.

- Electron + React + TypeScript + Tailwind + Zustand + better-sqlite3 + lucide-react.
- Projects + boards in SQLite.
- Shape tools: rectangle, square, ellipse.
- Lines, arrows, and shape-anchored connectors (straight / orthogonal / curved).
- Text blocks (resizable, rotatable, editable).
- Lucide icon picker.
- Clipboard-paste + drag-drop for images.
- Undo/redo, autosave, multi-select, duplicate, layering.
- Pan / zoom infinite canvas with minimap.
- Dark/light UI theme.
- PNG export.
- Unsigned `.dmg` build via electron-builder (arm64).
