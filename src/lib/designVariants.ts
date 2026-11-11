import type { Project } from '../types';
/** Use one architecture/camera/light rig while comparing only finishes. */
export function applyAppearance(base:Project,variant:Project):Project{
  const signature=(p:Project)=>JSON.stringify({width:p.width,depth:p.depth,height:p.wallHeight,walls:p.walls.map(({id,a,b,thickness})=>({id,a,b,thickness})),openings:p.openings,furniture:p.furniture.map(({id,kind,x,y,w,d,h,rotation,assetId,modelUpAxis,modelElevation,modelOffsetX,modelOffsetZ})=>({id,kind,x,y,w,d,h,rotation,assetId,modelUpAxis,modelElevation,modelOffsetX,modelOffsetZ}))});
  if(signature(base)!==signature(variant))throw new Error('Las propuestas tienen distinta geometría. Guarda dos versiones cambiando solo acabados para compararlas.');
  const result=structuredClone(base);result.palette=structuredClone(variant.palette);
  for(const room of result.rooms){const source=variant.rooms.find(r=>r.id===room.id);if(source){room.floor=source.floor;room.materialId=source.materialId;}}
  for(const wall of result.walls)wall.materialId=variant.walls.find(w=>w.id===wall.id)?.materialId;
  for(const item of result.furniture){const source=variant.furniture.find(f=>f.id===item.id)!;item.color=source.color;item.materialId=source.materialId;item.modelFinish=structuredClone(source.modelFinish);item.modelFinishes=structuredClone(source.modelFinishes);item.module=structuredClone(source.module);}
  return result;
}
