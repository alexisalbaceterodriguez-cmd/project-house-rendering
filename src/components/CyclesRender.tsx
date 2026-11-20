import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../store';
import { download, fileSafe } from '../lib/geometry';
import { createRenderPackage } from '../lib/renderExport';
import { interiorLights, MAX_INTERIOR_LIGHTS, presetLabels, QUALITY_SAMPLES, type CyclesPreset, type CyclesQuality, type RenderPass } from '../lib/renderPackage';
import { cancelRender, engineHealth, engineUrl, FINAL_STATUSES, getRender, listRenders, outputUrl, renderOutputs, setEngineUrl, stageLabels, submitRender, type EngineHealth, type RenderJob, type RenderOutput } from '../lib/renderApi';

const resolutions=['960x540','1280x720','1920x1080','2560x1440','3840x2160'];
const qualityLabels:Record<CyclesQuality,string>={draft:'Borrador',standard:'Estándar',high:'Alta'};
const statusLabels:Record<RenderJob['status'],string>={queued:'En cola',running:'Renderizando',succeeded:'Terminado',failed:'Error',canceled:'Cancelado'};
const seconds=(n?:number)=>n===undefined?'':n<60?`${n.toFixed(1)} s`:`${Math.floor(n/60)} min ${Math.round(n%60)} s`;

