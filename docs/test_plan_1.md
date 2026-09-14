# haldraw 0.5.0 — test plan 1: manual scenarios

Seven scenarios, each exercising three to five features in sequence. Every key or click you need is written inline so the help overlay is not required. Estimated time: 30 to 40 minutes for all seven.

**Before you start.** Have these files in a folder you can find from the open dialog:

- `logo.png` — any logo or simple graphic, ideally 300 to 1200 px wide, with some text in it.
- `big.png` or `big.jpg` — a raster wider than 4096 px (a full-resolution Retina screenshot of a large monitor, or export anything at 2x from Preview).
- `anim.gif` — any animated GIF.
- `diagram.png` — a screenshot of any flowchart or box-and-arrow diagram.

Quick reference used throughout. `Esc` deselects everything, which brings the **Board** panel back on the right.

| Key | Action | Key | Action |
|---|---|---|---|
| `V` | Select tool | `R` / `O` / `D` | Rectangle / Ellipse / Diamond |
| `T` | Text | `C` | Connector (snaps to shapes) |
| `A` / `L` | Arrow / Line | `I` | Icon library |
| `⌘⇧I` | Import image | `⌘Z` / `⌘⇧Z` | Undo / Redo |
| `⌘A` | Select all | `⌘D` | Duplicate selection |
| `⌘G` / `⌘⇧G` | Group / Ungroup | `⌘]` / `⌘[` | Bring forward / Send backward |
| `⌘⇧]` / `⌘⇧[` | Bring to front / Send to back | `⌘1` / `⌘0` | Zoom to fit / Reset zoom |
| `⌘E` | Export PNG | `Space`+drag | Pan |
| `⌘`+scroll | Zoom | `?` | Help overlay (library or editor) |

Record a pass or fail per numbered check. Anything that fails, note what you saw.

---

## Scenario 1 — First run and the library

**Tests:** auto-created project, help overlay, rename, drop-to-create.

1. Launch haldraw. If you have projects already, that is fine; the checks still apply.
2. Press `?`. **Check 1.1:** a "Library help" overlay appears. Press `?` again or `Esc` to close it.
3. Drag `logo.png` from Finder onto the board grid on the right. A name prompt appears with the file's basename filled in. Accept it.
   **Check 1.2:** if no project was selected, a project called "Untitled project" now exists in the sidebar and is selected.
   **Check 1.3:** the placement dialog opens showing a thumbnail, the pixel size, and the byte size.
4. Click **Place** with defaults. **Check 1.4:** the board opens, the logo fills the view, nothing is selected, the right panel says **Board** and lists one entry under **Reference images**.
5. Click **← Library**. Hover the project in the sidebar, click the pencil, rename it to `Tests`. Hover the board card, click the pencil, rename it to `Logo trace`. **Check 1.5:** both names update immediately and survive a quit and relaunch.

## Scenario 2 — Duplicate a logo

**Tests:** locked reference ignores the pointer, drawing over it, text, opacity, dim, Bring to front, removing the reference, comparing the copy.

The vocabulary here maps to what the app has today: "layer 0" is the locked reference image at the bottom of the stack; "layer 1" is every node you draw on top. There is no layer object yet.

