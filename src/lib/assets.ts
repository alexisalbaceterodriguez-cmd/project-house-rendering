/** Browser-local model blobs, deliberately separate from project JSON/history. */
import { openBrowserDatabase } from './browserDatabase';
const DATABASE='atelier60-assets-v1';
const STORE='models';
const META_STORE='model-metadata';
export type ModelMetadata={name:string;source?:string;license?:string;w?:number;d?:number;h?:number;thumbnail?:string};
const db=()=>openBrowserDatabase({name:DATABASE,version:2,upgrade:database=>{
  if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE);
  if(!database.objectStoreNames.contains(META_STORE))database.createObjectStore(META_STORE);
}});
async function useStore<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,finish:(v:T)=>void,fail:(e:unknown)=>void)=>void,storeName=STORE):Promise<T>{
  const database=await db();
  return new Promise<T>((resolve,reject)=>{
    let tx:IDBTransaction;
    try{tx=database.transaction(storeName,mode);}catch(error){database.close();reject(error);return;}
    let answer=undefined as T;let settled=false;
    const fail=(e:unknown)=>{if(!settled){settled=true;const error=e instanceof Error?e:new Error('Error al guardar el modelo.');reject(error.name==='QuotaExceededError'?new Error('Almacenamiento de modelos 3D lleno. Libera espacio del navegador o exporta una copia del proyecto.'):error);}};
    tx.oncomplete=()=>{if(!settled){settled=true;resolve(answer); }database.close();};
    tx.onerror=()=>{fail(tx.error);database.close();};
    tx.onabort=()=>{fail(tx.error);database.close();};
    try{work(tx.objectStore(storeName),v=>{answer=v;},fail);}catch(e){fail(e);tx.abort();}
  });
}
/** Metadata survives removal of an instance and is independent of project JSON. */
export async function putModelMetadata(id:string,metadata:ModelMetadata):Promise<void>{
  return useStore<void>('readwrite',store=>{store.put(metadata,id);},META_STORE);
}
export async function getModelMetadata(id:string):Promise<ModelMetadata|null>{
  return useStore<ModelMetadata|null>('readonly',(store,finish)=>{
    const request=store.get(id);request.onsuccess=()=>finish(request.result??null);
  },META_STORE);
}
export async function deleteModelMetadata(id:string):Promise<void>{
  return useStore<void>('readwrite',store=>{store.delete(id);},META_STORE);
}
export async function putModelAsset(id:string,blob:Blob):Promise<void>{
  if(!id||blob.size>12*1024*1024)throw Error('El modelo excede los 12 MB permitidos.');
  return useStore<void>('readwrite',store=>{store.put(blob,id);});
}
export async function getModelAsset(id:string):Promise<Blob|null>{
  return useStore<Blob|null>('readonly',(store,finish,fail)=>{
    const req=store.get(id);
    req.onsuccess=()=>finish(req.result instanceof Blob?req.result:null);
    req.onerror=()=>fail(req.error);
  });
}
export async function blobToDataURL(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
}
export function dataURLToBlob(input:string):Blob{
  const [head,data]=input.split(',',2);
  if(!head?.startsWith('data:')||!data||!head.includes(';base64'))throw Error('Modelo embebido no válido.');
  const bytes=atob(data);
  const arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);
  return new Blob([arr],{type:head.slice(5,head.indexOf(';'))||'model/gltf-binary'});
}

/** Remove assets written during a failed multi-model import. */
export async function deleteModelAsset(id:string):Promise<void>{
  return useStore<void>('readwrite',store=>{store.delete(id);});
}

/** Library removal is all-or-nothing, including metadata. Recheck references after opening IDB. */
export async function deleteModelResource(id:string,assertUnused:()=>void):Promise<void>{
  const database=await db();
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction;
    try{
      assertUnused();
      tx=database.transaction([STORE,META_STORE],'readwrite');
    }catch(error){database.close();reject(error);return;}
    tx.oncomplete=()=>{database.close();resolve();};
    tx.onerror=tx.onabort=()=>{database.close();reject(new Error('No se pudo eliminar el recurso. El archivo y sus datos se conservan.'));};
    try{tx.objectStore(STORE).delete(id);tx.objectStore(META_STORE).delete(id);}
    catch(error){tx.abort();database.close();reject(error);}
  });
}

/** Enumerate reusable local GLB blobs without loading their contents into memory. */
export async function listModelAssets():Promise<{id:string;size:number;metadata?:ModelMetadata}[]>{
  const models=await useStore<{id:string;size:number;metadata?:ModelMetadata}[]>('readonly',(store,finish,fail)=>{
    const entries:{id:string;size:number;metadata?:ModelMetadata}[]=[];
    const request=store.openCursor();
    request.onsuccess=()=>{
      const cursor=request.result;
      if(!cursor){finish(entries);return;}
      if(typeof cursor.key==='string' && cursor.value instanceof Blob){
        entries.push({id:cursor.key,size:cursor.value.size});
      }
      cursor.continue();
    };
    request.onerror=()=>fail(request.error);
  });
  return Promise.all(models.map(async model=>({...model,metadata:await getModelMetadata(model.id)??undefined})));
}
