import type { Project } from '../types';

/** Keyboard nudge steps in metres: arrow keys move 1 cm, with Shift 10 cm. */
export const NUDGE = { fine: .01, coarse: .1 };
/** Offset of keyboard duplicates, the same as the panel's Duplicar button. */
export const DUPLICATE_OFFSET = .25;

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const angle = (deg: number) => round(((deg % 360) + 360) % 360);

/**
 * Move the furniture `ids` by (dx, dy) metres as one block. The move is shortened so every centre stays
 * inside the plan, the same bounds the position fields use, and the group keeps its shape at the edge.
 * Returns the distance actually moved.
 */
export function nudgeFurniture(p: Project, ids: readonly string[], dx: number, dy: number) {
  const items = p.furniture.filter(f => ids.includes(f.id));
  if (!items.length) return { dx: 0, dy: 0 };
  const xs = items.map(f => f.x), ys = items.map(f => f.y);
  const mx = Math.min(Math.max(dx, -Math.min(...xs)), p.width - Math.max(...xs));
  const my = Math.min(Math.max(dy, -Math.min(...ys)), p.depth - Math.max(...ys));
  for (const f of items) { f.x = round(f.x + mx); f.y = round(f.y + my); }
  return { dx: mx, dy: my };
}

/**
 * Turn the furniture `ids` by `deg` degrees (clockwise in the plan, like the rotation field). A single
 * object turns in place; a group turns about the centre of its positions, so a table keeps its chairs.
 * Positions that would leave the plan are clamped to it.
 */
export function rotateFurniture(p: Project, ids: readonly string[], deg: number) {
  const items = p.furniture.filter(f => ids.includes(f.id));
  if (!items.length) return;
  const cx = (Math.min(...items.map(f => f.x)) + Math.max(...items.map(f => f.x))) / 2;
  const cy = (Math.min(...items.map(f => f.y)) + Math.max(...items.map(f => f.y))) / 2;
  const r = deg * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
  for (const f of items) {
    // SVG rotate(): y points down, so a positive angle turns clockwise on screen.
    const ox = f.x - cx, oy = f.y - cy;
    f.x = round(Math.min(p.width, Math.max(0, cx + ox * cos - oy * sin)));
    f.y = round(Math.min(p.depth, Math.max(0, cy + ox * sin + oy * cos)));
    f.rotation = angle(f.rotation + deg);
  }
}

/**
 * Copy the furniture `ids`, offset 25 cm down-right (shortened at the plan edge as a block), and return
 * the new ids in the same order. Names gain « (copia)» like the panel's Duplicar button.
 */
export function duplicateFurniture(p: Project, ids: readonly string[], makeId: () => string) {
  const items = p.furniture.filter(f => ids.includes(f.id));
  if (!items.length) return [];
  const copies = items.map(f => ({ ...structuredClone(f), id: makeId(), name: `${f.name} (copia)` }));
  p.furniture.push(...copies);
  const newIds = copies.map(c => c.id);
  nudgeFurniture(p, newIds, DUPLICATE_OFFSET, DUPLICATE_OFFSET);
  return newIds;
}