1. Open `Logo trace`. Press `⌘1` to fit the logo to the view.
2. Click anywhere on the logo. **Check 2.1:** it does not select or move; a faint marquee rectangle starts instead. Release.
3. Press `Esc`, then in the **Board** panel tick **Dim references on canvas**. **Check 2.2:** the logo fades to about a third of its opacity.
4. Recreate the logo's outline. Press `R` and drag a rectangle over the logo's bounding shape (or `O` for a round mark, `D` for a diamond). With it selected, use the **Fill** and **Stroke** swatches in the right panel to approximate the logo's colours. Press `V` to return to select.
5. Recreate the wordmark. Press `T`, click where the logo's text sits, type the text, then click empty canvas to commit. Drag the text box's corner handles to size it. In the **Text** section change the font size and alignment to match.
6. Add an embedded mark. Press `⌘⇧I`, choose `logo.png` again, set **Size** to **Scale** and type `25`, set **Position** to **Centre of view**, untick **Lock as reference**, untick **Send to back**, untick **Fit view**, click **Place**. **Check 2.3:** a quarter-size, selectable copy appears in the middle. Drag it into a corner of your recreation. With it selected, drag the **Opacity** slider in the **Image** section to 60 and back to 100.
7. Select your rectangle and press `⌘⇧[` (Send to back). **Check 2.4:** it disappears behind the locked logo. Press `⌘⇧]` (Bring to front). **Check 2.5:** it is back on top of everything, including your text. Press `⌘[` once. **Check 2.6:** it steps down exactly one place, under the text, in a single keypress.
8. Shift-drag a corner of your rectangle. **Check 2.7:** it scales without changing proportions. Drag a corner without Shift; it stretches freely.
9. Press `Esc`. In **Reference images**, click the padlock-open icon. **Check 2.8:** the original logo becomes selected and draggable. Drag it 200 px to the right so the two sit side by side. Compare your copy against the original.
10. With the original still selected, in the **Image** section click **Lock as reference**. **Check 2.9:** selection clears and it reappears in the Board panel's list. Click its trash icon there. **Check 2.10:** only your recreation remains. Press `⌘Z`. **Check 2.11:** the original returns, still locked.
11. Press `⌘A`. **Check 2.12:** everything except the locked original is selected. Press `⌘G` to group the recreation. Click any part of it. **Check 2.13:** the whole group selects. `⌥`-click one shape inside it. **Check 2.14:** only that shape selects. Press `⌘⇧G` to ungroup.

## Scenario 3 — Trace a diagram with connectors

**Tests:** import into an existing board via the menu, origin placement, connector snapping ignores the reference, connectors between drawn shapes, edge labels.

1. In the library click **New board** and name it `DFD`. It opens empty.
2. Use the menu **File ▸ Import Image…** (or `⌘⇧I`). Choose `diagram.png`. **Check 3.1:** **Position** defaults to **Centre of view** because this is an existing board. Change it to **Origin (0, 0)**, leave the rest, click **Place**.
3. Press `R` and draw a rectangle over each box in the diagram, three or four is enough. Press `V`.
4. Press `C`. Press and drag from inside one rectangle to inside another, releasing over the second. **Check 3.2:** a connector with an arrowhead snaps between the two shapes. Repeat for two more pairs.
5. Press `C` again, press inside a rectangle and drag to a spot over the reference image where there is no drawn shape, release. **Check 3.3:** the connector ends at a loose point; it did not snap to the locked image.
6. Click a connector. In the right panel, under **Routing**, choose orthogonal. **Check 3.4:** it reroutes with a right angle and a small square handle appears at the elbow; drag the handle. Type a label in the **Label** field. **Check 3.5:** the label appears on the connector and can be dragged.
7. Drag one rectangle. **Check 3.6:** its connectors follow.
8. Press `Esc`, then **Dim references on canvas**. Press `⌘E`, save the PNG to the Desktop, open it in Preview. **Check 3.7:** the diagram screenshot in the export is at full opacity, not dimmed. Untick dim.

## Scenario 4 — Placement and size options

**Tests:** Fit to view, Scale %, Original, fit-view-after toggle, Reset to original size, cancel paths.

