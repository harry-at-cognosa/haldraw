import { ANCHOR_SLOTS, type Anchor, type AnchorSlot, type CanvasNode, type NodeStyle } from '@shared/types';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function nodeCenter(n: CanvasNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

// ---- Composite rectangle shapes (0.9.4) ----

/** Depth of the 3D box's top and left bands: 12 % of the shorter side, 6–40 units. */
export function box3dDepth(n: { width: number; height: number }): number {
  return Math.max(6, Math.min(40, 0.12 * Math.min(n.width, n.height)));
}

/** Offset of the data store's vertical line from the left edge: the box height, never past 40 % of the width. */
export function dsboxOffset(n: { width: number; height: number }): number {
  return Math.min(n.height, 0.4 * n.width);
}

export const COLBOX_DIVIDER_MIN = 0.1;
export const COLBOX_DIVIDER_MAX = 1 / 3;
export const COLBOX_DIVIDER_DEFAULT = 0.2;

/** Height of the collection box's header band (above the divider). */
export function colboxHeader(n: CanvasNode): number {
  const f = Math.max(COLBOX_DIVIDER_MIN, Math.min(COLBOX_DIVIDER_MAX, n.style.dividerFraction ?? COLBOX_DIVIDER_DEFAULT));
  return f * n.height;
}

/**
 * Rectangle the label may occupy. The whole box for plain shapes; the front
 * face of a 3D box; the part right of the line for a data store; the part
 * below the divider for a collection. Canvas and exporter both use this so
 * text lands in the same place on screen and in PNG/SVG.
 */
export function labelBox(n: CanvasNode): Rect {
  switch (n.type) {
    case 'box3d': {
      const d = box3dDepth(n);
      return { x: n.x + d, y: n.y + d, width: n.width - d, height: n.height - d };
    }
    case 'dsbox': {
      const o = dsboxOffset(n);
      return { x: n.x + o, y: n.y, width: n.width - o, height: n.height };
    }
    case 'colbox': {
      const h = colboxHeader(n);
      return { x: n.x, y: n.y + h, width: n.width, height: n.height - h };
    }
    default:
      return { x: n.x, y: n.y, width: n.width, height: n.height };
  }
}

export function rotatePoint(p: Point, origin: Point, rotation: number): Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

// ---- Connection slots (0.9.17) ----

type Box = { x: number; y: number; width: number; height: number };

const SQ = Math.SQRT1_2;
/** Unit normals for the rectangle family: side slots use the side, corners the diagonal. */
const RECT_NORMALS: Record<AnchorSlot, Point> = {
  nnw: { x: 0, y: -1 }, n: { x: 0, y: -1 }, nne: { x: 0, y: -1 },
  ne: { x: SQ, y: -SQ },
  ene: { x: 1, y: 0 }, e: { x: 1, y: 0 }, ese: { x: 1, y: 0 },
  se: { x: SQ, y: SQ },
  sse: { x: 0, y: 1 }, s: { x: 0, y: 1 }, ssw: { x: 0, y: 1 },
  sw: { x: -SQ, y: SQ },
  wsw: { x: -1, y: 0 }, w: { x: -1, y: 0 }, wnw: { x: -1, y: 0 },
  nw: { x: -SQ, y: -SQ },
};

/** Slot index 0–15 clockwise from north. */
function slotIndex(slot: AnchorSlot): number {
  return ANCHOR_SLOTS.indexOf(slot);
}

/** Rectangle family: quarter points and midpoints of each side, plus the corners. */
function rectSlot(b: Box, slot: AnchorSlot): Point {
  const { x, y, width: w, height: h } = b;
  const q = [0, 0.25, 0.5, 0.75, 1];
  const i = slotIndex(slot);
  // 0..3 top edge left→right starting at centre: n, nne, ne(corner) ...
  // Walk the 5×5 perimeter: top row from centre to the right, down the right side, along the bottom, up the left.
  const ring: Point[] = [
    { x: x + q[2] * w, y }, { x: x + q[3] * w, y }, { x: x + w, y }, // n nne ne
    { x: x + w, y: y + q[1] * h }, { x: x + w, y: y + q[2] * h }, { x: x + w, y: y + q[3] * h }, // ene e ese
    { x: x + w, y: y + h }, { x: x + q[3] * w, y: y + h }, { x: x + q[2] * w, y: y + h }, // se sse s
    { x: x + q[1] * w, y: y + h }, { x, y: y + h }, // ssw sw
    { x, y: y + q[3] * h }, { x, y: y + q[2] * h }, { x, y: y + q[1] * h }, // wsw w wnw
    { x, y }, { x: x + q[1] * w, y }, // nw nnw
  ];
  return ring[i];
}

/** Ellipse: parametric angle every 22.5° clockwise from north. */
function ellipseSlot(b: Box, slot: AnchorSlot): Point {
  const t = (slotIndex(slot) * Math.PI) / 8;
  return { x: b.x + b.width / 2 + (b.width / 2) * Math.sin(t), y: b.y + b.height / 2 - (b.height / 2) * Math.cos(t) };
}

function ellipseNormal(b: Box, slot: AnchorSlot): Point {
  const t = (slotIndex(slot) * Math.PI) / 8;
  // Tangent of (a sin t, −b cos t) is (a cos t, b sin t); the outward normal is (b sin t, −a cos t).
  const nx = (b.height / 2) * Math.sin(t);
  const ny = -(b.width / 2) * Math.cos(t);
  const len = Math.hypot(nx, ny) || 1;
  return { x: nx / len, y: ny / len };
}

/** Diamond: vertices at n e s w, edge midpoints at ne se sw nw, quarter points between. */
function diamondSlot(b: Box, slot: AnchorSlot): Point {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const v: Point[] = [
    { x: cx, y: b.y }, // n
    { x: b.x + b.width, y: cy }, // e
    { x: cx, y: b.y + b.height }, // s
    { x: b.x, y: cy }, // w
  ];
  const i = slotIndex(slot);
  const a = v[Math.floor(i / 4)];
  const c = v[(Math.floor(i / 4) + 1) % 4];
  const f = (i % 4) / 4;
  return { x: a.x + (c.x - a.x) * f, y: a.y + (c.y - a.y) * f };
}

function diamondNormal(b: Box, slot: AnchorSlot): Point {
  const i = slotIndex(slot);
  if (i % 4 === 0) return [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }][i / 4];
  // Edge from vertex k to vertex k+1; its outward normal is the edge direction turned toward the outside.
  const k = Math.floor(i / 4);
  const w = b.width / 2;
  const h = b.height / 2;
  const dir = [{ x: w, y: h }, { x: -w, y: h }, { x: -w, y: -h }, { x: w, y: -h }][k];
  const nx = dir.y;
  const ny = -dir.x;
  const len = Math.hypot(nx, ny) || 1;
  return { x: nx / len, y: ny / len };
}

