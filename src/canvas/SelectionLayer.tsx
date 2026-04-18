import type { CanvasNode } from '@shared/types';
import { combinedBbox } from '@/util/geometry';

export type Handle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate';

type Props = {
  nodes: CanvasNode[];
  zoom: number;
  onHandlePointerDown: (handle: Handle, e: React.PointerEvent) => void;
};

const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  rotate: 'grab',
};

export default function SelectionLayer({ nodes, zoom, onHandlePointerDown }: Props) {
  if (nodes.length === 0) return null;
  const single = nodes.length === 1 ? nodes[0] : null;
  const bbox = single
    ? { x: single.x, y: single.y, width: single.width, height: single.height }
    : combinedBbox(nodes);
  if (!bbox) return null;

  const handleSize = 10 / zoom;
  const half = handleSize / 2;
  const rotationDeg = single?.rotation ? (single.rotation * 180) / Math.PI : 0;
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;

  const handles: Array<{ id: Handle; cx: number; cy: number }> = [
    { id: 'nw', cx: bbox.x, cy: bbox.y },
    { id: 'n', cx: centerX, cy: bbox.y },
    { id: 'ne', cx: bbox.x + bbox.width, cy: bbox.y },
    { id: 'e', cx: bbox.x + bbox.width, cy: centerY },
    { id: 'se', cx: bbox.x + bbox.width, cy: bbox.y + bbox.height },
    { id: 's', cx: centerX, cy: bbox.y + bbox.height },
    { id: 'sw', cx: bbox.x, cy: bbox.y + bbox.height },
    { id: 'w', cx: bbox.x, cy: centerY },
  ];

  const rotateY = bbox.y - 28 / zoom;

  return (
    <g
      transform={single ? `rotate(${rotationDeg} ${centerX} ${centerY})` : undefined}
      pointerEvents="all"
    >
      <rect
        x={bbox.x}
        y={bbox.y}
        width={bbox.width}
        height={bbox.height}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1 / zoom}
        strokeDasharray={`${4 / zoom} ${4 / zoom}`}
        pointerEvents="none"
      />
      {handles.map((h) => (
        <rect
          key={h.id}
          x={h.cx - half}
          y={h.cy - half}
          width={handleSize}
          height={handleSize}
          fill="white"
          stroke="var(--accent)"
          strokeWidth={1.5 / zoom}
          style={{ cursor: HANDLE_CURSORS[h.id] }}
          onPointerDown={(e) => onHandlePointerDown(h.id, e)}
        />
      ))}
      <line
        x1={centerX}
        y1={bbox.y}
        x2={centerX}
        y2={rotateY + handleSize}
        stroke="var(--accent)"
        strokeWidth={1 / zoom}
        pointerEvents="none"
      />
      <circle
        cx={centerX}
        cy={rotateY}
        r={handleSize * 0.9}
        fill="white"
        stroke="var(--accent)"
        strokeWidth={1.5 / zoom}
        style={{ cursor: HANDLE_CURSORS.rotate }}
        onPointerDown={(e) => onHandlePointerDown('rotate', e)}
      />
    </g>
  );
}
