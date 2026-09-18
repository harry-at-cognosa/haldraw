import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons as LucideIcons } from 'lucide-react';
import type { CanvasEdge, CanvasNode } from '@shared/types';
import { combinedBbox, edgeLabelBox, labelBox } from './geometry';
import { edgeEndpoints } from '@/canvas/routing';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Padding inside a label box, matching the canvas label's `p-2` (8 px each side). */
const LABEL_PAD = 8;
/** Line height as a multiple of the font size, matching the canvas label. */
const LABEL_LINE_HEIGHT = 1.3;

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, font: string): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 0.55 * parseFloat(font);
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * Break text into the lines the canvas label shows: explicit newlines are
 * kept, each paragraph is filled word by word to `maxWidth`, and a word wider
 * than the box is split by character (`word-break: break-word`). Measured with
 * the same family, size and weight the canvas renders with.
 */
export function wrapLabelText(text: string, maxWidth: number, font: string): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    const push = () => {
      out.push(line);
      line = '';
    };
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, font) <= maxWidth || !candidate) {
        line = candidate;
        continue;
      }
      if (line) push();
      // The word alone does not fit: split it by characters.
      if (textWidth(word, font) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = '';
      for (const ch of word) {
        if (chunk && textWidth(chunk + ch, font) > maxWidth) {
          out.push(chunk);
          chunk = '';
        }
        chunk += ch;
      }
      line = chunk;
    }
    push();
  }
  return out;
}

function createTextElement(node: CanvasNode): SVGElement | null {
  const text = node.content.text?.replace(/\s+$/, '') ?? '';
  if (!text.trim()) return null;
  const style = node.style;
  const fontSize = style.fontSize ?? 16;
  const fontFamily = style.fontFamily ?? 'Inter, system-ui, sans-serif';
  const fontWeight = style.fontWeight ?? 500;
  const lineH = fontSize * LABEL_LINE_HEIGHT;
  const align = style.textAlign ?? 'center';
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const pad = LABEL_PAD;
  // Same rectangle the canvas label uses (front face / right part / lower part for composite shapes).
  const box = labelBox(node);
  const xPos =
    anchor === 'start' ? box.x + pad : anchor === 'end' ? box.x + box.width - pad : box.x + box.width / 2;

  // Wrap to the box like the canvas does, so a long label never runs past its shape.
  const lines = wrapLabelText(text, Math.max(1, box.width - pad * 2), `${fontWeight} ${fontSize}px ${fontFamily}`);
  const va = style.verticalAlign ?? 'middle';
  const block = lines.length * lineH;
  // First baseline: the canvas centres a block of `lines × lineH` in the box;
  // within a line the glyphs sit roughly 0.8 em from its top.
  const ascent = fontSize * 0.8;
  const lead = (lineH - fontSize) / 2;
  let top: number;
  if (va === 'top') top = box.y + pad;
  else if (va === 'bottom') top = box.y + box.height - pad - block;
  else top = box.y + box.height / 2 - block / 2;
  const baseY = top + lead + ascent;

  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('text-anchor', anchor);
  t.setAttribute('fill', style.color ?? '#e6e8eb');
  t.setAttribute('font-family', fontFamily);
  t.setAttribute('font-size', String(fontSize));
  t.setAttribute('font-weight', String(fontWeight));
  t.setAttribute('style', 'white-space: pre');

  if (node.type === 'text' && node.rotation) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    t.setAttribute('transform', `rotate(${(node.rotation * 180) / Math.PI} ${cx} ${cy})`);
  }

  lines.forEach((line, i) => {
    const tspan = document.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', String(xPos));
    tspan.setAttribute('y', String(baseY + i * lineH));
    tspan.textContent = line;
    t.appendChild(tspan);
  });
  return t;
}

function createIconElement(node: CanvasNode): SVGElement | null {
  const name = node.content.iconName;
  if (!name) return null;
  const IconComp = (LucideIcons as Record<string, React.ComponentType<any>>)[name];
  if (!IconComp) return null;
  const svgStr = renderToStaticMarkup(
    React.createElement(IconComp, {
      width: node.width,
      height: node.height,
      color: node.style.color ?? '#e6e8eb',
      strokeWidth: node.style.strokeWidth ?? 2,
    })
  );
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgStr, 'image/svg+xml');
  const iconSvg = doc.documentElement;
  if (!iconSvg || iconSvg.nodeName.toLowerCase() !== 'svg') return null;
  iconSvg.setAttribute('x', String(node.x));
  iconSvg.setAttribute('y', String(node.y));
  iconSvg.setAttribute('width', String(node.width));
  iconSvg.setAttribute('height', String(node.height));
  iconSvg.setAttribute('overflow', 'visible');
  return iconSvg as unknown as SVGElement;
}

