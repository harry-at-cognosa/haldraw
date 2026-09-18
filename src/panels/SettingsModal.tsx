import { useEffect, useState } from 'react';
import { KEYCHAIN_ACCOUNT, KEYCHAIN_ADD_COMMAND, KEYCHAIN_SERVICE, VECTORIZE_MODELS, type AppSettings } from '@shared/types';

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

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="px-3 h-8 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
