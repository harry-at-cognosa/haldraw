# Connection points, round 2: proposal for the record — 2026-09-18

Sixteen named connection slots on every shape, an explicit picker, and snap-to-slot while dragging a line end. Written after the 0.9.16 release; supersedes the "stay with six anchors" decision recorded in [Allowed_connection_points_for_shapes_haldraw_v0.9.3.md](./Allowed_connection_points_for_shapes_haldraw_v0.9.3.md). Decisions below are Harry's, 2026-09-18.

## Decisions

| Question | Decision |
|---|---|
| Scope | One release (0.9.17). |
| Corners on boxes | Pickable. |
| Auto attachment on boxes and diamonds | The four side midpoints only, chosen by direction as today. Corners are reached by picking a slot or by releasing on the corner dot. |
| Auto attachment on ellipses | Eight majors (cardinals and diagonals), chosen by angle. |
| Ink strokes | Not attachable, as today. |
| Rotated shapes | Slots rotate with the shape, as today. |

## The scheme

One vocabulary of sixteen slots, named like the sixteen cells on the perimeter of a 5×5 grid, using compass names: `n`, `nne`, `ne`, `ene`, `e`, `ese`, `se`, `sse`, `s`, `ssw`, `sw`, `wsw`, `w`, `wnw`, `nw`, `nnw`. Plus `center` and `auto`. Each shape kind places the sixteen slots on its own outline:

| Shape | Slot placement |
|---|---|
| Rectangle, 3D box, data store, collection, text, image, icon | Each side: its two quarter points and its midpoint (12), plus the four corners (16). |
| Ellipse | Parametric angles every 22.5°. `n` `e` `s` `w` are the extreme points (unchanged); `ne` `se` `sw` `nw` are the new halfway points on the curve; the other eight sit between those. |
| Diamond | `n` `e` `s` `w` stay the vertices; `ne` `se` `sw` `nw` are the midpoints of the four edges; the remaining eight are the quarter points of each edge. |

Outward normals, which curved and orthogonal routing use to leave a shape:

- Rectangle family: a quarter point uses its side's normal (unchanged behaviour); a corner uses the diagonal.
- Ellipse: the true tangent normal at that angle, so curves leave the oval along its surface instead of horizontally or vertically.
- Diamond: edge slots use the edge normal; vertices keep the bisector.

## How it is used

- **Picker.** The Anchors section of the line panel becomes a 5×5 dot picker per end: sixteen perimeter dots, a centre dot, and an Auto toggle, with a faint glyph of the attached shape's kind behind it so a dot reads as a place on that shape.
- **Snap while dragging.** While a line end hovers over a shape, all sixteen slots show as small dots on the outline. Releasing within about 12 px of a dot sets that slot explicitly; releasing anywhere else inside the shape keeps `auto`. The same applies when re-dragging an existing line's endpoint. This is the everyday route to two parallel lines on the same side without overlap.
- **Auto** remains the default for drawn, snapped and Vectorize edges.

## Data and compatibility

- Stored anchor values become `auto`, `center`, or a compass name. The old `top` / `right` / `bottom` / `left` are read as `n` / `e` / `s` / `w` on load; nothing in the database or in existing `.haldraw` files needs touching.
- A file with the new names opened in 0.9.16 or earlier falls through to `center` for that end. Recorded, not engineered around, per the standing no-back-compat rule.

## How a line is drawn (0.9.16 behaviour, unchanged by this proposal)

One press-drag-release gesture, not two clicks.

1. **Arrow (A) or Line (L):** press anywhere inside the source shape's bounding box. Interior or edge makes no difference; the topmost unlocked shape under the pointer is the source. Ink strokes and locked reference images are ignored. Pressing on empty canvas starts a loose line from that point.
2. Drag toward the target. The shape whose box is under the pointer shows a blue halo; that is the shape the end will attach to.
3. Release anywhere inside the target shape's box. The line attaches with `auto` at both ends, so the visible endpoints move to the facing side midpoints of each box, not to where you pressed or released.
4. Release outside every shape and the end is a loose point exactly there; the arrow points into space. The endpoint can be dragged onto a shape later while the line is selected.

A press-release with almost no travel touching no shape is discarded, as is a line from a shape back to itself. Holding ⌥ disables snapping at both ends. The tool returns to Select after each line.

**Connector (C)** is stricter: the press must be on a shape and the release on a different shape, or nothing is created.

After 0.9.17, step 3 gains the dot snap described above; steps 1, 2 and 4 are unchanged.

## Implementation scope

Geometry (slot tables, `anchorPoint`, `outwardNormal`), the `Anchor` type plus the alias for the old names, the panel picker, the canvas hover dots and release snap, an update to the connection-points doc, and a changelog entry. Similar effort to the pen tool (0.9.13).
