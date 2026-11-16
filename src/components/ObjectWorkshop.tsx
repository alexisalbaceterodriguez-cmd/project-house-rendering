import { useState } from 'react';
import { useEditor } from '../store';
import { deleteModelResource, putModelAsset, putModelMetadata } from '../lib/assets';
import { findFreePlacement } from '../lib/diagnostics';
import type { ObjectRecipe } from '../lib/workshopObjects';

const families=[['sofa','Sofá tapizado',2.3,.95,.82],['sideboard','Aparador acanalado',1.8,.45,.8],['table','Mesa de comedor',1.8,.9,.75],['lamp','Lámpara escultórica',.5,.5,1.5]] as const;
export default function ObjectWorkshop({onMessage}:{onMessage:(message:string)=>void}) {
  const {change,setSelection,setMode}=useEditor();
  const [recipe,setRecipe]=useState<ObjectRecipe>({family:'sideboard',name:'Aparador acanalado',w:1.8,d:.45,h:.8,color:'#986a45',accent:'#b49a60'});
  const [busy,setBusy]=useState(false);
  const patch=(values:Partial<ObjectRecipe>)=>setRecipe(current=>({...current,...values}));
  const create=async()=>{
    const projectId=useEditor.getState().project.id;
    setBusy(true);let assetId:string|undefined;
    try {
      const {createWorkshopGLB}=await import('../lib/workshopObjects');
      const blob=await createWorkshopGLB(recipe);
      assetId=crypto.randomUUID();await putModelAsset(assetId,blob);
      await putModelMetadata(assetId,{name:recipe.name,source:'Creación original en Atelier 60',license:'Creación propia',w:recipe.w,d:recipe.d,h:recipe.h});
      if(useEditor.getState().project.id!==projectId)throw new Error('El proyecto ha cambiado. Vuelve a crear el objeto en el proyecto actual.');
      const id=crypto.randomUUID(),storedId=assetId;
      change(project=>project.furniture.push({id,kind:'model',name:recipe.name,...findFreePlacement(project,recipe.w,recipe.d),w:recipe.w,d:recipe.d,h:recipe.h,rotation:0,color:'#ffffff',assetId:storedId,
        productSource:{manufacturer:'Diseño propio',reference:`atelier:workshop:${recipe.family}`,source:'Creado en Atelier 60',license:'Creación propia',attribution:'Geometría original generada en Atelier 60'}}));
      if(!useEditor.getState().project.furniture.some(item=>item.id===id))throw new Error('No se pudo añadir el objeto al proyecto.');
      assetId=undefined;setSelection({type:'furniture',id});setMode('split');
      onMessage('Objeto creado a escala. Cierra Estudio para verlo; puedes personalizar sus materiales por pieza, duplicarlo y exportarlo con el proyecto.');
    } catch(error) {
      if(assetId)await deleteModelResource(assetId,()=>{}).catch(()=>{});
      onMessage(error instanceof Error?error.message:'No se pudo crear el objeto.');
    } finally {setBusy(false);}
  };
  return <section className="resource-workshop" aria-label="Taller de objetos">
    <h3>Crea un objeto</h3><p>Diseños originales con bordes redondeados, detalles y materiales independientes. Ajusta medidas reales; el modelo se incorpora a tu biblioteca local.</p>
    <div className="workshop-grid"><label>Diseño<select aria-label="Diseño del objeto" value={recipe.family} disabled={busy} onChange={event=>{const family=families.find(family=>family[0]===event.target.value)!;patch({family:family[0],name:family[1],w:family[2],d:family[3],h:family[4]});}}>{families.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>Nombre del objeto<input aria-label="Nombre del objeto creado" maxLength={180} value={recipe.name} disabled={busy} onChange={event=>patch({name:event.target.value})}/></label>
      {(['w','d','h'] as const).map((axis,index)=><label key={axis}>{['Ancho','Fondo','Altura'][index]} (m)<input aria-label={['Ancho del objeto creado','Fondo del objeto creado','Altura del objeto creado'][index]} type="number" min={.2} max={6} step={.01} disabled={busy} value={recipe[axis]} onChange={event=>patch({[axis]:Number(event.target.value)})}/></label>)}
      <label>Color principal<input aria-label="Color del objeto creado" type="color" disabled={busy} value={recipe.color} onChange={event=>patch({color:event.target.value})}/></label>
      <label>Color de detalles<input aria-label="Color de detalles del objeto" type="color" disabled={busy} value={recipe.accent} onChange={event=>patch({accent:event.target.value})}/></label>
    </div><button className="primary-btn" disabled={busy} onClick={()=>void create()}>{busy?'Creando objeto…':'Crear e insertar objeto'}</button>
    <p className="small-help">Para otra forma o un producto concreto, importa su GLB desde Objetos. El taller puede ampliarse con nuevos diseños creados bajo petición.</p>
  </section>;
}
