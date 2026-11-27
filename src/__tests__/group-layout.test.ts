import { describe, expect, it } from 'vitest';
import { blankProject } from '../data/defaultProject';
import { alignFurniture, distributeFurniture, footprintHalf } from '../lib/groupLayout';
import { isProject } from '../store';
import type { Furniture, Project } from '../types';

const item = (id: string, x: number, y: number, w = 1, d = .5, rotation = 0): Furniture => ({ id, kind: 'sideboard', name: id, x, y, w, d, h: .8, rotation, color: '#c4a17b' });
const plan = (...items: Furniture[]): Project => ({ ...blankProject(10, 6), furniture: items });
const pos = (p: Project, id: string) => { const f = p.furniture.find(i => i.id === id)!; return [f.x, f.y]; };

describe('Alinear y distribuir un grupo de muebles', () => {
  it('calcula la huella girada', () => {
    expect(footprintHalf({ w: 2, d: 1, rotation: 0 })).toEqual({ x: 1, y: .5 });
    const turned = footprintHalf({ w: 2, d: 1, rotation: 90 });
    expect(turned.x).toBeCloseTo(.5);
    expect(turned.y).toBeCloseTo(1);
  });

  it('alinea los bordes izquierdo y derecho de las huellas, sin tocar el otro eje', () => {
    const p = plan(item('a', 2, 1, 2), item('b', 4, 3, 1), item('c', 6, 5, 1, .5, 90));
    alignFurniture(p, ['a', 'b', 'c'], 'left');
    // Borde izquierdo común en x = 1 (la huella de a empieza en 2 − 1).
    expect(pos(p, 'a')).toEqual([2, 1]);
    expect(pos(p, 'b')).toEqual([1.5, 3]);
    expect(pos(p, 'c')).toEqual([1.25, 5]); // girada 90°: su medio ancho en planta es 0,25
    alignFurniture(p, ['a', 'b', 'c'], 'right');
    expect(pos(p, 'a')).toEqual([2, 1]);
    expect(pos(p, 'b')).toEqual([2.5, 3]);
    expect(pos(p, 'c')).toEqual([2.75, 5]);
  });

  it('centra el grupo en vertical y alinea los fondos', () => {
    const p = plan(item('a', 2, 1), item('b', 4, 3, 1, 1), item('c', 6, 5));
    alignFurniture(p, ['a', 'b', 'c'], 'center-y');
    // Contorno de y 0,75 a 5,25: centro 3.
    expect(p.furniture.map(f => f.y)).toEqual([3, 3, 3]);
    alignFurniture(p, ['a', 'c'], 'bottom');
    expect(pos(p, 'a')).toEqual([2, 3]);
    expect(pos(p, 'c')).toEqual([6, 3]);
    expect(pos(p, 'b')).toEqual([4, 3]);
  });

  it('no deja ningún centro fuera del plano', () => {
    // La huella de a (2 m centrada en x = 0) sobresale del plano: b no puede seguirla más allá del borde.
    const p = plan(item('a', 0, 1, 2), item('b', 4, 2, .4));
    alignFurniture(p, ['a', 'b'], 'left');
    expect(pos(p, 'a')[0]).toBe(0);
    expect(pos(p, 'b')[0]).toBe(0);
    const q = plan(item('a', 10, 1, 2), item('b', 4, 2, .4));
    alignFurniture(q, ['a', 'b'], 'right');
    expect(pos(q, 'b')[0]).toBe(10);
    expect(isProject(q)).toBe(true);
  });

  it('reparte huecos iguales entre huellas de distinto tamaño, con los extremos fijos', () => {
    // Huellas: a 0..1, b (2 m) desordenada a la derecha, c 9..10 → hueco libre de 6 m repartido en 3 m.
    const p = plan(item('a', .5, 1), item('c', 9.5, 2), item('b', 8, 3, 2));
    distributeFurniture(p, ['a', 'b', 'c'], 'x');
    expect(pos(p, 'a')).toEqual([.5, 1]);
    expect(pos(p, 'b')).toEqual([5, 3]);
    expect(pos(p, 'c')).toEqual([9.5, 2]);
  });

  it('distribuye en vertical con la huella girada y exige al menos tres muebles', () => {
    const p = plan(item('a', 1, 1), item('b', 2, 1.6, 1, .5, 90), item('c', 3, 5));
    distributeFurniture(p, ['a', 'b', 'c'], 'y');
    // a ocupa 0,75..1,25, c 4,75..5,25, b mide 1 m en y: huecos de 1,25.
    expect(pos(p, 'b')).toEqual([2, 3]);
    const two = plan(item('a', 1, 1), item('b', 5, 5));
    distributeFurniture(two, ['a', 'b'], 'x');
    expect(two.furniture.map(f => [f.x, f.y])).toEqual([[1, 1], [5, 5]]);
  });
});
