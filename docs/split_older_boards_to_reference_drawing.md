# Split an older board into Reference and Drawing layers

Applies to boards that existed before haldraw 0.7.0 (object layers).

## Why the reference is not its own layer

The 0.7.0 migration put every node on each existing board, the locked reference image included, onto a single layer named **Layer 1**. Only boards created with **From image…** (or a dropped image) from 0.7.0 onward get the two-layer arrangement automatically: a locked **Reference** layer at the bottom and a current **Drawing** layer above it.

The locked image still appears in the **Reference images** section below the Layers list, because that section follows the node-level lock, not layer membership.

## Steps

All in the editor with the board open. `Esc` deselects and shows the Board panel.

1. Press `Esc`, then `⌘⇧L`. A new layer, **Layer 2**, appears above Layer 1 and becomes current.
2. Press `⌘A`. This selects every drawn shape and skips the locked reference image.
3. Move the selection up one layer: press `⌘⌥]`, or in the properties panel's **Layer** section choose **Layer 2** in the **On layer** dropdown.
4. Press `Esc`. In the Layers list:
   - double-click **Layer 1**, rename it `Reference`, press Enter, then click its padlock to lock the layer;
   - double-click **Layer 2**, rename it `Drawing`, press Enter.

Result: Reference (locked, bottom) holds the image; Drawing (current, top) holds everything else. Every step is undoable with `⌘Z`.

## Check

- Layers list shows Drawing above Reference; the Reference row has the padlock set and a count of 1.
- Clicking the image starts a marquee rather than selecting it.
- Hiding Reference with its eye icon removes the image from the canvas and from PNG/SVG export.
