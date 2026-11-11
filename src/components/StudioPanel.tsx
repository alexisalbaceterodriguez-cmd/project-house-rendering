import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store';
import { modelCatalog, modelUrl, type LibraryProduct } from '../data/modelCatalog';
import { materialCatalog, materialUrl } from '../data/materialCatalog';
import { getModelAsset,listModelAssets,putModelAsset,putModelMetadata } from '../lib/assets';
import { deleteUnusedModelResource } from '../lib/modelRetention';
import { validateGLB } from '../lib/modelValidation';
import { measureModelDimensions } from '../lib/modelThumbnail';
import { deleteDesign, listDesigns, saveDesign, type SavedDesign } from '../lib/projectLibrary';
import { applyAppearance } from '../lib/designVariants';
import { captureImage } from '../lib/sceneCapture';
import { approximateNetArea, findFreePlacement, furnitureCollisions } from '../lib/diagnostics';
import { download, makeId } from '../lib/geometry';
import { projectWarnings, resizeProject } from '../lib/topology';
import type { ModuleSettings, Project, RenderSettings } from '../types';
import WallEditingTools from './WallEditingTools';
import BudgetTools from './BudgetTools';

type Tab='models'|'materials'|'modules'|'versions'|'render'|'tools';
const tabs:[Tab,string][]=[['models','Modelos'],['materials','Acabados'],['modules','Cocina y baño'],['versions','Versiones'],['render','Imagen y cámara'],['tools','Plano y revisión']];
const defaultRender:RenderSettings={lighting:'day',quality:'draft',exposure:1};
export default function StudioPanel({open,onClose}:{open:boolean;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const {project,selection,change,setSelection,setMode,load,liveCamera,selectedFurniture,setFurnitureGroup,setCameraLocked}=useEditor();
  const [tab,setTab]=useState<Tab>('models'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [search,setSearch]=useState(''),[family,setFamily]=useState('Todos');
  const [versions,setVersions]=useState<SavedDesign[]>([]),[versionName,setVersionName]=useState(''),[variantId,setVariantId]=useState('');
  const [front,setFront]=useState('#ece7dd'),[worktop,setWorktop]=useState('wood'),[moduleWidth,setModuleWidth]=useState(.6);
  const [handles,setHandles]=useState<ModuleSettings['handles']>('bar');
  const [materialTarget,setMaterialTarget]=useState('selection'),[resolution,setResolution]=useState('1920x1080');
  const [width,setWidth]=useState(project.width),[depth,setDepth]=useState(project.depth),[anchor,setAnchor]=useState('nw');
  const [comparison,setComparison]=useState<{base:Project;other:Project;label:string;showing:'A'|'B'}|null>(null);
  const comparisonRef=useRef(comparison);comparisonRef.current=comparison;
  const [assets,setAssets]=useState<Awaited<ReturnType<typeof listModelAssets>>>([]);
  useEffect(()=>{const element=dialog.current;if(open&&!element?.open){element?.showModal();setMessage('');void refreshVersions();}else if(!open&&element?.open)element.close();},[open]);
  const run=async(work:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await work();}catch(error){setMessage(error instanceof Error?error.message:'No se pudo completar la operación.');}finally{setBusy(false);}};
  useEffect(()=>{if(open&&tab==='tools'){let active=true;void listModelAssets().then(result=>{if(active)setAssets(result);}).catch(()=>{if(active)setMessage('No se pudieron leer los recursos locales.');});return()=>{active=false;};}},[open,tab]);
  const refreshVersions=async()=>{try{setVersions(await listDesigns());}catch{setMessage('No se puede abrir la biblioteca de versiones. Exporta una copia JSON.');}};
  const item=selection?.type==='furniture'?project.furniture.find(f=>f.id===selection.id):undefined;
  const render=project.render??defaultRender;
  const updateRender=(patch:Partial<RenderSettings>)=>change(p=>{p.render={...(p.render??defaultRender),...patch};});
  const insertProduct=(product:LibraryProduct)=>run(async()=>{
    const assetId=`catalog-v1:${product.id}`;
    let blob=await getModelAsset(assetId);
    if(!blob){const response=await fetch(modelUrl(product));if(!response.ok)throw new Error('No se pudo cargar el modelo. Comprueba la conexión y vuelve a intentarlo.');blob=await response.blob();await validateGLB(blob);await putModelAsset(assetId,blob);}
    await validateGLB(blob);
    const dimensions=await measureModelDimensions(blob);
    if(Object.values(dimensions).some(n=>!Number.isFinite(n)||n<.02||n>15))throw new Error('El modelo no tiene dimensiones métricas utilizables.');
    await putModelMetadata(assetId,{name:product.name,source:product.source,license:product.license,...dimensions});
    const id=makeId();change(p=>p.furniture.push({id,kind:'model',name:product.name,...findFreePlacement(p,dimensions.w,dimensions.d),...dimensions,rotation:0,color:'#ffffff',assetId,productId:product.id,productSource:{manufacturer:product.manufacturer,reference:product.reference,source:product.source,license:product.license,attribution:product.attribution}}));
    setSelection({type:'furniture',id});setMessage(`${product.name} añadido a escala. Puedes moverlo en el plano.`);
  });
  const applyMaterial=(id:string)=>{
    if(materialTarget==='selection'&&!selection){setMessage('Selecciona primero una estancia, pared u objeto en el plano.');return;}
    change(p=>{
      if(materialTarget==='floors'){p.rooms.forEach(r=>{r.materialId=id||undefined;});return;}
      if(materialTarget==='walls'){p.walls.forEach(w=>{w.materialId=id||undefined;});return;}
      if(selection?.type==='room'){const r=p.rooms.find(r=>r.id===selection.id);if(r)r.materialId=id||undefined;}
      if(selection?.type==='wall'){const w=p.walls.find(w=>w.id===selection.id);if(w)w.materialId=id||undefined;}
      if(selection?.type==='furniture'){
        const f=p.furniture.find(f=>f.id===selection.id);if(!f)return;
        if(f.kind==='model'){
          if(!id){if(f.modelFinish)delete f.modelFinish.materialId;}
          else f.modelFinish={...(f.modelFinish??{color:'#ffffff',roughness:.8,metalness:0}),materialId:id};
        }else f.materialId=id||undefined;
      }
    });setMessage('Acabado aplicado. Deshacer recupera el anterior.');
  };
  const addModule=(kind:ModuleSettings['family'],name:string)=>{
    const id=makeId(),h=kind==='wall'?.72:kind==='column'?2.1:.88,d=kind==='wall'?.35:.6;
    change(p=>{
      const last=p.furniture.filter(f=>f.module).at(-1);const x=last?last.x+last.w/2+moduleWidth/2:moduleWidth/2+.2;
      p.furniture.push({id,kind:kind==='vanity'?'sink':'kitchen',name,x:Math.min(x,p.width-moduleWidth/2),y:p.depth-d/2-.15,w:moduleWidth,d,h,rotation:0,color:front,productId:`atelier60:module:${kind}`,module:{family:kind,front,worktop,handles}});
    });setSelection({type:'furniture',id});setMessage(`${name} añadido. Ajusta posición y giro desde Propiedades.`);
  };
  const saveVersion=()=>run(async()=>{
    await saveDesign(project,versionName||`${project.name} · propuesta ${versions.length+1}`);await refreshVersions();setVersionName('');setMessage('Versión guardada con geometría, modelos, acabados y cámara.');
  });
  const openVersion=(version:SavedDesign)=>run(async()=>{
    await saveDesign(project,`${project.name} · antes de restaurar`);load(version.project);setComparison(null);await refreshVersions();setMessage(`Restaurada «${version.name}». El estado anterior queda guardado.`);
  });
  const compareVersion=()=>{
    try{const other=versions.find(v=>v.id===variantId);if(!other)throw new Error('Elige una versión para comparar.');if(!liveCamera)throw new Error('Abre la vista 3D y guarda el encuadre antes de comparar.');
      const base=structuredClone(project);base.render={...(base.render??defaultRender),camera:structuredClone(liveCamera),walk:false};
      const alternate=applyAppearance(base,other.project);setComparison({base,other:alternate,label:other.name,showing:'A'});change(p=>{p.render=base.render;});setCameraLocked(true);setMode('3d');setMessage('Comparación preparada. A y B mantienen geometría, luz y cámara.');
    }catch(error){setMessage((error as Error).message);}
  };
  const switchVariant=(side:'A'|'B')=>{if(!comparison)return;const next=side==='A'?comparison.base:comparison.other;change(p=>{Object.assign(p,structuredClone(next));});setComparison({...comparison,showing:side});};
  const exportRender=()=>run(async()=>{const [w,h]=resolution.split('x').map(Number);download(`${project.name.replace(/[^\p{L}\p{N}-]/gu,'-')}-${comparison?.showing??'render'}.png`,await captureImage(w,h),'image/png');setMessage('Imagen PNG exportada.');});
  const applyResize=()=>{try{const dx=anchor.endsWith('e')?width-project.width:0,dy=anchor.startsWith('s')?depth-project.depth:0;
    change(p=>{for(const w of p.walls.filter(w=>!w.outer)){w.a.x+=dx;w.b.x+=dx;w.a.y+=dy;w.b.y+=dy;}for(const f of p.furniture){f.x+=dx;f.y+=dy;}for(const r of p.rooms){r.x+=dx;r.y+=dy;r.vertices?.forEach(v=>{v.x+=dx;v.y+=dy;});}resizeProject(p,width,depth,'keep');});setMessage('Envolvente actualizada; revisa los avisos de elementos fuera de límites.');
    }catch(error){setMessage((error as Error).message);}};
  return <dialog ref={dialog} className="studio-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="studio-heading">
    <header className="studio-heading"><div><span className="eyebrow">ATELIER 60 · ESTUDIO</span><h2 id="studio-heading">Tu proyecto, al detalle</h2></div><button type="button" onClick={onClose} aria-label="Cerrar estudio">×</button></header>
    <nav className="studio-tabs" aria-label="Secciones del estudio">{tabs.map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setMessage('');}}>{label}</button>)}</nav>
    {message&&<p className="studio-message" role="status">{message}</p>}
    <div className="studio-body" aria-busy={busy}>
    {tab==='models'&&<>
      <h3>Modelos 3D incluidos</h3><p>Recursos autorizados, con medidas del archivo original. Al insertarlos quedan disponibles en tu biblioteca local.</p>
      <label>Buscar modelos<input aria-label="Buscar modelos incluidos" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Sofá, butaca, lámpara…"/></label>
      <label>Familia<select value={family} onChange={e=>setFamily(e.target.value)}>{['Todos',...new Set(modelCatalog.map(p=>p.family))].map(f=><option key={f}>{f}</option>)}</select></label>
      <div className="studio-products">{modelCatalog.filter(p=>(family==='Todos'||p.family===family)&&`${p.name} ${p.manufacturer} ${p.reference}`.toLowerCase().includes(search.toLowerCase())).map(p=><article key={p.id}>
        <img className="product-preview" src={`${import.meta.env.BASE_URL}models/${p.file}.jpg`} alt={p.name} loading="lazy"/><h4>{p.name}</h4><p>{p.description}</p><small>{p.manufacturer} · {p.reference}</small><details><summary>Origen y licencia · {p.license}</summary><p>{p.attribution}</p><a href={p.source} target="_blank" rel="noreferrer">Consultar recurso original</a></details><button className="primary-btn" disabled={busy} onClick={()=>void insertProduct(p)}>Insertar {p.name}</button>
      </article>)}</div>
    </>}
    {tab==='materials'&&<>
      <h3>Acabados con textura</h3><p>Color, relieve y rugosidad reales. Cambios independientes, a escala métrica y con historial.</p>
      <label>Aplicar acabado a<select aria-label="Destino del acabado" value={materialTarget} onChange={e=>setMaterialTarget(e.target.value)}><option value="selection">Selección actual{selection?` · ${selection.type==='room'?'estancia':selection.type==='wall'?'pared':'objeto'}`:''}</option><option value="floors">Todos los suelos</option><option value="walls">Todas las paredes</option></select></label>
      {item?.kind==='model'&&<p>Se aplica al material o superficie elegidos en Propiedades. Sin superficie elegida, afecta al modelo completo.</p>}
      <div className="studio-materials">{materialCatalog.map(m=><button key={m.id} onClick={()=>applyMaterial(m.id)}><img src={materialUrl(m,'color')} alt="" loading="lazy"/><strong>{m.name}</strong><small>{m.category} · CC0 · repetición {m.scale} m</small></button>)}</div>
      <button className="quiet-btn" onClick={()=>applyMaterial('')}>Retirar textura de este destino</button><p className="small-help">Fuentes: Poly Haven, CC0. El color original del modelo se conserva al retirar la textura.</p>
    </>}
    {tab==='modules'&&<>
      <h3>Cocinas y baños modulares</h3><p>Módulos paramétricos propios. Sus medidas y acabados se guardan por instancia; puedes combinar importaciones de fabricantes.</p>
      <label>Ancho del módulo<select aria-label="Ancho del módulo" value={moduleWidth} onChange={e=>setModuleWidth(Number(e.target.value))}>{[.3,.4,.45,.6,.8,.9,1.2].map(w=><option key={w} value={w}>{Math.round(w*100)} cm</option>)}</select></label>
      <div className="studio-module-list">{([['base','Módulo bajo'],['wall','Módulo alto'],['column','Columna'],['sink','Fregadero'],['hob','Placa'],['oven','Horno'],['vanity','Mueble lavabo']] as const).map(([key,label])=><button key={key} disabled={busy} onClick={()=>addModule(key,label)}>Añadir {label}</button>)}</div>
      <h4>Acabados del módulo</h4><label>Color de frentes<input type="color" aria-label="Color de frentes" value={front} onChange={e=>setFront(e.target.value)}/></label>
      <label>Encimera<select aria-label="Material de encimera" value={worktop} onChange={e=>setWorktop(e.target.value)}>{materialCatalog.filter(m=>m.id==='wood'||m.id==='tile').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Tiradores<select aria-label="Tiradores de módulo" value={handles} onChange={e=>setHandles(e.target.value as ModuleSettings['handles'])}><option value="bar">Barra metálica</option><option value="none">Frente sin tirador</option></select></label>
      <button disabled={!item?.module} onClick={()=>{if(!item?.module)return;change(p=>{const f=p.furniture.find(f=>f.id===item.id)!;f.module={...f.module!,front,worktop,handles};f.color=front;});setMessage('Acabados del módulo seleccionado actualizados.');}}>Aplicar al módulo seleccionado</button>
      <p className="small-help">Para comparar tres propuestas, guarda una versión antes de cambiar frentes o encimeras. Las paredes y el encuadre permanecen iguales.</p>
    </>}
    {tab==='versions'&&<>
      <h3>Proyectos y propuestas</h3><p>Instantáneas completas en este navegador. Exporta también un JSON portable como copia externa.</p>
      <label>Nombre de la versión<input aria-label="Nombre de la versión" placeholder={`${project.name} · propuesta A`} value={versionName} onChange={e=>setVersionName(e.target.value)} maxLength={180}/></label><button className="primary-btn" disabled={busy} onClick={()=>void saveVersion()}>Guardar versión del proyecto</button>
      <div className="version-list">{versions.map(v=><article key={v.id}><strong>{v.name}</strong><small>{new Date(v.savedAt).toLocaleString('es-ES')} · {v.project.width} × {v.project.depth} m · {v.project.furniture.length} objetos</small><button disabled={busy} onClick={()=>void openVersion(v)}>Restaurar {v.name}</button><button className="danger" disabled={busy} onClick={()=>void run(async()=>{await deleteDesign(v.id);await refreshVersions();})} aria-label={`Eliminar versión ${v.name}`}>Eliminar versión</button></article>)}</div>
      {!versions.length&&<p>No hay versiones guardadas todavía.</p>}
      <h4>Comparar acabados A/B</h4><label>Propuesta B<select aria-label="Propuesta para comparar" value={variantId} onChange={e=>setVariantId(e.target.value)}><option value="">Seleccionar versión…</option>{versions.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><button onClick={compareVersion}>Preparar comparación con el proyecto actual</button>
      {comparison&&<div className="comparison-controls"><p>B: {comparison.label}. Mostrando {comparison.showing}. Cámara e iluminación fijas.</p><button aria-pressed={comparison.showing==='A'} onClick={()=>switchVariant('A')}>Ver propuesta A</button><button aria-pressed={comparison.showing==='B'} onClick={()=>switchVariant('B')}>Ver propuesta B</button><button onClick={()=>{setComparison(null);setCameraLocked(false);}}>Terminar comparación</button><p>Cierra este panel para ver la escena; la comparación sigue disponible al volver.</p></div>}
    </>}
    {tab==='render'&&<>
      <h3>Imagen y cámara</h3><p>Visualización física en tiempo real con texturas, sombras y ambiente HDRI. La calidad depende de la GPU y del modelo.</p>
      <label>Iluminación<select aria-label="Iluminación" value={render.lighting} onChange={e=>updateRender({lighting:e.target.value as RenderSettings['lighting']})}><option value="day">Día</option><option value="night">Noche cálida</option><option value="studio">Estudio HDRI</option></select></label>
      <label>Exposición<input type="range" aria-label="Exposición" min="0.2" max="3" step="0.1" value={render.exposure} onChange={e=>updateRender({exposure:Number(e.target.value)})}/></label>
      <label>Calidad<select aria-label="Calidad 3D" value={render.quality} onChange={e=>updateRender({quality:e.target.value as RenderSettings['quality']})}><option value="draft">Rápida</option><option value="high">Alta</option></select></label>
      <button onClick={()=>{setMode('3d');setMessage('Vista 3D abierta. Cierra este panel para ajustar la cámara.');}}>Abrir vista 3D</button>
      <button disabled={!liveCamera} onClick={()=>{if(liveCamera){updateRender({camera:structuredClone(liveCamera),walk:false});setMessage('Encuadre guardado en el proyecto y sus versiones.');}}}>Guardar encuadre actual</button><button disabled={!render.camera} onClick={()=>{updateRender({camera:undefined,walk:false});setMessage('Cámara automática restaurada.');}}>Restablecer cámara</button>
      <button onClick={()=>{updateRender({walk:!render.walk});setMode('3d');setMessage(!render.walk?'Cierra el panel y haz clic en 3D. WASD o flechas para caminar; Escape libera el ratón.':'Cámara orbital activada.');}}>{render.walk?'Salir del paseo':'Recorrer en primera persona'}</button>
      <label>Resolución PNG<select aria-label="Resolución de imagen" value={resolution} onChange={e=>setResolution(e.target.value)}><option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option><option value="2560x1440">2560 × 1440</option><option value="3840x2000">3840 × 2000</option></select></label><button className="primary-btn" disabled={busy} onClick={()=>void exportRender()}>Exportar imagen PNG</button>
    </>}
    {tab==='tools'&&<>
      <h3>Precisión y revisión del plano</h3><p>Mayús + clic selecciona varios muebles; arrastra el grupo. Escape revierte el arrastre completo. Rueda amplía el plano; botón central o Espacio desplaza.</p>
      <button onClick={()=>{setSelection(null);setMode('2d');onClose();requestAnimationFrame(()=>{window.dispatchEvent(new Event('atelier60:fit-plan'));requestAnimationFrame(()=>window.print());});}}>Imprimir plano / guardar PDF</button>
      <BudgetTools/>
      <WallEditingTools/>
      <label>Paso de rejilla<select aria-label="Paso de rejilla" value={project.editor?.grid??.1} onChange={e=>change(p=>{p.editor={...(p.editor??{magnet:true,orthogonal:true,grid:.1}),grid:Number(e.target.value)};})}>{[.01,.05,.1,.25,.5,1].map(value=><option key={value} value={value}>{value*100} cm</option>)}</select></label>
      <label className="studio-check"><input type="checkbox" aria-label="Ajuste magnético" checked={project.editor?.magnet!==false} onChange={e=>change(p=>{p.editor={...(p.editor??{grid:.1,magnet:true,orthogonal:true}),magnet:e.target.checked};})}/> Ajustar a puntos, muros y muebles cercanos</label>
      <label className="studio-check"><input type="checkbox" aria-label="Ajuste ortogonal" checked={project.editor?.orthogonal!==false} onChange={e=>change(p=>{p.editor={...(p.editor??{grid:.1,magnet:true,orthogonal:true}),orthogonal:e.target.checked};})}/> Favorecer tabiques horizontales y verticales</label>
      <button onClick={()=>{setFurnitureGroup(project.furniture.map(f=>f.id));setMessage(`${project.furniture.length} objetos seleccionados.`);}}>Seleccionar todos los objetos</button><button disabled={!selectedFurniture.length} onClick={()=>{const ids:string[]=[];change(p=>{for(const original of p.furniture.filter(f=>selectedFurniture.includes(f.id))){const f=structuredClone(original);f.id=makeId();f.x+=.25;f.y+=.25;f.name+=' · copia';ids.push(f.id);p.furniture.push(f);}});setFurnitureGroup(ids);setMessage('Selección duplicada.');}}>Duplicar selección ({selectedFurniture.length})</button>
      <h4>Ampliar envolvente sin escalar muebles</h4><label>Ancho nuevo (m)<input aria-label="Ancho anclado" type="number" min="2" max="100" step=".1" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label><label>Fondo nuevo (m)<input aria-label="Fondo anclado" type="number" min="2" max="100" step=".1" value={depth} onChange={e=>setDepth(Number(e.target.value))}/></label><label>Esquina fija<select aria-label="Anclaje de dimensiones" value={anchor} onChange={e=>setAnchor(e.target.value)}><option value="nw">Superior izquierda</option><option value="ne">Superior derecha</option><option value="sw">Inferior izquierda</option><option value="se">Inferior derecha</option></select></label><button onClick={applyResize}>Actualizar envolvente anclada</button>
      <h4>Plano de referencia</h4><label>Imagen PNG, JPEG o WebP<input aria-label="Imagen de plano de referencia" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(!file)return;void run(async()=>{if(file.size>5*1024*1024)throw new Error('La imagen debe ocupar menos de 5 MB.');const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});const image=new Image();image.src=data;await image.decode();const scale=Math.min(1,1600/image.width,1600/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d')!;context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);const safeData=canvas.toDataURL('image/jpeg',.8);change(p=>{p.referenceImage={data:safeData,width:p.width,height:p.width*image.height/image.width,opacity:.5};});setMessage('Referencia añadida. Indica el ancho real de la imagen para calibrar la escala.');});}}/></label>
      {project.referenceImage&&<><label>Ancho real de la imagen (m)<input aria-label="Ancho real de referencia" type="number" min=".1" max="100" step=".01" value={project.referenceImage.width} onChange={e=>{const w=Number(e.target.value);change(p=>{if(p.referenceImage){p.referenceImage.height*=w/p.referenceImage.width;p.referenceImage.width=w;}});}}/></label><label>Opacidad de referencia<input type="range" min="0" max="1" step=".05" value={project.referenceImage.opacity} onChange={e=>change(p=>{if(p.referenceImage)p.referenceImage.opacity=Number(e.target.value);})}/></label><button onClick={()=>change(p=>{delete p.referenceImage;})}>Quitar referencia</button></>}
      <h4>Superficies aproximadas</h4><ul>{project.rooms.map(r=><li key={r.id}>{r.name}: {approximateNetArea(r,project).toFixed(2)} m² descontando espesor, aproximadamente.</li>)}</ul><p className="small-help">Estimación por ejes y espesor. No sustituye medición técnica ni verificación de habitabilidad.</p>
      <h4>Avisos para revisar</h4><ul>{[...projectWarnings(project),...furnitureCollisions(project)].slice(0,40).map((warning,i)=><li key={i}>{warning}</li>)}</ul>
      <h4>Recursos guardados</h4><p>Los modelos se comparten entre propuestas. Solo se puede retirar un recurso si ningún proyecto, respaldo local, versión, comparación o paso del historial lo utiliza.</p>
      {assets.map(asset=><article className="resource-row" key={asset.id}><span>{asset.metadata?.name??asset.id.slice(0,20)} · {(asset.size/1048576).toFixed(2)} MB</span><button disabled={busy} aria-label={`Eliminar recurso ${asset.metadata?.name??asset.id}`} onClick={()=>void run(async()=>{
        await deleteUnusedModelResource(asset.id,()=>{
          const state=useEditor.getState(),drag=state.dragCheckpoint,compare=comparisonRef.current;
          return [state.project,...state.history,...state.redoStack,...(drag?[drag.project,...drag.history,...drag.redoStack]:[]),...(compare?[compare.base,compare.other]:[])];
        });
        setAssets(await listModelAssets());setMessage('Recurso eliminado de la biblioteca.');
      })}>Eliminar recurso</button></article>)}
      {item?.kind==='model'&&<label>Reemplazar archivo del objeto seleccionado<input type="file" accept=".glb" aria-label="Reparar modelo seleccionado" onChange={e=>{const file=e.target.files?.[0];if(!file)return;void run(async()=>{
        if(file.size>12*1024*1024)throw new Error('Modelo demasiado grande. Máximo 12 MB.');await validateGLB(file);const assetId=makeId();await putModelAsset(assetId,file);
        change(p=>{const f=p.furniture.find(f=>f.id===item.id);if(f){f.assetId=assetId;delete f.modelData;delete f.productId;delete f.productSource;}});setAssets(await listModelAssets());setMessage('Archivo reemplazado solo en este objeto. Se mantienen sus medidas y posición.');
      });}}/></label>}
    </>}
    </div>
  </dialog>;
}
