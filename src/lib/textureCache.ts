import { useSyncExternalStore } from 'react';
import { isTextureReference } from './materialValidation';
import { resolveTextureMap } from './materialLibrary';

type TextureState={data?:string;pending?:Promise<void>;error?:string};
const cache=new Map<string,TextureState>(),listeners=new Set<()=>void>();
let revision=0;
const notify=()=>{revision++;queueMicrotask(()=>listeners.forEach(listener=>listener()));};
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function useTextureLibraryRevision(){return useSyncExternalStore(subscribe,()=>revision);}
const states=(references?:string[])=>references?[...new Set(references)].flatMap(id=>cache.has(id)?[cache.get(id)!]:[]):[...cache.values()];
export const textureMapsPending=(references?:string[])=>states(references).some(state=>!!state.pending);
export const textureMapErrors=(references?:string[])=>[...new Set(states(references).flatMap(state=>state.error?[state.error]:[]))];
export function retryTextureMaps(){for(const [id,state] of cache)if(state.error)cache.delete(id);notify();}
/** Suspense waits for IndexedDB as well as the image loader. Failures keep the definition and its physical settings. */
export function readTextureMap(value:string):string|undefined{
  if(!isTextureReference(value))return value;
  let state=cache.get(value);
  if(!state){
    state={};cache.set(value,state);
    const entry=state;
    entry.pending=resolveTextureMap(value).then(data=>{entry.data=data;},error=>{entry.error=error instanceof Error?error.message:'No se pudo cargar un mapa. Reintenta o importa su JSON portable.';})
      .finally(()=>{delete entry.pending;notify();});
    notify();
  }
  if(state.pending)throw state.pending;
  return state.data;
}
