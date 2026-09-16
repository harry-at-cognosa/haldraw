# Review of docs/Vectorize_pipeline_implementation_reference_2026-09-15.md (first draft, then named Vectorize_pipeline_reference.md) — 2026-09-15

Independent review of the first draft by a fresh sub-agent that read the document and every source file it cites. The report is reproduced verbatim below. Disposition of each item is recorded first.

## Disposition

**Applied in full:** Errors 1–13; Inferences 1–7; Omissions 1–7, 9, 10, 11; Structure 2 (overview diagram redrawn, column widths machine-checked) and 4 (U+2011 non-breaking hyphens replaced globally; all 48 contents links verified against the GitHub slug rule); Clarity 1–6; Cuts 1, 2, 5.

**Applied in part:** Omission 8 (sandbox flag added to §1.4 as one sentence).

**Not applied, deliberately:**
- Structure 5, index entries as links: the index keeps plain section references, in the manner of a printed index; the new entries the reviewer listed were added.
- Cut 3, §B.5 closing paragraph: already a single sentence.
- Cut 4, removing the third column of the §B.3 table: kept, now labelled as interpretation with a pointer to §B.6 as the canonical list.
- Omission 12, API-side image size caps: not added; no source in the repository and not exercised.

## Report (verbatim)

# Review: docs/Vectorize_pipeline_reference.md (0.9.2)

Overall: the document is accurate to a high degree. The system prompt block is byte-identical to `SYSTEM_PROMPT` (verified programmatically), the schema, validation strings and order, error messages, constants, formulas, insertMany semantics, render ordering and the four commit-message font-size values all check out. The items below are what does not.

## Errors (must fix)

1. **§B.2, `messages` row — "three more messages on attempt 1".** Attempt 1 sends three messages in total (original user turn + assistant + user), i.e. two more. `electron/vectorize.ts:182-183`. Replace: "one user turn on attempt 0; on attempt 1 the same turn plus the rejected assistant text and a correction request (three messages in all)". §B.8's diagram already shows this correctly.

2. **§B.7 — "Rules 6–8 duplicate what the schema already enforces."** Only rule 6 (kind enum) and the type half of rule 7 (`number`) are schema-enforced. Positivity (rule 8) and finiteness are not in `OUTPUT_SCHEMA` (`electron/vectorize.ts:61-64` type `number` only). Replace: "Rule 6 and the type check in rule 7 duplicate the schema; rules 8 and 9 are enforced nowhere else."

3. **§A.5 (and §6 "Error toast") — wrapped message is `…: VectorizeError: <msg>`.** `VectorizeError` does not set `name` (`electron/vectorize.ts:27-31`), so Electron's `error.toString()` yields `Error: <msg>`; the code comment at `src/util/vectorize.ts:181` says exactly `Error: <msg>`. The regex accepts either. Replace: "`Error invoking remote method 'vectorize:run': Error: <msg>` (the subclass name is not carried because `VectorizeError` never sets `name`)".

4. **§D.2, third consequence — draft nodes sit "above anything else that later lands on the Draft layer".** False. `addNode` assigns `maxZIndex(nodes) + 1` (`src/store/canvasStore.ts:494`), so anything added afterwards, on any layer, stacks above the draft. Replace: "…which orders them among themselves in model order; later additions get higher `zIndex` values and paint above them."

5. **§B.1 — "That exact string is exported as `KEYCHAIN_ADD_COMMAND` … and shown (with a Copy button) in the Settings dialog."** The dialog uses its own duplicate literal (`src/panels/SettingsModal.tsx:4`); the renderer cannot import the electron module. Replace: "…embedded in the no-key error; the Settings dialog shows a second, hand-duplicated copy of the same string (`SettingsModal.tsx:4`), which must be kept in sync."

6. **§A.1 table, row 2 — "every locked node of type `image` gets a row".** Every node with `locked: true` gets a row regardless of type; only image rows get the sparkle (`src/panels/PropertiesPanel.tsx:1111-1113`, `1184`). Replace accordingly.

7. **§A.2 and §A.3 diagram — "stored image (≤ 4096 px long side)" / "the importer downsamples rasters whose long side exceeds 4096 px".** True only for file import and drop (`decodeAndStore`, `src/canvas/BoardEditor.tsx:201`). Pasted images are stored at full size via `images.store` with no downsample (`BoardEditor.tsx:163-172`). Replace: "Files imported or dropped are downsampled to 4096 px before storage; pasted images are stored as pasted."

8. **§D.1 — "If the reference's layer cannot be found, `abovePosition` is -1 and the new layer lands at the bottom."** Incomplete: `findIndex` returns -1, so `above = ordered[0]` (the bottom layer); if that layer is named "Draft" it is reused instead (`src/util/vectorize.ts:190-191`). Add the clause.

9. **§D.2, second consequence — "then **Ungroup** to edit pieces".** There is no Ungroup control in the panel; it is `⌘⇧G` (`src/canvas/BoardEditor.tsx:532`, `src/panels/ShortcutHelp.tsx:68`). Replace bold with "⌘⇧G (Ungroup)".

