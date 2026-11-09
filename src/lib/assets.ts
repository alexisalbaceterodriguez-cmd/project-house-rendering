/** Browser-local model blobs, deliberately separate from project JSON/history. */
const DATABASE='atelier60-assets-v1';
const STORE='models';
function db():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('Este navegador no permite guardar modelos 3D.'));return;}
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('No se puede abrir IndexedDB.'));
  });
}
async function useStore<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,finish:(v:T)=>void,fail:(e:unknown)=>void)=>void):Promise<T>{
  const database=await db();
  return new Promise<T>((resolve,reject)=>{
    const tx=database.transaction(STORE,mode);
    let answer=undefined as T;let settled=false;
    const fail=(e:unknown)=>{if(!settled){settled=true;const error=e instanceof Error?e:new Error('Error al guardar el modelo.');reject(error.name==='QuotaExceededError'?new Error('Almacenamiento de modelos 3D lleno. Libera espacio del navegador o exporta una copia del proyecto.'):error);}};
    try{work(tx.objectStore(STORE),v=>{answer=v;},fail);}catch(e){fail(e);}
    tx.oncomplete=()=>{if(!settled){settled=true;resolve(answer); }database.close();};
    tx.onerror=()=>{fail(tx.error);database.close();};
    tx.onabort=()=>{fail(tx.error);database.close();};
  });
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

/** Enumerate reusable local GLB blobs without loading their contents into memory. */
export async function listModelAssets():Promise<{id:string;size:number}[]>{
  return useStore<{id:string;size:number}[]>('readonly',(store,finish,fail)=>{
    const entries:{id:string;size:number}[]=[];
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
}
