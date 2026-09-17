# Connection points for lines and arrows — haldraw 0.9.3

How an attached line end chooses its point on a shape, and what the six line-end glyphs are. Written 2026-09-17 from `src/util/geometry.ts` (`anchorPoint`), `src/canvas/routing.ts`, `src/canvas/Shape.tsx` and `src/canvas/edgeHeads.ts`. Decision on 2026-09-17: stay with this scheme for now.

## 1. Anchors

The set is the same for every shape kind. An attached edge end has one of six anchors, all computed from the node's axis-aligned bounding box, then rotated with the node if it has a rotation.

| Anchor | Point |
|---|---|
| `top` | midpoint of the top edge of the box |
| `right` | midpoint of the right edge |
| `bottom` | midpoint of the bottom edge |
| `left` | midpoint of the left edge |
| `center` | centre of the box |
| `auto` | whichever of the four side midpoints faces the other end. The horizontal and vertical offsets to the target are compared after scaling by the box's aspect ratio (`|dx| × height` against `|dy| × width`), so a target to the right picks `right`, a target above picks `top`, and a diagonal target depends on slope versus aspect ratio |

There is no per-shape geometry: no ellipse-perimeter intersection, no diamond vertices as a distinct concept, no corner anchors, no arbitrary points along the outline. The same six points apply to rect, ellipse, diamond, text, icon and image nodes. In practice the side midpoints coincide with the visible outline for every kind:

- **rect**: the four side midpoints lie on the stroke.
- **ellipse**: the four side midpoints of the box are the ellipse's extreme points, so they lie on the curve.
- **diamond**: the polygon's four vertices are exactly the four side midpoints of the box, so an edge attaches at a vertex.
- **text**: midpoints of the invisible text box, so a line stops at the box edge, not at the glyphs.
- **icon, image**: midpoints of the node's box.

Two other things worth knowing:

- The anchor is set per edge end in the properties panel's **Anchors** section (Auto, Top, Right, Bot, Left, Ctr). Edges created by drawing, by snapping, or by Vectorize get `auto` at both ends.
- An end need not attach at all: an edge with no node at one end has a free point there (a loose endpoint). Loose ends draw from that point and use a default outward normal for curved routing.

For `auto` the outward normal, which curved and orthogonal routing use to leave the shape perpendicular to its side, comes from the same chosen side. A curved edge therefore leaves an ellipse horizontally or vertically, never along the true tangent.

## 2. Line-end glyphs

Six head styles, selectable independently for the start and the end of any line:

| Head | Drawn as | Notes |
|---|---|---|
| `none` | nothing | |
| `arrow` | filled triangle | the classic arrowhead |
| `open` | open chevron, stroked, no fill | a "V" |
| `dot` | filled circle | |
| `diamond` | filled diamond | |
| `crow` | crow's foot: three prongs meeting on the line | for entity-relationship diagrams |

All heads are drawn in the line's colour, scale with the line width, and sit on the line side of the endpoint, so a head on an attached end is not hidden under the shape it points at.

## 3. Lines and arrows are one object

There is no separate arrow type; an arrow is a line whose end has a head. The **Line (L)** tool creates a line with the heads last used; the **Arrow (A)** tool does the same but forces a filled `arrow` at the end if the remembered end head was `none`. Both remember colour, width, dash, routing and heads for the next line. Ends snap to the shape they are released on unless ⌥ is held.

Per line, the properties panel offers:

| Attribute | Choices |
|---|---|
| Color | the palette swatches shared with shape stroke, plus a custom colour |
| Width | slider 0.5 to 12 in steps of 0.5; the typed field accepts up to 100 |
| Style | Solid; Dashed (6 on, 4 off); Dotted (2 on, 3 off). The pattern does not scale with width |
| Heads | any of the six at the start, any of the six at the end |
| Routing | straight; orthogonal (one draggable elbow); curved (draggable midpoint handle) |
| Anchors | per end, as in §1 |
| Label | optional text pill at the midpoint, draggable when the line is selected |
| Layer | a line lives on a layer like a shape (⌘⌥] / ⌘⌥[ to step) |

Vectorize uses a subset: straight routing, `none` at the start, `none` or `arrow` at the end, the board's default line colour, width 2, dashed only for low-confidence elements.
