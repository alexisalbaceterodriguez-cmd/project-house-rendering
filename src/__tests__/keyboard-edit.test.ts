import { describe, expect, it } from 'vitest';
import { blankProject } from '../data/defaultProject';
import { duplicateFurniture, nudgeFurniture, rotateFurniture } from '../lib/keyboardEdit';
import { isProject } from '../store';
import type { Furniture, Project } from '../types';

const item = (id: string, x: number, y: number, rotation = 0): Furniture => ({ id, kind: 'chair', name: `Silla ${id}`, x, y, w: .45, d: .5, h: .85, rotation, color: '#c4a17b' });
const plan = (...items: Furniture[]): Project => ({ ...blankProject(10, 6), furniture: items });
const at = (p: Project, id: string) => { const f = p.furniture.find(i => i.id === id)!; return [f.x, f.y, f.rotation]; };

describe('Edición de muebles con el teclado', () => {
  it('mueve solo los seleccionados y en bloque', () => {
    const p = plan(item('a', 2, 2), item('b', 3, 2.5), item('c', 5, 5));
    expect(nudgeFurniture(p, ['a', 'b'], .01, -.1)).toEqual({ dx: .01, dy: -.1 });
    expect(at(p, 'a')).toEqual([2.01, 1.9, 0]);
    expect(at(p, 'b')).toEqual([3.01, 2.4, 0]);
    expect(at(p, 'c')).toEqual([5, 5, 0]);
  });

  it('acorta el movimiento en el borde del plano sin deformar el grupo', () => {
    const p = plan(item('a', 9.95, 1), item('b', 9, 1.5));
    const moved = nudgeFurniture(p, ['a', 'b'], .1, 0);
    expect(moved.dx).toBeCloseTo(.05);
    expect(at(p, 'a')[0]).toBe(10);
    expect(at(p, 'b')[0]).toBe(9.05);
    // Al borde ya no se mueve más, en ningún eje bloqueado.
    expect(nudgeFurniture(p, ['a', 'b'], .1, 0).dx).toBe(0);
    expect(nudgeFurniture(plan(item('a', 0, 0)), ['a'], -.1, -.1)).toEqual({ dx: -0, dy: -0 });
  });

  it('gira un mueble en su sitio y normaliza el ángulo entre 0 y 360°', () => {
    const p = plan(item('a', 4, 3, 270));
    rotateFurniture(p, ['a'], 90);
    expect(at(p, 'a')).toEqual([4, 3, 0]);
    rotateFurniture(p, ['a'], -90);
    expect(at(p, 'a')).toEqual([4, 3, 270]);
  });

  it('gira un grupo alrededor de su centro en el sentido del plano', () => {
    // Mesa en (4, 3) y silla 1 m a su derecha: tras +90° (horario con y hacia abajo) la silla queda debajo.
    const p = plan({ ...item('mesa', 4, 3), kind: 'table' }, item('silla', 5, 3, 270));
    rotateFurniture(p, ['mesa', 'silla'], 90);
    expect(at(p, 'mesa')).toEqual([4.5, 2.5, 90]);
    expect(at(p, 'silla')).toEqual([4.5, 3.5, 0]);
    // La distancia entre ambos se conserva y cuatro giros devuelven el grupo a su sitio.
    for (let i = 0; i < 3; i++) rotateFurniture(p, ['mesa', 'silla'], 90);
    expect(at(p, 'mesa')).toEqual([4, 3, 0]);
    expect(at(p, 'silla')).toEqual([5, 3, 270]);
  });

  it('duplica la selección desplazada 25 cm con ids nuevos y el proyecto sigue siendo válido', () => {
    const p = plan(item('a', 2, 2, 45), item('b', 3, 2));
    let n = 0;
    const ids = duplicateFurniture(p, ['a', 'b'], () => `copia-${++n}`);
    expect(ids).toEqual(['copia-1', 'copia-2']);
    expect(p.furniture).toHaveLength(4);
    expect(at(p, 'copia-1')).toEqual([2.25, 2.25, 45]);
    expect(at(p, 'copia-2')).toEqual([3.25, 2.25, 0]);
    expect(p.furniture.find(f => f.id === 'copia-1')?.name).toBe('Silla a (copia)');
    expect(at(p, 'a')).toEqual([2, 2, 45]);
    expect(isProject(p)).toBe(true);
    // Sin selección no se añade nada.
    expect(duplicateFurniture(p, [], () => 'x')).toEqual([]);
    expect(p.furniture).toHaveLength(4);
  });
});
