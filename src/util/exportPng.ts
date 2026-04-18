import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons as LucideIcons } from 'lucide-react';
import type { CanvasEdge, CanvasNode } from '@shared/types';
import { combinedBbox } from './geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';

function createTextElement(node: CanvasNode): SVGElement | null {
  const text = node.content.text?.trim() ?? '';
  if (!text) return null;
  const style = node.style;
  const fontSize = style.fontSize ?? 16;
  const lineH = fontSize * 1.3;
  const align = style.textAlign ?? 'center';
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const pad = 8;
  const xPos =
    anchor === 'start' ? node.x + pad : anchor === 'end' ? node.x + node.width - pad : node.x + node.width / 2;

  const lines = text.split('\n');
  const va = style.verticalAlign ?? 'middle';
  let baseY: number;
  if (va === 'top') baseY = node.y + pad + fontSize;
  else if (va === 'bottom')
    baseY = node.y + node.height - pad - (lines.length - 1) * lineH;
  else
    baseY =
      node.y + node.height / 2 + fontSize / 3 - ((lines.length - 1) * lineH) / 2;

  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('text-anchor', anchor);
  t.setAttribute('fill', style.color ?? '#e6e8eb');
  t.setAttribute('font-family', style.fontFamily ?? 'Inter, system-ui, sans-serif');
  t.setAttribute('font-size', String(fontSize));
  t.setAttribute('font-weight', String(style.fontWeight ?? 500));
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

function replaceForeignObjects(root: Element, nodes: CanvasNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const fos = Array.from(root.querySelectorAll('foreignObject'));
  for (const fo of fos) {
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
  background: string | null;
}): string {
  const { nodes, background } = opts;
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

  replaceForeignObjects(clone, nodes);

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
}): Promise<string> {
  const { nodes, background } = opts;
  const bbox = combinedBbox(nodes) ?? { x: 0, y: 0, width: 800, height: 600 };
  const pad = 48;
  const scale = 2;
  const viewW = bbox.width + pad * 2;
  const viewH = bbox.height + pad * 2;

  const xml = buildExportSvg({ nodes, background: null });
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
