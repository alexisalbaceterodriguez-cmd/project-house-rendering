import type { Project } from '../types';
import { migrateProject } from './projectSchema';
export type SavedDesign = { id:string; name:string; savedAt:string; project:Project };
// Separate database avoids invalidating the asset database used by existing projects.
const open = () => new Promise<IDBDatabase>((resolve,reject)=>{
  const req=indexedDB.open('atelier60-project-library',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('designs',{keyPath:'id'});
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(new Error('Cierra otras pestañas de Atelier 60 para guardar.'));
});
async function transaction<T>(mode:IDBTransactionMode, work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('designs',mode);let result:T;
    try{const req=work(tx.objectStore('designs'));req.onsuccess=()=>{result=req.result;};}
    catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(new Error('No se pudo guardar la versión. Exporta un JSON y comprueba el espacio del navegador.'));};
  });
}
export async function saveDesign(project:Project,name:string):Promise<SavedDesign>{
  const saved={id:crypto.randomUUID(),name:name.trim().slice(0,180)||project.name,savedAt:new Date().toISOString(),project:migrateProject(project)};
  await transaction('readwrite',store=>store.put(saved));return saved;
}
export async function listDesigns():Promise<SavedDesign[]>{
  return (await transaction<SavedDesign[]>('readonly',store=>store.getAll())).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
}
export async function deleteDesign(id:string):Promise<void>{await transaction('readwrite',store=>store.delete(id));}
