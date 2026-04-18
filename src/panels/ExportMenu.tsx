import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';

export type ExportFormat = 'png-transparent' | 'png-solid' | 'svg';

type Props = {
  onExport: (format: ExportFormat) => void;
};

const OPTIONS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: 'png-transparent', label: 'PNG — transparent', hint: 'alpha background for overlay' },
  { id: 'png-solid', label: 'PNG — solid background', hint: 'canvas color filled' },
  { id: 'svg', label: 'SVG', hint: 'vector, editable' },
];

export default function ExportMenu({ onExport }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onEsc);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 h-8 rounded-md bg-accent text-white font-medium hover:opacity-90 inline-flex items-center gap-1.5"
        title="Export"
      >
        <Download size={14} /> Export <ChevronDown size={12} />
      </button>
      {open ? (
        <div className="absolute right-0 top-10 w-64 rounded-lg bg-panel border border-border shadow-panel overflow-hidden z-30">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setOpen(false);
                onExport(o.id);
              }}
              className="w-full text-left px-3 py-2 hover:bg-panel-hover border-b border-border last:border-0"
            >
              <div className="text-sm">{o.label}</div>
              <div className="text-xs text-fg-muted">{o.hint}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
