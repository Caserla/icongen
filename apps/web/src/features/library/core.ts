import catalogData from './catalog.json';

export const styles = ['linear', 'outline', 'bold', 'broken', 'bulk', 'twotone'] as const;
export type LibraryStyle = typeof styles[number];
export type Design = typeof catalogData[number];
export const catalog: Design[] = catalogData;
export type Variant = { viewBox: string; paths: Record<string, string>[]; supportsStroke: boolean };
export type Appearance = { size: number; color: string; endColor: string; mode: 'solid' | 'linear' | 'radial'; angle: number; strokeWidth?: number; alpha?:number; endAlpha?:number; startOffset?:number; endOffset?:number };
export const defaultAppearance: Appearance = { size: 24, color: '#ffffff', endColor: '#8054ff', mode: 'solid', angle: 90, strokeWidth: 1.5 };
export function supportsStrokeAdjustment(variant: Variant) {
  return variant.paths.some(path=>Boolean(path.stroke && path.stroke!=='none'));
}
const attributeNames = new Set(['d','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','fill-rule']);
export function validateVariant(input: unknown): Variant {
  const value = input as Variant;
  if (!value || value.viewBox !== '0 0 24 24' || !Array.isArray(value.paths) || !value.paths.length || value.paths.length > 100) throw Error('Invalid icon');
  for (const path of value.paths) {
    if (!path || typeof path !== 'object' || typeof path.d !== 'string' || !/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+eE-]+$/.test(path.d)) throw Error('Invalid geometry');
    for (const [key, val] of Object.entries(path)) {
      if (!attributeNames.has(key) || typeof val !== 'string' || /[<>&"']|url\(/i.test(val)) throw Error('Invalid attribute');
      if ((key === 'fill' || key === 'stroke') && !/^(none|currentColor|#[0-9a-f]{6})$/i.test(val)) throw Error('Invalid paint');
    }
  }
  return value;
}
export function normalizeAppearance(value: Appearance): Appearance {
  const color = (v: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  return { size: Math.max(24, Math.min(128, Math.round(Number(value.size) || 24))), color: color(value.color, '#ffffff'), endColor: color(value.endColor, '#8054ff'), mode: ['solid','linear','radial'].includes(value.mode) ? value.mode : 'solid', angle: Number.isFinite(value.angle) ? ((value.angle % 360) + 360) % 360 : 90 };
}
export function renderSvg(input: Variant, appearance: Appearance): string {
  const variant = validateVariant(input);
  const config = normalizeAppearance(appearance);
  const paint = config.mode === 'solid' ? config.color : 'url(#paint)';
  const clampAlpha=(n:number|undefined)=>Number.isFinite(n)?Math.max(0,Math.min(1,n!)):1;
  const alpha=clampAlpha(appearance.alpha),endAlpha=clampAlpha(appearance.endAlpha);
  const start=Number.isFinite(appearance.startOffset)?Math.max(0,Math.min(100,appearance.startOffset!)):0;
  const end=Number.isFinite(appearance.endOffset)?Math.max(start,Math.min(100,appearance.endOffset!)):100;
  const stops = `<stop offset="${start/100}" stop-color="${config.color}" stop-opacity="${alpha}"/><stop offset="${end/100}" stop-color="${config.endColor}" stop-opacity="${endAlpha}"/>`;
  const defs = config.mode === 'solid' ? '' : config.mode === 'radial'
    ? `<defs><radialGradient id="paint">${stops}</radialGradient></defs>`
    : `<defs><linearGradient id="paint" x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform="rotate(${config.angle} .5 .5)">${stops}</linearGradient></defs>`;
  const width = Number.isFinite(appearance.strokeWidth) ? Math.max(.5,Math.min(2.5,appearance.strokeWidth!)) : 1.5;
  const body = variant.paths.map(path => {
    const attributes = path.stroke && path.stroke!=='none' ? {...path,'stroke-width':String(width)} : path;
    return `<path ${Object.entries(attributes).map(([key, value]) => `${key}="${value === 'currentColor' ? paint : value}"`).join(' ')}/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${config.size}" height="${config.size}" viewBox="${variant.viewBox}" fill="none">${defs}${config.mode==='solid'&&alpha!==1?`<g opacity="${alpha}">${body}</g>`:body}</svg>`;
}
export function svgDataUrl(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
export function filterCatalog(q: string, category: string) {
  const needle = q.trim().toLocaleLowerCase();
  return catalog.filter(item => (!category || item.category === category) && `${item.id} ${item.nameZh} ${item.nameEn} ${item.category}`.toLocaleLowerCase().includes(needle));
}
export type FileFormat = 'svg' | 'png' | 'webp';
export async function exportBlob(svg: string, format: FileFormat, size: number): Promise<Blob> {
  if (format === 'svg') return new Blob([svg], { type: 'image/svg+xml' });
  // All inputs are immutable snapshots, independent of later UI changes.
  const image = new Image();
  image.src = svgDataUrl(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw Error('Canvas unavailable');
  context.drawImage(image, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob && blob.type === `image/${format}` ? resolve(blob) : reject(Error('Export unavailable')), `image/${format}`, 1));
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
