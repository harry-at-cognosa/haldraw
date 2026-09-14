# Hal Draw tips document 1.md

## data hierarchy for haldraw projects: 

## primary organization - projects

- A project is only a named folder of boards. It carries no settings, no shared style, no shared images. Deleting a project cascades to its boards.

- Project has a name and timestamps, nothing else.

## secondary organization - boards (drawings)

- The full hierarchy for a board and its data, as stored in the SQLite file under Application Support:

- A board belongs to one project. 
- It owns its name, viewport position and zoom, and paper background colour. 
- The board is the unit you draw on, export, duplicate, and link to with haldraw://board/<id>.
- Node belongs to one board. Shapes, text, icons, and images are all nodes, distinguished by type. 
- Each node carries 
    - position, 
    - size, 
    - rotation, 
    - z-order, 
    - style, 
    - content, 
    - an optional group id, and since 0.4.0, the 
    - locked flag.
- Edge belongs to one board. 
- A connector between two nodes, or a free line or arrow with loose endpoints.
- Image blob is global, not owned by any board. 
    - Bytes are stored once, keyed by content hash, and 
    - image nodes point at them by id. 

- Two boards importing the same file share one blob.

- Groups are not a table. A group is just a shared group id on its member nodes.

## Two consequences worth knowing. 

- Cross-board links work across projects, since board ids are global, 
    - so a project is a viewing convenience rather than a boundary. 
- And there is no move-board-between-projects operation yet. 
    - Duplicate creates the copy inside the same project.

