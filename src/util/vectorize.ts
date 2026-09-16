import type { CanvasEdge, CanvasNode, VectorShapeKind, VectorizeResponse, VectorizeResult } from '@shared/types';
import { useCanvas, layerOrder } from '@/store/canvasStore';
import { defaultStyleForBackground, defaultEdgeStrokeForBackground } from '@/util/geometry';

/** Claude renders images at full resolution up to this long side; larger ones are scaled anyway. */
const MAX_SIDE = 1568;
/** Elements below this confidence get a dashed stroke so the eye goes to them. */
const LOW_CONFIDENCE = 0.6;

export type VectorizeSummary = { shapes: number; connectors: number; lowConfidence: number; model: string; inputTokens: number; outputTokens: number };

/** Fire a toast from anywhere; BoardEditor listens. */
export function notify(kind: 'ok' | 'err', text: string) {
  window.dispatchEvent(new CustomEvent('haldraw:toast', { detail: { kind, text } }));
}

/** Decode a data URL, downsample to MAX_SIDE, return PNG base64 plus the size sent. */
export async function imageToPng(dataUrl: string): Promise<{ pngBase64: string; width: number; height: number }> {
  // Decode by hand: fetch() on a data: URL is blocked by the renderer's CSP.
  const comma = dataUrl.indexOf(',');
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    const url = canvas.toDataURL('image/png');
    return { pngBase64: url.slice(url.indexOf(',') + 1), width: w, height: h };
  } finally {
    bitmap.close();
  }
}

const HEX = /^#[0-9a-f]{6}$/i;
const colour = (v: string, fallback: string | undefined) => (HEX.test(v) ? v.toLowerCase() : fallback);

/** Black or white, whichever reads on `hex` (WCAG relative luminance). */
export function contrastingText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
  return lum > 0.35 ? '#0b0d10' : '#ffffff';
}

/** Average glyph width and line height as multiples of font size, for Inter-like faces. */
const CHAR_W = 0.55;
const LINE_H = 1.25;
const MIN_FONT = 8;
const MAX_FONT = 48;

/**
 * Font size at which the text fits the box the model measured (canvas units).
 * Free text: the box is the text's own extent, so fit the line count to the
 * height and the longest line to the width. Shapes: the box is the shape, so
 * size the wrapped text to a fraction of its area (ellipses lose the corners).
 */
export function estimateFontSize(text: string, w: number, h: number, kind: VectorShapeKind): number {
  const t = text.trim();
  if (!t) return 16;
  const lines = t.split('\n');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  let f: number;
  if (kind === 'text') {
    const byHeight = h / (lines.length * LINE_H);
    const byWidth = w / (longest * CHAR_W);
    f = Math.min(byHeight, byWidth);
  } else {
    const usable = (kind === 'ellipse' ? 0.5 : kind === 'diamond' ? 0.4 : 0.75) * w * h;
    const byArea = Math.sqrt(usable / (t.length * CHAR_W * LINE_H));
    const byWidth = (w * 0.9) / (Math.min(longest, 24) * CHAR_W);
    f = Math.min(byArea, byWidth);
  }
  return Math.round(Math.max(MIN_FONT, Math.min(MAX_FONT, f)));
}

/**
 * Map the model's image-pixel boxes into the reference node's rectangle and
 * build node / edge rows. Ids are fresh; `tempIds` maps the model's ids so the
 * caller can wire connectors.
 */
