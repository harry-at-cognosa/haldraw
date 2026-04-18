import type { Anchor, CanvasNode } from '@shared/types';

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

export function anchorPoint(node: CanvasNode, anchor: Anchor, target?: Point): Point {
  const c = nodeCenter(node);
  let local: Point;
  if (anchor === 'auto') {
    const t = target ?? c;
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    if (Math.abs(dx) * node.height > Math.abs(dy) * node.width) {
      local = { x: dx > 0 ? node.x + node.width : node.x, y: c.y };
    } else {
      local = { x: c.x, y: dy > 0 ? node.y + node.height : node.y };
    }
  } else {
    switch (anchor) {
      case 'top':
        local = { x: c.x, y: node.y };
        break;
      case 'bottom':
        local = { x: c.x, y: node.y + node.height };
        break;
      case 'left':
        local = { x: node.x, y: c.y };
        break;
      case 'right':
        local = { x: node.x + node.width, y: c.y };
        break;
      case 'center':
      default:
        local = c;
    }
  }
  if (node.rotation) return rotatePoint(local, c, node.rotation);
  return local;
}

export function outwardNormal(node: CanvasNode, anchor: Anchor, target?: Point): Point {
  const c = nodeCenter(node);
  const p = anchorPoint(node, anchor, target);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
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
