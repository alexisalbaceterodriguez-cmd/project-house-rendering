import { describe, expect, it } from 'vitest';
import { blankProject, demoProject } from '../data/defaultProject';
import { buildWallGraph, migrateProject } from '../lib/projectSchema';
import { applyAppearance } from '../lib/designVariants';
import { approximateNetArea, furnitureCollisions } from '../lib/diagnostics';
import { isProject } from '../lib/validation';
import { reconcileRooms, updateWallGeometry } from '../lib/topology';
import { materialCatalog } from '../data/materialCatalog';
import { modelCatalog } from '../data/modelCatalog';

describe('Contrato de producto y compatibilidad',()=>{
  it('migra v1 sin modificar el original ni perder identidad, geometría o acabados',()=>{
    const original=structuredClone(demoProject);original.rooms[0].materialId='wood';
    const saved=structuredClone(original),migrated=migrateProject(original);
    expect(original).toEqual(saved);expect(migrated.version).toBe(1);expect(migrated.schemaRevision).toBe(1);
    expect(migrated.walls).toEqual(saved.walls);expect(migrated.rooms).toEqual(saved.rooms);
    expect(migrateProject(migrated)).toEqual(migrated);
    expect(migrated.graph!.nodes.length).toBeGreaterThan(4);
    const ids=new Set(migrated.graph!.nodes.map(n=>n.id));
    expect(migrated.graph!.edges.every(e=>ids.has(e.from)&&ids.has(e.to))).toBe(true);
  });
  it('divide el grafo en un cruce X sin cambiar los segmentos del proyecto',()=>{
    const p=blankProject();p.walls.push({id:'a',a:{x:1,y:3},b:{x:9,y:3},thickness:.1},{id:'b',a:{x:5,y:1},b:{x:5,y:5},thickness:.1});
    const graph=buildWallGraph(p),joint=graph.nodes.find(n=>n.x===5&&n.y===3)!;
    expect(graph.edges.filter(e=>e.from===joint.id||e.to===joint.id)).toHaveLength(4);
    expect(p.walls).toHaveLength(6);
  });
  it('conserva el ID del nodo al mover una unión compartida',()=>{
    const p=migrateProject(blankProject());p.walls.push({id:'host',a:{x:1,y:3},b:{x:5,y:3},thickness:.1},{id:'branch',a:{x:5,y:3},b:{x:5,y:5},thickness:.1});
    p.graph=buildWallGraph(p);const id=p.graph.nodes.find(n=>n.x===5&&n.y===3)!.id;
    updateWallGeometry(p,'host',{x:1,y:3},{x:6,y:3});p.graph=buildWallGraph(p);
    expect(p.graph.nodes.find(n=>n.x===6&&n.y===3)?.id).toBe(id);
  });
  it('rechaza revisiones futuras, cámaras y transformaciones GLB no finitas',()=>{
    const p=structuredClone(demoProject);p.schemaRevision=2 as 1;expect(isProject(p)).toBe(false);
    delete p.schemaRevision;p.render={lighting:'day',quality:'high',exposure:1,camera:{position:[NaN,1,1],target:[0,0,0]}};expect(isProject(p)).toBe(false);
    delete p.render;p.furniture[0].modelOffsetX=Infinity;expect(isProject(p)).toBe(false);
  });
  it('reconciliar habitaciones conserva la textura asignada',()=>{
    const p=structuredClone(demoProject);p.rooms[0].materialId='wood';reconcileRooms(p);
    expect(p.rooms.find(r=>r.id==='living')?.materialId).toBe('wood');
  });
  it('compara solo acabados sin cambiar geometría, luz ni cámara',()=>{
    const a=migrateProject(demoProject);a.render={lighting:'night',quality:'high',exposure:.8,camera:{position:[10,7,8],target:[5,0,3]}};
    const b=structuredClone(a);b.rooms[0].materialId='tile';b.furniture[0].color='#aabbcc';b.render!.lighting='day';
    const result=applyAppearance(a,b);expect(result.rooms[0].materialId).toBe('tile');expect(result.furniture[0].color).toBe('#aabbcc');
    expect(result.walls).toEqual(a.walls);expect(result.render).toEqual(a.render);expect(a.rooms[0].materialId).toBeUndefined();
    b.walls[0].b.x+=1;expect(()=>applyAppearance(a,b)).toThrow('distinta geometría');
  });
  it('detecta colisiones de objetos rotados y descuenta espesores de forma aproximada',()=>{
    const p=migrateProject(demoProject);expect(approximateNetArea(p.rooms[0],p)).toBeLessThan(24);
    p.furniture=[{id:'1',kind:'table',name:'Mesa A',x:3,y:3,w:2,d:1,h:1,rotation:45,color:'#ffffff'},{id:'2',kind:'chair',name:'Silla B',x:3,y:3,w:.5,d:.5,h:1,rotation:0,color:'#ffffff'}];
    expect(furnitureCollisions(p).some(s=>s.includes('Mesa A')&&s.includes('Silla B'))).toBe(true);
    p.furniture[1].x=8;expect(furnitureCollisions(p).some(s=>s.includes('se solapa'))).toBe(false);
  });
  it('todos los recursos incorporados tienen identidad, origen y licencia explícitos',()=>{
    expect(new Set(modelCatalog.map(p=>p.id)).size).toBe(modelCatalog.length);
    expect(modelCatalog).toHaveLength(3);expect(materialCatalog).toHaveLength(4);
    for(const product of modelCatalog){expect(product.source).toMatch(/^https:\/\//);expect(product.license).toMatch(/^CC/);expect(product.attribution.length).toBeGreaterThan(10);}
  });
});
