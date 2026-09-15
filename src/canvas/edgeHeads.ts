import { createElement, useId, type ReactElement } from 'react';
import type { EdgeHead } from '@shared/types';

export const HEAD_LABELS: Record<EdgeHead, string> = {
  none: 'None',
  arrow: 'Arrow',
  open: 'Open arrow',
  dot: 'Dot',
  diamond: 'Diamond',
  crow: "Crow's foot",
};

/**
 * Marker geometry in a 0 0 10 10 viewBox with +x pointing along the path
 * toward the endpoint. `refX` is the x that sits exactly on the endpoint, chosen
 * so the head lies on the line side of the endpoint: an attached edge stops at
 * the shape border, and a head that crossed it would be hidden under the shape.
 */
const REF_X: Record<Exclude<EdgeHead, 'none'>, number> = {
  arrow: 8,
  open: 8,
  dot: 8.5,
  diamond: 10,
  crow: 10,
};

function headShape(kind: Exclude<EdgeHead, 'none'>, stroke: string): ReactElement {
  switch (kind) {
    case 'arrow':
      return createElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: stroke });
    case 'open':
      return createElement('path', {
        d: 'M 0 0 L 10 5 L 0 10',
        fill: 'none',
        stroke,
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      });
    case 'dot':
      return createElement('circle', { cx: 5, cy: 5, r: 3.5, fill: stroke });
    case 'diamond':
      return createElement('path', { d: 'M 0 5 L 5 0 L 10 5 L 5 10 z', fill: stroke });
    case 'crow':
      // Trunk on the line, three prongs touching the endpoint (the shape border).
      return createElement('path', {
        d: 'M 0 5 L 10 0 M 0 5 L 10 5 M 0 5 L 10 10',
        fill: 'none',
        stroke,
        strokeWidth: 1.5,
        strokeLinecap: 'round',
      });
  }
}

/** `<marker>` for one end of an edge, or null for 'none'. Unique per edge because it carries the stroke colour. */
export function headMarker(kind: EdgeHead, id: string, stroke: string): ReactElement | null {
  if (kind === 'none') return null;
  return createElement(
    'marker',
    {
      id,
      viewBox: '0 0 10 10',
      refX: REF_X[kind],
      refY: 5,
      markerWidth: 6,
      markerHeight: 6,
      orient: 'auto-start-reverse',
    },
    headShape(kind, stroke)
  );
}

/** Small preview of a head for the properties panel: a short line with the marker at `end`. */
export function HeadGlyph({ kind, end }: { kind: EdgeHead; end: 'start' | 'end' }) {
  const id = `hg-${useId().replace(/:/g, '')}`;
  const stroke = 'currentColor';
  return createElement(
    'svg',
    { width: 26, height: 12, viewBox: '0 0 26 12', 'aria-hidden': true },
    createElement('defs', null, headMarker(kind, id, stroke)),
    createElement('path', {
      d: 'M 3 6 L 23 6',
      stroke,
      strokeWidth: 1.5,
      fill: 'none',
      markerStart: end === 'start' && kind !== 'none' ? `url(#${id})` : undefined,
      markerEnd: end === 'end' && kind !== 'none' ? `url(#${id})` : undefined,
    })
  );
}
