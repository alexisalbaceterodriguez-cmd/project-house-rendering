import type { Project } from '../types';
import { migrateProject } from './projectSchema';
import { openBrowserDatabase } from './browserDatabase';
import { storeMaterialMaps } from './materialLibrary';
export type SavedDesign = { id:string; name:string; savedAt:string; project:Project };
// Separate database avoids invalidating the asset database used by existing projects.
const open = () => openBrowserDatabase({name:'atelier60-project-library',version:1,upgrade:db=>{
  if(!db.objectStoreNames.contains('designs'))db.createObjectStore('designs',{keyPath:'id'});
}});
async function transaction<T>(mode:IDBTransactionMode, work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await open();
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction;let result:T;
    try{tx=db.transaction('designs',mode);}catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(new Error('No se pudo guardar la versión. Exporta un JSON y comprueba el espacio del navegador.'));};
    try{const req=work(tx.objectStore('designs'));req.onsuccess=()=>{result=req.result;};}
    catch(error){tx.abort();db.close();reject(error);}
  });
}
export async function saveDesign(project:Project,name:string):Promise<SavedDesign>{
  const saved={id:crypto.randomUUID(),name:name.trim().slice(0,180)||project.name,savedAt:new Date().toISOString(),project:migrateProject(project)};
  if(saved.project.materials?.length)saved.project.materials=await storeMaterialMaps(saved.project.materials);
  await transaction('readwrite',store=>store.put(saved));return saved;
}
export async function listDesigns():Promise<SavedDesign[]>{
  return (await transaction<SavedDesign[]>('readonly',store=>store.getAll())).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
}
export async function deleteDesign(id:string):Promise<void>{await transaction('readwrite',store=>store.delete(id));}
