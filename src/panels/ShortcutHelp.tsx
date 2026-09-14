const PICKER_SECTIONS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: 'Getting started',
    items: [
      ['+ (sidebar)', 'New project'],
      ['New board', 'Empty board in the selected project'],
      ['From image…', 'Board with an image as a locked reference layer'],
      ['Drop image on grid', 'Same as From image…'],
      ['⌘⇧I', 'Import image (creates a project if none exists)'],
      ['Import… / ⌘⇧O', 'Import a .haldraw board file'],
      ['Drop .haldraw on grid', 'Same as Import…'],
    ],
  },
  {
    title: 'Boards',
    items: [
      ['Click card', 'Open board'],
      ['Hover card', 'Rename · Duplicate · Copy link · Delete'],
      ['? ', 'Show/hide this overlay'],
    ],
  },
];

export default function ShortcutHelp({
  open,
  onClose,
  variant = 'editor',
}: {
  open: boolean;
  onClose: () => void;
  /** 'picker' shows the library view's help; 'editor' the canvas shortcuts. */
  variant?: 'picker' | 'editor';
}) {
  if (!open) return null;
  const sections: Array<{ title: string; items: Array<[string, string]> }> =
    variant === 'picker' ? PICKER_SECTIONS : [
    {
      title: 'Tools',
      items: [
        ['V', 'Select'],
        ['R', 'Rectangle'],
        ['S', 'Square (locked ratio)'],
        ['O', 'Ellipse / Circle'],
        ['L', 'Line'],
        ['A', 'Arrow'],
        ['T', 'Text'],
        ['C', 'Connector'],
        ['I', 'Icon library'],
      ],
    },
    {
      title: 'Canvas',
      items: [
        ['Space + drag', 'Pan'],
        ['⌘ / Ctrl + scroll', 'Zoom'],
        ['⌘0', 'Reset zoom'],
        ['⌘1', 'Zoom to fit'],
      ],
    },
    {
      title: 'Edit',
      items: [
        ['⌘Z / ⌘⇧Z', 'Undo / Redo'],
        ['⌘C / ⌘V / ⌘X', 'Copy / Paste / Cut'],
        ['⌘D', 'Duplicate selection'],
        ['⌘⇧D', 'Duplicate entire board (timestamped copy)'],
        ['⌘G / ⌘⇧G', 'Group / Ungroup'],
        ['⌥-click', 'Select single shape inside a group'],
        ['⌘A', 'Select all'],
        ['Delete / Backspace', 'Delete selection'],
        ['Arrow keys (+Shift)', 'Nudge 1px (10px)'],
      ],
    },
    {
      title: 'Layers',
      items: [
        ['⌘]', 'Bring forward'],
        ['⌘[', 'Send backward'],
        ['⌘⇧]', 'Bring to front'],
        ['⌘⇧[', 'Send to back'],
      ],
    },
    {
      title: 'Other',
      items: [
        ['⌘V', 'Paste screenshot as image'],
        ['⌘⇧I', 'Import image file (placement dialog)'],
        ['⌘⇧O', 'Import .haldraw board into this project'],
        ['Export ▾ › haldraw board', 'Save this board as a .haldraw file'],
        ['⇧ + resize handle', 'Keep aspect ratio'],
        ['⌘E', 'Export PNG'],
        ['?', 'Show/hide this overlay'],
      ],
    },
  ];
  const title = variant === 'picker' ? 'Library help' : 'Keyboard shortcuts';
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-[680px] max-w-[92%] max-h-[80vh] bg-panel border border-border rounded-xl shadow-panel p-6 overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold mb-4">{title}</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 text-sm">
          {sections.map((s) => (
            <div key={s.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">
                {s.title}
              </div>
              <div className="space-y-1">
                {s.items.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-fg-muted">{v}</span>
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-canvas text-xs font-mono text-fg">
                      {k}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
