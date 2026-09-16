import type { CanvasEdge, CanvasNode, VectorizeResponse, VectorizeResult } from '@shared/types';
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
    return {
      tempId: s.id,
      type: s.kind,
      x: ref.x + s.x * sx,
      y: ref.y + s.y * sy,
      width: Math.max(4, s.w * sx),
      height: Math.max(4, s.h * sy),
      rotation: 0,
      locked: false,
      style: {
        ...base,
        fill: isText ? 'transparent' : colour(s.fill, base.fill),
        stroke: isText ? 'transparent' : colour(s.stroke, base.stroke),
        strokeDasharray: dashed && !isText ? '6 4' : undefined,
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
