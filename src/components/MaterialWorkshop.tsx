import { useEffect, useState } from 'react';
import { useEditor } from '../store';
import type { CustomMaterial } from '../types';
import { assignMaterial, prepareMaterialMap, validCustomMaterials, type MaterialTarget } from '../lib/projectMaterials';
import { createMaterialMaps, type TexturePattern } from '../lib/proceduralTextures';
import { finishPresets } from '../lib/studioRender';
import { embedMaterialMaps, listLibraryMaterials, storeMaterialMaps, type LibraryMaterial } from '../lib/materialLibrary';
import { MaterialPreview } from './MaterialStorage';

const defaults={name:'Mi material',category:'Personalizado',color:'#c5ad8c',scale:1,roughness:.65,metalness:0,normalStrength:1,source:'Creado en Atelier 60',license:'Creación propia'};
export default function MaterialWorkshop({target,onMessage}:{target:MaterialTarget;onMessage:(message:string)=>void}) {
  const {project,change,selection}=useEditor();
  const [draft,setDraft]=useState<Omit<CustomMaterial,'id'>>(defaults);
  const [pattern,setPattern]=useState<TexturePattern|'none'>('none'),[busy,setBusy]=useState(false);
  const [library,setLibrary]=useState<LibraryMaterial[]>([]),[libraryError,setLibraryError]=useState('');
  const refresh=async()=>{try{setLibrary(await listLibraryMaterials());setLibraryError('');}catch(error){setLibraryError(error instanceof Error?error.message:'No se pudo abrir la biblioteca. Reintenta.');}};
  useEffect(()=>{let active=true;listLibraryMaterials().then(entries=>{if(active)setLibrary(entries);}).catch(error=>{if(active)setLibraryError((error as Error).message);});return()=>{active=false;};},[]);
  const patch=(values:Partial<typeof draft>)=>setDraft(current=>({...current,...values}));
  const upload=async(file:File,map:'color'|'normal'|'roughness')=>{
    setBusy(true);
    try {const data=await prepareMaterialMap(file,map);setDraft(current=>({...current,maps:{...current.maps,[map]:data}}));setPattern('none');onMessage('Textura preparada. Guarda el material para incorporarla al proyecto.');}
    catch(error){onMessage(error instanceof Error?error.message:'No se pudo preparar la textura.');}
    finally{setBusy(false);}
  };
  const incorporate=async(material:CustomMaterial,apply:boolean)=>{
    const original=useEditor.getState().project;
    const candidate=structuredClone(original);
    const same=candidate.materials?.find(entry=>entry.id===material.id);
    if(same&&JSON.stringify(same)!==JSON.stringify(material))material={...material,id:`custom:${crypto.randomUUID()}`};
    candidate.materials??=[];
    if(!candidate.materials.some(entry=>entry.id===material.id))candidate.materials.push(material);
    if(apply)assignMaterial(candidate,material.id,target,selection);
    if(!validCustomMaterials(candidate.materials))throw new Error('Revisa el nombre y los valores. Máximo 64 materiales y 4 MB de texturas por proyecto.');
    const stored=await storeMaterialMaps(candidate.materials);
    if(useEditor.getState().project!==original)throw new Error('El proyecto cambió durante el guardado. El material queda en la biblioteca; vuelve a aplicarlo al proyecto actual.');
    change(project=>{project.materials=stored;if(apply)assignMaterial(project,material.id,target,selection);});
    await refresh();
  };
  const create=async(apply:boolean)=>{
    setBusy(true);
    try {
      const maps=pattern==='none'?draft.maps:createMaterialMaps(pattern,draft.color);
      const material:CustomMaterial={...draft,name:draft.name.trim(),id:`custom:${crypto.randomUUID()}`,maps,color:maps?.color?'#ffffff':draft.color};
      await incorporate(material,apply);
      onMessage(apply?'Material creado y aplicado. Puedes deshacer ambos cambios juntos.':'Material guardado en la biblioteca local y en este proyecto.');
    } catch(error){onMessage(error instanceof Error?error.message:'No se pudo crear el material.');}
    finally{setBusy(false);}
  };
  const reuse=async(material:CustomMaterial)=>{
    setBusy(true);
    try{await incorporate(material,true);onMessage('Material de la biblioteca reutilizado y aplicado. Puedes deshacer el cambio.');}
    catch(error){onMessage(error instanceof Error?error.message:'No se pudo reutilizar el material.');}finally{setBusy(false);}
  };
  const apply=async(material:CustomMaterial)=>{
    setBusy(true);const original=useEditor.getState().project;
    try{await embedMaterialMaps([material]);if(useEditor.getState().project!==original)throw new Error('El proyecto cambió. Vuelve a aplicar el material.');change(project=>assignMaterial(project,material.id,target,selection));onMessage('Material aplicado.');}
    catch(error){onMessage((error as Error).message);}finally{setBusy(false);}
  };
  const base=async(material:CustomMaterial)=>{
    setBusy(true);
    try{const [{id:_,...copy}]=await embedMaterialMaps([material]);setDraft(copy);setPattern('none');onMessage('Material copiado al taller. Guarda una nueva creación para modificarlo de forma independiente.');}
    catch(error){onMessage((error as Error).message);}finally{setBusy(false);}
  };
  return <section className="resource-workshop" aria-label="Taller de materiales">
    <h4>Crea tu material</h4><p>Combina color y propiedades físicas, genera una textura o incorpora tus mapas PBR. La biblioteca local permite reutilizarlos en otros proyectos; los mapas viajan en el JSON portable.</p>
    <div className="workshop-grid">
      <label>Nombre del material<input aria-label="Nombre del material" value={draft.name} maxLength={180} onChange={event=>patch({name:event.target.value})}/></label>
      <label>Respuesta física<select aria-label="Respuesta física del material" value={draft.finish??'standard'} onChange={event=>{const finish=event.target.value as keyof typeof finishPresets;patch({finish,...finishPresets[finish]});}}><option value="standard">Mate / metal</option><option value="glass">Vidrio</option><option value="varnish">Barniz</option><option value="fabric">Tejido</option></select></label>
      <label>Textura<select aria-label="Patrón del material" value={pattern} onChange={event=>setPattern(event.target.value as typeof pattern)}><option value="none">Color o mapas propios</option><option value="wood">Veta de madera</option><option value="marble">Mármol veteado</option><option value="fabric">Tejido</option><option value="terrazzo">Terrazo</option><option value="concrete">Hormigón</option></select></label>
      <label>Color base<input type="color" aria-label="Color base del material" value={draft.color} onChange={event=>patch({color:event.target.value})}/></label>
      <label>Repetición (m)<input type="number" aria-label="Repetición del material" min={.02} max={20} step={.01} value={draft.scale} onChange={event=>patch({scale:Number(event.target.value)})}/></label>
      <label>Rugosidad · {draft.roughness.toFixed(2)}<input aria-label="Rugosidad del material" type="range" min={0} max={1} step={.01} value={draft.roughness} onChange={event=>patch({roughness:Number(event.target.value)})}/></label>
      <label>Metalicidad · {draft.metalness.toFixed(2)}<input aria-label="Metalicidad del material" type="range" min={0} max={1} step={.01} value={draft.metalness} onChange={event=>patch({metalness:Number(event.target.value)})}/></label>
      <label>Intensidad del relieve<input aria-label="Relieve del material" type="range" min={0} max={3} step={.05} value={draft.normalStrength} onChange={event=>patch({normalStrength:Number(event.target.value)})}/></label>
    </div>
    <details><summary>Mapas propios y procedencia</summary>
      <p>PNG, JPEG o WebP. Se optimizan a un máximo de 1024 px. Normal en formato OpenGL; rugosidad en escala de grises.</p>
      {(['color','normal','roughness'] as const).map((map,index)=><label key={map}>{['Mapa de color','Mapa normal','Mapa de rugosidad'][index]}<input type="file" aria-label={['Mapa de color','Mapa normal','Mapa de rugosidad'][index]} accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void upload(file,map);}}/>{draft.maps?.[map]&&<><img className="map-preview" src={draft.maps[map]} alt={`Vista previa ${map}`}/><button type="button" onClick={()=>{const maps={...draft.maps};delete maps[map];patch({maps});}}>Retirar mapa {map}</button></>}</label>)}
      <label>Procedencia<input value={draft.source} maxLength={2000} onChange={event=>patch({source:event.target.value})}/></label>
      <label>Licencia o derechos<input value={draft.license} maxLength={2000} onChange={event=>patch({license:event.target.value})}/></label>
    </details>
    <button className="primary-btn" disabled={busy} onClick={()=>void create(true)}>Crear y aplicar material</button>
    <button disabled={busy} onClick={()=>void create(false)}>Guardar material sin aplicar</button>
    <p className="small-help">Vidrio, barniz y tejido usan transmisión, capa brillante y brillo de fibras en calidad Alta. En Rápida se simplifican. Los patrones generan mapas sintéticos; incorpora texturas para reproducir un acabado concreto.</p>
    {!!project.materials?.length&&<><h4>Materiales de este proyecto</h4><div className="studio-materials">{project.materials.map(material=><article className="custom-material-card" key={material.id}>
      <MaterialPreview material={material}/>
      <strong>{material.name}</strong><small>{material.license} · {material.scale} m · rugosidad {material.roughness.toFixed(2)}</small>
      <button disabled={busy} onClick={()=>void apply(material)}>Aplicar {material.name}</button>
      <button disabled={busy} onClick={()=>void base(material)}>Usar como base {material.name}</button>
    </article>)}</div></>}
    <h4>Biblioteca local de materiales</h4><p className="small-help">Disponible entre proyectos de este navegador. Se conservan los mapas usados por respaldos, versiones y deshacer. Exporta JSON para llevarlos a otro equipo.</p>
    <button disabled={busy} onClick={()=>void refresh()}>Actualizar biblioteca de materiales</button>
    {libraryError&&<p role="alert">{libraryError}</p>}
    <div className="studio-materials">{library.map(({key,material})=><article className="custom-material-card" key={key}><MaterialPreview material={material}/><strong>{material.name}</strong><small>{material.license} · {material.scale} m</small><button disabled={busy} onClick={()=>void reuse(material)}>Reutilizar {material.name}</button></article>)}</div>
  </section>;
}
