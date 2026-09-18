# Connection points for lines and arrows — haldraw 0.9.17

Supersedes the 0.9.3 note. Design and decisions: [Connection_points_proposal_260918.md](./Connection_points_proposal_260918.md). Code: `src/util/geometry.ts` (`slotPointLocal`, `slotNormalLocal`, `autoSlot`, `anchorPoint`, `outwardNormal`, `nearestSlot`), `src/canvas/Canvas.tsx` (hover dots, snap), `src/panels/PropertiesPanel.tsx` (`AnchorRow`).

## Slots

Sixteen named slots on every shape, clockwise from north: `n nne ne ene e ese se sse s ssw sw wsw w wnw nw nnw`, plus `center` and `auto`. Each kind places them on its own outline; a rotated shape rotates them with it.

| Shape | Slot placement | Outward normal |
|---|---|---|
| Rectangle, 3D box, data store, collection, text, image, icon | Each side: quarter points and midpoint; plus the four corners | The side's normal; corners the diagonal |
| Ellipse | Parametric angle every 22.5° from north | The true tangent normal |
| Diamond | `n e s w` at the vertices; `ne se sw nw` at the edge midpoints; the rest at the edges' quarter points | Edge normal; vertices the bisector |

Ink strokes take no connections.

## Auto

| Shape | Auto chooses |
|---|---|
| Rectangle family, diamond | One of `n e s w` by direction to the other end, scaled by the box's aspect ratio (unchanged behaviour) |
| Ellipse | The nearest of the eight majors (`n ne e se s sw w nw`) by angle to the other end |

## How a slot is chosen

- **While dragging a line end over a shape** (drawing with L, A or C, or re-dragging an endpoint of a selected line), the sixteen slots show as dots and the nearest dot within 12 screen px lights up. Release there and the end takes that slot; release anywhere else inside the shape and it stays `auto`.
- **In the panel**, each attached end has a picker: the dots drawn on a glyph of the shape's kind, a centre dot, and Auto. Hovering a dot names it.

## Stored values

Anchors are stored per edge end as `auto`, `center` or a slot name. The pre-0.9.17 names `top` `right` `bottom` `left` are read as `n` `e` `s` `w` when a row or a `.haldraw` file loads; they are rewritten only when the edge is next saved. A file with the new names opened in 0.9.16 or earlier resolves those ends to `center`.
