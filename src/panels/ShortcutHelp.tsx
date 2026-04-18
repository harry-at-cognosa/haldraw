export default function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const sections: Array<{ title: string; items: Array<[string, string]> }> = [
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
        ['⌘E', 'Export PNG'],
        ['?', 'Show/hide this overlay'],
      ],
    },
  ];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-[680px] max-w-[92%] max-h-[80vh] bg-panel border border-border rounded-xl shadow-panel p-6 overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold mb-4">Keyboard shortcuts</div>
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
