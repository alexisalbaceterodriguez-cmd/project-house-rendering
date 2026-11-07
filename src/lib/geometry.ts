import type { Opening, Point, Wall } from '../types';
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const snap = (v: number, step = 0.1) => Math.round(v / step) * step;
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export const wallLength = (wall: Wall) => distance(wall.a, wall.b);
export function wallProjection(wall: Wall, p: Point): { offset: number; point: Point } {
  const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y;
  const sq = dx * dx + dy * dy;
  const offset = sq === 0 ? 0 : clamp(((p.x - wall.a.x) * dx + (p.y - wall.a.y) * dy) / sq, 0, 1);
  return { offset, point: { x: wall.a.x + offset * dx, y: wall.a.y + offset * dy } };
}
export type WallPart = { from: number; to: number; bottom: number; top: number };
/** Solid wall segments around real voids: full-height spans, lintels, and window sills. */
export function wallParts(wall: Wall, openings: Opening[], wallHeight: number): WallPart[] {
  const length = wallLength(wall);
  if (length < 0.001) return [];
  const spans = openings.filter(o => o.wallId === wall.id)
    .map(o => ({ start: clamp(o.offset * length - o.width / 2, 0, length), end: clamp(o.offset * length + o.width / 2, 0, length), o }))
    .sort((a, b) => a.start - b.start);
  const parts: WallPart[] = [];
  let cursor = 0;
  for (const { start, end, o } of spans) {
    if (start > cursor + 0.001) parts.push({ from: cursor, to: start, bottom: 0, top: wallHeight });
    if (start < cursor - 0.001 || end <= cursor) continue;
    const bottom = clamp(o.sill, 0, wallHeight);
    const top = clamp(o.sill + o.height, 0, wallHeight);
    if (bottom > 0) parts.push({ from: start, to: end, bottom: 0, top: bottom });
    if (top < wallHeight) parts.push({ from: start, to: end, bottom: top, top: wallHeight });
    cursor = end;
  }
  if (cursor < length - 0.001) parts.push({ from: cursor, to: length, bottom: 0, top: wallHeight });
  return parts;
}
export const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const download = (filename: string, data: string | Blob, mime = 'application/json') => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement('a'); const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
};
export const fileSafe = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
