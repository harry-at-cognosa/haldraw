import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { useCanvas } from '@/store/canvasStore';

export type ExportFormat = 'png-transparent' | 'png-solid' | 'svg' | 'haldraw';

type Props = {
  onExport: (format: ExportFormat) => void;
};

const OPTIONS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: 'png-transparent', label: 'PNG — transparent', hint: 'alpha background for overlay' },
  { id: 'png-solid', label: 'PNG — solid background', hint: 'canvas color filled' },
  { id: 'svg', label: 'SVG', hint: 'vector, editable' },
  { id: 'haldraw', label: 'haldraw board (.haldraw)', hint: 'portable JSON; re-import from the library' },
];

export default function ExportMenu({ onExport }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const includeRefs = useCanvas((s) => s.exportIncludeRefs);
  const setIncludeRefs = useCanvas((s) => s.setExportIncludeRefs);
  const hasRefs = useCanvas((s) => Object.values(s.nodes).some((n) => n.locked));

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
          {hasRefs ? (
            <label
              className="flex items-start gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-panel-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={includeRefs}
                onChange={(e) => setIncludeRefs(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm text-fg">Include reference images</span>
                <span className="block text-xs text-fg-muted">
                  Off: PNG and SVG contain only the drawing. The .haldraw file always keeps everything.
                </span>
              </span>
            </label>
          ) : null}
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