/** Fetch an engine output as an object URL (goes through CORS, works from the hosted editor). */
function useOutputImage(jobId:string,name:string,enabled:boolean){
  const [url,setUrl]=useState<string>();
  useEffect(()=>{
    if(!enabled)return;let active=true,objectUrl:string|undefined;
    void fetch(outputUrl(jobId,name)).then(r=>r.ok?r.blob():Promise.reject(new Error(String(r.status)))).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(()=>{});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[jobId,name,enabled]);
  return url;
}

function RenderCard({job,onCancel,onMessage}:{job:RenderJob;onCancel:(id:string)=>void;onMessage:(m:string)=>void}){
  const done=job.status==='succeeded';
  const beauty=useOutputImage(job.id,'beauty.png',done),preview=useOutputImage(job.id,'preview.png',done&&job.hasPreview!==false);
  const [showing,setShowing]=useState<'cycles'|'webgl'>('cycles'),[outputs,setOutputs]=useState<RenderOutput[]>([]);
  useEffect(()=>{if(done)void renderOutputs(job.id).then(setOutputs).catch(()=>{});},[done,job.id]);
  const save=async(name:string)=>{
    try{const response=await fetch(outputUrl(job.id,name));if(!response.ok)throw new Error();download(`${fileSafe(job.project.name)||'render'}-${job.id.slice(0,8)}-${name}`,await response.blob(),response.headers.get('Content-Type')??'application/octet-stream');}
    catch{onMessage('No se pudo descargar el archivo del motor.');}
  };
  const fraction=Math.round((job.progress?.fraction??0)*100);
  const image=showing==='webgl'?preview:beauty;
  return <article className="cycles-job" aria-label={`Render ${job.project.name} · ${statusLabels[job.status]}`}>
    {done?<figure className="cycles-figure">{image?<img src={image} alt={showing==='cycles'?`Render Cycles de ${job.project.name}`:`Vista previa WebGL de ${job.project.name}`}/>:<div className="cycles-placeholder">Cargando imagen…</div>}
      <figcaption>{showing==='cycles'?'Blender Cycles · trazado de rayos':'Visor WebGL · misma cámara'}</figcaption></figure>
      :<div className="cycles-placeholder">{job.status==='failed'?'Sin imagen':job.status==='canceled'?'Cancelado':`${stageLabels[job.progress?.stage]??job.progress?.stage} · ${fraction}%`}</div>}
    <div className="cycles-job-info">
      <strong>{job.project.name}</strong>
      <small>{job.settings?`${job.settings.width} × ${job.settings.height} · ${presetLabels[job.settings.lighting as CyclesPreset]??job.settings.lighting} · ${qualityLabels[job.settings.quality as CyclesQuality]??job.settings.quality}`:''}{job.reused?' · reutilizado':''}</small>
      <small>{statusLabels[job.status]}{job.result?.device?` · ${job.result.device}`:''}{job.result?.renderSeconds!==undefined?` · ${seconds(job.result.renderSeconds)}`:''}{job.result?.samples?` · ${job.result.samples} muestras`:''}</small>
      {!FINAL_STATUSES.includes(job.status)&&<><progress max={100} value={fraction} aria-label="Progreso del render"/>
        <small>{stageLabels[job.progress?.stage]??job.progress?.stage}{job.progress?.sample?` · muestra ${job.progress.sample}/${job.progress.samples}`:''}</small>
        <button type="button" onClick={()=>onCancel(job.id)}>Cancelar render</button></>}
      {job.status==='failed'&&<p className="cycles-error" role="alert">{job.error?.message??'El render falló.'}{job.error?.code?` (${job.error.code})`:''}</p>}
      {done&&<div className="cycles-actions">
        {preview&&<span role="group" aria-label="Comparar motor"><button type="button" aria-pressed={showing==='cycles'} onClick={()=>setShowing('cycles')}>Cycles</button><button type="button" aria-pressed={showing==='webgl'} onClick={()=>setShowing('webgl')}>WebGL</button></span>}
        <button type="button" onClick={()=>void save('beauty.png')}>Descargar PNG</button>
        {outputs.some(o=>o.name==='passes.exr')&&<button type="button" onClick={()=>void save('passes.exr')}>Pases EXR</button>}
        <button type="button" onClick={()=>void save('result.json')}>Informe</button>
      </div>}
    </div>
  </article>;
}

export default function CyclesRender({busy,run,onMessage}:{busy:boolean;run:(work:()=>Promise<void>)=>Promise<void>;onMessage:(m:string)=>void}){
  const project=useEditor(s=>s.project),setMode=useEditor(s=>s.setMode);
  const [preset,setPreset]=useState<CyclesPreset>('afternoon'),[quality,setQuality]=useState<CyclesQuality>('standard');
  const [resolution,setResolution]=useState('1280x720'),[verticals,setVerticals]=useState(false),[passes,setPasses]=useState(true);
  const [health,setHealth]=useState<EngineHealth|null>(null),[healthError,setHealthError]=useState(''),[address,setAddress]=useState(engineUrl());
  const [jobs,setJobs]=useState<RenderJob[]>([]);
  const timer=useRef<number|undefined>(undefined);
  const refresh=useCallback(async()=>{
    try{const [h,list]=await Promise.all([engineHealth(),listRenders()]);setHealth(h);setHealthError('');setJobs(list);return list;}
    catch(error){setHealth(null);setHealthError(error instanceof Error?error.message:'Motor no disponible.');return null;}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  // Poll only while a job is pending.
  const pending=jobs.filter(j=>!FINAL_STATUSES.includes(j.status)).map(j=>j.id).join(',');
  useEffect(()=>{
    if(!pending)return;
    const tick=async()=>{
      const updated=await Promise.all(pending.split(',').map(id=>getRender(id).catch(()=>null)));
      setJobs(current=>current.map(job=>updated.find(u=>u?.id===job.id)??job));
      timer.current=window.setTimeout(()=>void tick(),900);
    };
    timer.current=window.setTimeout(()=>void tick(),600);
    return()=>window.clearTimeout(timer.current);
  },[pending]);
  const options=()=>{const [width,height]=resolution.split('x').map(Number);return {preset,quality,width,height,verticals,passes:(passes?['depth','normal','object_id','material_id','albedo']:[]) as RenderPass[]};};
  const generate=()=>run(async()=>{
    if(!health)throw new Error(healthError||'Inicia el motor de render antes de generar la imagen.');
    setMode('3d');
    const pkg=await createRenderPackage(options());
    const job=await submitRender(pkg.zip,pkg.idempotencyKey);
    setJobs(current=>[job,...current.filter(j=>j.id!==job.id)]);
    onMessage(job.reused?'Este encuadre y ajustes ya estaban renderizados: se reutiliza el resultado.':`Render enviado a Cycles (${(pkg.zip.size/1048576).toFixed(1)} MB). Puedes seguir editando; la imagen usa la escena exportada.`);
  });
  const exportPackage=()=>run(async()=>{
    setMode('3d');
    const pkg=await createRenderPackage(options());
    download(`${fileSafe(project.name)||'escena'}-render-package.zip`,pkg.zip,'application/zip');
    onMessage(`Paquete exportado: escena GLB ${(pkg.glbBytes/1048576).toFixed(1)} MB, manifiesto y vista previa.`);
  });
  const cancel=(id:string)=>void cancelRender(id).then(job=>setJobs(current=>current.map(j=>j.id===id?job:j))).catch(error=>onMessage((error as Error).message));
  const [w,h]=resolution.split('x').map(Number);
  return <section className="resource-workshop cycles-panel" aria-label="Render fotorrealista con Cycles">
    <h4>Render fotorrealista · Blender Cycles</h4>
    <p className="small-help">Trazado de rayos sobre la misma geometría, cámara y materiales de la vista 3D. Las dimensiones no cambian: el motor solo calcula la luz.</p>
    <div className={`engine-status ${health?'ok':'off'}`} role="status">
      {health?`Motor conectado · ${health.device==='AUTO'?'GPU si está disponible':health.device} · ${health.queue} en cola`:'Motor no conectado'}
      <button type="button" onClick={()=>void refresh()}>Comprobar</button>
    </div>
    {!health&&<details className="engine-help" open={!!healthError}><summary>Cómo iniciar el motor local</summary>
      <p>Necesita Blender 4.5 LTS. En una terminal: <code>cd render-engine</code> y <code>python -m atelier_engine</code>. Instrucciones completas en render-engine/README.md.</p>
      <label>Dirección del motor<input aria-label="Dirección del motor de render" value={address} onChange={e=>setAddress(e.target.value)} onBlur={()=>{try{setAddress(setEngineUrl(address));void refresh();}catch(error){onMessage((error as Error).message);}}}/></label>
      {healthError&&<p className="small-help">{healthError}</p>}
    </details>}
    <div className="workshop-grid">
      <label>Luz<select aria-label="Iluminación Cycles" value={preset} onChange={e=>setPreset(e.target.value as CyclesPreset)}>{(Object.keys(presetLabels) as CyclesPreset[]).map(key=><option key={key} value={key}>{presetLabels[key]}</option>)}</select></label>
      <label>Calidad<select aria-label="Calidad Cycles" value={quality} onChange={e=>setQuality(e.target.value as CyclesQuality)}>{(Object.keys(qualityLabels) as CyclesQuality[]).map(key=><option key={key} value={key}>{qualityLabels[key]} · {QUALITY_SAMPLES[key]} muestras</option>)}</select></label>
      <label>Resolución<select aria-label="Resolución Cycles" value={resolution} onChange={e=>setResolution(e.target.value)}>{resolutions.map(r=><option key={r} value={r}>{r.replace('x',' × ')}</option>)}</select></label>
    </div>
    <label className="studio-check"><input type="checkbox" aria-label="Corregir verticales" checked={verticals} onChange={e=>setVerticals(e.target.checked)}/> Verticales corregidas (fotografía de arquitectura; cambia ligeramente el encuadre respecto al visor)</label>
    <label className="studio-check"><input type="checkbox" aria-label="Pases técnicos EXR" checked={passes} onChange={e=>setPasses(e.target.checked)}/> Pases técnicos en EXR de 32 bits (profundidad, normales, IDs de objeto y material, albedo)</label>
    {preset==='night'&&(lights=>lights>MAX_INTERIOR_LIGHTS&&<p className="small-help">El proyecto pide {lights} luces nocturnas (lámparas y llamas de vela); Cycles usa las {MAX_INTERIOR_LIGHTS} más intensas y omite el resto.</p>)(interiorLights(project).length)}
    <p className="small-help">Encuadra la vista 3D (por ejemplo a 1,5 m de altura en Recorrer en primera persona) y genera. {w*h>2_100_000&&quality==='high'?'Alta resolución con calidad Alta puede tardar varios minutos en CPU.':''}</p>
    <button className="primary-btn" type="button" disabled={busy} onClick={()=>void generate()}>Generar render Cycles</button>
    <button type="button" disabled={busy} onClick={()=>void exportPackage()}>Descargar paquete de render</button>
    {jobs.length>0&&<><h4>Galería de renders</h4><div className="cycles-gallery">{jobs.map(job=><RenderCard key={job.id} job={job} onCancel={cancel} onMessage={onMessage}/>)}</div></>}
  </section>;
}
