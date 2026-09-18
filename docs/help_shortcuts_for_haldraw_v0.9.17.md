# haldraw 0.9.17 / 0.9.18 — help and shortcuts

Mirrors the two `?` overlays in the app (library and editor) and adds the mouse-only panel controls. Supersedes the 0.8.0 note. Items marked with a version arrived in that release.

## Library (project picker)

### Getting started

| Key / control | Action |
|---|---|
| `+` (sidebar) | New project |
| **New board** | Empty board in the selected project |
| **From image…** | Board with an image as a locked reference layer |
| Drop image on grid | Same as From image… |
| `⌘⇧I` | Import image (creates a project if none exists) |
| **Import…** / `⌘⇧O` | Import a `.haldraw` board file |
| Drop `.haldraw` on grid | Same as Import… |

### Boards

| Key / control | Action |
|---|---|
| Click card | Open board |
| Hover card | Rename · Duplicate · Copy link · Delete |
| `⌘K` (0.9.15) | Go to any board or project: fuzzy search, ↑ ↓ move, ↩ open, esc close. Also File ▸ Go to Board… |
| `?` | Show / hide the help overlay |

## Editor (board open)

### Tools

| Key | Action |
|---|---|
| `V` | Select |
| `R` | Rectangle |
| `S` | Square (locked ratio) |
| `O` | Ellipse / Circle |
| `D` | Diamond (decision) |
| `B` | 3D box (external entity) |
| `X` | Data store |
| `K` | Collection |
| `L` | Line |
| `A` | Arrow |
| `T` | Text |
| `C` | Connector (shape to shape only) |
| `P` (0.9.13) | Pen: freehand ink. Stays active between strokes; `Esc` or `V` leaves it. A stroke begun on a shape draws over it |
| `⌥`-drag with `L` / `A` | Draw without snapping to shapes; also `⌥`-drag an endpoint handle to detach it |
| `I` | Icon library |

### Drawing an arrow between two shapes, step by step

One press-drag-release gesture, not two clicks.

1. Press `A` (or click the arrow icon). The cursor becomes a crosshair.
2. **Press the mouse button down anywhere inside the source shape**: interior, label, or on the border line. It does not have to be on the border. Do not release.
3. **Keep the button held and drag** toward the target. When the pointer crosses into the target shape's box, that shape gets a blue halo and sixteen small dots appear on its outline.
4. **Release while the pointer is inside the target shape.** Two choices at that moment:
   - Release **on or within 12 px of a dot** and the arrow attaches at exactly that dot (the lit one).
   - Release **anywhere else inside the target's box** and the arrow attaches with Auto: the head goes to the side midpoint facing the source.
5. The tool returns to Select and the new arrow is selected.

The source end is always Auto when drawn this way: the tail sits at the source's side midpoint facing the target, whatever point inside the source you pressed on. To pick a source slot, use the From picker in the Anchors section afterwards, or drag the tail's endpoint handle onto a dot.

What goes wrong and why:

| You did | Result |
|---|---|
| Released outside the target's box, even one pixel past the border | The end is loose at that exact point. Select the arrow and drag its endpoint handle onto the shape |
| Pressed on empty canvas instead of inside the source | The tail is a loose point where you pressed |
| Pressed and released with under 4 px of travel, touching no shape | Nothing is created |
| Dragged back and released on the shape you started from | Nothing is created |
| Held `⌥` during the gesture | No attachment at either end, by design |

`C` (Connector) is the same gesture with stricter rules: the press must be inside a shape and the release inside a different shape, or nothing is created. `L` (Line) is the same as `A` but with no head unless you last used one.

### Canvas

| Key | Action |
|---|---|
| `Space` + drag | Pan |
| `⌘` / `Ctrl` + scroll | Zoom |
| `⌘=` / `⌘−` (0.9.14) | Zoom in / out about the view centre (also the toolbar buttons either side of the % readout) |
| `⌘0` | Reset zoom to 100 % |
| `⌘1` | Zoom to fit |
| `⌘F` (0.9.16) | Find text on this board: ↩ or ↓ next, ⇧↩ or ↑ previous, esc closes and keeps the selection |

### Edit

| Key | Action |
|---|---|
| `⌘Z` / `⌘⇧Z` | Undo / Redo |
| `⌘C` / `⌘V` / `⌘X` | Copy / Paste / Cut |
| `⌘D` | Duplicate selection |
| `⌘⇧D` | Duplicate entire board (timestamped copy) |
| `⌘G` / `⌘⇧G` | Group / Ungroup |
| `⌥`-click | Select single shape inside a group |
| `⌘A` | Select all (skips locked reference images) |
| `Tab` / `⇧Tab` | Select next / previous shape in stacking order (pans into view) |
| `Delete` / `Backspace` | Delete selection |
| Arrow keys (+ `Shift`) | Nudge 1 px (10 px) |
| `Esc` | Deselect everything (shows the Board panel); leaves the pen tool |
| Double-click a shape | Edit its text (`⌘↩` or click away to commit, `Esc` cancels) |

### Stacking & layers