/** Connector label as a paper-coloured pill plus centred text, matching the canvas. */
function createEdgeLabelElement(edge: CanvasEdge, nodesById: Record<string, CanvasNode>, paper: string): SVGElement | null {
  if (!edge.label) return null;
  const { from, to } = edgeEndpoints(edge, nodesById);
  const at = edge.labelPoint ?? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const lb = edgeLabelBox(edge, paper);
  const g = document.createElementNS(SVG_NS, 'g');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', String(at.x - lb.w / 2 + 2));
  rect.setAttribute('y', String(at.y - lb.h / 2 + 2));
  rect.setAttribute('width', String(lb.w - 4));
  rect.setAttribute('height', String(lb.h - 4));
  rect.setAttribute('rx', '4');
  rect.setAttribute('fill', lb.bg ?? 'none');
  rect.setAttribute('stroke', edge.style.stroke ?? '#e6e8eb');
  rect.setAttribute('stroke-width', '1');
  g.appendChild(rect);
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', String(at.x));
  t.setAttribute('y', String(at.y + lb.fontSize / 3));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('fill', lb.color);
  t.setAttribute('font-family', lb.fontFamily);
  t.setAttribute('font-size', String(lb.fontSize));
  t.setAttribute('font-weight', String(lb.fontWeight));
  t.textContent = edge.label;
  g.appendChild(t);
  return g;
}

function replaceForeignObjects(root: Element, nodes: CanvasNode[], edges: CanvasEdge[], paper: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodesById: Record<string, CanvasNode> = Object.fromEntries(byId);
  const edgesById = new Map(edges.map((e) => [e.id, e]));
  const fos = Array.from(root.querySelectorAll('foreignObject'));
  for (const fo of fos) {
    if (fo.getAttribute('data-fo-role') === 'edge-label') {
      const edge = edgesById.get(fo.getAttribute('data-edge-id') ?? '');
      const el = edge ? createEdgeLabelElement(edge, nodesById, paper) : null;
      if (el) fo.replaceWith(el);
      else fo.remove();
      continue;
    }
    const parent = fo.closest('[data-node-id]');
    const id = parent?.getAttribute('data-node-id');
    const node = id ? byId.get(id) : undefined;
    if (!node) {
      fo.remove();
      continue;
    }
    const role = fo.getAttribute('data-fo-role');
    let replacement: SVGElement | null = null;
    if (role === 'icon') replacement = createIconElement(node);
    else if (role === 'label') replacement = createTextElement(node);
    if (replacement) fo.replaceWith(replacement);
    else fo.remove();
  }
}

export function buildExportSvg(opts: {
  nodes: CanvasNode[];
  /** Edges on the canvas, for their labels. */
  edges?: CanvasEdge[];
  /** Board paper colour: connector label pills use it even in transparent exports. */
  paper?: string;
  background: string | null;
}): string {
  const { nodes, background, edges = [], paper = '#ffffff' } = opts;
  const bbox = combinedBbox(nodes) ?? { x: 0, y: 0, width: 800, height: 600 };
  const pad = 48;

  const svgEl = document.querySelector('svg.haldraw-canvas') as SVGSVGElement | null;
  if (!svgEl) throw new Error('canvas not found');
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-ui="true"]').forEach((el) => el.remove());

  const viewX = bbox.x - pad;
  const viewY = bbox.y - pad;
  const viewW = bbox.width + pad * 2;
  const viewH = bbox.height + pad * 2;

  const rootG = clone.querySelector('g[data-root="true"]');
  if (rootG) rootG.setAttribute('transform', '');

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${viewX} ${viewY} ${viewW} ${viewH}`);
  clone.setAttribute('width', String(viewW));
  clone.setAttribute('height', String(viewH));
  clone.removeAttribute('style');
  clone.removeAttribute('class');

  replaceForeignObjects(clone, nodes, edges, paper);

  // Board-level "dim references" is a canvas aid only: restore each dimmed
  // node's stored opacity so exports never bake the dimming in.
  clone.querySelectorAll('[data-base-opacity]').forEach((g) => {
    const base = g.getAttribute('data-base-opacity');
    g.querySelectorAll('[opacity]').forEach((el) => el.setAttribute('opacity', base ?? '1'));
    g.removeAttribute('data-base-opacity');
  });

  // Resolve CSS variables to concrete values so the file renders stand-alone.
  const cs = getComputedStyle(document.documentElement);
  const resolve = (v: string) => v.replace(/var\(--([a-z-]+)\)/g, (_m, name) => cs.getPropertyValue(`--${name}`).trim() || '#000');
  clone.querySelectorAll('*').forEach((el) => {
    for (const attr of ['fill', 'stroke', 'color']) {
      const val = el.getAttribute(attr);
      if (val && val.includes('var(')) el.setAttribute(attr, resolve(val));
    }
    const style = el.getAttribute('style');
    if (style && style.includes('var(')) el.setAttribute('style', resolve(style));
  });

  if (background) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(viewX));
    bg.setAttribute('y', String(viewY));
    bg.setAttribute('width', String(viewW));
    bg.setAttribute('height', String(viewH));
    bg.setAttribute('fill', background);
    clone.insertBefore(bg, clone.firstChild);
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function exportBoardPng(opts: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  imageUrls: Record<string, string>;
  background: string | null;
  paper?: string;
}): Promise<string> {
  const { nodes, edges, background, paper } = opts;
  const bbox = combinedBbox(nodes) ?? { x: 0, y: 0, width: 800, height: 600 };
  const pad = 48;
  const scale = 2;
  const viewW = bbox.width + pad * 2;
  const viewH = bbox.height + pad * 2;

  const xml = buildExportSvg({ nodes, edges, paper, background: null });
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewW * scale);
    canvas.height = Math.round(viewH * scale);
    const ctx = canvas.getContext('2d')!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
