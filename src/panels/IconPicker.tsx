import { useEffect, useMemo, useState } from 'react';
import { icons } from 'lucide-react';
import { Search } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (iconName: string) => void;
};

export default function IconPicker({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const names = useMemo(() => Object.keys(icons), []);
  const filtered = useMemo(() => {
    if (!query.trim()) return names.slice(0, 400);
    const q = query.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(q)).slice(0, 400);
  }, [query, names]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-28 z-50"
      onClick={onClose}
    >
      <div
        className="w-[720px] max-w-[92%] bg-panel border border-border rounded-xl shadow-panel overflow-hidden flex flex-col"
        style={{ maxHeight: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Search size={16} className="text-fg-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons (Lucide)…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <span className="text-xs text-fg-muted">{filtered.length} results</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          <div className="grid grid-cols-10 gap-1">
            {filtered.map((name) => {
              const Icon = (icons as Record<string, React.ComponentType<any>>)[name];
              return (
                <button
                  key={name}
                  onClick={() => {
                    onPick(name);
                    onClose();
                  }}
                  title={name}
                  className="aspect-square rounded hover:bg-panel-hover text-fg-muted hover:text-fg flex items-center justify-center"
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
