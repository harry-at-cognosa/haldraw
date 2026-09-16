# Vectorize 0.9.2: what the review findings mean in use, and what to do about them

Written 2026-09-15 from the code review behind [Vectorize_pipeline_reference.md](./Vectorize_pipeline_reference.md) and its [review](./Vectorize_pipeline_reference_review_2026-09-15.md). This note is for the person using the app, not the person reading the code: each item says what you would see, when, what it costs, and what the fix is.

**Status of every item below: derived from reading the code, not reproduced in the running app.** None was seen during the 0.9.x test runs. The mechanisms are unambiguous in the source, but "you would see X" should be read as "the code will do X", pending a run that confirms it.

## Summary

| # | Finding | What you would see | How likely during your testing | Recommendation |
|---|---|---|---|---|
| 1 | Placement uses the image's position from *before* the call | Draft offset or mis-scaled if you moved or resized the image while waiting | Moderate: calls take 10 to 60 s and the canvas stays live | Fix before extended testing (small change) |
| 1b | Same root cause: switching boards mid-call | Draft inserted into whichever board is open when the reply arrives | Low, but the outcome is confusing and persists | Same fix, plus a guard |
| 2 | Undo after a vectorize leaves the locked Reference layer current | The next shape you draw cannot be selected or moved | Moderate: undo-and-retry is a natural testing loop | Fix soon (small change, not vectorize-specific) |
| 3 | No coordination between simultaneous calls | Two Draft layers, or lost progress text; possibly a double charge | Low | Fix when convenient |
| 4 | Keychain command string exists in two places | Nothing today | Only matters if the keychain names change | Housekeeping |
| 5 | Some errors reach the toast unclassified | Raw error wording in a red toast | Rare | Cosmetic |
| 6 | Pasted images skip the 4096 px storage downsample | Larger database rows; no effect on vectorize output | Only with very large pastes | No action |
| 7 | A validation retry sends the image a second time | Roughly double the input tokens for that run | Rare, and correct behaviour | Awareness only |
| 8 | SVG references untested | Unknown: may work, may fail with a decode error | Only if you vectorize an SVG | Test once before relying on it |

Items 1 and 2 are the ones I would fix before a long testing session. Everything else can wait.

---

## 1. The draft is placed against the image as it was when you pressed Vectorize

**What happens.** When you press Vectorize…, the app records the image's rectangle (position and size on the board) and the layer list at that moment, then waits for the model. When the reply arrives, tens of seconds later, it scales the model's coordinates into *that recorded* rectangle and picks the Draft layer from *that recorded* layer list. It does not look again.

**What you would see.**

- If you nudge, drag or resize the reference image while the progress text is showing, the draft lands where the image *was*, at the size it *was*. On a board where you are lining things up by eye this looks like the model got everything wrong by a constant offset. It did not; the app used a stale frame.
- If you reorder layers while waiting, the new Draft layer is slotted into the old order, so it can end up in a different place in the stack than "directly above the reference".
- If you delete the reference while waiting, the draft is still inserted, floating over empty canvas.

**The more serious variant, 1b.** If you go back to the Library and open a *different* board while a call is in flight, the reply is inserted into the board that is open when it arrives. The draft's coordinates are relative to the original image, which is not on this board, and its Draft layer is created at the bottom of the stack because the original layer does not exist here. The rows are then autosaved with the new board. You would open a board and find a group of strange shapes on a new layer at the bottom, with no indication of where they came from. One ⌘Z removes them if you notice immediately; otherwise they persist.

**How likely.** The window is the whole call: 10 to 60 s on Opus 5 for a dense diagram. The canvas is fully live during that time and nothing suggests you should wait. The first variant is easy to trigger by accident; the board switch is less likely but the outcome is the most confusing of anything in this note.

**Cost.** A misplaced draft is a wasted call (tens of cents at Opus 5 rates for a large image, see item 7) plus the confusion. Nothing is corrupted; undo removes it.

**Fix.** Small. After the reply, re-read the image node and the layer list from the live store instead of the copies taken before the call; if the node is gone or the board has changed, show a toast ("The image was removed while the model was working; nothing inserted") and stop. About ten lines in `src/util/vectorize.ts` (the `vectorizeNode` function, lines 163 to 192). A second, optional line of defence is to disable the Library button and layer reordering while a call runs, but the re-read alone removes the wrong outcomes.