function isEllipse(n: CanvasNode): boolean {
  return n.type === 'ellipse';
}
function isDiamond(n: CanvasNode): boolean {
  return n.type === 'diamond';
}

/** Unrotated position of a slot on this node's outline. */
export function slotPointLocal(node: CanvasNode, slot: AnchorSlot): Point {
  if (isEllipse(node)) return ellipseSlot(node, slot);
  if (isDiamond(node)) return diamondSlot(node, slot);
  return rectSlot(node, slot);
}

/** Unrotated outward normal at a slot. */
export function slotNormalLocal(node: CanvasNode, slot: AnchorSlot): Point {
  if (isEllipse(node)) return ellipseNormal(node, slot);
  if (isDiamond(node)) return diamondNormal(node, slot);
  return RECT_NORMALS[slot];
}

/** Every slot in world coordinates (rotated with the node), for the hover dots and the picker. */
export function slotPoints(node: CanvasNode): Array<{ slot: AnchorSlot; point: Point }> {
  const c = nodeCenter(node);
  return ANCHOR_SLOTS.map((slot) => {
    const p = slotPointLocal(node, slot);
    return { slot, point: node.rotation ? rotatePoint(p, c, node.rotation) : p };
  });
}

/** The slot whose point lies within `radius` of `p`, nearest first; null when none is that close. */
export function nearestSlot(node: CanvasNode, p: Point, radius: number): AnchorSlot | null {
  let best: AnchorSlot | null = null;
  let bestD = radius;
  for (const { slot, point } of slotPoints(node)) {
    const d = Math.hypot(point.x - p.x, point.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = slot;
    }
  }
  return best;
}

/**
 * Slot chosen by `auto`. Boxes and diamonds: one of the four cardinals, by the
 * direction to the target scaled by the box's aspect ratio (unchanged since
 * 0.1). Ellipses: the nearest of the eight majors by angle, so a diagonal line
 * meets the curve where it points instead of at an extreme point. The target
 * is taken in the node's unrotated frame.
 */
export function autoSlot(node: CanvasNode, target?: Point): AnchorSlot {
  const c = nodeCenter(node);
  let t = target ?? c;
  if (node.rotation && target) t = rotatePoint(target, c, -node.rotation);
  const dx = t.x - c.x;
  const dy = t.y - c.y;
  if (isEllipse(node)) {
    if (!dx && !dy) return 'n';
    // Clockwise angle from north in eighths of a turn.
    const a = Math.atan2(dx, -dy);
    const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return ANCHOR_SLOTS[k * 2];
  }
  if (Math.abs(dx) * node.height > Math.abs(dy) * node.width) return dx > 0 ? 'e' : 'w';
  return dy > 0 ? 's' : 'n';
}

