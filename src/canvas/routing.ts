import type { CanvasEdge, CanvasNode } from '@shared/types';
import { anchorPoint, outwardNormal, type Point } from '@/util/geometry';

export function edgeEndpoints(
  edge: CanvasEdge,
  nodes: Record<string, CanvasNode>
): { from: Point; to: Point; fromNormal: Point; toNormal: Point } {
  const fromNode = edge.fromNode ? nodes[edge.fromNode] : null;
  const toNode = edge.toNode ? nodes[edge.toNode] : null;

  // Fallback points for free endpoints
  const rawFrom: Point = fromNode
    ? { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 }
    : edge.fromPoint ?? { x: 0, y: 0 };
  const rawTo: Point = toNode
    ? { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 }
    : edge.toPoint ?? { x: 100, y: 0 };

  const from = fromNode
    ? anchorPoint(fromNode, edge.fromAnchor ?? 'auto', rawTo)
    : rawFrom;
  const to = toNode ? anchorPoint(toNode, edge.toAnchor ?? 'auto', rawFrom) : rawTo;

  const fromNormal = fromNode ? outwardNormal(fromNode, edge.fromAnchor ?? 'auto', rawTo) : { x: 1, y: 0 };
  const toNormal = toNode ? outwardNormal(toNode, edge.toAnchor ?? 'auto', rawFrom) : { x: -1, y: 0 };
  return { from, to, fromNormal, toNormal };
}

export function orthogonalElbow(
  edge: CanvasEdge,
  nodes: Record<string, CanvasNode>
): { x: number; y: number } {
  if (edge.midpoint) return edge.midpoint;
  const { from, to, fromNormal } = edgeEndpoints(edge, nodes);
  if (Math.abs(fromNormal.x) > Math.abs(fromNormal.y)) {
    return { x: (from.x + to.x) / 2, y: from.y };
  }
  return { x: from.x, y: (from.y + to.y) / 2 };
}

export function buildPath(edge: CanvasEdge, nodes: Record<string, CanvasNode>): string {
  const { from, to, fromNormal, toNormal } = edgeEndpoints(edge, nodes);
  switch (edge.routing) {
    case 'orthogonal': {
      const elbow = orthogonalElbow(edge, nodes);
      const horizFirst = Math.abs(fromNormal.x) > Math.abs(fromNormal.y);
      if (horizFirst) {
        return `M ${from.x} ${from.y} L ${elbow.x} ${from.y} L ${elbow.x} ${to.y} L ${to.x} ${to.y}`;
      }
      return `M ${from.x} ${from.y} L ${from.x} ${elbow.y} L ${to.x} ${elbow.y} L ${to.x} ${to.y}`;
    }
    case 'curved': {
      const dist = Math.max(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.4);
      const c1x = from.x + fromNormal.x * dist;
      const c1y = from.y + fromNormal.y * dist;
      const c2x = to.x + toNormal.x * dist;
      const c2y = to.y + toNormal.y * dist;
      return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
    }
    case 'straight':
    default:
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
}
