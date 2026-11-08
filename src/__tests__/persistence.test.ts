import { describe, expect, it } from 'vitest';
import { blankProject, demoProject } from '../data/defaultProject';
import { isProject } from '../lib/validation';
import { reconcileRooms, resizeProject, roomArea } from '../lib/topology';

describe('F0: portabilidad y validación del proyecto', () => {
  it('acepta redimensionar un plano nuevo desde el editor', () => {
    const project = blankProject();
    project.name = 'Vivienda E2E';
    expect(isProject(project)).toBe(true);
    resizeProject(project, 12, 7);
    expect(project.width).toBe(12);
    expect(project.depth).toBe(7);
    expect(isProject(project)).toBe(true);
    expect(project.rooms.reduce((total, room) => total + roomArea(room), 0)).toBeCloseTo(84);
  });

  it('conserva la geometría y los metadatos al exportar e importar JSON', () => {
    const original = structuredClone(demoProject);
    reconcileRooms(original);
    const restored: unknown = JSON.parse(JSON.stringify(original));
    expect(isProject(restored)).toBe(true);
    if (!isProject(restored)) return;
    expect(restored).toEqual(original);
    expect(restored.rooms.reduce((total, room) => total + roomArea(room), 0)).toBeCloseTo(60);
  });

  it('mantiene un proyecto redimensionado válido tras serializarlo', () => {
    const project = structuredClone(demoProject);
    resizeProject(project, 12, 8);
    const restored: unknown = JSON.parse(JSON.stringify(project));
    expect(isProject(restored)).toBe(true);
    if (!isProject(restored)) return;
    expect(restored.width * restored.depth).toBe(96);
    expect(restored.rooms.reduce((total, room) => total + roomArea(room), 0)).toBeCloseTo(96);
  });

  it('rechaza IDs de muros duplicados y aberturas huérfanas', () => {
    const project = structuredClone(demoProject);
    project.walls[1].id = project.walls[0].id;
    expect(isProject(project)).toBe(false);
    project.walls[1].id = 'wall-unique-regression';
    project.openings[0].wallId = 'wall-that-does-not-exist';
    expect(isProject(project)).toBe(false);
  });

  it('rechaza vértices y huecos de recintos no finitos', () => {
    const project = structuredClone(demoProject);
    project.rooms[0].vertices = [{ x: 0, y: 0 }, { x: 1, y: Infinity }, { x: 1, y: 1 }];
    expect(isProject(project)).toBe(false);
    project.rooms[0].vertices = undefined;
    project.rooms[0].holes = [[{ x: 0, y: 0 }, { x: 1, y: NaN }, { x: 1, y: 1 }]];
    expect(isProject(project)).toBe(false);
  });
});
