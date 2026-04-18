import { useMemo, useRef } from 'react';
import { useCanvas } from '@/store/canvasStore';
import { combinedBbox } from '@/util/geometry';

export default function Minimap() {
  const nodes = useCanvas((s) => s.nodes);
  const viewport = useCanvas((s) => s.viewport);
  const setViewport = useCanvas((s) => s.setViewport);
  const ref = useRef<HTMLDivElement>(null);

  const bbox = useMemo(() => combinedBbox(Object.values(nodes)), [nodes]);

  const width = 180;
  const height = 120;
  const padding = 40;

  if (!bbox || (bbox.width === 0 && bbox.height === 0)) {
    return (
      <div className="absolute right-3 bottom-3 bg-panel border border-border rounded-lg text-[10px] text-fg-muted p-2 shadow-panel">
        empty canvas
      </div>
    );
  }

  const expandedBbox = {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: bbox.width + padding * 2,
    height: bbox.height + padding * 2,
  };

  const scale = Math.min(width / expandedBbox.width, height / expandedBbox.height);
  const offsetX = (width - expandedBbox.width * scale) / 2 - expandedBbox.x * scale;
  const offsetY = (height - expandedBbox.height * scale) / 2 - expandedBbox.y * scale;

  // Viewport rect in world coordinates
  const el = document.querySelector('svg');
  const cw = el?.clientWidth ?? 1000;
  const ch = el?.clientHeight ?? 800;
  const viewWorld = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: cw / viewport.zoom,
    height: ch / viewport.zoom,
  };

  const onClick = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - offsetX) / scale;
    const wy = (my - offsetY) / scale;
    setViewport({
      x: cw / 2 - wx * viewport.zoom,
      y: ch / 2 - wy * viewport.zoom,
      zoom: viewport.zoom,
    });
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      className="absolute right-3 bottom-3 bg-panel/90 backdrop-blur border border-border rounded-lg shadow-panel cursor-pointer overflow-hidden"
      style={{ width, height }}
    >
      <svg width={width} height={height}>
        {Object.values(nodes).map((n) => (
          <rect
            key={n.id}
            x={n.x * scale + offsetX}
            y={n.y * scale + offsetY}
            width={Math.max(1, n.width * scale)}
            height={Math.max(1, n.height * scale)}
            fill={n.style.fill && n.style.fill !== 'transparent' ? n.style.fill : 'var(--fg-muted)'}
            opacity={0.6}
          />
        ))}
        <rect
          x={viewWorld.x * scale + offsetX}
          y={viewWorld.y * scale + offsetY}
          width={viewWorld.width * scale}
          height={viewWorld.height * scale}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
