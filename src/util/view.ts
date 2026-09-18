import { useCanvas } from '@/store/canvasStore';
import type { Rect } from './geometry';

/** Pan (without zooming) so the rectangle is fully on screen, if it is not already. */
export function ensureRectInView(r: Rect): void {
  const state = useCanvas.getState();
  const vp = state.viewport;
  const el = document.querySelector('svg.haldraw-canvas') as SVGSVGElement | null;
  const cw = el?.clientWidth ?? 1000;
  const ch = el?.clientHeight ?? 700;
  const pad = 40;
  const left = r.x * vp.zoom + vp.x;
  const top = r.y * vp.zoom + vp.y;
  const right = left + r.width * vp.zoom;
  const bottom = top + r.height * vp.zoom;
  let dx = 0;
  let dy = 0;
  if (left < pad) dx = pad - left;
  else if (right > cw - pad) dx = cw - pad - right;
  if (top < pad) dy = pad - top;
  else if (bottom > ch - pad) dy = ch - pad - bottom;
  // A rectangle larger than the view: centre it instead of thrashing between edges.
  if (right - left > cw - pad * 2) dx = cw / 2 - (left + right) / 2;
  if (bottom - top > ch - pad * 2) dy = ch / 2 - (top + bottom) / 2;
  if (dx || dy) state.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom });
}
