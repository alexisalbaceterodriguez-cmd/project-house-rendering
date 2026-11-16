import type { CustomMaterial, Project, Selection } from '../types';
import { materialCatalog, materialUrl } from '../data/materialCatalog';

import { MAX_MATERIAL_MAP_LENGTH } from './materialValidation';
export { validCustomMaterials } from './materialValidation';

export function resolveMaterial(project:Pick<Project,'materials'>,id?:string):CustomMaterial|undefined {
  if (!id) return;
  const custom=project.materials?.find(material=>material.id===id);
  if (custom) return custom;
  const builtIn=materialCatalog.find(material=>material.id===id);
  if (builtIn) return {...builtIn,color:'#ffffff',normalStrength:1,maps:{
    color:materialUrl(builtIn,'color'),normal:materialUrl(builtIn,'normal'),roughness:materialUrl(builtIn,'roughness'),
  }};
}

export type MaterialTarget='selection'|'floors'|'walls';
/** Shared by the library and workshop; one edit remains one undo operation. */
export function assignMaterial(project:Project,id:string,target:MaterialTarget,selection:Selection):void {
  if (target==='floors') {project.rooms.forEach(room=>{room.materialId=id||undefined;});return;}
  if (target==='walls') {project.walls.forEach(wall=>{wall.materialId=id||undefined;});return;}
  if (!selection || selection.type==='opening') throw new Error('Selecciona una estancia, pared u objeto para aplicar el material.');
  if (selection.type==='room') {const room=project.rooms.find(room=>room.id===selection.id);if(room)room.materialId=id||undefined;}
  if (selection.type==='wall') {const wall=project.walls.find(wall=>wall.id===selection.id);if(wall)wall.materialId=id||undefined;}
  if (selection.type==='furniture') {
    const item=project.furniture.find(item=>item.id===selection.id);if(!item)return;
    if (item.kind!=='model') item.materialId=id||undefined;
    else if (!id) {if(item.modelFinish)delete item.modelFinish.materialId;}
    else {
      const material=resolveMaterial(project,id);
      item.modelFinish={...(item.modelFinish??{color:'#ffffff',roughness:.8,metalness:0}),
        ...(material?{color:material.color,roughness:material.roughness,metalness:material.metalness}:{}),materialId:id};
    }
  }
}

/** Decode and resize before adding pixels to a project. Imported maps travel with JSON. */
export async function prepareMaterialMap(file:File,map:'color'|'normal'|'roughness'):Promise<string> {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 16*1024*1024)
    throw new Error('Elige una textura PNG, JPEG o WebP de hasta 16 MB.');
  const bitmap=await createImageBitmap(file);
  try {
    if (bitmap.width>8192 || bitmap.height>8192) throw new Error('La textura debe tener como máximo 8192 píxeles por lado.');
    const factor=Math.min(1,1024/bitmap.width,1024/bitmap.height);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));
    const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo procesar la textura.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',map==='normal'?.95:.9);
    if(data.length>MAX_MATERIAL_MAP_LENGTH)throw new Error('La textura procesada sigue siendo demasiado grande. Usa una imagen con menos detalle o resolución.');
    return data;
  } finally {bitmap.close();}
}
