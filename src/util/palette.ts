import { DEFAULT_PALETTE, type Palette } from '@shared/types';
import { useCanvas } from '@/store/canvasStore';

let saveTimer: number | null = null;

/**
 * Replace one swatch. The store updates at once (live preview while the
 * native colour panel is open, which fires an input event per tick); the
 * write to settings is debounced so a drag through the panel is one save.
 */
export function replaceSwatch(kind: keyof Palette, index: number, hex: string): void {
  const s = useCanvas.getState();
  const list = [...s.palette[kind]];
  if (index < 0 || index >= list.length || !/^#[0-9a-f]{6}$/i.test(hex)) return;
  list[index] = hex.toLowerCase();
  const next = { ...s.palette, [kind]: list };
  s.setPalette(next);
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void window.haldraw.settings.set({ palette: useCanvas.getState().palette });
  }, 300);
}

/** Back to the starter set, persisted. */
export function resetPalette(): void {
  useCanvas.getState().setPalette(DEFAULT_PALETTE);
  void window.haldraw.settings.set({ palette: DEFAULT_PALETTE });
}

/** Open the macOS Colors panel; null on Cancel. */
export function pickColour(initial: string): Promise<string | null> {
  return window.haldraw.pickColor(/^#[0-9a-f]{6}$/i.test(initial) ? initial : '#ffffff');
}
