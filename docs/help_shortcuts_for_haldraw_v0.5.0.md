# haldraw 0.5.0 — help and shortcuts

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
| `Delete` / `Backspace` | Delete selection |
| Arrow keys (+ `Shift`) | Nudge 1 px (10 px) |
| `Esc` | Deselect everything (shows the Board panel) |

### Stacking order

| Key | Action |
|---|---|
| `⌘]` | Bring forward |
| `⌘[` | Send backward |
| `⌘⇧]` | Bring to front |
| `⌘⇧[` | Send to back |

### Other

| Key | Action |
|---|---|
| `⌘V` | Paste screenshot as image |
| `⌘⇧I` | Import image file (placement dialog) |
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
| Toolbar, right side | Export ▾ | PNG transparent · PNG solid · SVG |
| Board panel (nothing selected) | Background swatches | Set this board's paper colour |
| Board panel | Reference images list | Unlock (selects) · Remove |
| Board panel | Dim references on canvas | Fade locked images; never exported |
| Properties panel, Image section | Opacity slider | Image opacity |
| Properties panel, Image section | Lock as reference | Make the image ignore the pointer |
| Properties panel, Image section | Reset to original size | Restore intrinsic pixel size |
| Properties panel, Layer section | ▲ ▼ ⇈ ⇊ | Same as the stacking-order keys |
