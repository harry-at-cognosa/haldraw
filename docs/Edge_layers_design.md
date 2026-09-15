# Edges on layers, head styles, and no-snap drawing — design note for 0.8.0

Written on the M1 on 2026-09-15 against 0.7.2, for implementation on the M2. Companion to the Round 3 object-layers spec in [Reference_image_import_design.md](./Reference_image_import_design.md), which promised that "a connector belongs to the layer of its `fromNode` (or the current layer when both ends are loose)" but shipped without it.

## 1. Problem

Lines, arrows and connectors are all `CanvasEdge` rows. In 0.7.x an edge has no layer, no z-index and no group, and `Canvas.tsx` paints every edge in one block *before* every node (`sortedEdges.map` precedes `sortedNodes.map` inside `<g data-root>`). Consequences:

- A free arrow drawn over a locked reference image is stored but invisible: it is painted under the image. This is the case that triggered the note.
- Edges ignore layer visibility, lock and solo except indirectly, through the nodes they attach to. A loose line on a hidden layer cannot exist because a loose line is on no layer.
- **Move to layer** and `⌘⌥]` / `⌘⌥[` act on nodes only.
- Only two head shapes exist: a filled triangle at either end, stored as `arrow_start` / `arrow_end` booleans.
- A loose line or arrow snaps to any unlocked shape its endpoint lands on, with no way to refuse.

## 2. Decision: one line type, on layers

Considered and rejected: a new `line` **node** type living beside edges. It would duplicate routing, markers, dash, label and hit-testing; the exporters and the `.haldraw` format would carry two line representations; and two things that look identical would behave differently (one snaps and follows shapes, one does not; one can be grouped, one cannot). Every comparable tool (draw.io, OmniGraffle, Inkscape connectors) has a single line object that is either attached or not.

Edges already do most of what is wanted: loose or attached ends, straight / orthogonal / curved routing, draggable midpoint on curved edges, solid / dashed / dotted, labels. What they lack is layer membership and a wider set of head shapes. So: **give edges a layer, widen the head shapes, add a no-snap modifier, keep everything else.**

Within a layer, edges still draw beneath that layer's nodes. Giving edges a z-index and merging them into the node stacking list is deferred to a possible phase 2 (section 10); the layer alone covers the reference-image case and most others.

## 3. Data model

### 3.1 SQLite (`electron/db.ts`)

```sql
-- additive; use addColumnIfMissing for each
ALTER TABLE edges ADD COLUMN layer_id   TEXT;                       -- non-null after migration
ALTER TABLE edges ADD COLUMN head_start TEXT NOT NULL DEFAULT 'none';
ALTER TABLE edges ADD COLUMN head_end   TEXT NOT NULL DEFAULT 'none';
CREATE INDEX IF NOT EXISTS edges_layer ON edges(layer_id);
```

`arrow_start` / `arrow_end` stay in the table for one release, no longer read, so a 0.7.x binary opened on the migrated database still works. Drop them in a later cleanup.

### 3.2 Migration (`migrateEdges`, called after `migrateLayers`)

Idempotent, one transaction, same style as `migrateLayers`:

1. For every edge with `layer_id IS NULL`: set it to the `layer_id` of `from_node`; if `from_node` is null, of `to_node`; if both null, the board's bottom layer (`ORDER BY position ASC LIMIT 1`).
2. For every edge where `head_end = 'none' AND arrow_end = 1`: set `head_end = 'arrow'`. Same for start. Run this only when the `head_*` columns were just added (check `PRAGMA table_info` before the `ALTER`), so a user who later sets a head to `none` is not overridden on the next launch.

Verification after launch:

```bash
sqlite3 ~/Library/Application\ Support/haldraw/haldraw.db \
  "SELECT count(*) FROM edges WHERE layer_id IS NULL;
   SELECT count(*) FROM edges e LEFT JOIN layers l ON l.id = e.layer_id WHERE l.id IS NULL;"
```

Both counts must be 0.

### 3.3 Types (`shared/types.ts`)

