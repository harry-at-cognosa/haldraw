# haldraw 0.7.0 — test plan 2: layers

Six scenarios for the layers release. Assumes test plan 1 has passed on 0.6.x. `Esc` deselects and shows the **Board** panel, where the **Layers** list lives. The toolbar title has a layer dropdown showing the current layer.

| Key | Action |
|---|---|
| `⌘⇧L` | New layer |
| `⌘⌥]` / `⌘⌥[` | Move selection up / down a layer |
| `⌘]` / `⌘[` | Bring forward / send backward (within layer) |
| `⌘A` | Select all (skips hidden and locked) |
| `⌘Z` | Undo |
| `⌘E` | Export PNG |

## Scenario 1 — Migration

1. Launch 0.7.0 over your 0.6.x database. Open the traced logo board. **Check 1.1:** everything is where it was, same stacking.
2. Press `Esc`. **Check 1.2:** the Layers list shows one layer, "Layer 1", highlighted as current, with a count equal to the number of shapes including the reference image.
3. **Check 1.3:** the toolbar dropdown says "Layer 1".
4. In a terminal:
   ```bash
   sqlite3 ~/Library/Application\ Support/haldraw/haldraw.db "SELECT count(*) FROM nodes WHERE layer_id IS NULL; SELECT count(*) FROM boards WHERE current_layer IS NULL;"
   ```
   **Check 1.4:** both counts are 0.

## Scenario 2 — New board from image

1. Library ▸ **From image…** ▸ `logo.png` ▸ accept name. In the placement dialog **Check 2.1:** "Place on its own locked layer" is ticked by default. Place.
2. `Esc`. **Check 2.2:** two layers: "Drawing" on top (current, count 0) and "Reference" below (locked padlock, count 1).
3. Press `R`, draw a rectangle. **Check 2.3:** Drawing's count becomes 1; Reference stays 1.
4. Click the reference image. **Check 2.4:** it does not select (layer is locked). Click the padlock on Reference to unlock, click the image. **Check 2.5:** it selects, and the current layer switches to Reference (row highlight and toolbar dropdown both change). Lock it again.

## Scenario 3 — Current layer and auto-switch

1. On the same board, `⌘⇧L`. **Check 3.1:** "Layer 3" appears above Drawing and is current.
2. Draw an ellipse. **Check 3.2:** it lands on Layer 3 (count 1).
3. Click the rectangle from Scenario 2. **Check 3.3:** current switches to Drawing. Press `⌘D`. **Check 3.4:** the duplicate lands on Drawing, not Layer 3.
4. Use the toolbar dropdown to pick Layer 3, then `T` and type some text. **Check 3.5:** text lands on Layer 3.
5. Double-click the "Layer 3" name in the list, type `Labels`, Enter. **Check 3.6:** renamed; survives `⌘Z` then `⌘⇧Z`.

## Scenario 4 — Visibility, lock, solo

1. Click the eye on Labels. **Check 4.1:** ellipse and text vanish; the row dims; `⌘A` selects only Drawing shapes. Click the eye again to restore.
2. Draw a connector (`C`) from the rectangle to the ellipse. Hide Labels. **Check 4.2:** the connector disappears with the ellipse. Show Labels.
3. Lock Drawing. Click the rectangle. **Check 4.3:** no selection; a marquee starts instead. Press `R` and draw over it: works. Unlock Drawing.
4. Hover the Labels row, click the solo icon. **Check 4.4:** only ellipse and text visible; the reference image is gone too. Click solo again. **Check 4.5:** everything returns. Reopen the board from the library. **Check 4.6:** solo is off, visibility and lock states are as you left them.

## Scenario 5 — Ordering and moving between layers

1. Select the ellipse (Labels). Press `⌘⌥[`. **Check 5.1:** its layer becomes Drawing (Labels count −1, Drawing +1, current = Drawing). Press `⌘⌥]`. **Check 5.2:** back on Labels.
2. Select the rectangle. In the properties panel, Layer section, **On layer** dropdown ▸ Labels. **Check 5.3:** moved; the rectangle now draws above everything on Drawing regardless of `⌘]`/`⌘[`.
3. Hover Labels, click ▼ to move the layer below Drawing. **Check 5.4:** Labels' shapes now draw beneath Drawing's shapes. Click ▲ to restore.
4. With two shapes on the same layer overlapping, `⌘]` and `⌘[` on the lower one. **Check 5.5:** they swap in one press each, as in 0.5.0.

## Scenario 6 — Delete, export, round trip

1. Add an empty layer (`⌘⇧L`), hover it, trash ▸ **delete**. **Check 6.1:** gone; `⌘Z` restores it.
2. Hover Labels (non-empty), trash. **Check 6.2:** both **merge** and **delete** appear. Click **merge**. **Check 6.3:** its shapes are now on the layer below; Labels is gone; `⌘Z` restores layer and membership.
3. Hover the only remaining non-Reference layer when Reference is the only other: with exactly two layers, delete the top one via **delete**; then try to delete the last layer. **Check 6.4:** no trash icon is offered for the last layer.
4. Hide Reference, `⌘E`, open the PNG. **Check 6.5:** no reference in the export (both because hidden and because "Include reference images" is off). Show Reference, tick Include reference images, export. **Check 6.6:** reference present. Untick.
5. Export ▾ ▸ haldraw board. Import it from the library. **Check 6.7:** layer names, order, visibility and lock all match; shapes are on the right layers; current layer is the top one.
6. Import a `.haldraw` file exported from 0.6.x (before layers). **Check 6.8:** imports with one "Layer 1" holding everything.
7. Duplicate the board (`⌘⇧D`), open the copy. **Check 6.9:** layers copied with membership intact.

## Reporting

Check numbers that failed, one line each on what you saw.
