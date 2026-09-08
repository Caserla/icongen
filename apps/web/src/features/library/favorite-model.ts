import { catalog, styles, type LibraryStyle } from './core';
export function assetId(designId: string, style: LibraryStyle, version: string) {
  return `${designId}:${style}:${version}`;
}
export function findAsset(id: unknown) {
  if (typeof id !== 'string' || id.length > 180) return undefined;
  const [designId, style, version, extra] = id.split(':');
  const design = catalog.find(item=>item.id===designId && item.version===version);
  if (!design || extra !== undefined || !styles.includes(style as LibraryStyle)) return undefined;
  return { id, design, style: style as LibraryStyle };
}