10. **Appendix E, text-colour row — luminance of `#1f6f3f` "≈ 0.136".** Recomputed: 0.1202. Conclusion (white) unchanged.

11. **Table of contents — six anchors will not resolve on GitHub.** Headings 1.2, D.2 and Appendices A–D contain U+2011 NON-BREAKING HYPHEN (doc lines 78, 685, 898, 970, 995, 1045). github-slugger keeps only ASCII hyphen-minus and strips U+2011, producing `#12-level0-diagram`, `#d2-insertmany-ids-zorder-group-selection-undo`, `#appendix-a--endtoend-pseudocode`, `#appendix-b--validateresult-pseudocode`, `#appendix-c--colour-and-fontsize-helpers-pseudocode`, `#appendix-d--insertmany-pseudocode`, while the TOC uses ASCII hyphens. Em dashes are fine (dropped, leaving `--`, which the TOC already uses). Fix: replace U+2011 with `-` in headings; 92 lines in the file contain U+2011, so a global replace is simplest and also fixes search/grep on terms like `z‑order`.

12. **§B.8 — "The `<problem>` is exactly one of the strings in §B.7."** It can also be `Not valid JSON: <message>` (`electron/vectorize.ts:177`), which is in B.7's numbered steps but not its rule table. Say "one of the rule strings or the `Not valid JSON:` form".

13. **§C.5 "verified values" table, rows 1 and 3 — "(width-bound)".** The commit message gives no text. Row 1 (397×119 rect, 36 chars) yields 27 only if the longest line is ≥ 24 chars (byArea 37.8, byWidth 27.07); with two 18-char lines it is 36. Row 3 (298×159 ellipse) yields 20 for any text whose longest line ≥ 24 and length < ~84 chars; longer text is area-bound at ≤ 20. Either state the assumption or drop the parenthetical.

## Inferences stated as fact

1. **§B.2 "Absent field" table, `thinking` / `effort` / `temperature` rows.** Adaptive-thinking defaults for Opus 5 / Sonnet 5, `effort` default `high`, and "not settable on the Claude 5 family" are external API-documentation claims not verifiable from the repo (the SDK types only show `effort?: 'low'|'medium'|'high'|'xhigh'|'max'|null`, `messages.d.ts:2039`). Label "per Anthropic documentation on 2026-09-15; not exercised here."
2. **§B.4 "the ordering Anthropic recommends".** External; label.
3. **§C.3 — "The threshold 0.35 is deliberately above the neutral 0.179 crossover so mid-tone fills … get white text, matching how such diagrams are usually drawn."** Neither the code comment (`src/util/vectorize.ts:46`) nor commit 77136d6 states this rationale. Label as the author's reading.
4. **§C.5 last paragraph — "slightly optimistic … which is intentional".** Rationale not in code or commits. Label.
5. **§C.1 — "The floor of 4 units keeps a degenerate box selectable."** No comment in code; label as reading.
6. **§B.3 table, "What it deliberately gives up" column** — e.g. "may over-report decorative elements": model-behaviour predictions, not code facts. One sentence saying the column is interpretation would suffice.
7. **§6 and §9 observations** ("3106 × 2667 bubble-chart … 13833 tokens", "timeline bars came back as tall thin rectangles") are session observations; say so ("observed once on …").
8. **§A.3 SVG remark** is already labelled unverified; fine.

## Omissions

1. **Stale state across the network round-trip.** `vectorizeNode` captures `store = useCanvas.getState()` before any `await` (`src/util/vectorize.ts:163`) and reads `store.board.background`, `store.layers[ref.layerId]` and `layerOrder(store.layers)` after the reply (lines 185-188), while `insertMany` operates on fresh state (line 192). The `ref` node object is likewise the pre-call one. If the user moves/resizes the reference or edits layers during the call (tens of seconds), the draft is placed against the old rectangle and the Draft-layer decision uses stale layer positions. Belongs in §D.1 or §9.
2. **Concurrency.** Nothing serialises calls; the disabled flag is per `VectorizeButton` instance (`PropertiesPanel.tsx:558`). Two rows' sparkles can run at once, and if the Image section unmounts (selection change) mid-call the progress state is lost while the call continues and the toast still fires. Belongs in §A.1 next to "there is no cancel".
3. **Non-`APIError` exceptions** fall through `throw err` (`electron/vectorize.ts:164`) and reach the toast with their raw message; likewise a malformed fake file throws a raw `SyntaxError` from `JSON.parse` (line 130), not a `VectorizeError`. §B.9 table should have a final row.
4. **Undo side-effects.** Undo clears selection and, because the Draft layer (current) disappears, `currentLayerId` falls to the bottom layer (`layerOrder(last.layers)[0]`, `canvasStore.ts` undo), typically "Reference", not the layer the user was on before. Redo does not restore selection. §D.2 bullet 1 should say so.
5. **`HISTORY_LIMIT = 200`** (`canvasStore.ts:320`) bounds the history; missing from §8.
6. **Entry-point gap.** An image whose own `locked` flag is false but which sits on a locked layer is neither clickable (`isNodeInteractive`, `canvasStore.ts:~215`) nor listed under Reference images (filter is `n.locked`, `PropertiesPanel.tsx:1112`), so it has no Vectorize entry point. Worth a line in §A.1.
7. **§1.6 table** could add: design note's "or File menu" entry point (not shipped); "exactly one **locked** image selected" → any single image; "Progress toast" → progress shown in the button label / under the row, not a toast.
8. **`sandbox: false`** in `electron/main.ts:97`; §1.4's trust-boundary line lists contextIsolation and nodeIntegration only.
9. **§D.3** omits that `flushSave` writes the viewport (`boards.setViewport`) before the current layer, and that the unmount path is fire-and-forget (no `await`, `BoardEditor.tsx:148-158`).
10. **§A.4** — the Settings select offers only the four ids, so "Model … was not found" arises only from a hand-edited `meta` row or a retired id. One clause.
11. **§D.2 step 4** — "an edge whose ends are unknown is dropped silently" cannot occur from `vectorizeNode` because `validateResult` has already checked references; say it guards other callers.
12. **API-side image limits** (per-image size/pixel caps) would surface as `API error 400: …`; if mentioned, label external.

