import type { Project } from '../types';
import { blobToDataURL,dataURLToBlob,deleteModelAsset,getModelAsset,putModelAsset } from './assets';
import { validateGLB } from './modelValidation';
import { isProject } from './validation';
type AssetAccess={get:(id:string)=>Promise<Blob|null>;put:(id:string,blob:Blob)=>Promise<void>;delete:(id:string)=>Promise<void>;encode:(blob:Blob)=>Promise<string>};
const browserAssets:AssetAccess={get:getModelAsset,put:putModelAsset,delete:deleteModelAsset,encode:blobToDataURL};

export async function portableProject(project:Project,assets:AssetAccess=browserAssets):Promise<Project>{
  const copy=structuredClone(project);delete copy.resources;
  const counts=new Map<string,number>(),encoded=new Map<string,string>();
  for(const f of copy.furniture)if(f.assetId)counts.set(f.assetId,(counts.get(f.assetId)??0)+1);
  for(const f of copy.furniture){
    if(!f.assetId)continue;const id=f.assetId;
    if(!encoded.has(id)){const blob=await assets.get(id);if(!blob)throw new Error(`Falta el modelo «${f.name}» en este navegador.`);encoded.set(id,await assets.encode(blob));}
    if(counts.get(id)!>1){
      copy.resources??=[];if(!copy.resources.some(r=>r.id===id))copy.resources.push({id,data:encoded.get(id)!});
      delete f.modelData;
    }else{f.modelData=encoded.get(id);delete f.assetId;}
  }
  if(new Blob([JSON.stringify(copy,null,2)]).size>64*1024*1024)throw new Error('El proyecto portable supera 64 MB. Divide el diseño en propuestas más pequeñas antes de exportar.');
  return copy;
}

/** Atomic hydration: never replace browser data with foreign IDs or leak partial writes. */
export async function hydratePortableProject(input:unknown,assets:AssetAccess=browserAssets):Promise<Project>{
  if(!isProject(input))throw new Error('El archivo no contiene un proyecto compatible.');
  const copy=structuredClone(input),resources=new Map((copy.resources??[]).map(r=>[r.id,r.data]));
  const created:string[]=[],remapped=new Map<string,string>();
  try{
    for(const f of copy.furniture)if(f.kind==='model'&&f.assetId&&!f.modelData&&!resources.has(f.assetId)&&!await assets.get(f.assetId)){
      throw new Error(`Falta el modelo «${f.name}» en este navegador. Importa un JSON portable con los modelos incluidos.`);
    }
    for(const [oldId,data] of resources){
      const blob=dataURLToBlob(data);await validateGLB(blob);const existing=await assets.get(oldId);
      if(existing&&existing.size===blob.size){
        const [a,b]=await Promise.all([existing.arrayBuffer(),blob.arrayBuffer()]);
        const first=new Uint8Array(a),second=new Uint8Array(b);
        if(first.every((value,index)=>value===second[index])){remapped.set(oldId,oldId);continue;}
      }
      const id=crypto.randomUUID();await assets.put(id,blob);created.push(id);remapped.set(oldId,id);
    }
    for(const f of copy.furniture){
      if(f.kind!=='model')continue;
      if(f.modelData){const blob=dataURLToBlob(f.modelData);await validateGLB(blob);const id=crypto.randomUUID();await assets.put(id,blob);created.push(id);f.assetId=id;delete f.modelData;}
      else if(f.assetId&&remapped.has(f.assetId))f.assetId=remapped.get(f.assetId);
    }
    delete copy.resources;return copy;
  }catch(error){await Promise.allSettled(created.map(id=>assets.delete(id)));throw error;}
}
