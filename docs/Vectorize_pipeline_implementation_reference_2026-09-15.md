# Vectorize: how a reference image becomes an editable draft — pipeline reference

Describes the implementation as of **0.9.2** (commits `8ee54aa`, `d0233eb`, `e0291bd`, `77136d6`, all 2026-09-15). Written 2026-09-15 from the code, not from the design note; where the two differ, §1.6 says so. Companion to [Vectorize_raster_design.md](./Vectorize_raster_design.md), which holds the intent and the decision record.

Audience: someone who wants to know exactly what happens between pressing **Vectorize…** and seeing shapes on a Draft layer, including every byte that goes to the model and every rule applied to what comes back.

---

## Table of contents

- [0. Scope and the one thing to know first](#0-scope-and-the-one-thing-to-know-first)
- [1. Overview](#1-overview)
  - [1.1 One paragraph](#11-one-paragraph)
  - [1.2 Level-0 diagram](#12-level-0-diagram)
  - [1.3 The five major steps](#13-the-five-major-steps)
  - [1.4 Process and trust boundaries](#14-process-and-trust-boundaries)
  - [1.5 Where perception happens, and where it does not](#15-where-perception-happens-and-where-it-does-not)
  - [1.6 Design note versus shipped code](#16-design-note-versus-shipped-code)
- [2. Step A — Trigger and image preparation (renderer)](#2-step-a--trigger-and-image-preparation-renderer)
  - [A.1 Entry points](#a1-entry-points)
  - [A.2 Fetching the image bytes](#a2-fetching-the-image-bytes)
  - [A.3 Downsampling to the model's resolution ceiling](#a3-downsampling-to-the-models-resolution-ceiling)
  - [A.4 Model choice and settings](#a4-model-choice-and-settings)
  - [A.5 The IPC request](#a5-the-ipc-request)
- [3. Step B — The model call (main process)](#3-step-b--the-model-call-main-process)
  - [B.1 API key retrieval](#b1-api-key-retrieval)
  - [B.2 Request assembly](#b2-request-assembly)
  - [B.3 The system prompt, verbatim](#b3-the-system-prompt-verbatim)
  - [B.4 The user turn](#b4-the-user-turn)
  - [B.5 The output schema, verbatim](#b5-the-output-schema-verbatim)
  - [B.6 What the model is asked to perceive](#b6-what-the-model-is-asked-to-perceive)
  - [B.7 Response handling and structural validation](#b7-response-handling-and-structural-validation)
  - [B.8 The single retry](#b8-the-single-retry)
  - [B.9 Error taxonomy](#b9-error-taxonomy)
  - [B.10 The test seam](#b10-the-test-seam)
- [4. Step C — Conversion to board geometry (renderer)](#4-step-c--conversion-to-board-geometry-renderer)
  - [C.1 Coordinate mapping](#c1-coordinate-mapping)
  - [C.2 Shape kind mapping](#c2-shape-kind-mapping)
  - [C.3 Fill, stroke and text colour](#c3-fill-stroke-and-text-colour)
  - [C.4 Confidence and the dashed stroke](#c4-confidence-and-the-dashed-stroke)
  - [C.5 Font size estimation](#c5-font-size-estimation)
  - [C.6 Connector construction](#c6-connector-construction)
- [5. Step D — Insertion into the board (store)](#5-step-d--insertion-into-the-board-store)
  - [D.1 Resolving the Draft layer](#d1-resolving-the-draft-layer)
  - [D.2 insertMany: ids, z-order, group, selection, undo](#d2-insertmany-ids-z-order-group-selection-undo)
  - [D.3 Persistence](#d3-persistence)
  - [D.4 How the rows render](#d4-how-the-rows-render)
- [6. Step E — Feedback to the user](#6-step-e--feedback-to-the-user)
- [7. Data contracts](#7-data-contracts)
- [8. Constants and tunables](#8-constants-and-tunables)
- [9. Observed behaviour and limits](#9-observed-behaviour-and-limits)
- [Appendix A — End-to-end pseudo-code](#appendix-a--end-to-end-pseudo-code)
- [Appendix B — validateResult pseudo-code](#appendix-b--validateresult-pseudo-code)
- [Appendix C — Colour and font-size helpers pseudo-code](#appendix-c--colour-and-font-size-helpers-pseudo-code)
- [Appendix D — insertMany pseudo-code](#appendix-d--insertmany-pseudo-code)
- [Appendix E — A worked example](#appendix-e--a-worked-example)
- [Appendix F — File and symbol map](#appendix-f--file-and-symbol-map)
- [Index](#index)

---

## 0. Scope and the one thing to know first

**haldraw performs no image analysis of its own.** There is no edge detection, contour tracing, colour quantisation, connected-component labelling, OCR or line following anywhere in the app. Every perceptual judgement — where a box is, whether it is a rectangle or an ellipse, what colour it is, what its text says, which shapes an arrow joins — is made by the vision model in a single request and returned as JSON. The app's job is to (1) prepare the image, (2) ask the question precisely and constrain the answer's shape, (3) check the answer structurally, (4) map the answer's pixel coordinates onto the board, and (5) insert the result as ordinary haldraw rows that the user can edit.

Consequently, connectors are **not traced**. The model reports "a connector joins shape `s1` to shape `s3`, with an arrowhead at `s3`". haldraw then draws its own straight line between those two shapes using its existing auto-anchor routing (§C.6, §D.4). The path in the original picture — bends, curves, the exact points where it touched the boxes — is not recovered and is not asked for.

Everything below is in service of that division of labour.

---

## 1. Overview

### 1.1 One paragraph

The user selects a reference image node (or clicks the sparkle on its **Reference images** row) and presses **Vectorize…**. The renderer fetches the stored image bytes, downsamples them so the long side is at most 1568 px, and sends a PNG plus the chosen model id to the main process over IPC. The main process reads the Anthropic API key from the macOS keychain, builds one Messages API request (image + one-line instruction, a fixed system prompt, and a JSON-schema structured-output constraint), and calls the model. The reply is parsed and validated structurally; an invalid reply is sent back once with the validation error appended. The validated `{ shapes, connectors }` object returns to the renderer, which scales every box from image pixels into the reference node's rectangle, resolves colours, dashes low-confidence elements, estimates a font size for each text, and builds node and edge rows. Those rows are inserted as one undo step onto a "Draft" layer directly above the image's layer, grouped and selected; the ordinary dirty-flush then writes them to SQLite. A toast reports the counts, the model and the token usage.

### 1.2 Level-0 diagram

```
 ┌──────────────────────────── Electron renderer (React; no key, no network) ─────────────────────────────┐
 │                                                                                                        │
 │  [A] Trigger & prepare      [C] Convert to board geometry        [D] Insert            [E] Feedback    │
 │  ┌───────────────────┐      ┌─────────────────────────────┐      ┌────────────────┐    ┌────────────┐  │
 │  │ Vectorize… click  │      │ px → board scale, colours,  │      │ Draft layer,   │    │ toast:     │  │
 │  │ images.get(id)    │      │ dash < 0.6, font size,      │─────▶│ insertMany     │───▶│ counts,    │  │
 │  │ downsample ≤ 1568 │      │ node + edge rows (temp ids) │      │ one undo step  │    │ model,     │  │
 │  └────────┬──────────┘      └──────────────▲──────────────┘      └───────┬────────┘    │ tokens     │  │
 │           │ VectorizeRequest               │ VectorizeResponse           │ dirty flush └────────────┘  │
 └───────────┼────────────────────────────────┼─────────────────────────────┼─────────────────────────────┘
             │ IPC vectorize:run              │                             │ IPC upsertMany (300 ms)
 ┌───────────▼────────────────────────────────┴───────────────────────┐     │
 │  Electron main process — [B] Model call                            │     ▼
 │  ┌───────────────┐  ┌────────────────────────────┐  ┌───────────┐  │  ┌──────────────────────┐
 │  │ keychain read │─▶│ Messages API request:      │─▶│ parse +   │  │  │ SQLite               │
 │  │ `security`    │  │ system prompt + image +    │  │ validate; │  │  │ images, meta, nodes, │
 │  └───────────────┘  │ one line + json_schema     │  │ one retry │  │  │ edges, layers        │
 │                     └─────────────┬──────────────┘  └───────────┘  │  └──────────────────────┘
 └───────────────────────────────────┼────────────────────────────────┘
                                     │ HTTPS
                                     ▼
                         Anthropic Messages API  (haldraw's only network call)
```

### 1.3 The five major steps

| Step | Where | Entry symbol | Input | Output |
|---|---|---|---|---|
| **A** Trigger & prepare | renderer | `VectorizeButton` → `vectorizeNode` → `imageToPng` (`src/panels/PropertiesPanel.tsx`, `src/util/vectorize.ts`) | image node, stored bytes | `VectorizeRequest { pngBase64, width, height, model }` |
| **B** Model call | main | `runVectorize` (`electron/vectorize.ts`) | `VectorizeRequest` | `VectorizeResponse { result, model, inputTokens, outputTokens }` or `VectorizeError` |
| **C** Convert | renderer | `convertResult` (`src/util/vectorize.ts`) | `VectorizeResult`, reference node, sent size, board background | node rows (temp ids), edge rows (temp refs), low-confidence count |
| **D** Insert | renderer store | `insertMany` (`src/store/canvasStore.ts`) | rows + layer spec | fresh ids, one history entry, dirty sets → SQLite |
| **E** Feedback | renderer | `notify` → `BoardEditor` toast | summary or error | toast text |

### 1.4 Process and trust boundaries

```
  Renderer (contextIsolation, no nodeIntegration)      Preload (contextBridge)        Main (Node)              Outside
  ───────────────────────────────────────────────      ────────────────────────       ───────────────           ────────────────────
  window.haldraw.images.get(id)          ─────────▶   ipcRenderer.invoke      ───▶  imagesRepo.getImage  ───▶ SQLite images table
  window.haldraw.settings.get()          ─────────▶   ipcRenderer.invoke      ───▶  metaRepo.getMeta     ───▶ SQLite meta table
  window.haldraw.vectorize.keyStatus()   ─────────▶   ipcRenderer.invoke      ───▶  hasApiKey()          ───▶ macOS keychain (bool only)
  window.haldraw.vectorize.run(req)      ─────────▶   ipcRenderer.invoke      ───▶  runVectorize(req)    ───▶ keychain (key) + HTTPS API
```

- The API key is read by `security find-generic-password` inside `runVectorize` at call time. It exists only in main-process memory for the duration of the call, is never returned over IPC, never written to the database, and never logged. `keyStatus` returns `{ present: boolean }` and nothing else.
- The renderer holds image bytes and the model's JSON; it never holds credentials. The window runs with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: false`; the last means the preload script has Node access, so the context bridge, not an OS sandbox, is the boundary.
- The main process never touches the board: it does not know which node is being vectorized, only the PNG and its size.

### 1.5 Where perception happens, and where it does not

| Perceptual question | Who answers it | How |
|---|---|---|
| Where is each box, and how big is it? | model | bounding box `x, y, w, h` in sent-image pixels, requested by the system prompt and typed by the schema |
| Is it a rectangle, ellipse, diamond, or bare text? | model | `kind` enum; prompt says "use rect when unsure" |
| What colour is the interior / outline / text? | model | `fill`, `stroke`, `textColor` as `#rrggbb`, or `""` when it cannot tell; prompt forbids invention |
| What does the text say? | model | `text` verbatim, `\n` for line breaks |
| Which shapes does a line join, and which end has the head? | model | `from`, `to` shape ids, `headEnd` ∈ {none, arrow} |
| How sure is it? | model | `confidence` 0–1 per element |
| Where does the connector actually run? | **haldraw, at render time** | straight segment between auto-chosen sides of the two boxes (§C.6) |
| What size should the text be? | **haldraw** | heuristic from the box the model measured (§C.5) |
| Which colour if the model said `""`? | **haldraw** | transparent fill; board-default stroke; for text, black or white by luminance when the fill is known, else the board default (§C.3) |
| Which layer, z-order, group, selection? | **haldraw** | §D |

### 1.6 Design note versus shipped code

The design note's "Pipeline" section (written 2026-09-13) is partly superseded by its own "Implementation plan — 0.9.0" section and by the code. Differences that matter when reading the note:

| Design note "Pipeline" | Shipped |
|---|---|
| Renderer sends `imageId` plus the node rectangle to main; main fetches and downsamples at ~2000 px | Renderer fetches and downsamples to **1568 px**; main receives a finished PNG and knows nothing about the node |
| Model emits a `.haldraw` board file; validated by the file importer | Model emits the purpose-built `{ shapes, connectors }` contract (§7); validated by `validateResult` |
| System prompt describes the `.haldraw` v1 schema and node types including `icon` | System prompt describes four kinds (`rect`, `ellipse`, `diamond`, `text`); no icons; no routing options |
| "Settings dialog for the API key" | Settings dialog shows key **status** and the `security` command; the key itself is never entered in the app |
| "**Vectorize…** button … when exactly one locked image is selected", "or File menu" | Any single selected image, locked or not, in the Image section, plus a per-row sparkle under Reference images; no File-menu item |
| "Progress toast" | Progress is the button label or a line under the row; toasts carry only the final result or error |

The 0.9.1 and 0.9.2 changes (transparent unknown fill, measured font size, `textColor`) post-date the note entirely.

---

## 2. Step A — Trigger and image preparation (renderer)

```
  ┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
  │ A.1 click           │    │ A.2 images.get       │    │ A.3 imageToPng      │    │ A.4/A.5 settings +   │
  │ Vectorize… /        │───▶│ SQLite row →         │───▶│ decode, scale ≤1568,│───▶│ IPC vectorize:run    │
  │ row sparkle         │    │ data URL             │    │ PNG base64          │    │ { png, w, h, model } │
  └─────────────────────┘    └──────────────────────┘    └─────────────────────┘    └──────────────────────┘
        progress: "Starting…"     "Preparing image…"                                  "Asking <model>…"
```

### A.1 Entry points

Both entry points render the same component, `VectorizeButton` in `src/panels/PropertiesPanel.tsx`, and both call `vectorizeNode(node, setProgress)`.

| Where | Condition | Appearance |
|---|---|---|
| Properties panel, **Image** section | exactly one node selected and it is an image | full-width button, sparkle icon, label is the progress text while running, else "Vectorize…" |
| Board panel, **Reference images** list | every node with `locked: true` gets a row, whatever its type; only image rows get the sparkle | small sparkle icon button; progress text appears under the row while running |

The second entry point exists because locked reference images cannot be selected on the canvas, so the Image section never shows for them. The button is disabled while a call is in flight (`progress !== null`); there is no cancel.

The image need not be locked and need not be on a layer named "Reference"; any image node works.

Two gaps follow from where the buttons live. An image whose own `locked` flag is false but which sits on a locked layer is neither clickable on the canvas nor listed under Reference images, so it has no Vectorize entry point until its layer is unlocked. And nothing serialises calls: the disabled state is per button instance, so two rows' sparkles can run concurrently, and if the Image section unmounts mid-call (the selection changes) its progress display is lost while the call continues and the toast still fires.

### A.2 Fetching the image bytes

`vectorizeNode` reads `ref.content.imageId` and calls `window.haldraw.images.get(imageId)`. The main-process handler returns an `ImageBlob { id, mime, width, height, dataUrl }`, where `dataUrl` is `data:<mime>;base64,<bytes>` built from the `images` table (`electron/repo/images.ts`). Image ids are the SHA-256 of the stored bytes, so the same picture imported twice is stored once.

What is stored may already be smaller than the file the user imported: files imported or dropped are downsampled when the long side exceeds 4096 px (`MAX_STORED_SIDE` in `src/util/importImage.ts`), converting to PNG (or keeping JPEG); pasted images are stored as pasted, at full size; SVG is stored untouched. Vectorize works from the stored bytes, never the original file.

### A.3 Downsampling to the model's resolution ceiling

`imageToPng(dataUrl)` in `src/util/vectorize.ts`:

1. **Decode by hand.** `fetch()` on a `data:` URL is blocked by the renderer's Content-Security-Policy, so the function slices the MIME type out of the URL prefix, `atob`s the payload into a `Uint8Array`, wraps it in a `Blob`, and calls `createImageBitmap`.
2. **Scale factor.** `scale = min(1, 1568 / max(bitmap.width, bitmap.height))`. Images already within 1568 px are sent at native size; larger ones are shrunk so the long side is exactly 1568 (rounded). Never upscaled.
3. **Resample.** Draw the bitmap onto a 2-D canvas of the target size with `imageSmoothingQuality = 'high'`.
4. **Encode.** `canvas.toDataURL('image/png')`, strip the `data:image/png;base64,` prefix.
5. **Return** `{ pngBase64, width, height }` where `width`/`height` are the **sent** dimensions. Every coordinate the model returns is in this pixel space, and Step C scales from it.

Always PNG regardless of the stored MIME (lossless after the resample; a JPEG source is re-encoded losslessly at the new size). An SVG reference would have to be rasterised here by `createImageBitmap`; Chromium's support for SVG blobs in that call is limited and this path has not been exercised, so treat SVG references as unverified.

Why 1568: Anthropic's vision documentation states images are downscaled server-side when the long edge exceeds 1568 px, so sending more pixels costs bandwidth without adding detail, and scaling locally makes the coordinate space deterministic and known to the renderer. (Per the same documentation an image costs roughly `width × height / 750` input tokens, about 3.3 k at 1568 × 1568; the code does not compute this.)

```
   stored image (imported files ≤ 4096 px)       sent image (≤ 1568 px long side)
   ┌────────────────────────────┐                 ┌──────────────┐
   │ W_img × H_img              │  scale =        │ W_sent ×     │   model coordinates live here
   │                            │  min(1, 1568 /  │ H_sent       │   (origin top-left, y down)
   │                            │  max(W, H))     │              │
   └────────────────────────────┘                 └──────────────┘
```

### A.4 Model choice and settings

`window.haldraw.settings.get()` returns `AppSettings { vectorizeModel }`. The main process reads it from the `meta` table, key `vectorize.model`, falling back to `DEFAULT_VECTORIZE_MODEL = 'claude-opus-5'`. The Settings dialog (**File ▸ Settings…**, `⌘,`, or the toolbar gear) writes it with `settings.set`, which trims and ignores empty strings.

The selectable models (`VECTORIZE_MODELS` in `shared/types.ts`):

| id | label |
|---|---|
| `claude-opus-5` | Claude Opus 5 (default) |
| `claude-sonnet-5` | Claude Sonnet 5 |
| `claude-opus-4-8` | Claude Opus 4.8 |
| `claude-haiku-4-5` | Claude Haiku 4.5 |

The id string is passed through to the API unchanged. An id the API does not know produces the "Model … was not found" error (§B.9); since the select offers only these four, that arises only from a hand-edited `meta` row or an id the API has retired.

### A.5 The IPC request

```ts
window.haldraw.vectorize.run({
  pngBase64: sent.pngBase64,   // PNG, no data: prefix
  width:     sent.width,       // sent pixel size
  height:    sent.height,
  model:     settings.vectorizeModel,
})
```

Electron's structured clone carries the base64 string to main. On failure Electron wraps the main-process error as `Error invoking remote method 'vectorize:run': Error: <msg>` (the subclass name is not carried because `VectorizeError` never sets `name`); `vectorizeNode` strips that prefix with a regex so the toast shows only `<msg>`.

---

## 3. Step B — The model call (main process)

```
  runVectorize(req)
  │
  ├─ HALDRAW_VECTORIZE_FAKE set? ──yes──▶ read JSON file → validateResult → return {model:'fake', tokens 0}
  │
  ├─ readApiKey() via `security find-generic-password -s haldraw -a anthropic-api-key -w`
  │      └─ null ──▶ throw VectorizeError('no-key', includes the add command)
  │
  ├─ client = new Anthropic({ apiKey, maxRetries: 2, timeout: 180_000 })
  ├─ messages = [ user: [ image(base64 PNG), text("The image is W × H pixels. Extract its shapes and connectors.") ] ]
  │
  └─ for attempt in 0, 1:
        ├─ messages.create({ model, max_tokens: 16000, system: SYSTEM_PROMPT, messages,
        │                    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } } })
        │      └─ SDK error ──▶ map to VectorizeError kind (auth / model / network) and throw
        ├─ accumulate usage.input_tokens / output_tokens
        ├─ stop_reason 'refusal'    ──▶ throw 'model'
        ├─ stop_reason 'max_tokens' ──▶ throw 'output'
        ├─ text = concat of text blocks; parsed = JSON.parse(text); problem = validateResult(parsed, W, H)
        ├─ no problem ──▶ return { result, model: message.model, inputTokens, outputTokens }
        ├─ attempt 0 ──▶ push assistant(text or '{}') + user("That output was rejected: <problem>\nReturn the corrected JSON object only."); continue
        └─ attempt 1 ──▶ throw 'output' with problem + first 400 chars of text
```

### B.1 API key retrieval

`readApiKey()` spawns `security find-generic-password -s haldraw -a anthropic-api-key -w` synchronously with a 5 s timeout and takes trimmed stdout. Non-zero exit or empty output means "no key". The user stores the key once with:

```
security add-generic-password -s haldraw -a anthropic-api-key -w '<your key>' -U
```

That exact string is exported as `KEYCHAIN_ADD_COMMAND` and embedded in the no-key error. The Settings dialog shows a second, hand-duplicated copy of the same string (line 4 of `SettingsModal.tsx`, with a Copy button) because the renderer cannot import the Electron module; the two must be kept in sync by hand. The key is re-read on every call; nothing is cached.

### B.2 Request assembly

One call to `client.messages.create` per attempt, through `@anthropic-ai/sdk` 0.126.0. The request, field by field:

| Field | Value | Notes |
|---|---|---|
| `model` | `req.model` | from Settings; see A.4 |
| `max_tokens` | `16000` | ceiling on output; a hit produces the "ran out of output tokens" error rather than a truncated draft |
| `system` | `SYSTEM_PROMPT` | fixed string, §B.3; identical on every call |
| `messages` | one user turn on attempt 0; on attempt 1 the same turn plus the rejected assistant text and a correction request, three messages in all | §B.4, §B.8 |
| `output_config.format` | `{ type: 'json_schema', schema: OUTPUT_SCHEMA }` | structured output; the API constrains generation to the schema in §B.5 |

Fields **not** set, and what that implies:

| Absent field | Effect |
|---|---|
| `thinking` | model default applies; per Anthropic documentation as of 2026-09-15 (not exercised here), Opus 5 and Sonnet 5 run adaptive thinking when the field is omitted, Opus 4.8 and Haiku 4.5 do not think |
| `output_config.effort` | API default (`high`, per the same documentation) |
| `temperature`, `top_p`, `top_k` | API defaults (the Claude 5 models reject them anyway, per the same documentation) |
| `stream` | non-streaming; the SDK client timeout of 180 s bounds each HTTP attempt |
| `cache_control` | no prompt caching. The system prompt is short and the image dominates the input, so there is little to cache |
| `tools`, `tool_choice` | none; JSON comes back as a plain text block |
| `betas` / `fallbacks` | none |

Client options: `maxRetries: 2` means the SDK itself retries transport-level failures and 408/409/429/5xx responses up to twice per `messages.create`, with backoff, before the app sees an error. Combined with the app's own one validation retry, a worst case is six HTTP requests.

### B.3 The system prompt, verbatim

Stored as `SYSTEM_PROMPT` in `electron/vectorize.ts`. Reproduced exactly (the `\\n` in the source is a literal backslash-n in the delivered text, telling the model how to encode line breaks inside JSON strings):

```
You convert a raster picture of a diagram (flowchart, data-flow diagram, architecture sketch, org chart, logo with text) into an editable first draft for a drawing tool.

Return every visible shape and every visible connector, as JSON matching the given schema. Coordinates are pixels of the supplied image, origin top-left, x/y the top-left corner of the element's bounding box, w/h its size.

Rules:
- Each box, circle, rounded rectangle or diamond is one shape. Classify as rect, ellipse or diamond; use rect when unsure.
- Free-standing text that is not inside a shape is a shape of kind "text" whose box is the text's extent.
- Text inside a shape goes in that shape's "text" field, exactly as written, line breaks as \n. Use "" when the shape has no text.
- Colours as 6-digit lowercase hex (#rrggbb): "fill" is the shape's interior, "stroke" its outline, "textColor" the colour of its text (white text on a dark shape is common; report it). Use "" when you cannot tell. Do not invent colours.
- A connector is a line or arrow that visibly joins two shapes; "from" and "to" are the shape ids at its ends, "headEnd" is "arrow" when the "to" end has an arrowhead. A line whose ends do not touch shapes is not a connector; omit it.
- "confidence" is your 0–1 estimate that the element is real and correctly placed.
- Ids are short unique strings such as s1, s2.
- Do not describe the image; output only the JSON object.
```

Reading it rule by rule (the third column is this document's reading of the consequences, not anything the code states; §B.6 is the canonical list of what is not captured):

| Rule | What it buys | What it deliberately gives up |
|---|---|---|
| Role sentence names diagram genres | primes the model for boxes-and-arrows, not photographs | — |
| "every visible shape and every visible connector" | recall over precision; the user prunes | may over-report decorative elements |
| Coordinate convention stated twice (prompt + user turn size) | removes ambiguity about origin and units | — |
| Rounded rectangles → `rect`; "use rect when unsure" | avoids spurious ellipses/diamonds | corner radius is not captured (every rect gets the board default, 8) |
| Free text is a `text` shape with the text's extent as its box | lets Step C size the font from the box (§C.5) | — |
| Text "exactly as written" | faithful labels | no spelling correction |
| Colours as hex or `""`; "Do not invent colours" | Step C can treat `""` as "unknown" and keep the reference visible through the draft | gradients, patterns, images inside shapes reduce to one hex or `""` |
| `textColor` with the explicit white-on-dark hint | fixes the 0.9.0 defect of white labels coming out black | — |
| Connector = line that **visibly joins two shapes**; lines touching nothing are omitted | every edge can be attached at both ends, which is what makes it follow the shapes when moved | free lines, brackets, axes, legend swatches, timelines are lost; a line touching only one shape is lost |
| `headEnd` only | one head, at the `to` end | double-headed arrows and arrows pointing at `from` are not representable; the model must choose direction |
| `confidence` 0–1 | Step C dashes elements below 0.6 | — |
| Short unique ids | connectors can reference shapes; ids are remapped on insert | — |
| "output only the JSON object" | belt and braces alongside the schema constraint | — |

### B.4 The user turn

The first (and on attempt 0, only) message:

```json
{
  "role": "user",
  "content": [
    { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "<pngBase64>" } },
    { "type": "text",  "text": "The image is <W> × <H> pixels. Extract its shapes and connectors." }
  ]
}
```

The image block precedes the text block (the ordering Anthropic's documentation recommends). The size sentence gives the model the exact pixel frame in which to express coordinates; `validateResult` later uses the same `W`, `H` to reject boxes wholly outside the frame.

### B.5 The output schema, verbatim

`OUTPUT_SCHEMA`, passed as `output_config.format.schema`. Every property is `required` and `additionalProperties` is `false` at all three object levels (root, shape item, connector item), so the model cannot omit a colour (it must send `""`) and cannot add fields.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["shapes", "connectors"],
  "properties": {
    "shapes": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "kind", "x", "y", "w", "h", "text", "fill", "stroke", "textColor", "confidence"],
        "properties": {
          "id":         { "type": "string" },
          "kind":       { "type": "string", "enum": ["rect", "ellipse", "diamond", "text"] },
          "x":          { "type": "number" },
          "y":          { "type": "number" },
          "w":          { "type": "number" },
          "h":          { "type": "number" },
          "text":       { "type": "string" },
          "fill":       { "type": "string" },
          "stroke":     { "type": "string" },
          "textColor":  { "type": "string" },
          "confidence": { "type": "number" }
        }
      }
    },
    "connectors": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["from", "to", "headEnd", "label", "confidence"],
        "properties": {
          "from":       { "type": "string" },
          "to":         { "type": "string" },
          "headEnd":    { "type": "string", "enum": ["none", "arrow"] },
          "label":      { "type": "string" },
          "confidence": { "type": "number" }
        }
      }
    }
  }
}
```

What the schema does **not** constrain, and therefore what `validateResult` (§B.7) or Step C must handle:

- `id` uniqueness and `from`/`to` referring to real ids (checked by `validateResult`)
- `w`, `h` positivity and box position relative to the image (checked by `validateResult`)
- hex format of colours (handled by Step C: a non-matching string is treated as unknown)
- `confidence` range (not checked; anything `< 0.6` dashes, anything else does not)
- `text` line-break encoding (the model is told `\n`; JSON decoding yields a real newline)

The division of labour: **schema** guarantees the shape of the JSON so `JSON.parse` and the type cast are safe; **prompt** carries the semantics; **validateResult** enforces the referential and geometric invariants the schema language cannot express.

### B.6 What the model is asked to perceive

Restating §1.5 from the model's point of view, this is the complete perceptual task, and nothing else is asked:

```
  for every visible shape:                    for every visible connector:
    kind ∈ {rect, ellipse, diamond, text}       from: shape id at one end
    bounding box x, y, w, h (image px)          to:   shape id at the other end
    text (verbatim, \n line breaks, or "")      headEnd ∈ {none, arrow}  (head at `to`)
    fill, stroke, textColor (#rrggbb or "")     label ("" if none)
    confidence 0–1                              confidence 0–1
    id (short, unique)
```

Not asked for, and so never present in a draft: rotation, corner radius, stroke width, dash pattern, font family/weight/size, text alignment, gradients, icons, images inside shapes, connector paths or waypoints, connector colour or width, a head at the `from` end, head styles other than the filled arrow, containment/nesting, groups, z-order intent, and any element that is a line not joining two shapes.

### B.7 Response handling and structural validation

After a successful HTTP round trip:

1. `usage.input_tokens` and `usage.output_tokens` are added to running totals (so a retried call reports the sum of both attempts).
2. `stop_reason === 'refusal'` → `VectorizeError('model')` "The model declined to process this image."
3. `stop_reason === 'max_tokens'` → `VectorizeError('output')` "…ran out of output tokens…; try a simpler image."
4. All `text` blocks in `message.content` are concatenated (`textOf`).
5. `JSON.parse(text)`; a throw becomes the problem string `Not valid JSON: <message>`.
6. `validateResult(parsed, req.width, req.height)` returns `null` or the **first** problem found, as a sentence the model can act on.

`validateResult` rules, in evaluation order:

| # | Check | Problem string |
|---|---|---|
| 1 | value is an object | `Output is not an object.` |
| 2 | `shapes` is an array | `Missing "shapes" array.` |
| 3 | `connectors` is an array | `Missing "connectors" array.` |
| 4 | each shape has a non-empty string `id` | `Shape <i>: missing id.` |
| 5 | ids are unique | `Shape <i>: duplicate id "<id>".` |
| 6 | `kind` ∈ {rect, ellipse, diamond, text} | `Shape <id>: unknown kind "<kind>".` |
| 7 | `x`, `y`, `w`, `h` are finite numbers | `Shape <id>: <k> must be a number.` |
| 8 | `w > 0` and `h > 0` | `Shape <id>: w and h must be positive.` |
| 9 | box overlaps the image: not `x + w < 0`, not `y + h < 0`, not `x > W`, not `y > H` | `Shape <id>: box lies outside the image (W×H).` |
| 10 | each connector's `from` is a known id | `Connector <i>: "from" is not a shape id.` |
| 11 | each connector's `to` is a known id | `Connector <i>: "to" is not a shape id.` |
| 12 | `from !== to` | `Connector <i>: from and to are the same shape.` |

Rule 9 is permissive on purpose: a box may hang partly off the image (common when the model's estimate of an edge-hugging element overshoots) and is only rejected when it has no overlap at all. Rule 6 and the type half of rule 7 duplicate what the schema enforces; they matter for the test-seam file (§B.10), which bypasses the API. Finiteness, positivity (rule 8) and the overlap test (rule 9) are enforced nowhere else.

Not validated: colour strings, confidence range, `headEnd` value (schema-enforced only), `text`/`label` types (schema-enforced only), empty `shapes` (handled in the renderer: "The model found no shapes in this image.").

### B.8 The single retry

If attempt 0 fails parsing or validation, the conversation is extended and sent again once:

```
  messages after the first failure
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ 1  user      [ image, "The image is W × H pixels. Extract its shapes…" ]     │
  │ 2  assistant  <the rejected text verbatim, or "{}" if it was empty>          │
  │ 3  user      "That output was rejected: <problem>                            │
  │               Return the corrected JSON object only."                        │
  └──────────────────────────────────────────────────────────────────────────────┘
  system prompt, schema and all other parameters unchanged
```

The image is therefore sent (and billed) twice on a retry. The `<problem>` is one of the rule strings in §B.7 or the `Not valid JSON: <message>` form, so the model gets a single concrete fix to make ("Connector 3: "to" is not a shape id."), not a list. If the second reply also fails, the error carries the problem and the first 400 characters of the reply so the user can see what came back.

Because the output is schema-constrained, parse failures should be rare; the retry mostly catches referential errors (a connector naming an id that does not exist, a duplicate id) and geometric ones (zero-width box).

### B.9 Error taxonomy

`VectorizeError` carries a `kind` used only for classification; the renderer shows `message` in a red toast for 9 s.

| Trigger | kind | Message shown |
|---|---|---|
| keychain item absent or empty | `no-key` | `No API key in the keychain. In Terminal, run:` + the add command |
| `Anthropic.AuthenticationError` (401) | `auth` | `The API key was rejected (401). Check the keychain item.` |
| `Anthropic.NotFoundError` (404) | `model` | `Model "<id>" was not found. Pick another in Settings.` |
| `Anthropic.RateLimitError` (429, after SDK retries) | `network` | `Rate limited by the API. Try again in a minute.` |
| `Anthropic.APIConnectionError` (DNS, offline, timeout) | `network` | `Could not reach the API. Check the network connection.` |
| any other `Anthropic.APIError` | `model` | `API error <status>: <message>` |
| `stop_reason: 'refusal'` | `model` | `The model declined to process this image.` |
| `stop_reason: 'max_tokens'` | `output` | `The model ran out of output tokens before finishing; try a simpler image.` |
| second parse/validation failure | `output` | `The model's output could not be used: <problem>` + blank line + first 400 chars |
| fake file fails validation | `output` | `Fake result rejected: <problem>` |
| any other exception (not an `Anthropic.APIError`), or a fake file that is not valid JSON | none (re-thrown raw) | the error's own message, unclassified |
| (renderer) no `imageId` on node | plain Error | `The selected shape is not an image.` |
| (renderer) `images.get` returned null | plain Error | `Image bytes not found.` |
| (renderer) `shapes` empty | plain Error | `The model found no shapes in this image.` |

Nothing is inserted on any error path; the store is untouched until `insertMany` in Step D.

### B.10 The test seam

If the environment variable `HALDRAW_VECTORIZE_FAKE` names a JSON file, `runVectorize` reads it, validates it with `validateResult` against the request's `width`/`height`, and returns it as `{ result, model: 'fake', inputTokens: 0, outputTokens: 0 }` without touching the keychain or the network. Only a launcher that sets the variable sees this; the packaged app opened from Finder never has it. It exists so Steps C–E (mapping, layer, insert, grouping, undo) can be exercised deterministically in an isolated instance. Because the fake bypasses the schema constraint, this path is why `validateResult` re-checks kinds and numeric types.

---

## 4. Step C — Conversion to board geometry (renderer)

`convertResult(result, ref, sent, background)` in `src/util/vectorize.ts` turns the model's contract into rows the store accepts. It is a pure function of its arguments; it does not touch the store.

```
  inputs                                         per shape                                   per connector
  ─────────────────────────                      ──────────────────────────────────────      ───────────────────────────
  result.shapes / .connectors                    C.1 x,y,w,h  → board rect (sx, sy)          fromTemp/toTemp = ids
  ref: image node (x, y, width, height, layer)   C.2 kind     → node.type                    anchors 'auto', routing straight
  sent: { width, height } of the PNG             C.3 fill/stroke/textColor → style            headStart 'none', headEnd from model
  background: board paper colour                 C.4 confidence < 0.6 → dashed                C.4 confidence < 0.6 → dashed
                                                 C.5 fontSize ← text, box, kind              stroke = board default, width 2
                                                                                             label (or undefined)
  outputs: { nodes[] with tempId, edges[] with fromTemp/toTemp, lowConfidence }
```

### C.1 Coordinate mapping

The model's boxes are in sent-image pixels. The reference node occupies a rectangle on the board that the user chose at import (original size, fit, or a percentage) and may have moved or resized since. The mapping is an independent affine scale per axis plus the node's offset:

```
  sx = ref.width  / sent.width
  sy = ref.height / sent.height

  node.x      = ref.x + s.x * sx
  node.y      = ref.y + s.y * sy
  node.width  = max(4, s.w * sx)
  node.height = max(4, s.h * sy)
```

```
   sent image (px)                              board (canvas units)
   ┌────────────────────┐ W_sent                ┌───────────────────────────┐ ref.width
   │   ┌─────┐          │                       │      ┌───────┐            │
   │   │ s.x │ s.w      │   ×sx, ×sy, +ref.x/y  │      │       │            │
   │   └─────┘          │  ────────────────▶    │      └───────┘            │
   └────────────────────┘ H_sent                └───────────────────────────┘ ref.height
   origin (0,0)                                 origin (ref.x, ref.y)
```

Because `sx` and `sy` are computed separately, a reference the user has stretched non-uniformly gets a draft stretched the same way. Rotation of the reference node is **not** applied (`rotation: 0` on every draft node); a rotated reference gets an unrotated draft over its axis-aligned frame. The floor of 4 units prevents a degenerate box (a reading of the code; no comment states the reason).

The design note's regression case "reference at 50 %" is exactly this scale: `sent` equals the stored image size (if ≤ 1568 px) while `ref.width` is half of it, so `sx = 0.5`.

### C.2 Shape kind mapping

`node.type = s.kind` directly; the four model kinds are a subset of haldraw's `NodeType`. Differences by kind in the rest of the conversion:

| kind | fill | stroke | textAlign | verticalAlign | dashed when low confidence | font size rule |
|---|---|---|---|---|---|---|
| `rect`, `ellipse`, `diamond` | model's or transparent | model's or board default | board default (`center`) | unset (middle) | yes | area-based, §C.5 |
| `text` | always `transparent` | always `transparent` | `left` | `top` | **no** (nothing to dash) | extent-based, §C.5 |

Every node also gets `rotation: 0`, `locked: false`, `content.text = s.text || undefined` (empty string becomes absent), and the board-default style spread underneath (`strokeWidth 2`, `opacity 1`, `fontFamily Inter…`, `fontWeight 500`, `cornerRadius 8`).

### C.3 Fill, stroke and text colour

Helper: `colour(v, fallback)` returns `v.toLowerCase()` if `v` matches `/^#[0-9a-f]{6}$/i`, else `fallback`. So `""`, `#fff`, `rgb(…)`, `"white"` all mean "unknown".

```
  fill:
    kind == text ──────────────────────────▶ 'transparent'
    else colour(s.fill, 'transparent')      (unknown fill stays see-through so the reference shows)

  stroke:
    kind == text ──────────────────────────▶ 'transparent'
    else colour(s.stroke, base.stroke)      (base.stroke: #0b0d10 on light paper, #e6e8eb on dark)

  textColor (style.color):
    colour(s.textColor, fallback) where
      fallback = fill is a real hex ─────────▶ contrastingText(fill)     (black or white by luminance)
                 fill is 'transparent' ──────▶ base.color               (#0b0d10 light paper / #e6e8eb dark)
```

`contrastingText(hex)` computes WCAG relative luminance (sRGB linearisation, coefficients 0.2126 / 0.7152 / 0.0722) and returns `#0b0d10` when luminance > 0.35, else `#ffffff`. The threshold 0.35 sits above the 0.179 crossover at which black and white have equal contrast, so mid-tone fills (the blues and greens in the screenshot boards) get white text. The code and the 0.9.2 commit state the value but no rationale; this reading is the document's.

`base` is `defaultStyleForBackground(board.background)`, which switches between a light and a dark palette by a different, cheaper luminance test (`isColorDark`, Rec. 601 weights, threshold 128). The two functions serve different purposes and are not meant to agree.

Note the asymmetry: an unknown **fill** becomes transparent (so as not to hide the reference), but an unknown **stroke** becomes the board default (so the shape has a visible outline to grab).

### C.4 Confidence and the dashed stroke

`LOW_CONFIDENCE = 0.6`. For shapes other than `text`, `confidence < 0.6` sets `style.strokeDasharray = '6 4'`; for connectors it sets the same on the edge style. Each dashed element increments `lowConfidence`, which the toast reports ("N dashed (low confidence)"). Low-confidence `text` shapes are counted but not visually marked, because a text node has no stroke to dash.

The dash is stored as a plain style value, so the user removes it by choosing **Solid** in the properties panel, and it survives in the `.haldraw` file like any other dash.

### C.5 Font size estimation

The model reports no font size. `estimateFontSize(text, w, h, kind)` derives one from the box the model measured, in canvas units (the same units as `w`, `h` after C.1). Constants model an Inter-like face:

| constant | value | meaning |
|---|---|---|
| `CHAR_W` | 0.55 | average glyph advance as a multiple of font size |
| `LINE_H` | 1.25 | line height as a multiple of font size |
| `MIN_FONT` / `MAX_FONT` | 8 / 48 | clamp |

Empty (after trimming) text → 16 (the default; nothing to fit). Otherwise, on the trimmed text `t`: `lines = t.split('\n')`, `longest = max line length (≥ 1)`; `text.length` below means `t.length`.

**Free text** (`kind == 'text'`): the box *is* the text's extent, so fit both dimensions and take the smaller:

```
  byHeight = h / (lines × LINE_H)
  byWidth  = w / (longest × CHAR_W)
  f = min(byHeight, byWidth)
```

**Text inside a shape**: the box is the shape, and the text occupies only part of it, wrapped by the renderer. Size so the wrapped text fills a usable fraction of the area, but never wider than 90 % of the box at a capped 24-character line:

```
  usable  = k × w × h        k = 0.75 rect | 0.50 ellipse | 0.40 diamond
  byArea  = sqrt( usable / (text.length × CHAR_W × LINE_H) )
  byWidth = (0.9 × w) / (min(longest, 24) × CHAR_W)
  f = min(byArea, byWidth)
```

Result: `round(clamp(f, 8, 48))`.

The `k` factors approximate how much of the bounding box an inscribed text block can use: an ellipse loses its corners, a diamond more so. The `min(longest, 24)` cap assumes the renderer will wrap lines longer than about 24 characters, so a single long line should not force a tiny font. Verified values from the 0.9.1 commit:

| box | kind | text | result |
|---|---|---|---|
| 397 × 119 | rect | 36 chars | 27 px |
| 496 × 60 | text | one line, 36 chars | 25 px |
| 298 × 159 | ellipse | — | 20 px |

The commit does not give line breaks. The 27 and the 20 follow when the longest line is at least 24 characters, which makes both width-bound (357.3 / 13.2 = 27.07); that is the ordinary case for a single wrapped label. The 25 is width-bound for a 36-character line.

The renderer draws the label in a `foreignObject` with 8 px padding, `lineHeight 1.3`, `pre-wrap` and `break-word` (§D.4). The heuristic's 1.25 line height and zero padding are slightly optimistic relative to that, so drafts run a touch large rather than small. (An observed consequence; the code does not state it as a goal.)

### C.6 Connector construction

Each `VectorConnector` becomes one `CanvasEdge` row. Nothing geometric is computed here; the edge stores only *what it joins*:

| field | value |
|---|---|
| `fromTemp` / `toTemp` | the model's `from` / `to` ids (replaced by real node ids in D.2) |
| `fromNode` / `toNode` | `null` here; set by `insertMany` |
| `fromAnchor` / `toAnchor` | `'auto'` |
| `fromPoint` / `toPoint` | `null` (both ends attached) |
| `routing` | `'straight'` |
| `headStart` | `'none'` |
| `headEnd` | the model's value: `'none'` or `'arrow'` |
| `style` | `{ stroke: board default edge colour, strokeWidth: 2, opacity: 1, strokeDasharray: '6 4' if confidence < 0.6 }` |
| `label` | the model's label, or `undefined` when `""` |

Where the line actually runs is decided every time the canvas renders (§D.4): the `auto` anchor picks, on each box, the side that faces the other box's centre, and the straight route joins those two side-midpoints. The connector's colour is **not** taken from the image; it is always the board's default edge stroke (dark on light paper, light on dark).

```
  model says                                   haldraw draws
  { from: s1, to: s2, headEnd: arrow }         side of s1 facing s2 ─────────────▶ side of s2 facing s1
                                                (midpoint of that side)             (arrowhead here)
```

---

## 5. Step D — Insertion into the board (store)

### D.1 Resolving the Draft layer

Done in `vectorizeNode` just before insertion:

```
  ordered  = layers sorted bottom-first (position, then createdAt)
  refLayer = layers[ref.layerId]
  above    = the layer immediately above refLayer in `ordered`

  if above exists and above.name == 'Draft'  → reuse: layer = { id: above.id }
  else                                       → create: layer = { name: 'Draft', abovePosition: refLayer.position }
```

So repeated vectorizations of the same image accumulate on one Draft layer, each as its own group, while an image on a different layer (or a Draft layer that has since been moved) gets a fresh one. Only the layer **directly** above is considered; a "Draft" two layers up is not reused. If the reference's layer cannot be found, `findIndex` returns -1, so `above` is the bottom layer: it is reused if it happens to be named "Draft", otherwise a new layer is created at the bottom (`abovePosition` -1).

These reads use state captured before the network round trip. `vectorizeNode` takes `store = useCanvas.getState()` once, before any `await`, and after the reply reads the board background, the layer table and the `ref` node from that snapshot, while `insertMany` itself runs against fresh state. If the user moves or resizes the reference, or reorders layers, during the call (which can take tens of seconds), the draft is placed against the old rectangle and the Draft-layer decision uses the old layer positions.

### D.2 insertMany: ids, z-order, group, selection, undo

`insertMany({ nodes, edges }, { layer, group: true, select: true })` in `src/store/canvasStore.ts`:

```
  1  prev = snapshot(state)                              ← the undo point, taken before any change
  2  layer:
       { id }                     → use it
       { name, abovePosition }    → every layer with position > abovePosition moves up by 1;
                                    new layer at abovePosition + 1; renumber densely from 0
  3  nodes: for each input row in order
       id       = newId()          idOf[tempId] = id
       zIndex   = maxZIndex(existing) + 1, +2, +3 …      ← model order becomes stacking order
       groupId  = one shared newId() if group && nodes > 1, else null
       layerId  = the resolved layer
       boardId, createdAt, updatedAt filled
  4  edges: for each input row
       fromNode = idOf[fromTemp], toNode = idOf[toTemp]  ← unknown ends drop the edge silently (a guard for other
                                                          callers; validateResult already ensured references here)
       id, boardId, layerId, midpoint = null, labelPoint = null, timestamps
  5  set state:
       nodes, edges, layers merged
       currentLayerId = the Draft layer                  ← subsequent drawing lands on Draft
       selection = all new node ids; edgeSelection = ∅
       dirty sets ∪= new ids (and every renumbered layer)
       history.push(prev); future = []                   ← exactly one undo entry
  6  return { nodeIds, edgeIds, layerId }
```

```
  layer stack before                     after (create case, ref on position 0)
  ┌─────────────┐ 2  Annotations         ┌─────────────┐ 3  Annotations   (shifted)
  ├─────────────┤ 1  Drawing             ├─────────────┤ 2  Drawing       (shifted)
  ├─────────────┤ 0  Reference ◀ image   ├─────────────┤ 1  Draft   ◀ new, current, unlocked, visible
  └─────────────┘                        ├─────────────┤ 0  Reference ◀ image
                                         └─────────────┘
```

Consequences worth knowing:

- **One ⌘Z** removes every draft node and edge *and* the Draft layer if it was created in this call (the layer lives in the same snapshot). Undo also clears the selection, and because the current layer (Draft) no longer exists, the current layer falls to the bottom of the stack, typically "Reference", not the layer the user was on before. Redo restores nodes, edges and layer with the same ids, but not the selection.
- The group means a click on any draft element selects the whole draft (`expandSelectionToGroups`), so the user can nudge or scale the whole thing against the reference, then ⌘⇧G (Ungroup) to edit pieces.
- The canvas paints layers bottom-first and, within a layer, by `zIndex`. Draft nodes get `zIndex` values above every existing node, which orders them among themselves in model order; anything added later, on any layer, gets a higher `zIndex` still. Their position relative to the reference comes from Draft sitting above the reference's layer, not from `zIndex`.
- Edges are on the Draft layer too, so hiding Draft hides its connectors.

### D.3 Persistence

`insertMany` only marks rows dirty. `BoardEditor` subscribes to the store and, 300 ms after the last change to nodes, edges, layers, viewport or current layer, runs `flushSave` (also on ⌘S and on unmount). `flushSave` calls `consumeDirty()` and issues `layers.upsertMany` first (so every `layer_id` resolves), then `nodes.upsertMany` and `edges.upsertMany`, then the viewport and the current layer; main writes them to SQLite. The unmount path issues the same upserts without awaiting them. The draft therefore appears in the `.haldraw` export and survives restart like anything else; there is no separate "vectorize result" table or file.

### D.4 How the rows render

Nothing in the renderer knows a node came from Vectorize. The rows are drawn by the same code as hand-made ones:

- **Shapes** — `Shape.tsx` draws the rect/ellipse/diamond with `style.fill`, `style.stroke`, `strokeWidth 2`, `strokeDasharray` if set, `cornerRadius 8` on rects. The label is a `foreignObject` spanning the node with a flex `div`: `p-2` (8 px padding), `fontSize` from C.5, `lineHeight 1.3`, `whiteSpace: pre-wrap`, `wordBreak: break-word`, `overflow: hidden`, alignment from `textAlign`/`verticalAlign` (centre/middle for shapes, left/top for free text). Text that does not fit is clipped, not shrunk.
- **Connectors** — `routing.ts` `edgeEndpoints` resolves each end: with `anchor 'auto'` and a target point (the other node's centre), it compares `|dx| × height` against `|dy| × width`; if the horizontal term wins it attaches to the left or right side's midpoint, else top or bottom. `buildPath` for `'straight'` emits `M from L to`. `Edge.tsx` draws that path in the edge's stroke/width/dash, adds the `arrow` marker at the `to` end via `markerEnd`, and if a `label` exists, a 120 × 24 `foreignObject` pill at the path midpoint.
- **Auto-anchor rule, geometrically:** the chosen side is the one the ray from this box's centre to the other box's centre would exit through, using the box's aspect ratio. For two boxes side by side that is right→left; for stacked boxes it is bottom→top; for a diagonal pair it depends on the slope versus the aspect ratio.

```
   |dx|·h > |dy|·w  →  left/right side          otherwise  →  top/bottom side
   ┌────────┐                                    ┌────────┐
   │   c ───┼──▶ target                          │   c    │
   └────────┘                                    └───┬────┘
                                                     ▼ target
```

Because the edge is attached by node id, moving a draft box later drags its connectors with it. That is the payoff for asking the model for endpoints rather than paths.

---

## 6. Step E — Feedback to the user

`notify(kind, text)` dispatches a `haldraw:toast` `CustomEvent` on `window`; `BoardEditor` listens and shows it for 3.5 s (ok) or 9 s (err), pre-wrapped so the multi-line keychain command is readable.

Progress texts, in order, shown as the button label (Image section) or under the row (Reference images):

1. `Starting…` (set by the button before `vectorizeNode` runs)
2. `Preparing image…` (before `images.get` and the downsample)
3. `Asking <model id>…` (before the IPC call; stays until the reply)

Success toast format:

```
Draft: <n> shape[s], <m> connector[s][, <k> dashed (low confidence)] · <model as reported by the API> · <input+output> tokens
```

`model` is `message.model` from the API response (the resolved id), not the requested string. The token figure is the sum of input and output over all attempts. Observed once, on a 3106 × 2667 bubble-chart board that produced 65 shapes and no connectors: `claude-opus-5 · 13833 tokens`.

Error toast: the `VectorizeError.message` with Electron's IPC prefix stripped (§A.5).

---

## 7. Data contracts

From `shared/types.ts` (0.9.2). These are the only vectorize-specific types; everything downstream is ordinary `CanvasNode` / `CanvasEdge` / `Layer`.

```ts
export type VectorShapeKind = 'rect' | 'ellipse' | 'diamond' | 'text';

/** One element the model found. Coordinates are pixels of the image as sent, origin top-left. */
export interface VectorShape {
  id: string;
  kind: VectorShapeKind;
  x: number; y: number; w: number; h: number;
  text: string;        // '' when none
  fill: string;        // '#rrggbb' or ''
  stroke: string;      // '#rrggbb' or ''
  textColor: string;   // '#rrggbb' or ''   (added 0.9.2)
  confidence: number;  // 0–1
}

export interface VectorConnector {
  from: string;                 // shape id
  to: string;                   // shape id
  headEnd: 'none' | 'arrow';    // head at the `to` end
  label: string;                // '' when none
  confidence: number;           // 0–1
}

export interface VectorizeResult  { shapes: VectorShape[]; connectors: VectorConnector[]; }

export interface VectorizeRequest {
  pngBase64: string;   // PNG, base64 without the data: prefix, long side ≤ 1568 px
  width: number; height: number;   // sent size
  model: string;
}

export interface VectorizeResponse {
  result: VectorizeResult;
  model: string;         // as reported by the API ('fake' for the test seam)
  inputTokens: number;   // summed over attempts
  outputTokens: number;
}

export interface AppSettings { vectorizeModel: string; }   // meta table key 'vectorize.model'
```

Fields of `CanvasNode` / `CanvasEdge` that Step C sets, versus those `insertMany` fills:

| set by `convertResult` (node) | set by `insertMany` (node) |
|---|---|
| `type, x, y, width, height, rotation=0, locked=false, style{…}, content{text}` + `tempId` | `id, boardId, zIndex, groupId, layerId, createdAt, updatedAt` |

| set by `convertResult` (edge) | set by `insertMany` (edge) |
|---|---|
| `fromAnchor='auto', toAnchor='auto', fromPoint=null, toPoint=null, routing='straight', headStart='none', headEnd, style{…}, label` + `fromTemp, toTemp` | `id, boardId, fromNode, toNode, layerId, midpoint=null, labelPoint=null, createdAt, updatedAt` |

---

## 8. Constants and tunables

| Name | Value | File | Effect |
|---|---|---|---|
| `MAX_SIDE` | 1568 | `src/util/vectorize.ts` | long side of the PNG sent |
| `LOW_CONFIDENCE` | 0.6 | `src/util/vectorize.ts` | below → dashed `'6 4'` |
| `CHAR_W`, `LINE_H` | 0.55, 1.25 | `src/util/vectorize.ts` | glyph metrics for font-size estimate |
| `MIN_FONT`, `MAX_FONT` | 8, 48 | `src/util/vectorize.ts` | clamp |
| usable-area factors | rect 0.75, ellipse 0.50, diamond 0.40 | `estimateFontSize` | fraction of the box text may fill |
| width cap | `min(longest, 24)`, 0.9 × w | `estimateFontSize` | wrap assumption for shape text |
| luminance threshold | 0.35 | `contrastingText` | > → dark text `#0b0d10`, else `#ffffff` |
| minimum node size | 4 × 4 | `convertResult` | floor after scaling |
| edge defaults | `strokeWidth 2`, `routing 'straight'`, anchors `'auto'` | `convertResult` | |
| `max_tokens` | 16000 | `electron/vectorize.ts` | output ceiling |
| SDK `timeout` | 180 000 ms | `electron/vectorize.ts` | per HTTP attempt |
| SDK `maxRetries` | 2 | `electron/vectorize.ts` | transport/429/5xx retries inside the SDK |
| app validation retries | 1 | `electron/vectorize.ts` | one corrected-JSON round |
| keychain lookup timeout | 5000 ms | `readApiKey` | |
| raw-text excerpt in final error | 400 chars | `runVectorize` | |
| `KEYCHAIN_SERVICE` / `ACCOUNT` | `haldraw` / `anthropic-api-key` | `electron/vectorize.ts` | |
| `DEFAULT_VECTORIZE_MODEL` | `claude-opus-5` | `shared/types.ts` | |
| Draft layer name | `'Draft'` | `vectorizeNode` | reuse test is by exact name |
| toast durations | ok 3.5 s, err 9 s | `BoardEditor.tsx` | |
| `HISTORY_LIMIT` | 200 | `src/store/canvasStore.ts` | undo entries kept |
| autosave debounce | 300 ms | `BoardEditor.tsx` | delay from last store change to `flushSave` |
| `MAX_STORED_SIDE` | 4096 | `src/util/importImage.ts` | upstream: what is in the images table |

---

## 9. Observed behaviour and limits

Facts that follow from the code above, collected for anyone testing or extending the feature. None is a bug report; several are deliberate scope decisions recorded in the design note.

**Perception and coverage**

- Anything that is not a shape with a box, text with a box, or a line joining two shapes is dropped: axes, brackets, legends drawn as lines, free arrows, arrows that touch only one shape, swimlane dividers, timelines. In one observed run, the screenshot board's vertical timeline bars came back as tall thin rectangles: the model classified them as shapes.
- Bubble-chart-style boards (many discs, no arrows) produce shapes only; "0 connectors" is the expected result, not a failure.
- Nested boxes (a box inside a container) come back as two overlapping shapes with no containment relation; the later one in the model's list stacks on top.
- Only one arrowhead, at the `to` end, of one style (filled `arrow`). Double-headed arrows lose one head; open, dot, diamond and crow heads are never produced although haldraw supports them.
- Connector colour, width, dash and route in the source image are not captured; every draft connector is a straight, board-default-coloured, 2-px line, dashed only for low confidence.
- Text is sized by heuristic and centred in shapes; the source's alignment, weight and family are not captured. Long text in a small box is clipped by the renderer rather than overflowing.
- Corner radius is always the board default (8); sharp-cornered source boxes render rounded.
- A rotated reference node gets an unrotated draft (C.1).

**Coordinates and placement**

- Accuracy is bounded by the model's bounding-box estimates in a ≤ 1568 px frame, scaled by `sx`, `sy`. On a reference placed at 100 % of a 1568 px image, one image pixel is one canvas unit; at 50 % it is half a unit.
- Boxes partly outside the image are accepted and can land partly outside the reference rectangle.
- The Draft layer is created directly above the reference's layer and becomes current; new drawing after a vectorize lands on Draft until the user switches.
- The reference rectangle and the layer positions used for placement are those captured when the call started, not when the reply arrived (§D.1).

**Request mechanics**

- Each Vectorize is exactly one model call unless the reply fails validation, in which case exactly two; the image is sent both times. The SDK may additionally retry transport failures up to twice per call.
- No streaming, no prompt caching, no thinking or effort parameters; model defaults apply (§B.2).
- `max_tokens` 16000 bounds the draft size. A very dense diagram can hit it; the error suggests a simpler image. There is no chunking or tiling.
- The token count in the toast is `input + output` summed across attempts, as reported by the API; there is no cost display.
- Colours that are not exactly `#rrggbb` (short hex, names, rgb()) are treated as unknown, which the schema and prompt make unlikely but do not prevent.
- `confidence` outside 0–1 is not rejected; only `< 0.6` matters.

**Validation gaps by design**

- A box that overlaps the image by a single pixel passes rule 9.
- Duplicate connectors (same `from`, `to`) are allowed and each becomes an edge.
- A connector between two `text` shapes is allowed; it will attach to the invisible text boxes.

---

## Appendix A — End-to-end pseudo-code

```
procedure VECTORIZE(imageNode ref, onProgress):
    -- Step A (renderer)
    imageId ← ref.content.imageId;  fail "not an image" if absent
    onProgress("Preparing image…")
    blob ← IPC images.get(imageId);  fail "Image bytes not found." if null
    (png, W, H) ← IMAGE_TO_PNG(blob.dataUrl)                 -- §A.3
    settings ← IPC settings.get()
    onProgress("Asking " + settings.vectorizeModel + "…")

    -- Step B (main, via IPC vectorize:run)
    try  resp ← RUN_VECTORIZE({png, W, H, model: settings.vectorizeModel})
    catch e: rethrow with Electron's "Error invoking remote method…" prefix removed
    fail "The model found no shapes in this image." if resp.result.shapes is empty

    -- Step C (renderer)
    bg ← board.background or '#ffffff'
    (nodes, edges, low) ← CONVERT_RESULT(resp.result, ref, {W, H}, bg)   -- §4

    -- Step D (renderer store)
    ordered ← layers sorted by (position, createdAt)
    refLayer ← layers[ref.layerId]
    above ← ordered[index(refLayer) + 1]
    layerSpec ← (above exists and above.name == "Draft") ? {id: above.id}
                                                         : {name: "Draft", abovePosition: refLayer.position or -1}
    INSERT_MANY({nodes, edges}, {layer: layerSpec, group: true, select: true})   -- Appendix D

    -- Step E
    return {shapes: |nodes|, connectors: |edges|, lowConfidence: low,
            model: resp.model, inputTokens: resp.inputTokens, outputTokens: resp.outputTokens}


procedure IMAGE_TO_PNG(dataUrl):
    mime ← substring between "data:" and ";";  bytes ← base64-decode(payload after ",")
    bitmap ← createImageBitmap(Blob(bytes, mime))
    scale ← min(1, 1568 / max(bitmap.w, bitmap.h))
    w ← max(1, round(bitmap.w × scale));  h ← max(1, round(bitmap.h × scale))
    canvas(w, h).drawImage(bitmap, 0, 0, w, h) with high smoothing
    return (base64 of canvas PNG without prefix, w, h)


procedure RUN_VECTORIZE(req):                                -- main process
    if env HALDRAW_VECTORIZE_FAKE:
        raw ← parse file;  problem ← VALIDATE(raw, req.W, req.H)
        if problem: throw VectorizeError(output, "Fake result rejected: " + problem)
        return {result: raw, model: "fake", inputTokens: 0, outputTokens: 0}
    key ← stdout of `security find-generic-password -s haldraw -a anthropic-api-key -w` (5 s), trimmed
    if not key: throw VectorizeError(no-key, "No API key in the keychain. In Terminal, run:\n" + ADD_COMMAND)
    client ← Anthropic(apiKey: key, maxRetries: 2, timeout: 180 s)
    messages ← [ user: [ image(base64 PNG), text("The image is W × H pixels. Extract its shapes and connectors.") ] ]
    inTok ← 0; outTok ← 0
    for attempt in 0..1:
        try  msg ← client.messages.create(model: req.model, max_tokens: 16000, system: SYSTEM_PROMPT,
                                          messages, output_config: {format: {type: json_schema, schema: OUTPUT_SCHEMA}})
        catch AuthenticationError → throw(auth);  NotFoundError → throw(model);  RateLimitError → throw(network)
              APIConnectionError → throw(network);  APIError → throw(model, status + message);  else rethrow
        inTok += msg.usage.input_tokens;  outTok += msg.usage.output_tokens
        if msg.stop_reason == refusal:    throw VectorizeError(model,  "The model declined to process this image.")
        if msg.stop_reason == max_tokens: throw VectorizeError(output, "…ran out of output tokens…")
        text ← concat of text blocks
        try  parsed ← JSON.parse(text);  problem ← VALIDATE(parsed, req.W, req.H)
        catch: problem ← "Not valid JSON: " + error
        if not problem: return {result: parsed, model: msg.model, inputTokens: inTok, outputTokens: outTok}
        if attempt == 0:
            messages.push(assistant: text or "{}")
            messages.push(user: "That output was rejected: " + problem + "\nReturn the corrected JSON object only.")
            continue
        throw VectorizeError(output, "The model's output could not be used: " + problem + "\n\n" + text[0:400])
```

## Appendix B — validateResult pseudo-code

```
function VALIDATE(raw, W, H) → problem string or null:
    if raw is not an object:                 return "Output is not an object."
    if raw.shapes is not an array:           return 'Missing "shapes" array.'
    if raw.connectors is not an array:       return 'Missing "connectors" array.'
    ids ← ∅
    for i, s in raw.shapes:
        if s.id is not a non-empty string:   return "Shape i: missing id."
        if s.id ∈ ids:                       return 'Shape i: duplicate id "s.id".'
        ids ← ids ∪ {s.id}
        if s.kind ∉ {rect, ellipse, diamond, text}: return 'Shape s.id: unknown kind "s.kind".'
        for k in (x, y, w, h):
            if s[k] is not a finite number:  return "Shape s.id: k must be a number."
        if s.w ≤ 0 or s.h ≤ 0:               return "Shape s.id: w and h must be positive."
        if s.x + s.w < 0 or s.y + s.h < 0 or s.x > W or s.y > H:
                                             return "Shape s.id: box lies outside the image (W×H)."
    for i, c in raw.connectors:
        if c.from ∉ ids:                     return 'Connector i: "from" is not a shape id.'
        if c.to ∉ ids:                       return 'Connector i: "to" is not a shape id.'
        if c.from == c.to:                   return "Connector i: from and to are the same shape."
    return null
```

## Appendix C — Colour and font-size helpers pseudo-code

```
function COLOUR(v, fallback):
    return v matches /^#[0-9a-f]{6}$/i ? lowercase(v) : fallback

function CONTRASTING_TEXT(hex):
    (r, g, b) ← channels of hex, each / 255
    lin(c) ← c ≤ 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4
    L ← 0.2126·lin(r) + 0.7152·lin(g) + 0.0722·lin(b)
    return L > 0.35 ? "#0b0d10" : "#ffffff"

function ESTIMATE_FONT_SIZE(text, w, h, kind):
    t ← trim(text);  if t is empty: return 16
    lines ← split(t, "\n");  longest ← max(1, max length of lines)
    if kind == text:
        f ← min( h / (|lines| × 1.25),  w / (longest × 0.55) )
    else:
        k ← kind == ellipse ? 0.50 : kind == diamond ? 0.40 : 0.75
        byArea  ← sqrt( (k × w × h) / (|t| × 0.55 × 1.25) )
        byWidth ← (0.9 × w) / (min(longest, 24) × 0.55)
        f ← min(byArea, byWidth)
    return round( clamp(f, 8, 48) )

function CONVERT_RESULT(result, ref, sent, background):
    sx ← ref.width / sent.width;  sy ← ref.height / sent.height
    base ← defaultStyleForBackground(background);  edgeStroke ← defaultEdgeStrokeForBackground(background)
    low ← 0
    nodes ← for s in result.shapes:
        isText ← s.kind == text;  dashed ← s.confidence < 0.6;  if dashed: low += 1
        width ← max(4, s.w × sx);  height ← max(4, s.h × sy)
        fill ← isText ? transparent : COLOUR(s.fill, transparent)
        textColor ← COLOUR(s.textColor, fill ≠ transparent ? CONTRASTING_TEXT(fill) : base.color)
        yield { tempId: s.id, type: s.kind,
                x: ref.x + s.x × sx, y: ref.y + s.y × sy, width, height, rotation: 0, locked: false,
                style: base ⊕ { fill, stroke: isText ? transparent : COLOUR(s.stroke, base.stroke), color: textColor,
                                strokeDasharray: (dashed and not isText) ? "6 4" : undefined,
                                fontSize: ESTIMATE_FONT_SIZE(s.text, width, height, s.kind),
                                textAlign: isText ? left : base.textAlign, verticalAlign: isText ? top : undefined },
                content: { text: s.text or undefined } }
    edges ← for c in result.connectors:
        dashed ← c.confidence < 0.6;  if dashed: low += 1
        yield { fromTemp: c.from, toTemp: c.to, fromNode: null, toNode: null,
                fromAnchor: auto, toAnchor: auto, fromPoint: null, toPoint: null,
                routing: straight, headStart: none, headEnd: c.headEnd,
                style: { stroke: edgeStroke, strokeWidth: 2, opacity: 1, strokeDasharray: dashed ? "6 4" : undefined },
                label: c.label or undefined }
    return (nodes, edges, low)
```

## Appendix D — insertMany pseudo-code

```
procedure INSERT_MANY({nodes: inNodes, edges: inEdges}, opts):
    prev ← snapshot(nodes, edges, layers)                       -- undo point
    now ← Date.now()
    if opts.layer has id:
        layerId ← opts.layer.id
    else:
        for each layer l: if l.position > opts.layer.abovePosition: l.position += 1
        new ← Layer{ id: newId(), name: opts.layer.name, position: opts.layer.abovePosition + 1,
                     visible: true, locked: false, createdAt/updatedAt: now }
        layers ← renumber densely (sort by position, createdAt; assign 0..n-1)
        mark every changed layer dirty;  layerId ← new.id
    idOf ← {};  groupId ← (opts.group and |inNodes| > 1) ? newId() : null
    z ← maxZIndex(existing nodes) + 1
    for n in inNodes:
        id ← newId();  idOf[n.tempId] ← id
        nodes[id] ← n minus tempId, plus { id, boardId, zIndex: z++, groupId, layerId, createdAt/updatedAt: now }
        mark dirty
    for e in inEdges:
        from ← idOf[e.fromTemp];  to ← idOf[e.toTemp];  skip e if either is missing
        id ← newId()
        edges[id] ← e minus temps, plus { id, boardId, fromNode: from, toNode: to, midpoint: null, labelPoint: null,
                                          layerId, createdAt/updatedAt: now }
        mark dirty
    commit { nodes, edges, layers, currentLayerId: layerId,
             selection: opts.select ? new node ids : unchanged, edgeSelection: opts.select ? ∅ : unchanged,
             history: history + prev (bounded), future: [] }
    return { nodeIds, edgeIds, layerId }
```

## Appendix E — A worked example

Illustrative numbers, chosen to be easy to follow; not a captured transcript.

**Setup.** A 1200 × 800 px PNG of two boxes joined by an arrow is imported at 50 % and placed at board (100, 50), so the reference node is `x 100, y 50, width 600, height 400`. Long side 1200 ≤ 1568, so it is sent at native size: `W = 1200, H = 800`, `sx = sy = 0.5`.

**Request.** System prompt of §B.3; user turn = image + `The image is 1200 × 800 pixels. Extract its shapes and connectors.`; schema of §B.5.

**A plausible reply.**

```json
{
  "shapes": [
    { "id": "s1", "kind": "rect",    "x": 100, "y": 100, "w": 300, "h": 120,
      "text": "Start", "fill": "#1f6f3f", "stroke": "#1f6f3f", "textColor": "", "confidence": 0.95 },
    { "id": "s2", "kind": "ellipse", "x": 700, "y": 100, "w": 300, "h": 120,
      "text": "End",   "fill": "",        "stroke": "#333333", "textColor": "", "confidence": 0.55 }
  ],
  "connectors": [
    { "from": "s1", "to": "s2", "headEnd": "arrow", "label": "", "confidence": 0.9 }
  ]
}
```

**Validation.** Ids unique; kinds valid; sizes positive; both boxes inside 1200 × 800; connector ids exist and differ → `null`.

**Conversion (light board, base stroke/colour `#0b0d10`).**

| | s1 | s2 |
|---|---|---|
| board rect | x = 100 + 100·0.5 = **150**, y = 50 + 100·0.5 = **100**, w **150**, h **60** | x **450**, y **100**, w **150**, h **60** |
| fill | `#1f6f3f` | `""` → `transparent` (reference shows through) |
| stroke | `#1f6f3f` | `#333333` |
| text colour | `""`, fill known → luminance of (31,111,63) ≈ 0.120 ≤ 0.35 → **`#ffffff`** | `""`, fill transparent → base **`#0b0d10`** |
| dashed | 0.95 → no | 0.55 < 0.6 → **`'6 4'`**, counted |
| font size | rect: usable 0.75·150·60 = 6750; byArea = √(6750 / (5·0.55·1.25)) ≈ 44.3; byWidth = 135 / (5·0.55) ≈ 49.1 → **44** | ellipse: usable 4500; byArea = √(4500 / (3·0.6875)) ≈ 46.7; byWidth = 135 / 1.65 ≈ 81.8 → **47** |

Connector: `fromTemp s1 → toTemp s2`, `headEnd 'arrow'`, straight, board-default stroke, not dashed.

**Insertion.** Suppose the reference sits on layer "Reference" at position 0 and "Drawing" is at 1 with no Draft above it. A new "Draft" layer is created at position 1, Drawing moves to 2. Two nodes get fresh ids and consecutive `zIndex` above everything, one shared `groupId`; the edge gets `fromNode`/`toNode` set to those ids. Selection = both nodes; current layer = Draft; one history entry.

**Render.** Centres are (225, 130) and (525, 130): `dx = 300, dy = 0`, so `|dx|·60 > 0·150` on both boxes → s1's right side (300, 130) to s2's left side (450, 130), a horizontal 150-unit arrow with a filled head at s2. Dragging s2 later re-routes the arrow automatically.

**Toast.** `Draft: 2 shapes, 1 connector, 1 dashed (low confidence) · claude-opus-5 · <n> tokens`.

## Appendix F — File and symbol map

| File | Symbols | Role |
|---|---|---|
| `electron/vectorize.ts` | `KEYCHAIN_ADD_COMMAND`, `readApiKey`, `hasApiKey`, `VectorizeError`, `SYSTEM_PROMPT`, `OUTPUT_SCHEMA`, `validateResult`, `textOf`, `runVectorize` | Step B: key, request, schema, validation, retry, errors, test seam |
| `electron/ipc.ts` | handlers `vectorize:run`, `vectorize:keyStatus`, `settings:get`, `settings:set`, `images:get`; `readSettings` | IPC surface; model setting in `meta` |
| `electron/preload.ts` | `window.haldraw.vectorize`, `.settings`, `.images` | context bridge |
| `electron/main.ts` | File ▸ Settings… (`⌘,`) → `menu:settings` | menu entry |
| `electron/repo/images.ts`, `repo/meta.ts` | `getImage`, `getMeta`/`setMeta` | SQLite access |
| `shared/types.ts` | `VectorShape`, `VectorConnector`, `VectorizeResult`, `VectorizeRequest`, `VectorizeResponse`, `VECTORIZE_MODELS`, `DEFAULT_VECTORIZE_MODEL`, `AppSettings`, `HaldrawApi.vectorize/settings` | contracts (§7) |
| `src/util/vectorize.ts` | `MAX_SIDE`, `LOW_CONFIDENCE`, `notify`, `imageToPng`, `colour`, `contrastingText`, `estimateFontSize`, `convertResult`, `vectorizeNode` | Steps A, C, orchestration, Draft-layer choice |
| `src/util/geometry.ts` | `defaultStyleForBackground`, `defaultEdgeStrokeForBackground`, `isColorDark`, `anchorPoint` | defaults and auto-anchor |
| `src/store/canvasStore.ts` | `insertMany`, `layerOrder`, `renumberLayers`, `checkpoint`/`undo`/`redo`, `consumeDirty` | Step D |
| `src/panels/PropertiesPanel.tsx` | `VectorizeButton` (full and `compact`) | Step A entry points; Step E toast text |
| `src/panels/SettingsModal.tsx` | model select, key status, add command with Copy, Check again | settings UI |
| `src/panels/Toolbar.tsx` | gear → `onSettings` | settings entry |
| `src/canvas/BoardEditor.tsx` | `haldraw:toast` listener, `menu:settings` listener, `flushSave` | Step E, persistence |
| `src/canvas/routing.ts`, `Edge.tsx`, `Shape.tsx`, `edgeHeads.ts` | `edgeEndpoints`, `buildPath`, label `foreignObject`, `headMarker` | how the rows render (§D.4) |
| `src/util/importImage.ts` | `MAX_STORED_SIDE`, `decodeAndStore`, `placeImage` | upstream: what is in the images table and how the reference node was placed |
| `docs/Vectorize_raster_design.md` | — | intent and decisions |
| `CHANGELOG.md` 0.9.0–0.9.2 | — | user-facing history |

---

## Index

Section numbers; "App." = appendix.

- **anchor, auto** — 1.5, C.6, D.4, App. E
- **Anthropic SDK** (`@anthropic-ai/sdk` 0.126.0) — B.2, B.9, 8
- **arrowhead** (`headEnd`) — B.3, B.6, C.6, 9
- **base64** — A.3, A.5, B.4
- **bounding box** — B.3, B.5, B.7 rule 9, C.1
- **Content-Security-Policy** (data-URL fetch) — A.3
- **colour resolution** (fill, stroke, textColor) — 1.5, B.3, C.3, App. C, App. E
- **concurrency** (no serialisation, no cancel) — A.1
- **confidence** — B.3, B.5, C.4, 8, 9
- **connector** — 0, 1.5, B.3, B.6, C.6, D.4, 9
- **contrastingText / luminance** — C.3, 8, App. C, App. E
- **convertResult** — 1.3, 4, App. C
- **coordinate mapping** (`sx`, `sy`) — C.1, App. E
- **corner radius** — B.3, C.2, 9
- **dashed stroke** (`'6 4'`) — C.4, C.6, 8
- **data URL** — A.2, A.3
- **design note, differences from** — 1.6
- **downsampling** (1568 px) — A.3, 8
- **Draft layer** — D.1, D.2, 9, App. E
- **entry points** (Image section, Reference images row) — A.1
- **errors** (`VectorizeError`, kinds, messages) — A.5, B.9
- **estimateFontSize** — C.5, 8, App. C, App. E
- **fake result** (`HALDRAW_VECTORIZE_FAKE`) — B.10
- **font size** — see estimateFontSize
- **group** — D.2
- **HISTORY_LIMIT** — 8, D.2
- **IPC channels** — 1.4, A.5, D.3, App. F
- **images table** (SHA-256 ids) — A.2
- **insertMany** — 1.3, D.2, App. D
- **keychain** (`security`, add command) — 1.4, B.1, B.9
- **layer position shifting** — D.1, D.2, App. D
- **line height / glyph width constants** — C.5, 8
- **max_tokens** (16000) — B.2, B.9, 9
- **meta table** (`vectorize.model`) — A.4
- **model list** — A.4
- **model, reported** (`message.model`) — 6, 7
- **Not valid JSON** (parse failure as a problem string) — B.7, B.8
- **paste path** (no 4096 px downsample) — A.2
- **perception, division of labour** — 0, 1.5, B.6
- **persistence** (dirty flush → SQLite) — D.3
- **progress texts** — 2 (diagram), 6
- **prompt, system** — B.3
- **prompt, user turn** — B.4
- **refusal** — B.7, B.9
- **rendering of draft rows** — D.4
- **retry** (single, with validation error) — B.8; SDK retries — B.2
- **rotation** — C.1, 9
- **sandbox** (`sandbox: false`, context bridge) — 1.4
- **schema, JSON** (`output_config.format`) — B.2, B.5
- **selection after insert** — D.2
- **Settings dialog** — A.4, B.1, App. F
- **stale state** (snapshot taken before the call) — D.1, 9
- **structured output** — B.2, B.5
- **SVG references** (unverified) — A.3
- **test seam** — see fake result
- **text nodes** (free text) — B.3, C.2, C.5
- **thinking / effort** (not set) — B.2, 9
- **timeout** (180 s; 5 s keychain) — B.1, B.2, 8
- **toast** — 6
- **tokens** (summed; toast) — B.7, 6, 9
- **trust boundary** — 1.4
- **undo** (one step; side effects) — D.2
- **Ungroup** (⌘⇧G) — D.2
- **validateResult** — B.7, App. B
- **VectorizeRequest / VectorizeResponse / VectorShape / VectorConnector** — 7
- **z-order** — D.2, 9
