# Changelog

All notable changes to haldraw. Dates are calendar dates; version numbers follow [semver](https://semver.org/).

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
