# haldraw Roadmap

Living list of proposed features, post-v0.2. Edit freely — reorder, strike through, add.

---

## Round 2 (next batch of likely-valuable work)

- ~~**Reference image polish (0.5.0).**~~ Shipped 2026-09-13: opacity, dim references, large-image downsampling, dense z-order. Hide / exclude-from-export folds into object layers (Round 3).
- ~~**Customizable color palette.**~~ Shipped 0.9.11: right-click / ⌥-click a swatch to replace it via the native colour panel, app-wide, with Reset palette in Settings.
- **Configurable grid spacing.** Slider in the Board panel for dot size and snap granularity. Today hardcoded: 20 px between dots, 10 px snap. Harry wanted "half-inch dots" as an option.
- ~~**Export to JSON** + **import from JSON.**~~ Shipped 0.6.0 as `.haldraw` v1, single board. Project-level export and merge-into-existing are open follow-ups. Spec: [docs/Haldraw_file_format.md](./docs/Haldraw_file_format.md).
- ~~**Auto-backup.**~~ Shipped 0.9.12: daily snapshots in `backups/`, keep N (Settings, default 14), Back up now, Reveal in Finder.
- ~~**Freehand / pen tool.**~~ Shipped 0.9.13: `P`, smoothed ink strokes as `ink` nodes.
- ~~**Zoom in / out buttons**~~ Shipped 0.9.14, with ⌘= / ⌘−.
- **`⌘K` palette.** Fuzzy search across all projects and boards — jump to any diagram instantly.
- **Board search.** Find shapes within the current board by label text.

## Round 3 (heavier features; think about the use cases)

- ~~**Object layers.**~~ Shipped 0.7.0. Follow-ups: drag-to-reorder rows, per-layer export subset picker, row flash on auto-switch.
- ~~**Vectorize a raster image into shapes and text.**~~ Shipped 0.9.0–0.9.3 (Claude vision → Draft layer). Spec: [docs/Vectorize_raster_design.md](./docs/Vectorize_raster_design.md); how it works: [docs/Vectorize_pipeline_implementation_reference_2026-09-15.md](./docs/Vectorize_pipeline_implementation_reference_2026-09-15.md). Review follow-ups (serialise concurrent calls, share the keychain command string, classify stray errors) shipped 0.9.10, which also made PNG/SVG export wrap text like the canvas ([docs/Vectorize_findings_impact_2026-09-15.md](./docs/Vectorize_findings_impact_2026-09-15.md)).
- ~~**Vectorize recognises the composite shapes**~~ Shipped 0.9.7. Ground truth (an 11-shape board exported from haldraw) came back 11/11 kinds at 2132 px and at 800 px; the three spec images likewise. Open: the test set is haldraw's own rendering; hand-drawn or other tools' renderings of these shapes are untested.
- ~~**Change shape type.**~~ Shipped 0.9.9: Shape row in the properties panel (rect ↔ ellipse ↔ diamond ↔ 3D box ↔ data store ↔ collection ↔ text), keeps everything else.
- **Templates / stencils.** A starter library: flowchart, DFD (L0/L1/L2 scaffolds), ERD, system architecture, sequence diagram. Insert a pre-populated group of shapes.
- **Presentation mode.** Hide chrome, framed "slides" defined by rectangles, step through with arrow keys. Good for walking someone through a DFD hierarchy.
- **Markdown inside text shapes.** Bold / italic / bullets without leaving the diagram.
- **Shape comments / sticky notes.** Per-shape discussion threads (would require a tiny comments table).
- **Outline / tree view.** Sidebar showing the hierarchical structure of what's on the board — useful for big diagrams.

## Polish backlog (small, opportunistic)

- ~~Resize handle proportions / aspect-ratio lock (hold `Shift` while resizing).~~ Shipped in 0.4.0.
- Smarter orthogonal auto-routing (avoid overlapping shapes, Manhattan pathfinding).
- Pinch-zoom on trackpad.
- Window size / position persistence per project.
- Quick-swap between light/dark canvas while dark-UI stays (or vice-versa).
- Optional app-theme ↔ board-background link (toggle: when app theme flips, auto-flip the current board's paper color). Left independent by default.
- ~~"Lock" a shape so it can't be accidentally moved.~~ Shipped in 0.4.0 for images (reference layer); generalising the toggle to every shape type is a small follow-up.
- Arrow keys while dragging = constrain to horizontal / vertical.

## Things to decide later

- **Portable `.haldraw` file format.** JSON export does 80% of this; do we also want a CLI (`haldraw open path.haldraw`)?
- **Code signing & notarization & Mac App Store.** Detailed plan lives in [MAS.md](./MAS.md) — two rungs (Developer ID notarized DMG, then MAS). Skip until the app outgrows the "share with a few friends" phase.
- **Windows / Linux builds.** `electron-builder` handles most of it; Windows signing cert is an extra cost.
- **Collaboration.** Single-user was the explicit goal. Shared boards would require a sync layer (Yjs, etc.) and an upstream server.

---

## Tracking

Shipped features get logged to [CHANGELOG.md](./CHANGELOG.md) with a dated version. Once something here is done, cross it off (or delete) here and add it there.