## Structure and diagrams

1. Partitioning matches the brief: overview → five steps → sub-steps, Level-0 diagram plus per-step diagrams (A, B tree, C inputs/outputs, C.1 mapping, D.2 layer stack, D.4 anchor rule), TOC, index, appendices. Step D has no flow diagram of `insertMany` itself (the numbered list and Appendix D cover it); acceptable.
2. **Level-0 diagram (lines 80-104) is misaligned.** Line 89 (`│ dirty flush  └─────────────┘  │`) overruns the renderer box's right border; the "SQLite (images, nodes, edges, layers, meta)" label is wedged inside the main-process box and breaks its bottom border at line 101. Redraw with SQLite as its own box to the right of [B], fed by the `IPC upsertMany` arrow.
3. §3 tree, §B.8 message list, C.1/C.6/D.2/D.4 sketches are legible and correct. The §4 "diagram" is a monospace table; fine.
4. TOC anchors: see Error 11. All ASCII-only anchors resolve (checked `models` for the apostrophe, `--` for em dashes, colon removal in D.2).
5. Index: useful, correctly targeted. Entries are plain text; making each a link to the section anchor would make it usable on GitHub. Add: stale state, concurrency, HISTORY_LIMIT, paste path, SVG, sandbox, Ungroup (⌘⇧G), `Not valid JSON`.
6. Appendices A–D: pseudo-code matches the code line for line, including the trimmed-text detail in `ESTIMATE_FONT_SIZE` that the prose in §C.5 elides (`lines = text.split` should read the trimmed `t`).

## Clarity

1. §1.5 row "Which colour if the model said `""`?" says "black/white by luminance for text" — incomplete (only when fill is a known hex; else board default). §C.3 is right; make the summary match.
2. §B.5 "at both levels" — there are three object levels (root, shape item, connector item).
3. §B.2 `thinking` row is the longest cell in the document for a parameter the app does not send; cut to one sentence plus the external-docs label.
4. §A.3 point 1's parenthetical "(This was found by running the real app, not by static checks.)" is provenance, not reference content.
5. §C.5 prose says `text.split('\n')`; the code splits the trimmed string and uses its length for `byArea` (`src/util/vectorize.ts:70-73`).
6. §B.10 "Because the fake bypasses the schema constraint, this path is why `validateResult` re-checks kinds and numeric types" — fine, but pair it with Error 2's correction so the two passages agree.

## Suggested cuts

1. §A.3 "Why 1568" second half (the ×/750 token arithmetic) — background; keep one sentence or move to §9.
2. §A.3 "(This was found by running the real app…)".
3. §B.5 closing "division of labour" paragraph repeats §0 and §1.5; one sentence is enough.
4. §B.3 table's "What it deliberately gives up" column overlaps §B.6's "Not asked for" list and §9's coverage bullets; keep one of the three as the canonical list and cross-reference.
5. §9 "Validation gaps by design" bullet 4 (empty shapes + non-empty connectors impossible) is already stated in §B.7's "Not validated" line.

Files consulted: `/Users/harryAtMac/p33_haldraw_info_and_repo/haldraw/docs/Vectorize_pipeline_reference.md`, `electron/vectorize.ts`, `electron/ipc.ts`, `electron/preload.ts`, `electron/main.ts`, `electron/repo/images.ts`, `electron/repo/meta.ts`, `shared/types.ts`, `src/util/vectorize.ts`, `src/util/geometry.ts`, `src/util/importImage.ts`, `src/store/canvasStore.ts`, `src/panels/PropertiesPanel.tsx`, `src/panels/SettingsModal.tsx`, `src/canvas/BoardEditor.tsx`, `src/canvas/Canvas.tsx`, `src/canvas/Shape.tsx`, `src/canvas/Edge.tsx`, `src/canvas/routing.ts`, `src/index.html`, `docs/Vectorize_raster_design.md`, `CHANGELOG.md`, `node_modules/@anthropic-ai/sdk/client.js` (retry policy), commits 8ee54aa d0233eb e0291bd 77136d6.