## 2. After you undo a vectorize, the next shape you draw may be untouchable

**What happens.** Vectorize creates the Draft layer and makes it current, so your next drawing lands there. Undo removes the Draft layer. The store then has to pick a new current layer, and it picks the bottom of the stack, which on a board made by importing a reference image is the locked "Reference" layer. The app does not stop you drawing on a locked layer: the shape is created, placed on Reference, and from then on it ignores the pointer, because everything on a locked layer does.

**What you would see.** You vectorize, dislike the result, press ⌘Z, and draw a rectangle to start by hand. The rectangle appears but you cannot select, move or resize it. It shows up in the Reference images list in the Board panel (as a locked non-image row), which is the only place you can unlock it. Until you notice the current-layer selector in the toolbar says "Reference", every further shape does the same.

**How likely.** Moderate. Vectorize, judge, undo, try a different model or a cleaner image, is exactly the loop you have described for testing. Each undo puts you on the locked layer.

**Cost.** Confusion and a few minutes per occurrence; the shapes are recoverable by unlocking from the Board panel, or by switching layer and redrawing.

**Fix.** Two independent small changes, either sufficient:

- In the store's undo (and redo), when the current layer disappears, fall back to the topmost *unlocked* layer, or to the layer that was current before the undone step, rather than the bottom layer. This is not vectorize-specific: any undo that removes the current layer behaves this way today.
- In vectorize, remember the layer that was current before the call and restore it as current after insertion, leaving Draft selected but not current. That changes the deliberate 0.9.0 decision that "drawing continues on Draft", so it is a product choice, not just a fix.

The first is the better one and is a few lines in `src/store/canvasStore.ts` (the `currentLayerId` fallback inside `undo` and `redo`, around lines 701 and 736).

## 3. Two calls at once do not know about each other

**What happens.** Each Vectorize button keeps its own "busy" flag. There is no app-wide notion of "a vectorize is running". Three consequences:

- Two different reference images can be vectorized simultaneously by clicking both rows' sparkles. Each call is correct on its own, but both decide where the Draft layer goes from the layer list as it was when *they* started, so neither sees the Draft layer the other is about to create. You get two layers both named "Draft".
- If you click Vectorize… in the Image section and then change the selection, the Image section disappears and with it the progress text. The call continues; the toast still arrives; you just have no indication anything is running in between. Clicking the row sparkle for the same image at that point starts a second call for the same picture, billed again.
- There is no cancel. Closing the window does not stop the request; the reply is simply discarded.

**How likely.** Low in ordinary use. The lost-progress case is the one most likely to happen by accident.

**Cost.** At worst one duplicate call and an extra layer to delete.

**Fix.** A single module-level set of "node ids in flight" checked and displayed by both buttons, and reuse of any layer named Draft anywhere above the reference rather than only the one directly above. Small.

## 4. The keychain command is written out twice

**What happens.** The one-line `security add-generic-password …` command appears in two source files: the main-process module that reads the key, and the Settings dialog that shows it. They agree today. If the keychain service or account name is ever changed in one place and not the other, the Settings dialog would show a command that stores the key where the app does not look, and the app would keep reporting "no key" after you followed the instructions.

**How likely.** Zero unless the names change.

**Fix.** Move the string to the shared types module that both processes already import. Five minutes.

## 5. A few error paths bypass the friendly messages

**What happens.** Errors from the API client are mapped to the messages you have seen ("No API key…", "Rate limited…", "Could not reach the API…"). Anything that is not one of those known error types, for example a bug inside the SDK, a JSON-parse failure of the fake test file, or an unexpected exception in the main process, passes through with its raw wording.

**What you would see.** A red toast with developer-style text such as `Unexpected token < in JSON at position 0`. Nothing is inserted, so no harm.

**Fix.** Wrap the fall-through cases in the same error type with a generic sentence and keep the raw text after a line break. Cosmetic.

## 6. Pasted images are stored at full size

