# `.haldraw` board file — format v1

Shipped in 0.6.0 (2026-09-13). A single board as portable, human-readable JSON. Purpose: hand a diagram to someone without copying the SQLite database, keep a text-diffable copy in git, and serve as the target format for future generators (templates, the raster vectorizer).

## Where it appears in the app

| Action | Where |
|---|---|
| Export | Editor ▸ **Export ▾** ▸ **haldraw board (.haldraw)** |
| Import into a project | Library ▸ **Import…** button, or drop a `.haldraw` file on the board grid, or **File ▸ Import Board (.haldraw)…** (`⌘⇧O`) |
| Import while a board is open | `⌘⇧O` creates the board in the current project and opens it |

Import always creates a **new** board. It never merges into or overwrites an existing one.

## Structure

```jsonc
{
  "format": "haldraw-board",      // required, exact
  "version": 1,                   // required; readers reject other values
  "app": "0.6.0",                 // writer's app version, informational
  "exportedAt": "2026-09-13T20:41:00.000Z",
  "board": {
    "name": "Logo trace",
    "background": "#ffffff",      // paper colour or "transparent"
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "dimReferences": false
  },
  "layers": [ /* since 0.7.0: Layer without boardId, sorted by position (0 = bottom) */ ],
  "nodes": [ /* CanvasNode without boardId, sorted by zIndex; each has layerId since 0.7.0 */ ],
  "edges": [ /* CanvasEdge without boardId; each has layerId, headStart, headEnd since 0.8.0 */ ],
  "images": {
    "<sha256 of bytes>": { "mime": "image/png", "width": 800, "height": 600, "base64": "iVBOR..." }
  }
}
```

Node and edge objects are the in-app shapes from `shared/types.ts` verbatim, minus `boardId`. All coordinates are canvas units (pixels at 100 % zoom), origin top-left. Rotation is radians.

Edge fields since 0.8.0: `layerId` (the edge's own layer), `headStart` and `headEnd` (one of `none`, `arrow`, `open`, `dot`, `diamond`, `crow`). The writer also emits `arrowStart` / `arrowEnd` booleans, mirrors of "head is not `none`", so that 0.6.x–0.7.x builds can still read the file; 0.8.0 ignores them when the head fields are present.

## Rules on import

- **Ids are remapped.** Every node, edge and group id in the file is replaced with a fresh ULID, so importing the same file twice yields two independent boards and hand-written files can use any string as an id.
- **Layer ids are remapped** like node ids. A file with no `layers` block (written before 0.7.0) puts every node on the new board's single "Layer 1". A node whose `layerId` is absent goes to the top layer. A node referencing a layer not in the file is a validation error.
- **Edges have layers too** (0.8.0). An edge's `layerId` is remapped like a node's. When it is absent (files written before 0.8.0) the edge goes to the layer of its `fromNode`, else of its `toNode`, else the top layer (the same default as a node without `layerId`). An edge referencing a layer not in the file is a validation error.
- **Head styles** (0.8.0). `headStart` / `headEnd` absent → derived from the old booleans: `arrowStart ? "arrow" : "none"` and `arrowEnd !== false ? "arrow" : "none"`. An unknown head string is a validation error.
- **Image ids are content hashes** and are kept. If a file was hand-edited so the base64 no longer matches its key, the importer stores the bytes under the correct hash and repoints the nodes. Nothing is lost.
- **Edges must reference nodes in the same file.** An edge whose `fromNode` or `toNode` is absent is a validation error. Loose ends use `fromPoint` / `toPoint` with `fromNode: null`.
- **Missing optional fields get defaults.** `rotation` 0, `zIndex` array order, `style` `{}`, `content` `{}`, `locked` false, `routing` `"straight"`, `headEnd` `"arrow"` (via `arrowEnd` true).
- Board name is taken from the file, offered in a prompt, and can be changed before import.

## Validation errors

Each of these aborts the import with the message shown in a toast: not JSON; missing or wrong `format`; `version` other than 1; missing board name; `nodes` or `edges` not arrays; a node with no id, an unknown `type`, or a non-numeric `x`/`y`/`width`/`height`; an edge referencing a node not in the file; an edge with an unknown `headStart` / `headEnd`; a node or edge referencing a layer not in the file; a node referencing an image not in the file.

## Not in v1

- Project-level export (many boards in one file).
- Merge or overwrite of an existing board.
- Cross-board links: a `haldraw://board/<id>` link inside a node is exported verbatim and will point at the original database's board id.

## Regression checklist (0.6.0)

1. **Round trip.** Open a board with shapes, text, a connector with a label, a group, and a locked reference image. Export ▾ ▸ haldraw board. Library ▸ Import… ▸ pick the file ▸ accept the name. The new board looks identical: same z-order, same colours, group still selects as one, connector still attached, reference still locked, background and dim flag preserved.
2. **File contents.** Open the `.haldraw` in a text editor: readable JSON; one `images` entry; `nodes` sorted by `zIndex`; no `boardId` fields.
3. **Independence.** Edit the imported copy; the original is unchanged. Import the same file again; three boards now exist, all independent.
4. **Drop.** Drag the `.haldraw` file from Finder onto the library grid: same as Import…
5. **Menu in editor.** With a board open, `⌘⇧O`, pick the file: a new board is created in the current project and opened.
6. **Empty board export.** Export a board with nothing on it: succeeds, `nodes` is `[]`. (PNG/SVG export of an empty board still refuses.)
7. **Validation.** Hand-edit a copy: change `"version": 1` to `2`; import ▸ error toast naming the version. Delete the `images` block from a file with an image node; import ▸ error naming the node and image id. Corrupt a brace; import ▸ "Not valid JSON".
8. **No project.** On a fresh database, Import… creates "Untitled project" and puts the board there.
9. **Hand-edited ids.** Replace every `id` in a small file with `"a"`, `"b"`, `"c"` and fix the edge references to match: imports fine, ids in the database are ULIDs.
10. **Re-run 0.5.0 checklist item 8** (the whole 0.4.0 list) to confirm nothing else moved.
