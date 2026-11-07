import { describe,expect,it } from 'vitest';
import { demoProject } from '../data/defaultProject';
import { enclosedFaces, overlapRectangle, pointInPolygon, polygonArea, projectWarnings, reconcileRooms, resizeProject, roomArea, updateWallGeometry } from '../lib/topology';
import type { Wall } from '../types';
const v=(x:number,y:number)=>({x,y});
const rect=(a:number,b:number,w:number,h:number):Wall[]=>[
 {id:'a',a:v(a,b),b:v(a+w,b),thickness:.12,outer:true},
 {id:'b',a:v(a+w,b),b:v(a+w,b+h),thickness:.12,outer:true},
 {id:'c',a:v(a+w,b+h),b:v(a,b+h),thickness:.12,outer:true},
 {id:'d',a:v(a,b+h),b:v(a,b),thickness:.12,outer:true},
];
describe('Topología',()=>{
 it('detecta la cara interior y excluye el infinito',()=>{
   const faces=enclosedFaces(rect(0,0,10,6),10,6);
   expect(faces).toHaveLength(1);
   expect(polygonArea(faces[0])).toBeCloseTo(60);
   expect(pointInPolygon({x:3,y:2},faces[0])).toBe(true);
 });
 it('subdivide la planta con un tabique apoyado en dos muros',()=>{
   const walls=[...rect(0,0,10,6),{id:'divider',a:v(4,0),b:v(4,6),thickness:.12}];
   const faces=enclosedFaces(walls,10,6);
   expect(faces.map(polygonArea).sort((a,b)=>a-b)).toEqual([24,36]);
 });
 it('maneja un cruce y varias caras de forma estable',()=>{
   const walls=[...rect(0,0,10,6),{id:'x',a:v(5,0),b:v(5,6),thickness:.12}, {id:'y',a:v(0,3),b:v(10,3),thickness:.12}];
   expect(enclosedFaces(walls,10,6).map(polygonArea)).toEqual([15,15,15,15]);
 });
 it('calcula solapamientos de una cara con una habitación',()=>{
   expect(overlapRectangle([v(0,0),v(6,0),v(6,4),v(0,4)],{x:2,y:1,w:2,d:2})).toBeCloseTo(4);
 });
 it('reconcilia el ejemplo conservando nombres y superficies de los siete espacios',()=>{
   const p=structuredClone(demoProject);reconcileRooms(p);
   expect(p.rooms).toHaveLength(7);
   expect(p.rooms.reduce((sum,r)=>sum+roomArea(r),0)).toBeCloseTo(60);
   expect(p.rooms.find(r=>r.id==='master')?.name).toBe('Dormitorio principal');
 });
 it('redimensiona el plano completo con los tabiques y muebles',()=>{
   const p=structuredClone(demoProject);
   const id='living-top',x=p.walls.find(w=>w.id===id)!.a.x;
   const original=p.furniture[0].w;
   resizeProject(p,12,8);
   expect(p.width*p.depth).toBe(96);
   expect(p.walls.find(w=>w.id===id)!.a.x).toBeCloseTo(x*1.2);
   expect(p.furniture[0].w).toEqual(original);
   expect(p.rooms.reduce((a,r)=>a+roomArea(r),0)).toBeCloseTo(96);
 });
 it('traslada un segmento y sus juntas coincidentes; no cambia el perímetro exterior',()=>{
   const p=structuredClone(demoProject),outer=structuredClone(p.walls.find(w=>w.id==='n'));
   updateWallGeometry(p,'bed-top',v(7.1,0),v(7.1,3));
   reconcileRooms(p);
   expect(p.walls.find(w=>w.id==='n')).toEqual(outer);
   expect(p.walls.find(w=>w.id==='bed-top')?.a.x).toBeCloseTo(7.1);
 });
 it('detecta elementos fuera de la planta',()=>{
   const p=structuredClone(demoProject);
   p.furniture[0].x=-1;
   expect(projectWarnings(p).some(x=>x.includes('Sofá'))).toBe(true);
 });
});

describe('Seguridad al abrir proyectos',()=>{
  it('rechaza coordenadas no numéricas, referencias rotas y geometría corrupta',async()=>{
    const { isProject }=await import('../lib/validation');
    const p=structuredClone(demoProject);
    expect(isProject(p)).toBe(true);
    p.furniture[0].x=Number.NaN;
    expect(isProject(p)).toBe(false);
    p.furniture[0].x=1;
    p.openings[0].wallId='does-not-exist';
    expect(isProject(p)).toBe(false);
  });
});
