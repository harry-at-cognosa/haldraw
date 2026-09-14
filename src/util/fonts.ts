/**
 * Installed font families for the font picker.
 *
 * Chromium's Local Font Access API (`queryLocalFonts`) needs a user gesture and
 * a permission Electron grants by default. If it is missing or denied we fall
 * back to families that ship with macOS. Free text is always allowed on top.
 */
const FALLBACK_FAMILIES = [
  'Arial', 'Arial Narrow', 'Avenir', 'Avenir Next', 'Baskerville', 'Chalkboard', 'Charter',
  'Cochin', 'Comic Sans MS', 'Courier', 'Courier New', 'Didot', 'Futura', 'Geneva', 'Georgia',
  'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Hoefler Text', 'Impact', 'Inter', 'Lucida Grande',
  'Menlo', 'Monaco', 'Optima', 'Palatino', 'SF Mono', 'SF Pro', 'Tahoma', 'Times', 'Times New Roman',
  'Trebuchet MS', 'Verdana',
];

let cached: string[] | null = null;

type LocalFontData = { family: string };
type QueryLocalFonts = () => Promise<LocalFontData[]>;

export async function listLocalFonts(): Promise<string[]> {
  if (cached) return cached;
  const q = (window as unknown as { queryLocalFonts?: QueryLocalFonts }).queryLocalFonts;
  let families: string[] = [];
  if (q) {
    try {
      const fonts = await q();
      families = Array.from(new Set(fonts.map((f) => f.family))).filter(Boolean);
    } catch {
      families = [];
    }
  }
  if (!families.length) families = [...FALLBACK_FAMILIES];
  families.sort((a, b) => a.localeCompare(b));
  cached = families;
  return families;
}
