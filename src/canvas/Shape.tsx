import { memo, useEffect, useRef } from 'react';
import type { CanvasNode } from '@shared/types';
import { icons as LucideIcons } from 'lucide-react';
import { useCanvas } from '@/store/canvasStore';

type Props = {
  node: CanvasNode;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, node: CanvasNode) => void;
  onDoubleClick: (node: CanvasNode) => void;
  editing: boolean;
  onFinishEdit: (text: string) => void;
  imageUrl?: string;
};

function ShapeInner({
  node,
  selected,
  onPointerDown,
  onDoubleClick,
  editing,
  onFinishEdit,
  imageUrl,
}: Props) {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const transform = node.rotation
    ? `rotate(${(node.rotation * 180) / Math.PI} ${centerX} ${centerY})`
    : undefined;

  const style = node.style;
  const fill = style.fill ?? '#1f2937';
  const stroke = style.stroke ?? '#e6e8eb';
  const strokeWidth = style.strokeWidth ?? 2;
  const opacity = style.opacity ?? 1;

  const commonPointer = (e: React.PointerEvent) => onPointerDown(e, node);

  let shape: React.ReactNode;
  if (node.type === 'rect') {
    shape = (
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={style.cornerRadius ?? 8}
        ry={style.cornerRadius ?? 8}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={style.strokeDasharray}
        opacity={opacity}
      />
    );
  } else if (node.type === 'diamond') {
    const pts = `${centerX} ${node.y}, ${node.x + node.width} ${centerY}, ${centerX} ${node.y + node.height}, ${node.x} ${centerY}`;
    shape = (
      <polygon
        points={pts}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={style.strokeDasharray}
        opacity={opacity}
      />
    );
  } else if (node.type === 'ellipse') {
    shape = (
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={node.width / 2}
        ry={node.height / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={style.strokeDasharray}
        opacity={opacity}
      />
    );
  } else if (node.type === 'image' && imageUrl) {
    shape = (
      <image
        href={imageUrl}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        opacity={opacity}
        preserveAspectRatio="none"
      />
    );
  } else if (node.type === 'icon') {
    const iconName = node.content.iconName ?? 'Square';
    const IconComp = (LucideIcons as Record<string, React.ComponentType<any>>)[iconName];
    shape = (
      <foreignObject
        data-fo-role="icon"
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
      >
        {IconComp ? (
          <IconComp
            width={node.width}
            height={node.height}
            color={style.color ?? '#e6e8eb'}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        ) : null}
      </foreignObject>
    );
  }

  const hasLabel =
    node.type === 'text' ||
    node.type === 'rect' ||
    node.type === 'ellipse' ||
    node.type === 'diamond';
  const labelShouldRotate = node.type === 'text';
  const label = node.content.text ?? '';

  const labelElement = hasLabel ? (
    <foreignObject
      data-fo-role="label"
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      pointerEvents={node.type === 'text' ? 'all' : 'none'}
    >
      <div
        className="w-full h-full flex justify-center p-2"
        style={{
          color: style.color ?? '#e6e8eb',
          fontFamily: style.fontFamily ?? 'Inter, system-ui, sans-serif',
          fontSize: `${style.fontSize ?? 16}px`,
          fontWeight: style.fontWeight ?? 500,
          textAlign: style.textAlign ?? 'center',
          alignItems:
            style.verticalAlign === 'top'
              ? 'flex-start'
              : style.verticalAlign === 'bottom'
                ? 'flex-end'
                : 'center',
          overflow: 'hidden',
          wordBreak: 'break-word',
          lineHeight: 1.3,
          whiteSpace: 'pre-wrap',
        }}
      >
        {editing ? (
          <EditableText initial={label} onCommit={onFinishEdit} />
        ) : (
          label || (node.type === 'text' ? <span className="opacity-40">Text</span> : null)
        )}
      </div>
    </foreignObject>
  ) : null;

  return (
    <g
      data-node-id={node.id}
      data-node-type={node.type}
      onPointerDown={commonPointer}
      onDoubleClick={() => onDoubleClick(node)}
      style={{ cursor: 'move' }}
    >
      <g transform={transform}>
        {shape}
        {labelShouldRotate ? labelElement : null}
        {selected ? (
          <rect
            x={node.x - 0.5}
            y={node.y - 0.5}
            width={node.width + 1}
            height={node.height + 1}
            rx={(node.style.cornerRadius ?? 8) + 0.5}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5 / useCanvas.getState().viewport.zoom}
            pointerEvents="none"
          />
        ) : null}
      </g>
      {!labelShouldRotate && hasLabel ? labelElement : null}
    </g>
  );
}

function EditableText({ initial, onCommit }: { initial: string; onCommit: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const valRef = useRef<string>(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerText = initial;
    // Delay focus to the next frame so React and Electron have finished
    // committing the DOM. Without this, focus is sometimes silently
    // dropped and keystrokes hit the global shortcut handler.
    const frame = requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        // ignore selection failure on an empty node
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => {
        valRef.current = (e.target as HTMLElement).innerText;
      }}
      onBlur={() => onCommit(valRef.current)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCommit(initial);
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onCommit(valRef.current);
        }
        e.stopPropagation();
      }}
      style={{ outline: 'none', width: '100%', height: '100%' }}
    />
  );
}

export default memo(ShapeInner);
