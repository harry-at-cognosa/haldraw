import { useEffect, useState } from 'react';
import { BACKGROUND_NAMES, DEFAULT_PALETTE, KEYCHAIN_ACCOUNT, KEYCHAIN_ADD_COMMAND, KEYCHAIN_SERVICE, VECTORIZE_MODELS, type AppSettings, type BackupStatus, type Palette } from '@shared/types';
import { useCanvas } from '@/store/canvasStore';
import { pickColour, replaceSwatch, resetPalette } from '@/util/palette';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [keyPresent, setKeyPresent] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    window.haldraw.settings.get().then(setSettings);
    window.haldraw.vectorize.keyStatus().then((s) => setKeyPresent(s.present));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-[520px] max-w-[92%] bg-panel border border-border rounded-xl shadow-panel p-5 text-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-semibold mb-4">Settings</div>

        <div className="text-xs uppercase tracking-wider text-fg font-semibold mb-2">Vectorize</div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-fg-muted w-20">Model</span>
          <select
            value={settings?.vectorizeModel ?? ''}
            onChange={async (e) => {
              const next = await window.haldraw.settings.set({ vectorizeModel: e.target.value });
              setSettings(next);
            }}
            className="flex-1 bg-canvas rounded px-2 py-1.5 border border-border outline-none focus:border-accent"
          >
            {VECTORIZE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-fg-muted w-20 pt-0.5">API key</span>
          <div className="flex-1 min-w-0">
            <div className={keyPresent ? 'text-fg' : 'text-red-400'}>
              {keyPresent === null ? 'Checking the keychain…' : keyPresent ? `Found in the macOS keychain (${KEYCHAIN_SERVICE} / ${KEYCHAIN_ACCOUNT}).` : 'Not found in the macOS keychain.'}
            </div>
            <div className="text-fg-muted mt-1 leading-relaxed">
              The key is read from the keychain at call time and never stored by the app. To add or replace it, run this in Terminal:
            </div>
            <div className="mt-2 flex items-start gap-2">
              <code className="flex-1 min-w-0 block bg-canvas border border-border rounded px-2 py-1.5 text-xs break-all select-all">{KEYCHAIN_ADD_COMMAND}</code>
              <button
                onClick={async () => {
                  await window.haldraw.writeClipboard(KEYCHAIN_ADD_COMMAND);
                  setCopied(true);
                }}
                className="shrink-0 px-2 h-7 rounded border border-border text-xs text-fg-muted hover:text-fg hover:bg-panel-hover"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => window.haldraw.vectorize.keyStatus().then((s) => setKeyPresent(s.present))}
              className="mt-2 px-2 h-7 rounded border border-border text-xs text-fg-muted hover:text-fg hover:bg-panel-hover"
            >
              Check again
            </button>
          </div>
        </div>

        <PaletteSection />

        <BackupSection open={open} settings={settings} onSettings={setSettings} />

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="px-3 h-8 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Swatch editor: click any swatch to replace it (native colour panel); Reset restores the starter set. */
function PaletteSection() {
  const palette = useCanvas((s) => s.palette);
  const isDefault = JSON.stringify(palette) === JSON.stringify(DEFAULT_PALETTE);
  return (
    <div className="mt-5">
      <div className="text-xs uppercase tracking-wider text-fg font-semibold mb-2">Palette</div>
      <div className="text-fg-muted leading-relaxed mb-2">
        Click a swatch to replace it. The palette is app-wide and applies to new choices only; every shape keeps its own colour.
      </div>
      <SwatchRow label="Shapes" kind="swatches" colours={palette.swatches} />
      <SwatchRow label="Boards" kind="backgrounds" colours={palette.backgrounds} />
      <button
        onClick={resetPalette}
        disabled={isDefault}
        className="mt-2 px-2 h-7 rounded border border-border text-xs text-fg-muted hover:text-fg hover:bg-panel-hover disabled:opacity-40 disabled:hover:bg-transparent"
        title="Restore the starter palette (ten swatches, seven backgrounds)"
      >
        Reset palette
      </button>
    </div>
  );
}

function SwatchRow({ label, kind, colours }: { label: string; kind: keyof Palette; colours: string[] }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-fg-muted w-20">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {colours.map((c, i) => (
          <button
            key={`${i}-${c}`}
            data-settings-swatch={c}
            onClick={async () => {
              const hex = await pickColour(c);
              if (hex) replaceSwatch(kind, i, hex);
            }}
            className="w-6 h-6 rounded ring-1 ring-border hover:ring-accent"
            style={{ background: c }}
            title={`${kind === 'backgrounds' ? (BACKGROUND_NAMES[c] ?? c) : c} — click to replace (macOS Colors panel)`}
          />
        ))}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Daily snapshots: keep count, the newest file, Back up now, Reveal in Finder. */
function BackupSection({ open, settings, onSettings }: { open: boolean; settings: AppSettings | null; onSettings: (s: AppSettings) => void }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [keepDraft, setKeepDraft] = useState('');
  const refresh = () => window.haldraw.backups.status().then(setStatus);
  useEffect(() => {
    if (open) {
      setNote(null);
      refresh();
    }
  }, [open]);
  useEffect(() => {
    if (settings) setKeepDraft(String(settings.backupKeep));
  }, [settings?.backupKeep]);
  const commitKeep = async () => {
    const n = Math.round(Number(keepDraft));
    if (!Number.isFinite(n) || n < 1) {
      setKeepDraft(String(settings?.backupKeep ?? ''));
      return;
    }
    const next = await window.haldraw.settings.set({ backupKeep: n });
    onSettings(next);
    refresh();
  };
  const newest = status?.files[0];
  return (
    <div className="mt-5" data-testid="backup-section">
      <div className="text-xs uppercase tracking-wider text-fg font-semibold mb-2">Backups</div>
      <div className="text-fg-muted leading-relaxed mb-2">
        A snapshot of the whole database is written once a day, at launch or within the hour, to{' '}
        <code className="text-xs break-all">{status?.dir ?? '…'}</code>. Older snapshots are removed beyond the count kept.
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-fg-muted w-20">Keep</span>
        <input
          type="number"
          min={1}
          max={365}
          value={keepDraft}
          onChange={(e) => setKeepDraft(e.target.value)}
          onBlur={commitKeep}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            e.stopPropagation();
          }}
          className="w-20 bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent text-sm tabular-nums"
          title="How many daily snapshots to keep (1–365)"
        />
        <span className="text-fg-muted text-xs">daily snapshots</span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-fg-muted w-20">Newest</span>
        <span className="text-fg text-xs" data-testid="backup-newest">
          {status === null ? '…' : newest ? `${newest.name} · ${formatSize(newest.size)} · ${status.files.length} kept` : 'none yet'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await window.haldraw.backups.runNow();
              setNote(`Saved ${r.path.split('/').pop()}`);
              await refresh();
            } catch (err) {
              setNote(`Backup failed: ${(err as Error).message}`);
            } finally {
              setBusy(false);
            }
          }}
          className="px-2 h-7 rounded border border-border text-xs text-fg-muted hover:text-fg hover:bg-panel-hover disabled:opacity-40"
        >
          {busy ? 'Backing up…' : 'Back up now'}
        </button>
        <button
          onClick={() => window.haldraw.backups.reveal()}
          className="px-2 h-7 rounded border border-border text-xs text-fg-muted hover:text-fg hover:bg-panel-hover"
          title="Show the newest snapshot in the Finder"
        >
          Reveal in Finder
        </button>
        {note ? <span className="text-xs text-fg-muted truncate" data-testid="backup-note">{note}</span> : null}
      </div>
    </div>
  );
}