1. Still in `DFD`, zoom in with `⌘`+scroll until the board is at about 300 percent. Press `⌘⇧I`, choose `logo.png`, set **Size** to **Fit to view**, untick **Lock as reference** and **Send to back**, tick **Fit view to image after placing**, click **Place**. **Check 4.1:** the logo fills the view with a margin and is selected (click it once if not).
2. Press `⌘⇧I` again, same file, **Size** = **Scale**, type `200`. **Check 4.2:** the "→ W × H" preview beside the field shows exactly double the intrinsic size. Untick both lock and send-to-back, click **Place**. Click the new copy. **Check 4.3:** in the **Image** section, **Reset to original size** shows the intrinsic size in parentheses; click it. The image halves, keeping its top-left corner.
3. Press `⌘⇧I`, and in the file dialog click **Cancel**. **Check 4.4:** nothing changes.
4. Press `⌘⇧I`, choose the file, and in the placement dialog press `Esc`. **Check 4.5:** no new node appears, and `⌘Z` undoes your previous action, not a phantom import.
5. Press `⌘⇧I`, choose the file, press `Enter`. **Check 4.6:** `Enter` places with the current options.

## Scenario 5 — Large image and GIF

**Tests:** downsampling threshold, JPEG stays JPEG, GIF first frame, original-pixel placement after downsampling.

1. In the library, **From image…**, choose `big.png` (or `big.jpg`), accept the name, click **Place** with defaults. **Check 5.1:** the placement dialog reported the true pixel size (over 4096 wide). The board opens and the image looks sharp at fit-to-view.
2. Press `Esc`, unlock it from the Board panel, and click **Reset to original size** in the Image section. **Check 5.2:** the reported size in parentheses is the original, not 4096.
3. In a terminal:
   ```bash
   sqlite3 ~/Library/Application\ Support/haldraw/haldraw.db "SELECT mime, width, height FROM images ORDER BY rowid DESC LIMIT 3;"
   ```
   **Check 5.3:** the newest row has its long side at 4096 or less. **Check 5.4:** if you used a JPEG, the mime is `image/jpeg`; for a PNG it is `image/png`.
4. Back in the library, **From image…**, choose `anim.gif`. **Check 5.5:** the dialog says "(first frame only)" after the format. Place it. **Check 5.6:** the canvas shows a still frame.

## Scenario 6 — Persistence and export

**Tests:** autosave, quit mid-edit, locked state survives, dim persists per board, SVG export, duplicate board keeps everything.

1. Open `Logo trace`. Move one drawn shape, then immediately press `⌘Q` without waiting.
2. Relaunch, open `Logo trace`. **Check 6.1:** the shape is where you left it. **Check 6.2:** the reference is still locked (click it: no selection). **Check 6.3:** the dim checkbox state is what you left it at, and `DFD` has its own independent setting.
3. Click the **Export** menu at the top right, choose **SVG**, save to the Desktop. Open it in a browser. **Check 6.4:** the locked logo is present and undimmed, and your shapes are on top.
4. Press `⌘⇧D`. A toast reports a timestamped copy. Go to the library. **Check 6.5:** the copy exists; open it. **Check 6.6:** the reference is locked, the Board panel lists it, and every shape is present.

## Scenario 7 — Existing behaviour unchanged

**Tests:** quick paths and shortcuts that 0.4.x must not have broken.

1. In any board, take a screenshot to the clipboard (`⌘⌃⇧4`, drag a region). Press `⌘V` with the cursor over the canvas. **Check 7.1:** the screenshot lands centred on the cursor, unlocked, no dialog.
2. Drag `logo.png` from Finder directly onto the canvas. **Check 7.2:** same result as 7.1, no dialog.
3. Select a shape, `⌘C`, `⌘V`. **Check 7.3:** a copy appears offset by 20 px. `⌘D`. **Check 7.4:** another copy.
4. Press `⌘0`. **Check 7.5:** zoom returns to 100 percent. Press `⌘1`. **Check 7.6:** everything fits.
5. Press `?`. **Check 7.7:** the editor's keyboard shortcuts overlay appears, and it lists `⌘⇧I` and the Shift-resize entry.
6. Toggle the theme with the sun or moon icon. **Check 7.8:** UI flips; the board's paper colour does not.

---

## Reporting

Paste the check numbers that failed, with one line each on what you saw. Anything not listed here that surprised you is worth a line too.
