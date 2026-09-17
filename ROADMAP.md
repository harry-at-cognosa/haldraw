# haldraw Roadmap

Living list of proposed features, post-v0.2. Edit freely — reorder, strike through, add.

---

## Round 2 (next batch of likely-valuable work)

- ~~**Reference image polish (0.5.0).**~~ Shipped 2026-09-13: opacity, dim references, large-image downsampling, dense z-order. Hide / exclude-from-export folds into object layers (Round 3).
- **Customizable color palette.** Let the user replace any swatch in the fill / stroke / text palettes with a color picked via the native macOS color panel ("crayon box"). Scope: system-wide going forward. Existing drawings untouched — every element already stores its own hex code. Includes a **Reset palette** button to revert to the starter set (eight swatches + transparent + eight board backgrounds).
- **Configurable grid spacing.** Slider in the Board panel for dot size and snap granularity. Today hardcoded: 20 px between dots, 10 px snap. Harry wanted "half-inch dots" as an option.
- ~~**Export to JSON** + **import from JSON.**~~ Shipped 0.6.0 as `.haldraw` v1, single board. Project-level export and merge-into-existing are open follow-ups. Spec: [docs/Haldraw_file_format.md](./docs/Haldraw_file_format.md).
- **Auto-backup.** Rotating daily snapshots of the SQLite file to `~/Library/Application Support/haldraw/backups/`, keep last N (configurable, default 14). Cheap insurance.
- **Freehand / pen tool.** Ink-style freehand drawing for annotations and quick sketches.
- **Zoom in / out buttons** next to the % readout. Today zoom is keyboard + scroll only.
- **`⌘K` palette.** Fuzzy search across all projects and boards — jump to any diagram instantly.
- **Board search.** Find shapes within the current board by label text.

## Round 3 (heavier features; think about the use cases)

- ~~**Object layers.**~~ Shipped 0.7.0. Follow-ups: drag-to-reorder rows, per-layer export subset picker, row flash on auto-switch.
- ~~**Vectorize a raster image into shapes and text.**~~ Shipped 0.9.0–0.9.3 (Claude vision → Draft layer). Spec: [docs/Vectorize_raster_design.md](./docs/Vectorize_raster_design.md); how it works: [docs/Vectorize_pipeline_implementation_reference_2026-09-15.md](./docs/Vectorize_pipeline_implementation_reference_2026-09-15.md). Open follow-ups from the review: serialise concurrent calls, share the keychain command string, classify stray errors ([docs/Vectorize_findings_impact_2026-09-15.md](./docs/Vectorize_findings_impact_2026-09-15.md)).
- **Vectorize recognises the composite shapes** (3D box, data store, collection; added for drawing in 0.9.4). Widen the `kind` enum in the schema, prompt and validator; "use rect when unsure" stays. Needs real calls on real diagrams to judge the hit rate before shipping, since these are rectangles plus one line or band and both misses and false positives are likely at diagram resolution. Do after **Change shape type** so misclassifications are cheap to fix.
- **Change shape type.** A control in the properties panel to turn a selected node into another kind (rect ↔ ellipse ↔ diamond ↔ 3D box ↔ data store ↔ collection) keeping position, size, style and text. Today a wrong kind means delete and redraw.
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
