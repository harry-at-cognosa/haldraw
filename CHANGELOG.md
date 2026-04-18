# Changelog

All notable changes to haldraw. Dates are calendar dates; version numbers follow [semver](https://semver.org/).

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
