# Lines and arrows: head styles and attributes — haldraw 0.9.3

What a line can be in haldraw as of 0.9.3: the six head glyphs, the two drawing tools, and every attribute the properties panel exposes. Written 2026-09-17 from `src/canvas/edgeHeads.ts`, `src/canvas/Canvas.tsx` (tool defaults), `src/canvas/routing.ts` and `src/panels/PropertiesPanel.tsx`. Where a line attaches to a shape is covered in [Allowed_connection_points_for_shapes_haldraw_v0.9.3.md](./Allowed_connection_points_for_shapes_haldraw_v0.9.3.md).

## 1. The six head styles

Defined in `src/canvas/edgeHeads.ts` and selectable independently for the start and the end of any line.

| Head | Drawn as | Notes |
|---|---|---|
| `none` | nothing | |
| `arrow` | filled triangle | the classic arrowhead |
| `open` | open chevron, stroked, no fill | a "V" |
| `dot` | filled circle | |
| `diamond` | filled diamond | |
| `crow` | crow's foot: three prongs meeting on the line | for entity-relationship diagrams |

All heads are drawn in the line's colour, scale with the line width, and sit on the line side of the endpoint, so a head on an attached end is not hidden under the shape it points at.

## 2. Lines and arrows are one object

There is no separate arrow type. An arrow is a line whose end has a head. The two toolbar tools differ only in their starting heads:

- **Line (L)** creates a line with the heads you last used.
- **Arrow (A)** does the same but forces a filled `arrow` at the end if the remembered end head was `none`.

Both remember colour, width, dash, routing and heads across the session, so the next line you draw looks like the last one. Ends snap to a shape you release on (attached, `auto` anchor) unless ⌥ is held; an end released on empty canvas stays loose at that point.

## 3. Attributes of a line

Set from the properties panel with the line selected.

| Attribute | Choices |
|---|---|
| Color | the same palette swatches as shape stroke, plus a custom colour |
| Width | slider 0.5 to 12 in steps of 0.5; the typed field accepts up to 100 |
| Style | Solid; Dashed (6 on, 4 off); Dotted (2 on, 3 off). The dash pattern does not scale with width |
| Heads | any of the six at the start, any of the six at the end, independently |
| Routing | straight; orthogonal (one elbow, draggable); curved (control handle at a draggable midpoint) |
| Anchors | per end: Auto, Top, Right, Bottom, Left, Centre (see the connection-points note) |
| Label | optional text pill at the midpoint, draggable when the line is selected. Since 0.9.5 the pill is sized to the text, 14 px by default, in the board's default text colour on a paper-coloured pill bordered in the line's colour; the Label section offers colour, size (8–48) and, since 0.9.7, font family and weight (Reg / Med / Bold). Exported to PNG and SVG since 0.9.5 |
| Layer | a line lives on a layer like a shape; ⌘⌥] / ⌘⌥[ step it up or down |

Changing one style field leaves the others alone (since 0.8.1); earlier builds reset width when the colour changed and vice versa.

## 4. What Vectorize produces

Vectorize (0.9.x) uses a subset: straight routing, `none` at the start, `none` or `arrow` at the end, the board's default line colour, width 2, and Dashed only for elements the model reported with confidence below 0.6.
