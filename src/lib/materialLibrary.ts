import type { CustomMaterial } from '../types';
import { openBrowserDatabase } from './browserDatabase';
import { isMaterialImage, isTextureReference, validCustomMaterials } from './materialValidation';

export const MATERIAL_DATABASE = 'atelier60-material-library';
export type LibraryMaterial = { key:string; material:CustomMaterial };
export type MaterialAccess = {
  get:(id:string)=>Promise<string|null>;
  commit:(textures:Map<string,string>,materials:LibraryMaterial[])=>Promise<void>;
};
const open=()=>openBrowserDatabase({name:MATERIAL_DATABASE,version:1,upgrade:db=>{
  db.createObjectStore('textures');db.createObjectStore('materials',{keyPath:'key'});
}});
const storageError=()=>new Error('No se pudo guardar o leer la biblioteca de materiales. Comprueba el espacio y los permisos del navegador y reintenta. El material activo se conserva.');

async function transaction<T>(stores:string[],mode:IDBTransactionMode,work:(tx:IDBTransaction,answer:(value:T)=>void)=>void):Promise<T>{
  const db=await open();
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction;let result:T;
    try{tx=db.transaction(stores,mode);}catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(storageError());};
    try{work(tx,value=>{result=value;});}catch{tx.abort();db.close();reject(storageError());}
  });
}
export const browserMaterials:MaterialAccess={
  get:id=>transaction<string|null>(['textures'],'readonly',(tx,answer)=>{
    const request=tx.objectStore('textures').get(id);request.onsuccess=()=>answer(request.result??null);
  }),
  commit:(textures,materials)=>transaction<void>(['textures','materials'],'readwrite',tx=>{
    for(const [id,data] of textures)tx.objectStore('textures').put(data,id);
    for(const material of materials)tx.objectStore('materials').put(material);
  }),
};
export async function textureDigest(data:string):Promise<string>{
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function resolveTextureMap(id:string,access:MaterialAccess=browserMaterials):Promise<string>{
  if(isMaterialImage(id))return id;
  if(!isTextureReference(id))throw new Error('Referencia de textura no válida.');
  const data=await access.get(id);
  if(!isMaterialImage(data)||`texture:${await textureDigest(data)}`!==id)
    throw new Error('Falta un mapa del material o está dañado. Reimporta su JSON portable o reintenta la carga. El acabado se conserva.');
  return data;
}
export async function embedMaterialMaps(materials:CustomMaterial[],access:MaterialAccess=browserMaterials):Promise<CustomMaterial[]>{
  const copy=structuredClone(materials),resolved=new Map<string,string>();
  for(const material of copy)for(const map of ['color','normal','roughness'] as const){
    const value=material.maps?.[map];if(!value)continue;
    if(!resolved.has(value))resolved.set(value,await resolveTextureMap(value,access));
    material.maps![map]=resolved.get(value)!;
  }
  if(!validCustomMaterials(copy))throw new Error('Máximo 64 materiales y 4 MB de mapas por proyecto. Divide los acabados entre propuestas.');
  return copy;
}
/** Immutable, content-addressed pixels and definitions. One atomic commit; no deletion or ID overwrite.
 * Keeping library entries also protects primary/backup saves, versions, A/B and every undo snapshot.
 */
export async function storeMaterialMaps(materials:CustomMaterial[],access:MaterialAccess=browserMaterials):Promise<CustomMaterial[]>{
  if(!validCustomMaterials(materials))throw new Error('Los materiales no son válidos.');
  if(!materials.length)return [];
  const copy=await embedMaterialMaps(materials,access),textures=new Map<string,string>(),entries:LibraryMaterial[]=[];
  for(const material of copy){
    for(const map of ['color','normal','roughness'] as const){
      const data=material.maps?.[map];if(!data)continue;
      const id=`texture:${await textureDigest(data)}`;textures.set(id,data);material.maps![map]=id;
    }
    entries.push({key:await textureDigest(JSON.stringify(material)),material});
  }
  await access.commit(textures,entries);
  return copy;
}
export async function listLibraryMaterials():Promise<LibraryMaterial[]>{
  const entries=await transaction<LibraryMaterial[]>(['materials'],'readonly',(tx,answer)=>{
    const request=tx.objectStore('materials').getAll();request.onsuccess=()=>answer(request.result);
  });
  if(entries.some(entry=>!entry||typeof entry.key!=='string'||!validCustomMaterials([entry.material])))
    throw new Error('Hay una definición dañada en la biblioteca. Importa una copia JSON del material para recuperarla.');
  return entries.sort((a,b)=>a.material.name.localeCompare(b.material.name));
}