export function convertResult(
  result: VectorizeResult,
  ref: CanvasNode,
  sent: { width: number; height: number },
  background: string
): { nodes: Array<Omit<CanvasNode, 'id' | 'boardId' | 'createdAt' | 'updatedAt' | 'zIndex' | 'groupId' | 'layerId'> & { tempId: string }>; edges: Array<Omit<CanvasEdge, 'id' | 'boardId' | 'createdAt' | 'updatedAt' | 'layerId' | 'midpoint' | 'labelPoint'> & { fromTemp: string; toTemp: string }>; lowConfidence: number } {
  const sx = ref.width / sent.width;
  const sy = ref.height / sent.height;
  const base = defaultStyleForBackground(background);
  const edgeStroke = defaultEdgeStrokeForBackground(background);
  let low = 0;
  const nodes = result.shapes.map((s) => {
    const isText = s.kind === 'text';
    const dashed = s.confidence < LOW_CONFIDENCE;
    if (dashed) low++;
    const width = Math.max(4, s.w * sx);
    const height = Math.max(4, s.h * sy);
    const fill = isText ? 'transparent' : colour(s.fill, 'transparent');
    // Text colour: what the model saw; else black or white against a known fill; else the board default.
    const textColor = colour(s.textColor, fill && fill !== 'transparent' ? contrastingText(fill) : base.color);
    return {
      tempId: s.id,
      type: s.kind,
      x: ref.x + s.x * sx,
      y: ref.y + s.y * sy,
      width,
      height,
      rotation: 0,
      locked: false,
      style: {
        ...base,
        // Unknown fill stays transparent so the reference shows through.
        fill,
        stroke: isText ? 'transparent' : colour(s.stroke, base.stroke),
        color: textColor,
        strokeDasharray: dashed && !isText ? '6 4' : undefined,
        fontSize: estimateFontSize(s.text, width, height, s.kind),
        textAlign: isText ? 'left' : base.textAlign,
        verticalAlign: isText ? ('top' as const) : undefined,
      },
      content: { text: s.text || undefined },
    };
  });
  const edges = result.connectors.map((c) => {
    const dashed = c.confidence < LOW_CONFIDENCE;
    if (dashed) low++;
    return {
      fromTemp: c.from,
      toTemp: c.to,
      fromNode: null,
      fromAnchor: 'auto' as const,
      fromPoint: null,
      toNode: null,
      toAnchor: 'auto' as const,
      toPoint: null,
      routing: 'straight' as const,
      headStart: 'none' as const,
      headEnd: c.headEnd,
      style: { stroke: edgeStroke, strokeWidth: 2, opacity: 1, strokeDasharray: dashed ? '6 4' : undefined },
      label: c.label || undefined,
    };
  });
  return { nodes, edges, lowConfidence: low };
}

/**
 * Full flow for one image node: fetch bytes, downsample, call the model, place
 * the draft on a "Draft" layer above the image's layer as one undo step.
 */
export async function vectorizeNode(ref: CanvasNode, onProgress?: (msg: string) => void): Promise<VectorizeSummary> {
  const store = useCanvas.getState();
  const imageId = ref.content.imageId;
  if (!imageId) throw new Error('The selected shape is not an image.');
  onProgress?.('Preparing image…');
  const blob = await window.haldraw.images.get(imageId);
  if (!blob) throw new Error('Image bytes not found.');
  const sent = await imageToPng(blob.dataUrl);
  const settings = await window.haldraw.settings.get();
  onProgress?.(`Asking ${settings.vectorizeModel}…`);
  let res: VectorizeResponse;
  try {
    res = await window.haldraw.vectorize.run({
      pngBase64: sent.pngBase64,
      width: sent.width,
      height: sent.height,
      model: settings.vectorizeModel,
    });
  } catch (err) {
    // Electron wraps main-process errors: "Error invoking remote method 'x': Error: <msg>".
    throw new Error((err as Error).message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, ''));
  }
  if (!res.result.shapes.length) throw new Error('The model found no shapes in this image.');
  const bg = store.board?.background ?? '#ffffff';
  const { nodes, edges, lowConfidence } = convertResult(res.result, ref, sent, bg);
  const refLayer = store.layers[ref.layerId];
  const ordered = layerOrder(store.layers);
  // Reuse an existing "Draft" layer directly above the reference; else create one there.
  const above = ordered[ordered.findIndex((l) => l.id === refLayer?.id) + 1];
  const draftLayer = above && above.name === 'Draft' ? { id: above.id } : { name: 'Draft', abovePosition: refLayer?.position ?? -1 };
  useCanvas.getState().insertMany({ nodes, edges }, { layer: draftLayer, group: true, select: true });
  return { shapes: nodes.length, connectors: edges.length, lowConfidence, model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
}