export function anchorPoint(node: CanvasNode, anchor: Anchor, target?: Point): Point {
  const c = nodeCenter(node);
  if (anchor === 'center') return c;
  const slot: AnchorSlot = anchor === 'auto' ? autoSlot(node, target) : anchor;
  const local = slotPointLocal(node, slot);
  if (node.rotation) return rotatePoint(local, c, node.rotation);
  return local;
}

export function outwardNormal(node: CanvasNode, anchor: Anchor, target?: Point): Point {
  const c = nodeCenter(node);
  if (anchor === 'center') {
    const p = target ?? { x: c.x + 1, y: c.y };
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }
  const slot: AnchorSlot = anchor === 'auto' ? autoSlot(node, target) : anchor;
  const n = slotNormalLocal(node, slot);
  if (!node.rotation) return n;
  const cos = Math.cos(node.rotation);
  const sin = Math.sin(node.rotation);
  return { x: n.x * cos - n.y * sin, y: n.x * sin + n.y * cos };
}

export function combinedBbox(nodes: CanvasNode[]): Rect | null {
  if (!nodes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectContains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function isColorDark(c: string): boolean {
  if (c === 'transparent') return false;
  const m = c.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 128;
}

export function defaultStyleForBackground(bg: string): NodeStyle {
  const dark = isColorDark(bg);
  return {
    fill: dark ? '#1f2937' : '#f4f6f8',
    stroke: dark ? '#e6e8eb' : '#0b0d10',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 16,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 500,
    color: dark ? '#e6e8eb' : '#0b0d10',
    textAlign: 'center',
    cornerRadius: 8,
  };
}

export function defaultEdgeStrokeForBackground(bg: string): string {
  return isColorDark(bg) ? '#e6e8eb' : '#0b0d10';
}

export const EDGE_LABEL_FONT_DEFAULT = 14;

/**
 * Connector label pill: size from the text and font size (Inter-like metrics),
 * text colour from the edge style or the paper's default text colour, and the
 * paper colour behind it so it reads over the line. Shared by the canvas and
 * the exporter.
 */
export function edgeLabelBox(
  edge: { label?: string; style: { color?: string; fontSize?: number; fontFamily?: string; fontWeight?: number } },
  paper: string
): { w: number; h: number; fontSize: number; fontFamily: string; fontWeight: number; color: string; bg: string | undefined } {
  const fontSize = edge.style.fontSize ?? EDGE_LABEL_FONT_DEFAULT;
  const fontWeight = edge.style.fontWeight ?? 400;
  const chars = (edge.label ?? '').length;
  const charW = fontWeight >= 600 ? 0.68 : 0.62;
  return {
    w: Math.max(40, Math.round(chars * fontSize * charW + 24)),
    h: Math.round(fontSize * 1.3 + 12),
    fontSize,
    fontFamily: edge.style.fontFamily || 'Inter, system-ui, sans-serif',
    fontWeight,
    color: edge.style.color ?? defaultStyleForBackground(paper).color!,
    bg: /^#[0-9a-f]{6}$/i.test(paper) ? paper : undefined,
  };
}

// ---- Freehand ink (0.9.13) ----

/** Default pen width in canvas units. */
export const INK_DEFAULT_WIDTH = 3;

/** Bounding box of a run of world points; a single point gets a 1×1 box. */
export function pointsBbox(pts: Point[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!pts.length) return { x: 0, y: 0, width: 1, height: 1 };
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** World points → fractions of `box`. */
export function normalizeInk(pts: Point[], box: Rect): Array<[number, number]> {
  return pts.map((p) => [(p.x - box.x) / box.width, (p.y - box.y) / box.height]);
}

/** Fractions of the node's box → world points. */
export function inkWorldPoints(n: { x: number; y: number; width: number; height: number; content: { ink?: Array<[number, number]> } }): Point[] {
  return (n.content.ink ?? []).map(([fx, fy]) => ({ x: n.x + fx * n.width, y: n.y + fy * n.height }));
}

/**
 * SVG path for a stroke: quadratic curves through the midpoints between
 * samples, which rounds the polyline without overshooting. One sample draws a
 * dot; two draw a line.
 */
export function inkPath(pts: Point[]): string {
  if (!pts.length) return '';
  const f = (v: number) => Math.round(v * 100) / 100;
  if (pts.length === 1) return `M ${f(pts[0].x)} ${f(pts[0].y)} l 0.01 0`;
  if (pts.length === 2) return `M ${f(pts[0].x)} ${f(pts[0].y)} L ${f(pts[1].x)} ${f(pts[1].y)}`;
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i];
    const m = { x: (c.x + pts[i + 1].x) / 2, y: (c.y + pts[i + 1].y) / 2 };
    d += ` Q ${f(c.x)} ${f(c.y)} ${f(m.x)} ${f(m.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${f(last.x)} ${f(last.y)}`;
  return d;
}
