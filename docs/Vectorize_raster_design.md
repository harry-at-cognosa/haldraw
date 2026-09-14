# Vectorize a raster image into shapes and text — design note

Status: roadmap Round 3, not scheduled. Written 2026-09-13.

## Goal

Given a locked reference image on a board (a PNG or JPG of a flowchart, DFD, architecture diagram, or logo), produce an editable first draft of that diagram as ordinary haldraw nodes and edges, placed on top of the reference so the user can correct it by eye and then hide or delete the image.

This is a first draft generator, not a converter. Model output will be approximately right: boxes a few pixels off, connector routing guessed, text mostly correct. The reference stays underneath, which is what makes correction cheap.

## Dependencies

1. **`.haldraw` JSON format (0.6.0).** The model emits a board file; the existing importer places it. The vectorizer is then an adapter, not a new code path into the store.
2. **Object layers (Round 3).** The draft should land on its own layer above the reference so it can be toggled and compared. Without layers, it lands as unlocked nodes above the locked image, which still works.
3. **Network and credentials decision.** haldraw makes no network calls today and the README says so. This feature needs an outbound HTTPS call to a vision model and an API key. Options, in order of preference:
   - Key in the macOS keychain, read by the main process at call time, never written to disk by the app.
   - Key pasted into a Settings dialog and stored in the `meta` table. Simpler, weaker.
   - A local model via Ollama on the LAN. No key, no cloud, but current local vision models are materially worse at diagram structure.

## Pipeline

1. User selects a locked image node and chooses **Vectorize…** (Image section of the properties panel, or File menu).
2. Renderer sends `imageId` plus the node's rectangle to the main process.
3. Main process fetches the bytes, downsamples if the long side exceeds ~2000 px (model cost, not accuracy, is the constraint), and calls the model with:
   - the image;
   - a system prompt describing the `.haldraw` v1 schema, the node types available (`rect`, `ellipse`, `diamond`, `text`, `icon`), edge routing options, and the rule that coordinates are in image pixels with origin top-left;
   - an instruction to return only JSON.
4. Main process validates the JSON against the same parser the file importer uses. On failure, one retry with the validation error appended. On second failure, surface the error and the raw text.
5. Renderer receives a `HaldrawBoardFile`, maps image-pixel coordinates into the reference node's rectangle (scale and offset, since the user may have placed the image at 50 % or moved it), remaps ids, and inserts nodes and edges as one undo step.
6. Result is selected as a group so the user can see the extent and nudge it as a whole.

## Prompt design notes

- Ask for shapes by bounding box, text by content and bounding box, connectors by source and target shape index plus arrowhead presence. Do not ask for pixel-accurate paths.
- Ask the model to classify each box as `rect`, `ellipse` or `diamond`; default `rect`.
- Ask for the dominant fill and stroke colour per shape as hex; default to `defaultStyleForBackground`.
- Ask for confidence per element. Elements below a threshold get a dashed stroke so the user sees where to look.

## UI

- **Vectorize…** button in the Image section when exactly one locked image is selected.
- Progress toast; cancel not supported in v1.
- Settings dialog for the API key and model choice, reachable from the app menu.

## Regression checklist (when built)

1. Vectorize a clean flowchart PNG: every box becomes a node with the right text; connectors link the right pairs; result is one undo step.
2. Vectorize the same image placed at 50 %: nodes land on the reference, not at 2x.
3. Vectorize a logo: text and one or two shapes; no crash on sparse output.
4. Invalid model output: error toast, nothing inserted.
5. No key configured: clear message pointing at Settings, no network call.
6. Airplane mode: network error surfaced, nothing inserted.
