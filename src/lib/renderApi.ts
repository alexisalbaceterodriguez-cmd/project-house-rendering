/** Client for the local Atelier render engine (render-engine/, Blender + Cycles). */
export type JobStatus='queued'|'running'|'succeeded'|'failed'|'canceled';
export type RenderJob={
  id:string;status:JobStatus;createdAt:string;startedAt:string|null;finishedAt:string|null;
  project:{id:string;name:string};
  settings?:{width:number;height:number;samples:number;quality:string;lighting:string;passes:string[]};hasPreview?:boolean;
  progress:{stage:string;fraction:number;sample?:number;samples?:number};
  error?:{code:string;message:string}|null;
  result?:{device?:string;renderSeconds?:number;totalSeconds?:number;samples?:number;width?:number;height?:number;blender?:string;image?:{meanLuminance:number;clippedRatio:number;blackRatio:number}}|null;
  reused?:boolean;
};
export type RenderOutput={name:string;contentType:string;bytes:number;url:string};
export type EngineHealth={status:string;engine:string;blender:boolean;device:string;queue:number;maxQueue:number};

export const ENGINE_URL_KEY='atelier-60-render-engine';
export const DEFAULT_ENGINE_URL='http://127.0.0.1:8765';
export const FINAL_STATUSES:JobStatus[]=['succeeded','failed','canceled'];

export function engineUrl():string{
  try{return localStorage.getItem(ENGINE_URL_KEY)||DEFAULT_ENGINE_URL;}catch{return DEFAULT_ENGINE_URL;}
}
export function setEngineUrl(url:string){
  const clean=normaliseEngineUrl(url);
  try{if(clean===DEFAULT_ENGINE_URL)localStorage.removeItem(ENGINE_URL_KEY);else localStorage.setItem(ENGINE_URL_KEY,clean);}catch{/* per-browser convenience only */}
  return clean;
}
export function normaliseEngineUrl(url:string):string{
  const parsed=new URL(url.trim());
  if(parsed.protocol!=='http:'&&parsed.protocol!=='https:')throw new Error('La dirección del motor debe empezar por http:// o https://.');
  if(parsed.username||parsed.password)throw new Error('La dirección del motor no puede incluir credenciales.');
  return parsed.origin;
}

async function call<T>(path:string,init?:RequestInit,base=engineUrl()):Promise<T>{
  let response:Response;
  try{response=await fetch(base+path,{...init,mode:'cors'});}
  catch{throw new Error(`No hay conexión con el motor de render en ${base}. Inícialo con «python -m atelier_engine» dentro de render-engine/.`);}
  const body=await response.json().catch(()=>null) as {error?:{code:string;message:string}}|null;
  if(!response.ok)throw new Error(body?.error?.message??`El motor respondió ${response.status}.`);
  return body as T;
}
export const engineHealth=(base?:string)=>call<EngineHealth>('/health',undefined,base);
export const submitRender=(zip:Blob,idempotencyKey:string)=>call<RenderJob>('/renders',{method:'POST',body:zip,headers:{'Content-Type':'application/zip','Idempotency-Key':idempotencyKey}});
export const getRender=(id:string)=>call<RenderJob>(`/renders/${encodeURIComponent(id)}`);
export const listRenders=()=>call<{jobs:RenderJob[]}>('/renders').then(r=>r.jobs);
export const renderOutputs=(id:string)=>call<{outputs:RenderOutput[]}>(`/renders/${encodeURIComponent(id)}/outputs`).then(r=>r.outputs);
export const cancelRender=(id:string)=>call<RenderJob>(`/renders/${encodeURIComponent(id)}/cancel`,{method:'POST'});
export const outputUrl=(id:string,name:string)=>`${engineUrl()}/renders/${encodeURIComponent(id)}/outputs/${encodeURIComponent(name)}`;

export const stageLabels:Record<string,string>={
  queued:'En cola',starting:'Iniciando Blender',import:'Importando geometría',camera:'Preparando cámara',
  lighting:'Colocando luces',configure:'Configurando Cycles',render:'Renderizando con Cycles',save:'Guardando imagen y pases',done:'Terminado',
};
