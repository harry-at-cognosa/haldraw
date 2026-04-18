import { memo } from 'react';
import type { CanvasEdge, CanvasNode } from '@shared/types';
import { buildPath, edgeEndpoints } from './routing';

type Props = {
  edge: CanvasEdge;
  nodes: Record<string, CanvasNode>;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent, edge: CanvasEdge) => void;
};

function EdgeInner({ edge, nodes, selected, onPointerDown }: Props) {
  const d = buildPath(edge, nodes);
  const stroke = edge.style.stroke ?? '#e6e8eb';
  const strokeWidth = edge.style.strokeWidth ?? 2;
  const opacity = edge.style.opacity ?? 1;
  const dasharray = edge.style.strokeDasharray;
  const { from, to } = edgeEndpoints(edge, nodes);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

  return (
    <g>
      {/* Wide invisible hit path */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(16, strokeWidth + 12)}
        onPointerDown={(e) => onPointerDown?.(e, edge)}
        style={{ cursor: 'pointer' }}
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        opacity={opacity}
        markerStart={edge.arrowStart ? `url(#arrow-start-${edge.id})` : undefined}
        markerEnd={edge.arrowEnd ? `url(#arrow-end-${edge.id})` : undefined}
        pointerEvents="none"
      />
      {selected ? (
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth + 4}
          opacity={0.25}
          pointerEvents="none"
        />
      ) : null}
      {edge.label ? (
        <foreignObject
          x={mid.x - 60}
          y={mid.y - 12}
          width={120}
          height={24}
          pointerEvents="none"
        >
          <div
            className="text-xs text-center px-1.5 py-0.5 rounded bg-panel/80 border border-border inline-block"
            style={{ color: edge.style.color ?? '#e6e8eb' }}
          >
            {edge.label}
          </div>
        </foreignObject>
      ) : null}

      <defs>
        <marker
          id={`arrow-end-${edge.id}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
        <marker
          id={`arrow-start-${edge.id}`}
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill={stroke} />
        </marker>
      </defs>
    </g>
  );
}

export default memo(EdgeInner);