**What happens.** Images brought in through Import Image… or by dropping a file are shrunk to at most 4096 px on the long side before being stored in the database. Images pasted from the clipboard are stored as pasted. Vectorize always shrinks what it sends to 1568 px, so the model sees the same thing either way.

**Effect on you.** None on the draft. A very large paste (a 5000 px screenshot, say) makes a larger database row and a larger `.haldraw` export than the same image imported as a file. The paste is also placed on the board at 400 canvas units wide, so the reference rectangle is small and the draft is correspondingly small, which is correct behaviour.

**Recommendation.** No action. If you want parity, route the paste through the same downsample as import; it is one call.

## 7. A rejected reply costs a second full call

**What happens.** If the model's JSON fails the app's structural checks (a connector naming a shape id that does not exist, a duplicate id, a zero-size box), the app sends the whole conversation again once, with the specific complaint appended. The image is part of that conversation, so it is transmitted and billed a second time. The toast's token count is the sum of both attempts, which is why one run can show roughly double the tokens of an otherwise similar one.

**How likely.** Rare. The output is schema-constrained, so malformed JSON is close to impossible; the retry mostly catches a connector pointing at an id the model forgot to define.

**Cost.** For a 1568 px image, the image alone is on the order of 3,000 input tokens per attempt. At Opus 5 list pricing the image part of a retried run is a few cents; the output tokens (often 5,000 to 12,000 for a dense diagram) dominate. Awareness only; the behaviour is right.

## 8. SVG reference images are an untested path

**What happens.** An imported SVG is stored as SVG, untouched. Vectorize has to turn it into a bitmap before sending it, using the browser's image decoder. Chromium's support for decoding SVG through that particular call has historically been limited. The code path exists and may well work; it has not been run.

**What you might see.** Either a normal draft, or an error toast about image decoding, with nothing inserted.

**Recommendation.** Try it once with a small SVG before depending on it. If it fails, the fix is to rasterise via an `<img>` element instead, which does support SVG; a modest change.

---

## What does not need action

- **The model call itself.** Prompt, schema, validation order, retry logic, error mapping and key handling were all checked line by line and found to do what the design note says. The key never leaves the main process.
- **Coordinate mapping, colour rules, dashed low-confidence marking, font-size estimate, layer placement, grouping, single-step undo and persistence** all behave as documented. The findings above are about what happens *around* the call, not inside it.
- **"0 connectors" on bubble charts** is expected: a line must visibly join two shapes to count.
- **Elements the model does not report** (free lines, axes, legends, arrows touching one shape, corner radius, connector colour and route, a second arrowhead) are scope decisions, not defects. They are listed in §9 of the reference document.

## Suggested order of work

1. Item 1 (re-read live state after the reply, abort if the image or board is gone). Ten lines; removes the most confusing outcomes.
2. Item 2 (undo falls back to an unlocked layer). A few lines; removes a trap that is not limited to vectorize.
3. Items 3, 4, 5 together as a small "vectorize hygiene" release when convenient.
4. Item 8: one manual test with an SVG.

Each of 1 to 3 is a candidate for a 0.9.3 with a CHANGELOG entry; none needs a database migration.

## Where the code is, for later

| Item | File and region |
|---|---|
| 1, 1b | `src/util/vectorize.ts`, `vectorizeNode`, lines 163 to 192 (`store` captured at 163, used at 185 to 191) |
| 2 | `src/store/canvasStore.ts`, `undo` and `redo`, `currentLayerId` fallback near lines 701 and 736; `addNode` at 492 places on `currentLayerId` without a lock check |
| 3 | `src/panels/PropertiesPanel.tsx`, `VectorizeButton`, line 557 onward; Draft-layer reuse test in `vectorizeNode`, line 190 |
| 4 | `electron/vectorize.ts` line 10 and `src/panels/SettingsModal.tsx` line 4 |
| 5 | `electron/vectorize.ts` lines 130 and 164 |
| 6 | `src/canvas/BoardEditor.tsx`, `onRequestImagePaste`, line 163 onward, versus `decodeAndStore` in `src/util/importImage.ts` |
| 7 | `electron/vectorize.ts` lines 180 to 184 |
| 8 | `src/util/vectorize.ts`, `imageToPng`, line 25 |