```ts
export type EdgeHead = 'none' | 'arrow' | 'open' | 'dot' | 'diamond' | 'crow';

export interface CanvasEdge {
  // ...existing fields...
  /** Layer this edge belongs to. Always set after migration. */
  layerId: string;
  headStart: EdgeHead;
  headEnd: EdgeHead;
  /** @deprecated read-only mirrors of headStart/headEnd !== 'none'; removed in a later release */
  arrowStart: boolean;
  arrowEnd: boolean;
}
```

Keep `arrowStart` / `arrowEnd` on the type as derived values so the exporter and file writer keep compiling; compute them in `rowToEdge` from the heads.

`electron/repo/elements.ts`: `rowToEdge`, the `INSERT … ON CONFLICT` statement and the param mapper gain `layer_id`, `head_start`, `head_end`. `electron/repo/layers.ts` `removeLayers` relies on nothing new: layer deletion is handled in the store (section 5.4), which issues the edge upserts and deletes itself.

## 4. Where a new edge lands

**Rule: a new edge lands on the current layer, exactly like a new node.** This applies to `C`, `L` and `A`, and to paste, duplicate and `.haldraw` import (import maps the file's layer ids; see section 8).

The alternative in the Round 3 text, "layer of the from-node", was rejected: it is invisible to the user, it differs between the connector tool and the line tool, and it breaks the moment the from-node is moved to another layer. Because selecting a shape already switches the current layer to that shape's layer, a connector drawn right after selecting its source shape ends up on that shape's layer anyway.

An attached edge whose end node is moved to another layer **stays on its own layer**. Exception, for convenience: when **Move to layer** or `⌘⌥]` / `⌘⌥[` moves a set of nodes, every edge whose *both* attached ends are inside that set moves with them. Edges with one end in the set stay put.

## 5. Store (`src/store/canvasStore.ts`)

### 5.1 Predicates

```ts
export function isEdgeVisible(s, e: CanvasEdge, nodes): boolean
  // own layer visible (and solo satisfied) AND every attached node isNodeVisible
export function isEdgeInteractive(s, e: CanvasEdge, nodes): boolean
  // isEdgeVisible AND own layer not locked
```

The existing rule "hide the edge when either attached node is hidden" is preserved inside `isEdgeVisible`. The reference-view buttons (Normal / Hide refs / Refs only) keep their current behaviour: edges are part of the drawing, so `refView === 'only'` hides all edges.

### 5.2 Selection and interaction

- `handleEdgePointerDown` in `Canvas.tsx` returns early when `!isEdgeInteractive`, mirroring `handleNodePointerDown`.
- Endpoint and midpoint handles are not rendered for a non-interactive edge.
- `⌘A` and marquee continue to select nodes only. (Marquee over edges is a separate feature; not in scope.)

### 5.3 Layer moves

- `moveNodesToLayer(ids, layerId)` becomes `moveToLayer({ nodeIds, edgeIds }, layerId)`; it applies the both-ends rule from section 4 to edges not explicitly listed. Update the two call sites (`PropertiesPanel.tsx` On-layer dropdown, `BoardEditor.tsx` `⌘⌥]` / `⌘⌥[`) to pass the edge selection as well.
- `⌘⌥]` / `⌘⌥[` with only an edge selected steps that edge.

### 5.4 Layer delete / merge / counts

- **Delete** a layer: its edges are deleted with its nodes.
- **Merge down**: its edges move to the target layer with its nodes.
- The Layers list count shows nodes and edges separately when both are present: `12 shapes · 3 lines`; `12 shapes` when there are no edges. The shape-count field already exists; add the edge count beside it.
- **Select all on layer** in the Layers list selects that layer's edges too.
- **Solo** applies to edges through `isEdgeVisible`.

### 5.5 Undo

Layer moves of edges, head changes and layer delete/merge of edges all go through the existing snapshot mechanism (`snapshot()` already copies `edges`); nothing new is needed beyond including edges in the affected operations.

## 6. Rendering (`src/canvas/Canvas.tsx`)

Replace the two flat lists with a per-layer interleave:

```tsx
{layerOrder(layers).map((layer) => (
  <g key={layer.id} data-layer={layer.id}>
    {edgesByLayer.get(layer.id)?.map((edge) => <Edge … />)}
    {nodesByLayer.get(layer.id)?.map((node) => <Shape … />)}
  </g>
))}
```

`edgesByLayer` filters with `isEdgeVisible`; `nodesByLayer` keeps the current `isNodeVisible` + `refView` filter and the z-index sort. Selection handles and the marquee stay in their existing overlay group above all layers.

Result: an arrow on a "Notes" layer above "Reference" paints over the image; a connector on "Drawing" still paints beneath "Drawing" shapes, as today.

## 7. Head styles

### 7.1 Markers (`src/canvas/Edge.tsx`)

Keep one `<defs>` per edge (markers inherit the edge's stroke colour and must be unique per colour anyway). Replace the two fixed `<marker>` elements with a `headMarker(kind, position, stroke)` helper that returns `null` for `'none'`:

| Kind | Marker content (viewBox 0 0 10 10, refY 5, `orient="auto-start-reverse"`) | Fill |
|---|---|---|
| `arrow` | `M0 0 L10 5 L0 10 z` (existing) | stroke colour |
| `open` | `M0 0 L10 5 L0 10` as a stroked polyline, `fill="none"`, `stroke-width` 1.5 | none |
| `dot` | `<circle cx=5 cy=5 r=3.5>` | stroke colour |
| `diamond` | `M0 5 L5 0 L10 5 L5 10 z` | stroke colour |
| `crow` | three lines from `(10,5)` to `(0,0)`, `(0,5)`, `(0,10)`, `fill="none"` | none |

`refX` per kind so the line ends at the visual tip: `arrow` 8, `open` 8, `dot` 5, `diamond` 5, `crow` 9 (the crow's foot opens toward the node, so its tip is the trunk end). Marker size scales with stroke width via `markerUnits="strokeWidth"` (the default); the current `markerWidth/Height = 6` is fine for all five.

The `Edge` path uses `markerStart={headStart !== 'none' ? url(#head-start-${id}) : undefined}` and likewise for the end.

### 7.2 Properties panel (`src/panels/PropertiesPanel.tsx`)

Replace the **Arrowheads** section's two toggle buttons with two rows, each a `Segmented<EdgeHead>` of six small glyphs: none · arrow · open · dot · diamond · crow.

```
Start  [ — ][ ◀ ][ ◁ ][ ● ][ ◆ ][ ⋲ ]
End    [ — ][ ▶ ][ ▷ ][ ● ][ ◆ ][ ⋺ ]
```

Add a **Layer** section for edges, reusing the node section's **On layer** dropdown and the four stacking buttons greyed out (stacking within a layer is phase 2).

`lastEdge` (the remembered style for the next edge) stores `headStart` / `headEnd` instead of the booleans. The `A` tool sets `headEnd = 'arrow'` when the remembered value is `'none'`, matching today's `arrowEnd: true`.

### 7.3 Export

`buildExportSvg` in `src/util/exportPng.ts` emits the same markers; move `headMarker` to a shared module (`src/canvas/edgeHeads.ts`) and import it from both.

## 8. No-snap modifier

In `Canvas.tsx`, for the `L` and `A` tools only:

- pointer-down: `const startNode = e.altKey ? null : findTopmostNodeAt(…)`.
- `draw-line` pointer-move: `const target = e.altKey ? null : findTopmostNodeAt(…)`; when null, clear `hoveredNodeId` and write `toPoint`.
- Endpoint handle drag on an existing edge: same `e.altKey` check, so an attached end can be detached by Alt-dragging it off.

The `C` tool is unchanged: its whole purpose is snapping. Add `⌥-drag (L/A)` → "Draw without snapping to shapes" to the shortcut overlay and to `docs/help_shortcuts_for_haldraw_v0.8.0.md`.

Note that a locked node, or any node on a locked layer, already never captures an endpoint (`isNodeInteractive`), so drawing over a locked reference needs no modifier.

## 9. File format and import

Format stays **v1**. Writer (`src/util/haldrawFile.ts` `buildBoardFile`) adds `layerId`, `headStart`, `headEnd` to each edge and keeps writing `arrowStart` / `arrowEnd` so 0.7.x can still read the file.

Reader:

- `layerId` present → mapped through `layerIdMap` like nodes; must reference a layer in the file, else validation error `Edge ${id} references layer "${layerId}" which is not in the file.`
- `layerId` absent (0.7.x and earlier files) → layer of `fromNode`, else `toNode`, else the board's bottom layer; identical to the database migration.
- `headStart` / `headEnd` absent → `arrowStart ? 'arrow' : 'none'`; unknown head string → validation error.

Update `docs/Haldraw_file_format.md`: the edge field list, the two fallback rules, and a line in "Rules on import".

## 10. Deferred: z-order for edges (phase 2)

If "edge beneath the shapes on its own layer" proves limiting, the follow-up is:

- `edges.z_index INTEGER NOT NULL DEFAULT 0`, migrated to `min(z_index of that layer's nodes) - 1` so nothing moves visibly.
- One render list per layer of `CanvasNode | CanvasEdge` sorted by z-index; `bringForward` etc. accept edge ids; the four stacking buttons in the edge Layer section become live.
- `Tab` / `⇧Tab` cycling and Delete-selects-next include edges.

Not needed for the reference-image case and not planned until asked for.

## 11. Out of scope

- Edges in groups.
- Marquee selection of edges.
- Per-layer subset picker in the Export menu (hide layers instead, as in 0.7.0).
- Freehand / pen tool (separate roadmap item).
- Dropping `arrow_start` / `arrow_end` columns (do it one release later).

## 12. Regression checklist (0.8.0)

Assumes test plans 1 and 2 pass on 0.7.2. Use a board with a locked reference image on its own bottom layer ("Reference"), a "Drawing" layer with a few shapes and two connectors, and nothing else.

1. **Migration.** Launch 0.8.0 over the 0.7.2 database. Both counts in section 3.2 are 0. Every existing connector is on the layer of its from-node; existing arrowheads look unchanged.
2. **Arrow over reference.** `⌘⇧L` to add "Notes" above "Drawing". Press `A`, drag across the reference image from empty canvas to empty canvas. The arrow is visible on top of the image. Layers list shows `0 shapes · 1 line` for Notes.
3. **Layer visibility and lock.** Hide Notes: the arrow vanishes; `⌘A` and clicking where it was do nothing. Show. Lock Notes: the arrow renders, cannot be selected, its handles do not appear. Unlock.
4. **Solo.** Solo Notes: only the arrow shows. Solo off.
5. **Move edge between layers.** Select the arrow; Properties › Layer › On layer → Drawing. It now draws beneath the Drawing shapes it crosses. `⌘⌥]` moves it back up; it is again above.
6. **Both-ends rule.** Select two connected shapes on Drawing and `⌘⌥]`. The connector between them moved with them. A connector from one of them to a third shape left behind stayed on Drawing.
7. **Head styles.** Select a connector. Set Start = dot, End = crow. Both render, both survive relaunch. Set both to none: a plain line. Export PNG and SVG: heads match the canvas.
8. **Remembered style.** Draw a new arrow with `A`: it has the last-used heads and dash. Draw a line with `L`: end head is the remembered value, not forced to arrow.
9. **Alt no-snap.** With `A`, drag from inside a shape to inside another shape: attached at both ends (existing behaviour). Repeat holding `⌥`: both ends loose, and dragging either shape does not move the arrow. Alt-drag an attached endpoint handle off its shape: it detaches.
10. **Delete and merge.** Add a layer, put one arrow on it, delete with "delete": the arrow is gone. Undo. Delete with "merge down": the arrow is on the layer below.
11. **Export honours layers.** Hide Notes, export PNG: no arrow. Show Notes, untick "Include reference images", export PNG: arrow present, image absent, crop follows the drawing.
12. **File round trip.** Export `.haldraw`, import into a fresh project: layers, edge layers and heads all match. Import a `.haldraw` written by 0.7.x: every edge lands on its from-node's layer, arrowheads map to `arrow` / `none`.
13. **Old binary on new database.** Optional: launch the 0.7.2 bundle from `dist/` against the migrated database. It opens, edges draw beneath everything as before, arrowheads still show. Quit; relaunch 0.8.0; nothing was lost.
14. **Re-run test plan 2 scenarios 3–6** to confirm layer behaviour for nodes is unchanged.
