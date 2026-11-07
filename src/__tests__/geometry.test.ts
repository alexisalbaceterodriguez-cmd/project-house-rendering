import { describe, expect, it } from 'vitest';
import { demoProject } from '../data/defaultProject';
import { distance, wallParts, wallProjection } from '../lib/geometry';
import { isProject } from '../store';
import type { Wall, Opening } from '../types';

describe('Proyecto inicial',()=>{
  it('tiene superficie total de 60 m²',()=>{
    expect(demoProject.width*demoProject.depth).toBe(60);
    expect(demoProject.rooms.reduce((sum,r)=>sum+r.w*r.d,0)).toBeCloseTo(60,3);
  });
  it('incluye tres dormitorios y dos baños',()=>{
    expect(demoProject.rooms.filter(r=>r.kind==='bedroom')).toHaveLength(3);
    expect(demoProject.rooms.filter(r=>r.kind==='bathroom')).toHaveLength(2);
  });
  it('tiene una estructura serializable',()=>{
    expect(isProject(JSON.parse(JSON.stringify(demoProject)))).toBe(true);
    expect(isProject({version:1,width:-8})).toBe(false);
  });
});
describe('Tabiques y huecos',()=>{
  const wall:Wall={id:'x',a:{x:0,y:0},b:{x:5,y:0},thickness:.15};
  it('proyecta un punto a la longitud de un muro',()=>{
    const result=wallProjection(wall,{x:2,y:2});
    expect(result.offset).toBeCloseTo(.4);
    expect(distance(result.point,{x:2,y:0})).toBeCloseTo(0);
  });
  it('recorta el muro para una puerta hasta el dintel',()=>{
    const opening:Opening={id:'d',wallId:'x',kind:'door',offset:.5,width:1,height:2.1,sill:0};
    const parts=wallParts(wall,[opening],2.6);
    expect(parts).toHaveLength(3);
    expect(parts.find(p=>p.from===2)?.bottom).toBeCloseTo(2.1);
    expect(parts.reduce((a,p)=>a+(p.to-p.from)*(p.top-p.bottom),0)).toBeCloseTo(5*2.6-2.1);
  });
  it('incluye alféizar y dintel para una ventana',()=>{
    const opening:Opening={id:'win',wallId:'x',kind:'window',offset:.5,width:1,height:1.2,sill:.8};
    const parts=wallParts(wall,[opening],2.6);
    expect(parts).toHaveLength(4);
    expect(parts.some(p=>p.bottom===0&&p.top===.8)).toBe(true);
    expect(parts.some(p=>p.bottom===2&&p.top===2.6)).toBe(true);
  });
});
