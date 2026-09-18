# Changelog

All notable changes to haldraw. Dates are calendar dates; version numbers follow [semver](https://semver.org/).

## 0.9.13 — 2026-09-18

### Added

- **Pen tool (`P`)** for freehand ink: annotations, circles-around-things, quick sketches. Drag to draw; the tool stays active for the next stroke (Esc or `V` leaves it), a tap with no travel leaves nothing behind, and a stroke begun on top of a shape draws over it instead of dragging it. Each stroke is an `ink` node with its points kept as fractions of its box, so it moves, resizes, rotates, groups, copies, changes layer and shift-scales like any shape, and one ⌘Z removes one stroke. Strokes are smoothed through the sample midpoints, drawn with round caps and joins, and selectable by clicking anywhere along the line. The properties panel shows Stroke (colour, width, dash), Layer, Rotation and Link for ink; the pen remembers the last width and colour. Lines and connectors never snap to ink. Exports carry the stroke as a plain SVG path.

### Notes

- A `.haldraw` file containing ink is rejected by 0.9.12 and earlier with "unknown type".

## 0.9.12 — 2026-09-18

### Added

- **Auto-backup.** Once a day the whole database is snapshotted to `~/Library/Application Support/haldraw/backups/haldraw-YYYY-MM-DD.db`, at launch or within the hour if the app stays open, using SQLite's online backup so a write in progress is folded in. The newest 14 are kept by default. **Settings…** gains a Backups section: the keep count (1–365), the newest snapshot and how many are kept, **Back up now** (a second snapshot on the same day gets a time suffix) and **Reveal in Finder**. To restore, quit haldraw and copy a snapshot over `haldraw.db`.

## 0.9.11 — 2026-09-18

### Added

- **Customisable colour palette.** Right-click (or ⌥-click) any swatch in the Fill, Stroke or Text rows, or any board background swatch, to open the native macOS colour panel and replace that swatch for good; the change shows live while the panel is open and is saved a moment after the last pick. The palette is app-wide and stored in the settings table, so it holds across boards and relaunches; existing shapes keep their own hex and never change. Transparent cannot be replaced, and the rainbow "custom" swatch remains a one-off that touches no slot. **Settings…** gains a Palette section that lists the ten shape swatches and seven backgrounds, lets you replace any of them by clicking, and has a **Reset palette** button that restores the starter set.

## 0.9.10 — 2026-09-18

### Fixed

- **PNG and SVG export wrap text the way the canvas does.** Labels used to be exported as one line per typed line, so a long label ran past its shape in the file while it wrapped on screen. The exporter now measures the text with the shape's own family, size and weight and fills the label box word by word, breaking an over-long word by character, with the same padding and line height as the canvas; top / middle / bottom alignment follows the wrapped block. A label that overflows its box is clipped on the canvas but fully drawn in the export.
- **Vectorize runs one call at a time.** The in-flight state moved from the button into the store, so the Image section's button and the Reference-images sparkle share it: while a call is running every other Vectorize button is disabled ("busy with another image"), and the progress text survives deselecting or reselecting the image. Two rows can no longer each spawn a Draft layer.
- Vectorize reuses the nearest **Draft** layer anywhere above the reference image, not only one directly above it.
- Errors that were not API errors (a malformed fake-result file, an unexpected SDK throw) reach the toast as a sentence instead of a raw stack message.

### Changed

- The keychain command shown in Settings and in error messages comes from one constant in `shared/types.ts`.

## 0.9.9 — 2026-09-18

### Added

- **Change shape type.** A **Shape** row at the top of the properties panel turns the selection into a rectangle, ellipse, diamond, 3D box, data store, collection or free text in place. Position, size, rotation, fill, stroke, text and connectors are all kept; a multi-selection converts as a block, and one ⌘Z reverses the whole change. A text node that becomes a box gets the paper's default fill and stroke so it does not come out invisible. Icons and images are not convertible. This is the cheap way to correct a Vectorize misclassification.

## 0.9.8 — 2026-09-17

### Added

- **Shift-resize of a multi-selection scales text and strokes with the boxes.** Holding Shift at the start of a corner-handle drag on two or more selected shapes now scales each shape's font size and stroke width by the smaller of the two axis factors, and does the same to the stroke and label of every line joining two selected shapes. Font size floors at 4 and rounds to a whole number on release. A plain drag, or a Shift-drag on a single shape, still only reflows the box.

### Fixed

- **Zoom to fit (⌘1) could write a negative zoom into the board.** It measured the viewport with `document.querySelector('svg')`, which matches the first toolbar icon rather than the canvas, so a 16 px icon produced a zoom of −0.06 that autosave then persisted; the board opened blank and unclickable on every relaunch until the row was repaired by hand. It now measures `svg.haldraw-canvas` and never goes below 2 %.

## 0.9.7 — 2026-09-17

### Added

- **Vectorize recognises the 3D box, data store and collection shapes.** The model's shape kinds grow from four to seven, with one prompt rule per shape and "use rect when unsure" unchanged. A short word on a connector, with or without a pill around it, is now explicitly the connector's label rather than a shape. Ground truth: an 11-shape, 6-connector board exported from haldraw came back with every kind correct at 2132 px and at 800 px, with all six connectors and their four labels; the three spec images came back as their kinds.
- **Line labels have a font family and a weight** (Reg / Med / Bold) in the Label section, alongside colour and size; exports honour both.

### Changed

- Vectorize drafts size shape text from the shape's actual text area (front face of a 3D box, right of the data-store line, below the collection divider) minus padding, with a height bound, capped at 36 px instead of 48. Labels no longer overflow their boxes on the first draft.

## 0.9.6 — 2026-09-17

### Fixed

- **Lines are never hidden under a locked reference image on the same layer.** Within a layer the canvas now paints locked (reference) nodes first, then lines, then the other shapes. Previously lines were painted before every node of their layer, so on a single-layer board, or after "Lock as reference" on an image pasted onto the drawing layer, a connector across the image was invisible. Lines still run under ordinary shapes.

## 0.9.5 — 2026-09-17

### Fixed

- **Connector labels are readable and exported.** The label pill was 12 px light-grey text with no background, invisible on light paper, and PNG/SVG export dropped it entirely. Now: 14 px by default, text in the board's default text colour (dark on light paper, light on dark), a paper-coloured pill bordered in the line's colour, sized to the text instead of a fixed 120 × 24 box. Exports draw the same pill and text.
- The **Label** section of the properties panel gains a colour palette and a size slider (8–48) for the label.

## 0.9.4 — 2026-09-17

### Added

- **Three composite rectangle shapes**, drawn like any other shape and carrying the same fill, stroke, dash, opacity, text and rotation attributes:
  - **3D box** (`B`): a front face with a top-and-left band in the stroke colour at half opacity, for external entities. Band depth is 12 % of the shorter side, 6–24 units. Text sits in the front face.
  - **Data store** (`X`): a box with one vertical line inset from the left edge by the box height (never past 40 % of the width). Text sits right of the line.
  - **Collection** (`K`): a box with one horizontal divider below the top, adjustable from 10 % to 33 % of the height in the new **Divider** section (default 20 %). Text sits below the divider.
- Corners stay sharp on the three; **Corners** (radius) applies to rectangles only. Anchors are unchanged: the six points of the bounding box.
- PNG and SVG export place the text in the same sub-rectangle as the canvas.

### Notes

- A `.haldraw` file containing the new kinds is rejected by 0.9.3 and earlier with "unknown type".

## 0.9.3 — 2026-09-16

### Fixed

- **Vectorize places the draft against the image as it is when the reply arrives**, not as it was when the button was pressed. Moving or resizing the reference, or reordering layers, during the call no longer misplaces the draft. If the image was removed, or a different board opened, while the model was working, a toast says so and nothing is inserted (previously the draft could land on whichever board was open).
- **Undo never leaves a locked layer current.** When the current layer disappears (undo or redo of a step that created it, deleting it, or loading a board whose saved current layer is gone), the current layer becomes the topmost *unlocked* layer instead of the bottom one, which after a reference import is the locked Reference layer. Previously the next shape drawn after undoing a vectorize landed on Reference and could not be selected.

### Internal

- `HALDRAW_VECTORIZE_FAKE_DELAY_MS` delays the canned test result so the in-flight state can be exercised.

## 0.9.2 — 2026-09-15

### Changed

- **Vectorize drafts carry the text colour.** The model now reports each shape's text colour; when it can't, the draft picks black or white against the shape's fill by luminance, so white-on-dark-green stays white instead of the board's default dark text.
- The sparkle on a Reference images row shows the same progress text ("Preparing image…", "Asking claude-opus-5…") as the full button while a call runs.

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
