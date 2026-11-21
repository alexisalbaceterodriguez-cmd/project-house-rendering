import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from '../store';

describe('structural sharing between edits', () => {
  beforeEach(() => useEditor.getState().reset());

  it('keeps unchanged furniture, walls and rooms by identity', () => {
    const before = useEditor.getState().project;
    const moved = before.furniture[0].id;
    useEditor.getState().change(p => { p.furniture[0].x += .1; });
    const after = useEditor.getState().project;
    expect(after).not.toBe(before);
    expect(after.furniture[0]).not.toBe(before.furniture[0]);
    expect(after.furniture[0].id).toBe(moved);
    expect(after.furniture[0].x).toBeCloseTo(before.furniture[0].x + .1);
    after.furniture.slice(1).forEach((item, i) => expect(item).toBe(before.furniture[i + 1]));
    expect(after.walls).toBe(before.walls);
    expect(after.rooms).toBe(before.rooms);
    expect(after.palette).toBe(before.palette);
  });

  it('shares nothing it should not: added, removed and edited items are new', () => {
    const before = useEditor.getState().project;
    useEditor.getState().change(p => { p.furniture.pop(); p.walls[0].thickness += .01; });
    const after = useEditor.getState().project;
    expect(after.furniture).not.toBe(before.furniture);
    expect(after.furniture).toHaveLength(before.furniture.length - 1);
    expect(after.walls[0]).not.toBe(before.walls[0]);
    expect(after.walls[0].thickness).toBeCloseTo(before.walls[0].thickness + .01);
    expect(after.walls[1]).toBe(before.walls[1]);
  });

  it('undo restores the earlier objects and a later edit never alters history', () => {
    const before = useEditor.getState().project;
    const x = before.furniture[1].x;
    useEditor.getState().change(p => { p.furniture[0].x += .1; });
    useEditor.getState().change(p => { p.furniture[1].x += .2; });
    expect(before.furniture[1].x).toBe(x);
    useEditor.getState().undo(); useEditor.getState().undo();
    expect(useEditor.getState().project).toBe(before);
  });
});
