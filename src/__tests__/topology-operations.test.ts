import { describe, expect, it } from 'vitest';
import { blankProject } from '../data/defaultProject';
import { mergeInteriorWalls, normalizeInteriorIntersections, reconcileRooms, roomArea, splitInteriorWall, updateWallGeometry } from '../lib/topology';
import { isProject } from '../lib/validation';
import type { Project, Wall } from '../types';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall =>
  ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: .12 });
const openingCenter = (project: Project, id: string) => {
  const opening = project.openings.find(o => o.id === id)!;
  const host = project.walls.find(w => w.id === opening.wallId)!;
  return { x: host.a.x + (host.b.x - host.a.x) * opening.offset,
    y: host.a.y + (host.b.y - host.a.y) * opening.offset };
};

describe('Operaciones recientes de muros: conservación y rechazo atómico', () => {
  it('divide conservando posición física y referencias de puertas en ambos segmentos', () => {
    const p = blankProject();
    p.walls.push(wall('host', 1, 3, 9, 3));
    for (const [id, offset] of [['left', .25], ['right', .75]] as const) {
      p.openings.push({ id, wallId: 'host', kind: 'door', offset, width: .8, height: 2, sill: 0 });
    }
    const before = p.openings.map(o => openingCenter(p, o.id));
    expect(splitInteriorWall(p, 'host')).toBe(true);
    expect(p.openings.map(o => openingCenter(p, o.id))).toEqual(before);
    expect(p.openings[0].wallId).toBe('host');
    expect(p.openings[1].wallId).not.toBe('host');
    expect(isProject(p)).toBe(true);
  });

  it('rechaza cortar por una puerta sin modificar geometría, habitaciones ni referencias', () => {
    const p = blankProject();
    p.walls.push(wall('host', 1, 3, 9, 3));
    p.openings.push({ id: 'door', wallId: 'host', kind: 'door', offset: .5, width: .8, height: 2, sill: 0 });
    const before = structuredClone(p);
    expect(splitInteriorWall(p, 'host')).toBe(false);
    expect(p).toEqual(before);
  });

  it('normaliza T y X, conserva 60 m² y admite repetir sin nuevas modificaciones', () => {
    const p = blankProject();
    p.walls.push(wall('horizontal', 0, 3, 10, 3), wall('vertical', 5, 0, 5, 6), wall('branch', 2, 1, 2, 3));
    expect(normalizeInteriorIntersections(p)).toEqual({ tJunctions: 1, xCrossings: 1 });
    expect(p.rooms.reduce((sum, room) => sum + roomArea(room), 0)).toBeCloseTo(60);
    expect(isProject(p)).toBe(true);
    const before = structuredClone(p);
    expect(normalizeInteriorIntersections(p)).toEqual({ tJunctions: 0, xCrossings: 0 });
    expect(p).toEqual(before);
  });

  it('fusiona segmentos con sentidos opuestos sin mover la puerta', () => {
    const p = blankProject();
    p.walls.push(wall('first', 1, 2, 5, 2), wall('second', 9, 2, 5, 2));
    p.openings.push({ id: 'door', wallId: 'second', kind: 'door', offset: .25, width: .8, height: 2, sill: 0 });
    const before = openingCenter(p, 'door');
    expect(mergeInteriorWalls(p, 'first', 'second')).toBe(true);
    expect(openingCenter(p, 'door')).toEqual(before);
    expect(p.openings[0].wallId).toBe('first');
    expect(p.walls.some(w => w.id === 'second')).toBe(false);
    expect(isProject(p)).toBe(true);
  });

  it('arrastra el muro anfitrión manteniendo el extremo de su unión T', () => {
    const p = blankProject();
    p.walls.push(wall('host', 1, 3, 9, 3), wall('branch', 5, 1, 5, 3));
    updateWallGeometry(p, 'host', { x: 1, y: 4 }, { x: 9, y: 4 });
    expect(p.walls.find(w => w.id === 'branch')!.b).toEqual({ x: 5, y: 4 });
    reconcileRooms(p);
    expect(isProject(p)).toBe(true);
  });
});