| Key | Action |
|---|---|
| `⌘⇧L` | New layer |
| `⌘⌥]` / `⌘⌥[` | Move selection (shapes and lines) up / down a layer |
| `⌘]` | Bring forward |
| `⌘[` | Send backward |
| `⌘⇧]` | Bring to front |
| `⌘⇧[` | Send to back |

### Other

| Key | Action |
|---|---|
| `⌘V` | Paste screenshot as image |
| `⌘⇧I` | Import image file (placement dialog) |
| `⌘⇧O` | Import `.haldraw` board into this project |
| `⌘K` (0.9.15) | Go to any board or project |
| `⌘,` | Settings… (Vectorize model and API key status, Palette, Backups) |
| `Shift` + resize handle | Keep aspect ratio; on a multi-selection also scales text and stroke widths (0.9.8) |
| `⌘E` | Export PNG (transparent) |
| `⌘`-click a shape | Open its link |
| `?` | Show / hide the help overlay |

## Panels (mouse only)

### Toolbar

| Control | Action |
|---|---|
| Layer dropdown (centre) | Current layer: new shapes and lines land here |
| Grid icon | Show / hide the dot grid |
| Magnet icon | Snap to grid |
| ⊖ · % · ⊕ (0.9.14) | Zoom out · reset to 100 % · zoom in |
| Sun / Moon | Toggle app theme |
| Keyboard icon | Shortcut overlay |
| Gear | Settings… |
| Export ▾ | PNG transparent · PNG solid · SVG · haldraw board (.haldraw); "Include reference images" toggle when the board has any. Exports wrap text the way the canvas does (0.9.10) |

### Properties panel (something selected)

| Section | Control | Action |
|---|---|---|
| Header | Selection readout | Type · content, then layer · z-rank · size at position |
| Shape (0.9.9) | Seven kind buttons | Turn the selection into a rectangle, ellipse, diamond, 3D box, data store, collection or text in place, keeping size, style, text and connectors. Not offered for icons, images or ink |
| Fill / Stroke / Text | Swatches | Click applies. Right-click or `⌥`-click a swatch to replace it, app-wide (0.9.11). The rainbow swatch is a one-off custom colour. Both open the macOS Colors panel (0.9.18); the colour applies on OK. Ink strokes show Stroke only |
| Stroke | Width · Style | Slider and typed value; Solid · Dashed · Dotted |
| Text | Font · Size · Weight · Align · V-Align | Installed fonts by name; size 4–999 |
| Layer | ⇈ ▲ ▼ ⇊ · On layer | Stacking order; move to another layer |
| Corners | Radius | Rectangles only |
| Divider | From top % | Collection boxes only, 10–33 % |
| Rotation | Slider / degrees | Full 360° |
| Align (2+ selected) | Six buttons; Distribute with 3+ | Align edges and centres; distribute evenly |
| Image | Opacity · Vectorize… · Lock as reference · Reset to original size | Vectorize asks the vision model for an editable draft on a Draft layer above the image; one call at a time |
| Link | URL field | `https://…`, `mailto:`, or `haldraw://board/ID` |
| Reset styles / Delete | | |

### Line panel (a line or connector selected)

| Section | Control | Action |
|---|---|---|
| Anchors (0.9.17) | Slot picker per attached end | Sixteen dots on a glyph of that shape's kind, a centre dot, and Auto. Boxes: side quarter points, midpoints and corners; ellipses: every 22.5° around the curve; diamonds: vertices, edge midpoints and edge quarter points. Auto uses the four side midpoints on boxes and diamonds, eight directions on ellipses |
| Routing | Straight · Right-angle · Curved | Right-angle has a draggable elbow; Curved a draggable midpoint |
| Heads | Start / End rows | none · arrow · open · dot · diamond · crow's foot |
| Layer | On layer | Move the line to another layer |
| Color · Stroke | Swatches · Width · Style | As for shapes |
| Label | Text · colour · font · size · weight | Pill at the midpoint; drag it when the line is selected |

### Board panel (nothing selected)

| Section | Control | Action |
|---|---|---|
| Background | Swatches · Custom | This board's paper colour; right-click a swatch to replace it in the palette (0.9.11) |
| Layers | List | Click row = current · eye = show/hide · padlock = lock · double-click = rename · ▲▼ = reorder · solo · select · delete/merge |
| Reference images | Rows | Vectorize sparkle · Unlock (selects) · Remove; Normal / Hide refs / Refs only view; Dim references on canvas |

### Settings… (`⌘,`)

| Section | Control | Action |
|---|---|---|
| Vectorize | Model · API key status | Model choice; the key lives in the macOS keychain (command shown) |
| Palette (0.9.11) | Shapes row · Boards row · Reset palette | Click a swatch to replace it; Reset restores the starter set |
| Backups (0.9.12) | Keep · Newest · Back up now · Reveal in Finder | Daily snapshot of the database to `~/Library/Application Support/haldraw/backups/`, newest N kept (default 14). To restore, quit haldraw and copy a snapshot over `haldraw.db` |
