import { useEffect, useState } from 'react';
import {
  type DecodedImage,
  type PlacementOptions,
  type PositionMode,
  type SizeMode,
  formatBytes,
} from '@/util/importImage';

type Props = {
  image: DecodedImage | null;
  defaults: PlacementOptions;
  onPlace: (opts: PlacementOptions) => void;
  onCancel: () => void;
};

export default function ImportImageModal({ image, defaults, onPlace, onCancel }: Props) {
  const [opts, setOpts] = useState<PlacementOptions>(defaults);

  useEffect(() => {
    if (image) setOpts(defaults);
  }, [image, defaults]);

  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement && e.target.type === 'number')) {
        e.preventDefault();
        onPlace(opts);
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [image, opts, onPlace, onCancel]);

  if (!image) return null;

  const set = (patch: Partial<PlacementOptions>) => setOpts((o) => ({ ...o, ...patch }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="w-[520px] max-w-[94%] bg-panel border border-border rounded-xl shadow-panel p-5 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold mb-3">Place image</div>

        <div className="flex gap-4 mb-4">
          <div
            className="w-28 h-28 shrink-0 rounded-md border border-border bg-canvas flex items-center justify-center overflow-hidden"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg,#8883 0 6px,transparent 6px 12px)',
            }}
          >
            <img src={image.dataUrl} alt="" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0 space-y-1 text-fg-muted">
            <div className="text-fg truncate" title={image.name}>
              {image.name}
            </div>
            <div>
              {image.width} × {image.height} px
            </div>
            <div>
              {formatBytes(image.byteLength)} · {image.mime.replace('image/', '')}
              {image.mime === 'image/gif' ? ' (first frame only)' : ''}
            </div>
          </div>
        </div>

        <Field label="Size">
          <Segment<SizeMode>
            value={opts.size}
            onChange={(size) => set({ size })}
            options={[
              { id: 'original', label: 'Original (100%)' },
              { id: 'fit', label: 'Fit to view' },
              { id: 'scale', label: 'Scale' },
            ]}
          />
          {opts.size === 'scale' ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                max={1000}
                value={opts.scalePercent}
                onChange={(e) => set({ scalePercent: Number(e.target.value) || 100 })}
                className="w-20 bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent text-sm tabular-nums"
              />
              <span className="text-fg-muted">%</span>
              <span className="text-fg-muted text-xs">
                → {Math.round((image.width * opts.scalePercent) / 100)} ×{' '}
                {Math.round((image.height * opts.scalePercent) / 100)}
              </span>
            </div>
          ) : null}
        </Field>

        <Field label="Position">
          <Segment<PositionMode>
            value={opts.position}
            onChange={(position) => set({ position })}
            options={[
              { id: 'origin', label: 'Origin (0, 0)' },
              { id: 'center', label: 'Centre of view' },
            ]}
          />
        </Field>

        <div className="space-y-2 mt-3">
          <Check
            checked={opts.lock}
            onChange={(lock) => set({ lock })}
            label="Lock as reference"
            hint="Ignores clicks and drags so you can draw over it. Unlock later from the Board panel."
          />
          <Check
            checked={opts.ownLayer}
            onChange={(ownLayer) => set({ ownLayer })}
            label="Place on its own locked layer"
            hint='Creates a "Reference" layer at the bottom of the stack; your drawing stays on the current layer.'
          />
          <Check
            checked={opts.sendToBack}
            onChange={(sendToBack) => set({ sendToBack })}
            label="Send to back"
            hint="Place beneath everything already on the board."
          />
          <Check
            checked={opts.fitView}
            onChange={(fitView) => set({ fitView })}
            label="Fit view to image after placing"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 h-8 rounded-md text-fg-muted hover:bg-panel-hover text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onPlace(opts)}
            className="px-3 h-8 rounded-md text-white text-sm font-medium bg-accent hover:opacity-90"
          >
            Place
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs uppercase tracking-wider text-fg font-semibold mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Segment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`py-1.5 rounded text-xs ${
            value === o.id ? 'bg-accent text-white' : 'border border-border text-fg-muted hover:bg-panel-hover'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[var(--accent)]"
      />
      <span>
        <span className="text-fg">{label}</span>
        {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
