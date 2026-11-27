import type { Furniture, Project } from '../types';

/** Edge or centre the group lines up on: x is left/right in the plan, y top/bottom. */
export type Alignment = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
export type Axis = 'x' | 'y';

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** Half size of the item's footprint along the plan axes, taking its rotation into account. */
export function footprintHalf(f: Pick<Furniture, 'w' | 'd' | 'rotation'>) {
  const r = f.rotation * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  return { x: (f.w * c + f.d * s) / 2, y: (f.w * s + f.d * c) / 2 };
}

const selected = (p: Project, ids: readonly string[]) => p.furniture.filter(f => ids.includes(f.id));
const inside = (p: Project, f: Furniture) => { f.x = round(Math.min(p.width, Math.max(0, f.x))); f.y = round(Math.min(p.depth, Math.max(0, f.y))); };

/**
 * Line up the furniture `ids` on the group's outer footprint edge, or on the centre of that outline.
 * Edges use each rotated footprint, so a sofa and a side table against the same wall line up on their
 * backs, not on their centres. Only the aligned axis changes.
 */
export function alignFurniture(p: Project, ids: readonly string[], to: Alignment) {
  const items = selected(p, ids);
  if (items.length < 2) return;
  const axis: Axis = to === 'left' || to === 'center-x' || to === 'right' ? 'x' : 'y';
  const lo = Math.min(...items.map(f => f[axis] - footprintHalf(f)[axis]));
  const hi = Math.max(...items.map(f => f[axis] + footprintHalf(f)[axis]));
  for (const f of items) {
    const half = footprintHalf(f)[axis];
    f[axis] = to === 'left' || to === 'top' ? lo + half : to === 'right' || to === 'bottom' ? hi - half : (lo + hi) / 2;
    inside(p, f);
  }
}

/**
 * Space the furniture `ids` with equal gaps between footprints along `axis`, in their current order
 * (by centre). The first and last keep their place, so it needs at least three items. When the
 * footprints are longer than the span, the gaps are negative and the items overlap evenly.
 */
export function distributeFurniture(p: Project, ids: readonly string[], axis: Axis) {
  const items = selected(p, ids).sort((a, b) => a[axis] - b[axis]);
  if (items.length < 3) return;
  const halves = items.map(f => footprintHalf(f)[axis]);
  const start = items[0][axis] - halves[0], end = items[items.length - 1][axis] + halves[halves.length - 1];
  const gap = (end - start - halves.reduce((sum, h) => sum + 2 * h, 0)) / (items.length - 1);
  let edge = start;
  items.forEach((f, i) => { f[axis] = edge + halves[i]; edge += 2 * halves[i] + gap; inside(p, f); });
}
