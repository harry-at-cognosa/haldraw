import type { PickedImageFile } from '@shared/types';
import { useCanvas } from '@/store/canvasStore';

/** A decoded image ready to place: bytes are already in the images table. */
export interface DecodedImage {
  name: string;
  mime: string;
  imageId: string;
  dataUrl: string;
  width: number;
  height: number;
  byteLength: number;
}

export type SizeMode = 'original' | 'fit' | 'scale';
export type PositionMode = 'origin' | 'center';

export interface PlacementOptions {
  size: SizeMode;
  scalePercent: number;
  position: PositionMode;
  lock: boolean;
  sendToBack: boolean;
  fitView: boolean;
  /** Put the image on a new locked "Reference" layer at the bottom of the stack. */
  ownLayer: boolean;
}

export const DEFAULT_PLACEMENT: PlacementOptions = {
  size: 'original',
  scalePercent: 100,
  position: 'center',
  lock: true,
  sendToBack: true,
  fitView: true,
  ownLayer: true,
};

export async function fileToPicked(file: File): Promise<PickedImageFile> {
  return { name: file.name, mime: file.type, bytes: await file.arrayBuffer() };
}

/** Rasters whose long side exceeds this are downsampled before storage. Vector (SVG) is never touched. */
export const MAX_STORED_SIDE = 4096;

/** Decode dimensions, store the bytes, and return everything the placement dialog needs. */
export async function decodeAndStore(picked: PickedImageFile): Promise<DecodedImage> {
  const original = new Blob([picked.bytes], { type: picked.mime });
  const { width, height } = await blobDimensions(original);
  let stored = original;
  let storedMime = picked.mime;
  let storedW = width;
  let storedH = height;
  const longSide = Math.max(width, height);
  if (picked.mime !== 'image/svg+xml' && longSide > MAX_STORED_SIDE) {
    const scale = MAX_STORED_SIDE / longSide;
    storedW = Math.round(width * scale);
    storedH = Math.round(height * scale);
    // JPEG stays JPEG; everything else becomes PNG (drops GIF animation, which we never play anyway).
    storedMime = picked.mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    stored = await downsample(original, storedW, storedH, storedMime);
  }
  const imageId = await window.haldraw.images.store({
    mime: storedMime,
    bytes: await stored.arrayBuffer(),
    width: storedW,
    height: storedH,
  });
  const dataUrl = await blobToDataUrl(stored);
  return {
    name: picked.name,
    mime: picked.mime,
    imageId,
    dataUrl,
    width,
    height,
    byteLength: picked.bytes.byteLength,
  };
}

function canvasSize(): { w: number; h: number } {
  const el = document.querySelector('svg.haldraw-canvas') ?? document.querySelector('svg');
  return { w: el?.clientWidth ?? 1000, h: el?.clientHeight ?? 700 };
}

/** Compute the node rectangle for the chosen options against the current viewport. */
export function computePlacement(
  img: { width: number; height: number },
  opts: PlacementOptions
): { x: number; y: number; width: number; height: number } {
  const vp = useCanvas.getState().viewport;
  const { w: cw, h: ch } = canvasSize();
  let scale = 1;
  if (opts.size === 'scale') {
    scale = Math.max(0.01, opts.scalePercent / 100);
  } else if (opts.size === 'fit') {
    const pad = 40;
    const availW = (cw - pad * 2) / vp.zoom;
    const availH = (ch - pad * 2) / vp.zoom;
    scale = Math.min(availW / img.width, availH / img.height);
  }
  const width = img.width * scale;
  const height = img.height * scale;
  if (opts.position === 'origin') return { x: 0, y: 0, width, height };
  const cx = (cw / 2 - vp.x) / vp.zoom;
  const cy = (ch / 2 - vp.y) / vp.zoom;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Add the image node per the options. Returns the node id. */
export function placeImage(
  img: DecodedImage,
  opts: PlacementOptions,
  extra: { renameDefaultLayerTo?: string } = {}
): string {
  let store = useCanvas.getState();
  const rect = computePlacement(img, opts);
  let layerId: string | undefined;
  if (opts.ownLayer) {
    // Bottom, locked, and not current: drawing continues on the layer the user was on.
    const keepCurrent = store.currentLayerId;
    if (extra.renameDefaultLayerTo && keepCurrent) {
      const cur = store.layers[keepCurrent];
      const hasNodes = Object.values(store.nodes).some((n) => n.layerId === keepCurrent);
      if (cur && !hasNodes && /^Layer \d+$/.test(cur.name)) store.renameLayer(keepCurrent, extra.renameDefaultLayerTo);
    }
    const layer = store.addLayer({ name: 'Reference', locked: true, atBottom: true, makeCurrent: false });
    layerId = layer.id;
    store = useCanvas.getState();
  }
  // Compute the z-index up front so the whole import is one undo step.
  let zIndex: number | undefined;
  if (opts.sendToBack) {
    let bottom = 0;
    for (const n of Object.values(store.nodes)) if (n.zIndex < bottom) bottom = n.zIndex;
    zIndex = bottom - 1;
  }
  const node = store.addNode({
    type: 'image',
    ...rect,
    rotation: 0,
    style: { opacity: 1 },
    content: { imageId: img.imageId, naturalWidth: img.width, naturalHeight: img.height },
    locked: opts.lock,
    zIndex,
    layerId,
  });
  if (opts.fitView) fitViewTo(rect);
  return node.id;
}

export function fitViewTo(rect: { x: number; y: number; width: number; height: number }) {
  const { w: cw, h: ch } = canvasSize();
  const pad = 80;
  const zoom = Math.min((cw - pad * 2) / rect.width, (ch - pad * 2) / rect.height, 4);
  useCanvas.getState().setViewport({
    x: cw / 2 - (rect.x + rect.width / 2) * zoom,
    y: ch / 2 - (rect.y + rect.height / 2) * zoom,
    zoom,
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function downsample(blob: Blob, w: number, h: number, mime: string): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('downsample failed'))), mime, 0.92)
    );
  } finally {
    bitmap.close();
  }
}

async function blobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
