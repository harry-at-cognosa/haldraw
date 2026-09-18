# haldraw: complete roadmap snapshot, 2026-09-18

Point-in-time consolidation of every open item, drawn from [ROADMAP.md](../ROADMAP.md), the vectorize review follow-ups in [Vectorize_findings_impact_2026-09-15.md](./Vectorize_findings_impact_2026-09-15.md), and questions raised during the 0.9.x work. The living list stays in `ROADMAP.md`; this file is a snapshot for planning and for the record.

## Where things stand

| | |
|---|---|
| Latest on `main` | 0.9.8 (from the M1: Shift-resize scales text and strokes; ⌘1 zoom-to-fit no longer writes a negative zoom) |
| Installed on the M2 | 0.9.7 |
| Shipped this week | 0.9.0–0.9.2 Vectorize; 0.9.3 stale-state and locked-layer fixes; 0.9.4 three composite shapes; 0.9.5 readable, exported line labels; 0.9.6 lines paint above locked images; 0.9.7 Vectorize recognises the composite shapes, line labels get font and weight; 0.9.8 as above |
| Crossed off the roadmap since it was last reviewed | reference image polish (0.5.0), JSON export/import (0.6.0), object layers (0.7.0), Vectorize (0.9.0–0.9.3), Vectorize recognition of the composite shapes (0.9.7) |

## 1. Round 2, smaller features

| Item | Notes |
|---|---|
| Customisable colour palette | Replace any fill / stroke / text swatch via the native macOS colour panel, system-wide going forward; existing drawings untouched since every element stores its own hex. Includes a **Reset palette** button |
| Configurable grid spacing | Slider in the Board panel for dot spacing and snap granularity. Today 20 px dots, 10 px snap. The "half-inch dots" request |
| Auto-backup | Rotating daily snapshots of the SQLite file to `~/Library/Application Support/haldraw/backups/`, keep last N (default 14) |
| Freehand / pen tool | Ink-style drawing for annotations and quick sketches |
| Zoom in / out buttons | Next to the % readout; zoom is keyboard and ⌘-scroll only today |
| ⌘K palette | Fuzzy search across projects and boards |
| Board search | Find shapes on the current board by label text |

## 2. Round 3, heavier features

| Item | Notes |
|---|---|
| **Change shape type** | Properties-panel control to turn a node into another kind (rect ↔ ellipse ↔ diamond ↔ 3D box ↔ data store ↔ collection) keeping position, size, style and text. Today a wrong kind means delete and redraw. Suggested first: it is the cheapest way to correct a Vectorize misclassification |
| Templates / stencils | Starter library: flowchart, DFD L0/L1/L2 scaffolds, ERD, system architecture, sequence diagram; insert a pre-populated group |
| Presentation mode | Hide chrome, "slides" framed by rectangles, arrow keys to step. Useful for walking a DFD hierarchy |
| Markdown inside text shapes | Bold / italic / bullets without leaving the diagram |
| Shape comments / sticky notes | Per-shape threads; needs a small comments table |
| Outline / tree view | Sidebar with the structure of the board, for large diagrams |

## 3. Polish backlog, small and opportunistic

- Smarter orthogonal auto-routing (avoid shapes, Manhattan pathfinding)
- Pinch-zoom on the trackpad
- Window size and position persistence per project
- Quick swap between light and dark canvas while the UI theme stays, or the reverse
- Optional app-theme ↔ board-background link (toggle; independent by default)
- Arrow keys while dragging constrain to horizontal or vertical
- Generalise the lock toggle to every shape type (0.4.0 shipped it for images)
- Layers follow-ups from 0.7.0: drag-to-reorder rows, per-layer export subset, row flash on auto-switch

## 4. Vectorize follow-ups

From the 0.9.2 code review and this week's testing. Items 1–3 are small and could ship together as one hygiene release.

| # | Item | Why | Size |
|---|---|---|---|
| 1 | Serialise calls | The busy flag is per button, so two rows' sparkles can run at once and each creates its own "Draft" layer; if the Image section unmounts mid-call the progress text is lost. One in-flight set shared by both buttons, and reuse any "Draft" layer above the reference, not only the one directly above | small |
| 2 | One copy of the keychain command string | It is duplicated in `electron/vectorize.ts` and `SettingsModal.tsx`; move it to `shared/types.ts` | trivial |
| 3 | Classify stray errors | Exceptions that are not SDK `APIError`s, and a malformed fake file, reach the toast with raw wording | cosmetic |
| 4 | Recognition beyond haldraw's own renderings | The composite-shape ground truth (11/11 at 2132 px and 800 px) used PNGs exported from haldraw plus the three spec images. Hand-drawn diagrams and other tools' output are untested; expect more "use rect when unsure" fallbacks there. Test when real diagrams are to hand | test only |
| 5 | Export text wrapping | PNG/SVG export never wraps text (`white-space: pre`), so a long single-line label overflows its box in export while it wraps on canvas. Applies to every shape kind. Harry asked to be reminded once he has used the new shapes | medium |
| 6 | Pasted images bypass the 4096 px storage downsample | Files imported or dropped are downsampled before storage; pasted images are stored as pasted. No effect on Vectorize output; larger database rows and `.haldraw` files only | optional, one call |

## 5. Things to decide later

- **Portable `.haldraw` CLI.** JSON export does most of it; is `haldraw open path.haldraw` wanted?
- **Code signing, notarisation, Mac App Store.** Plan in [MAS.md](../MAS.md). Skip until the app outgrows "share with a few friends".
- **Windows / Linux builds.** `electron-builder` handles most of it; Windows signing certificate is an extra cost.
- **Collaboration.** Single-user was the explicit goal; shared boards would need a sync layer and a server.

## 6. Known limits, recorded, not scheduled

- Anchors are the six bounding-box points for every shape kind; no perimeter or vertex snapping ([Allowed_connection_points_for_shapes_haldraw_v0.9.3.md](./Allowed_connection_points_for_shapes_haldraw_v0.9.3.md)). Decision on 2026-09-17: keep this scheme for now.
- Lines carry one head style per end from six; no per-line colour for the label pill border other than the line colour.
- Vectorize captures shapes, text and connectors by endpoints only; connector paths, corner radius, stroke width, gradients and free lines are out of scope by design (§9 of the [implementation reference](./Vectorize_pipeline_implementation_reference_2026-09-15.md)).
- `.haldraw` files that contain the composite shapes are rejected by 0.9.3 and earlier; no back-compat work by standing decision.

## Suggested order

1. Install 0.9.8 on the M2 (ship steps only, no code).
2. Change shape type.
3. Vectorize hygiene release (items 1–3 above), plus export text wrapping if wanted.
4. Then pick from Round 2 by appetite: auto-backup and grid spacing are the cheapest wins; the palette editor is the most requested.
