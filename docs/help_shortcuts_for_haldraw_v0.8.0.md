# haldraw 0.8.0 — help and shortcuts

Mirrors the two `?` overlays in the app. The library overlay appears on the project picker; the editor overlay appears when a board is open. `D` for Diamond and `⌘E` for Export PNG work in the editor but are not listed in the overlay; they are included here.

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
| `L` | Line |
| `A` | Arrow |
| `T` | Text |
| `C` | Connector (snaps to shapes) |
| `⌥`-drag with `L` / `A` | Draw without snapping to shapes; also `⌥`-drag an endpoint handle to detach it |
| `I` | Icon library |

### Canvas

| Key | Action |
|---|---|
| `Space` + drag | Pan |
| `⌘` / `Ctrl` + scroll | Zoom |
| `⌘0` | Reset zoom |
| `⌘1` | Zoom to fit |

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
| `Esc` | Deselect everything (shows the Board panel) |

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
| `⌘,` | Settings… (vectorize model, API key status) |
| `Shift` + resize handle | Keep aspect ratio |
| `⌘E` | Export PNG |
| `⌘`-click a shape | Open its link |
| `?` | Show / hide the help overlay |

## Panels (mouse only)

| Where | Control | Action |
|---|---|---|
| Toolbar, right side | Grid icon | Show / hide dot grid |
| Toolbar, right side | Magnet icon | Snap to grid |
| Toolbar, right side | Sun / Moon | Toggle app theme |
| Toolbar, right side | Export ▾ | PNG transparent · PNG solid · SVG · haldraw board (.haldraw) |
| Board panel (nothing selected) | Background swatches | Set this board's paper colour |
| Toolbar, centre | Layer dropdown | Current layer (new shapes land here) |
| Board panel | Layers list | Click row = current · eye = show/hide · padlock = lock · double-click = rename · ▲▼ = reorder · solo · select · delete/merge |
| Board panel | Reference images list | Unlock (selects) · Remove |
| Properties panel, header | Selection readout (0.8.2) | Type · content, then layer · z-rank · size at position |
| Properties panel, Layer section | On layer dropdown | Move selection (shapes or lines) to a layer |
| Properties panel, Heads section | Start / End rows | Head style per end: none · arrow · open · dot · diamond · crow's foot |
| Board panel | Dim references on canvas | Fade locked images; never exported |
| Properties panel, Image section | Opacity slider | Image opacity |
| Properties panel, Image section | Lock as reference | Make the image ignore the pointer |
| Properties panel, Image section | Reset to original size | Restore intrinsic pixel size |
| Properties panel, Image section | Vectorize… (0.9.0) | Editable draft of the image on a Draft layer above it, via the vision model |
| Properties panel, Layer section | ▲ ▼ ⇈ ⇊ | Same as the stacking-order keys |
