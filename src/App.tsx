import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Armchair, ArrowDownToLine, Box, Camera, Check, ChevronDown, CircleHelp, Copy, DoorOpen, Eye, EyeOff, FilePlus2, FolderOpen, Grid2X2, Hammer, House, Image, Layers, LayoutGrid, Maximize2, Move, Paintbrush, PanelRightClose, Plus, Redo2, RotateCcw, RotateCw, Ruler, Save, Settings2, SlidersHorizontal, SplitSquareVertical, Trash2, Undo2, Upload, WandSparkles } from 'lucide-react';
import Plan2D from './components/Plan2D';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import Scene3D from './components/Scene3D';
import { catalog, floors, styles } from './data/catalog';
import { findProductSource, PRODUCT_CATALOG_VERSION } from './data/productCatalog';
import { blankProject } from './data/defaultProject';
import { clamp, download, fileSafe, makeId, wallLength } from './lib/geometry';
import { projectWarnings, reconcileRooms, resizeProject, roomArea, updateWallGeometry } from './lib/topology';
import { blobToDataURL, dataURLToBlob, deleteModelAsset, getModelAsset, listModelAssets, putModelAsset, putModelMetadata } from './lib/assets';
import { isProject, saveLocal, useEditor } from './store';
import { measureModelDimensions, renderModelThumbnail } from './lib/modelThumbnail';
import type { FloorFinish, Furniture, Mode, Palette, Project, RoomKind, Selection, Tool } from './types';

type SideTab = 'objects' | 'materials' | 'rooms';
const toolbar: {type:Tool;label:string;icon:ReactNode;hint:string}[] = [
  {type:'select',label:'Seleccionar',icon:<Move size={17}/>,hint:'Seleccionar y mover muebles, paredes y sus extremos'},
  {type:'wall',label:'Tabique',icon:<Ruler size={17}/>,hint:'Dibuja dos puntos para crear un tabique'},
  {type:'door',label:'Puerta',icon:<DoorOpen size={17}/>,hint:'Haz clic sobre un tabique para crear una puerta'},
  {type:'window',label:'Ventana',icon:<Maximize2 size={17}/>,hint:'Haz clic sobre un tabique para crear una ventana'},
  {type:'room',label:'Estancia',icon:<LayoutGrid size={17}/>,hint:'Marca dos esquinas para delimitar una estancia con paredes'},
];
const KIND_NAMES:Record<RoomKind,string>={living:'Zona de día',bedroom:'Dormitorio',bathroom:'Baño',hall:'Pasillo / distribuidor'};
const kindColors:Record<string,string>={living:'#d7c6a9',bedroom:'#ccd2bd',bathroom:'#b1c8c8',hall:'#d1d1ce'};
function Field({label,value,onChange,min=-100,max=100,step=.1,suffix='m'}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;step?:number;suffix?:string}){
  return <label className="field"><span>{label}</span><div className="input-suffix"><input type="number" min={min} max={max} step={step} value={Number(value.toFixed(3))} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(clamp(n,min,max));}}/><small>{suffix}</small></div></label>;
}
function ModelMaterialPicker({item,onChange}:{item:Furniture;onChange:(name:string|undefined)=>void}){
  const [names,setNames]=useState<string[]>([]);
  const [unnamed,setUnnamed]=useState<{id:string;label:string}[]>([]);
  const [status,setStatus]=useState('Leyendo materiales del modelo…');
  useEffect(()=>{
    let active=true;
    setNames([]);setUnnamed([]);setStatus('Leyendo materiales del modelo…');
    const load=async()=>{
      const blob=item.modelData?dataURLToBlob(item.modelData):item.assetId?await getModelAsset(item.assetId):null;
      if(!blob)throw new Error('No se encuentra el archivo GLB.');
      const gltf=await new GLTFLoader().parseAsync(await blob.arrayBuffer(),'');
      const found=new Set<string>();const missing:{id:string;label:string}[]=[];let meshIndex=0;
      gltf.scene.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const currentMesh=meshIndex++;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        for(const [slot,material] of materials.entries()){
          if(!(material instanceof THREE.MeshStandardMaterial))continue;
          if(material.name.trim())found.add(material.name);
          else missing.push({id:`@mesh:${currentMesh}:slot:${slot}`,label:`${object.name||`Malla ${currentMesh+1}`} · superficie ${slot+1} (sin nombre)`});
        }
      });
      if(active){setNames([...found].sort((a,b)=>a.localeCompare(b)));setUnnamed(missing);setStatus('');}
    };
    void load().catch(error=>{if(active)setStatus(error instanceof Error?error.message:'No se pudieron leer los materiales.');});
    return()=>{active=false;};
  },[item.assetId,item.modelData]);
  const selected=item.modelFinish?.materialName??'';
  return <><label className="field"><span>Material del GLB</span><select aria-label="Material GLB objetivo" value={selected} onChange={event=>onChange(event.target.value||undefined)}>
    <option value="">Todos los materiales PBR</option>
    {selected&&!names.includes(selected)&&!unnamed.some(entry=>entry.id===selected)&&<option value={selected}>{selected} (no encontrado)</option>}
    {names.map(name=><option key={name} value={name}>{name}</option>)}
    {unnamed.map(entry=><option key={entry.id} value={entry.id}>{entry.label}</option>)}
  </select></label>
  {status&&<p className="small-help" role="status">{status}</p>}
  {unnamed.length>0&&<p className="small-help">{unnamed.length} superficies sin nombre disponibles para editar individualmente.</p>}
  {!status&&names.length===0&&unnamed.length===0&&<p className="small-help">El GLB no contiene materiales PBR editables.</p>}
  </>;
}

function Sidebar({importModel,modelUnits,setModelUnits}:{importModel:()=>void;modelUnits:'m'|'cm'|'mm';setModelUnits:(unit:'m'|'cm'|'mm')=>void}){
  const [tab,setTab]=useState<SideTab>('objects');
  const [filter,setFilter]=useState('Todos');
  const [search,setSearch]=useState('');
  const [localModels,setLocalModels]=useState<Awaited<ReturnType<typeof listModelAssets>>>([]);
  const [libraryError,setLibraryError]=useState('');
  const [librarySearch,setLibrarySearch]=useState('');
  const [onlyLicensed,setOnlyLicensed]=useState(false);
  const [editingModel,setEditingModel]=useState<string|null>(null);
  const [modelDraft,setModelDraft]=useState({name:'',source:'',license:'',w:'',d:'',h:''});
  const [savingModel,setSavingModel]=useState(false);
  const [renderingThumbnail,setRenderingThumbnail]=useState(false);
  const [modelThumbnail,setModelThumbnail]=useState<string|undefined>();
  const uploadThumbnail=async(file:File)=>{
    if(!file.type.startsWith('image/')||file.size>5*1024*1024){setLibraryError('Selecciona una imagen de hasta 5 MB.');return;}
    const url=URL.createObjectURL(file);
    try{
      const img=new window.Image();
      await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Imagen no válida'));img.src=url;});
      const canvas=document.createElement('canvas');
      const ratio=Math.min(1,256/img.naturalWidth,256/img.naturalHeight);
      canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas no disponible');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      setModelThumbnail(canvas.toDataURL('image/jpeg',0.75));setLibraryError('');
    }catch{setLibraryError('No se ha podido procesar la miniatura.');}
    finally{URL.revokeObjectURL(url);}
  };
  const generateThumbnail=async()=>{
    if(!editingModel||renderingThumbnail)return;
    setRenderingThumbnail(true);setLibraryError('');
    try{
      const blob=await getModelAsset(editingModel);
      if(!blob)throw new Error('Archivo GLB no disponible.');
      setModelThumbnail(await renderModelThumbnail(blob));
    }catch(e){setLibraryError(e instanceof Error?'No se pudo generar la vista previa: '+e.message:'No se pudo generar la vista previa.');}
    finally{setRenderingThumbnail(false);}
  };
  const editModel=(model:Awaited<ReturnType<typeof listModelAssets>>[number])=>{
    setEditingModel(model.id);setModelThumbnail(model.metadata?.thumbnail);
    setModelDraft({name:model.metadata?.name??'',source:model.metadata?.source??'',license:model.metadata?.license??'',w:String(model.metadata?.w??''),d:String(model.metadata?.d??''),h:String(model.metadata?.h??'')});
    setLibraryError('');
  };
  const saveModelDetails=async()=>{
    if(!editingModel||savingModel)return;
    const dimensions=[modelDraft.w,modelDraft.d,modelDraft.h];
    if(!modelDraft.name.trim()||dimensions.some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>15))){setLibraryError('Indica un nombre y dimensiones válidas entre 0 y 15 m.');return;}
    setSavingModel(true);
    try{
      await putModelMetadata(editingModel,{name:modelDraft.name.trim(),source:modelDraft.source.trim()||undefined,license:modelDraft.license.trim()||undefined,thumbnail:modelThumbnail,...Object.fromEntries((['w','d','h'] as const).filter(k=>modelDraft[k]!=='').map(k=>[k,Number(modelDraft[k])]))});
      await refreshModels();setEditingModel(null);
    }catch{setLibraryError('No se han podido guardar los datos del modelo.');}
    finally{setSavingModel(false);}
  };
  const refreshModels=async()=>{try{setLocalModels(await listModelAssets());setLibraryError('');}catch{setLibraryError('No se ha podido abrir la biblioteca local.');}};
  useEffect(()=>{void refreshModels();},[]);
  const { project,change,setSelection,setTool,setMode }=useEditor();
  const groups=['Todos',...new Set(catalog.map(item=>item.category))];
  const visibleLocalModels=localModels.filter(model=>{
    const query=librarySearch.trim().toLocaleLowerCase();
    const matches=[model.metadata?.name,model.metadata?.source,model.metadata?.license,model.id].some(value=>value?.toLocaleLowerCase().includes(query));
    return matches&&(!onlyLicensed||Boolean(model.metadata?.license?.trim()));
  });
  const visible=catalog.filter(o=>(filter==='Todos'||o.category===filter)&&[o.name,o.category,findProductSource(o.kind)?.reference].some(value=>value?.toLowerCase().includes(search.toLowerCase())));
  const add=(entry:typeof catalog[number])=>{
    const id=makeId();
    change(p=>p.furniture.push({id,kind:entry.kind,name:entry.name,x:clamp(2+(p.furniture.length%5)*.22,.5,p.width-.5),y:clamp(2.7,.5,p.depth-.5),w:entry.w,d:entry.d,h:entry.h,rotation:0,color:entry.color,productId:findProductSource(entry.kind)?.id}));
    setSelection({type:'furniture',id}); setTool('select');setMode('split');
  };
  const insertStoredModel=async(assetId:string)=>{
    try{
      if(!await getModelAsset(assetId)){setLibraryError('El archivo ya no está disponible.');void refreshModels();return;}
      const existing=project.furniture.find(f=>f.kind==='model'&&f.assetId===assetId);
      const modelMetadata=localModels.find(model=>model.id===assetId)?.metadata;
      const id=makeId();
      change(p=>p.furniture.push({id,kind:'model',name:modelMetadata?.name??existing?.name??'Modelo GLB guardado',x:p.width/2,y:p.depth/2,w:modelMetadata?.w??existing?.w??1,d:modelMetadata?.d??existing?.d??1,h:modelMetadata?.h??existing?.h??1,rotation:0,color:existing?.color??'#e2e2df',assetId}));
      setSelection({type:'furniture',id});setTool('select');setMode('split');
    }catch{setLibraryError('No se ha podido recuperar el modelo.');}
  };
  const applyStyle=(name:string,palette:Palette)=>change(p=>{p.palette={...palette};p.furniture=p.furniture.map(f=>({...f,color:f.kind==='sofa'?palette.textile:f.kind==='chair'||f.kind==='table'?palette.wood:f.color}));});
  return <aside className="sidebar">
    <div className="sidebar-heading"><div><span className="eyebrow">TU ESTUDIO</span><h2>Elementos y acabados</h2></div><div className="sidebar-count">{project.furniture.length} objetos</div></div>
    <div className="sidebar-tabs">
      <button className={tab==='objects'?'active':''} onClick={()=>setTab('objects')}><Armchair size={15}/> Objetos</button>
      <button className={tab==='materials'?'active':''} onClick={()=>setTab('materials')}><Paintbrush size={15}/> Materiales</button>
      <button className={tab==='rooms'?'active':''} onClick={()=>setTab('rooms')}><Layers size={15}/> Estancias</button>
    </div>
    <div className="sidebar-content">
      {tab==='objects'&&<>
        <p className="small-help">Añade elementos al plano y arrástralos hasta su posición.</p>
        <input className="search" placeholder="Buscar muebles..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="chips">{groups.map(g=><button key={g} className={filter===g?'active':''} onClick={()=>setFilter(g)}>{g}</button>)}</div>
        <div className="section-label">CATÁLOGO PARAMÉTRICO · V{PRODUCT_CATALOG_VERSION}</div>
        <div className="catalog-grid">{visible.map(c=><button className="catalog-card" key={c.kind} onClick={()=>add(c)} title={`Añadir ${c.name}`}><span className="catalog-icon">{c.icon}</span><span className="catalog-name">{c.name}</span><small>{c.w} × {c.d} m</small><small title="Geometría original, no producto comercial">{findProductSource(c.kind)?.reference} · Diseño propio</small><span className="add-overlay"><Plus size={15}/></span></button>)}</div>
        <div className="section-label">BIBLIOTECA GLB LOCAL <button type="button" onClick={()=>void refreshModels()} title="Actualizar biblioteca">Actualizar</button></div>
        <p className="small-help">Modelos guardados en este navegador, incluso de otros proyectos. No se sincronizan entre dispositivos.</p>
        <input className="search" aria-label="Buscar en biblioteca GLB" placeholder="Buscar modelos, origen o licencia…" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)}/>
        <label className="small-help"><input type="checkbox" checked={onlyLicensed} onChange={e=>setOnlyLicensed(e.target.checked)}/> Solo con licencia indicada</label>
        <p className="small-help">{visibleLocalModels.length} de {localModels.length} modelos disponibles</p>
        {libraryError&&<p role="alert" className="footnote">{libraryError}</p>}
        <div className="catalog-grid">{visibleLocalModels.map(model=>{const match=project.furniture.find(f=>f.kind==='model'&&f.assetId===model.id);return <button className="catalog-card" key={model.id} onClick={()=>void insertStoredModel(model.id)} title="Insertar modelo guardado"><span className="catalog-icon">{model.metadata?.thumbnail?<img src={model.metadata.thumbnail} alt="" style={{width:64,height:64,objectFit:"contain",borderRadius:6}}/>:<Box size={24}/>}</span><span className="catalog-name">{model.metadata?.name??match?.name??'GLB · '+model.id.slice(0,8)}</span><small>{(model.size/1048576).toFixed(2)} MB</small>{model.metadata?.source&&<small title={model.metadata.source}>Origen: {model.metadata.source}</small>}{model.metadata?.license&&<small>Licencia: {model.metadata.license}</small>}<span className="add-overlay"><Plus size={15}/></span></button>;})}</div>
        {localModels.length>0&&visibleLocalModels.length===0&&<p className="small-help">No hay modelos que coincidan con estos filtros.</p>}
        {localModels.length>0&&<div className="section-label">EDITAR FICHA DE MODELO</div>}
        {localModels.length>0&&<label className="field"><span>Modelo de la biblioteca</span><select aria-label="Editar ficha GLB" value={editingModel??""} onChange={e=>{const model=localModels.find(m=>m.id===e.target.value);if(model)editModel(model);else setEditingModel(null);}}><option value="">Seleccionar modelo…</option>{localModels.map(m=><option key={m.id} value={m.id}>{m.metadata?.name??m.id.slice(0,8)}</option>)}</select></label>}
        {editingModel&&<div className="dimension-form"><label className="field"><span>Miniatura (imagen local)</span><button type="button" disabled={renderingThumbnail} onClick={()=>void generateThumbnail()}>{renderingThumbnail?"Generando vista…":"Generar miniatura desde GLB"}</button><input type="file" accept="image/*" aria-label="Miniatura del GLB" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadThumbnail(file);}}/></label>{modelThumbnail&&<div><img src={modelThumbnail} alt="Vista previa de miniatura" style={{maxWidth:128,maxHeight:128,objectFit:"contain"}}/><button type="button" onClick={()=>setModelThumbnail(undefined)}>Quitar miniatura</button></div>}<p className="small-help">Los cambios se guardan en este navegador y se aplican al insertar el modelo de nuevo. No modifican instancias existentes.</p>{([["name","Nombre"],["source","Procedencia"],["license","Licencia"],["w","Ancho (m)"],["d","Fondo (m)"],["h","Alto (m)"]] as const).map(([key,label])=><label className="field" key={key}><span>{label}</span><input aria-label={label+" del GLB"} type={key==="w"||key==="d"||key==="h"?"number":"text"} min={key==="w"||key==="d"||key==="h"?"0.01":undefined} max={key==="w"||key==="d"||key==="h"?"15":undefined} step="0.01" value={modelDraft[key]} onChange={e=>setModelDraft(prev=>({...prev,[key]:e.target.value}))}/></label>)}<button type="button" className="primary-btn" disabled={savingModel} onClick={()=>void saveModelDetails()}>{savingModel?"Guardando…":"Guardar ficha GLB"}</button></div>}
        <p className="footnote">Los elementos incluidos son diseños paramétricos propios, no modelos comerciales. Las referencias identifican cada diseño; no representan SKU de fabricantes externos.</p><label className="field"><span>Unidades del archivo GLB</span><select aria-label="Unidades del modelo GLB" value={modelUnits} onChange={e=>setModelUnits(e.target.value as 'm'|'cm'|'mm')}><option value="m">Metros (m)</option><option value="cm">Centímetros (cm)</option><option value="mm">Milímetros (mm)</option></select></label><button className="import-card" onClick={importModel}><Upload size={18}/><span><strong>Importar modelo 3D</strong><small>Archivo .glb local · máx. 12 MB</small></span><Plus size={16}/></button>
      </>}
      {tab==='materials'&&<>
        <p className="small-help">Aplica un ambiente completo o modifica los materiales de cada estancia desde sus propiedades.</p>
        <div className="section-label">PALETAS DE INTERIORISMO</div>
        <div className="style-list">{Object.entries(styles).map(([name,palette])=><button key={name} className="style-item" onClick={()=>applyStyle(name,palette)}><span className="style-swatches">{[palette.walls,palette.wood,palette.accent,palette.textile].map((c,i)=><i key={i} style={{background:c}}/>)}</span><span><strong>{name}</strong><small>Aplicar combinación</small></span><ChevronDown size={14}/></button>)}</div>
        <div className="section-label">ACABADOS DE PAVIMENTO</div>
        <div className="material-list">{Object.entries(floors).map(([key,f])=><button key={key} onClick={()=>change(p=>{p.rooms.forEach(room=>{if(room.kind!=='bathroom')room.floor=key as FloorFinish;});})}><i style={{background:f.color}}/><span>{f.label}</span><Plus size={14}/></button>)}</div>
        <p className="footnote">Los acabados se simulan mediante materiales y colores. Los catálogos comerciales y texturas PBR llegarían en una fase posterior.</p>
      </>}
      {tab==='rooms'&&<>
        <p className="small-help">Selecciona una estancia para modificar el tipo de suelo, el nombre y sus dimensiones conceptuales.</p>
        <div className="room-list">{project.rooms.map(r=><button key={r.id} onClick={()=>{setSelection({type:'room',id:r.id});setTool('select');}}><i style={{background:kindColors[r.kind]}}/><span><strong>{r.name}</strong><small>{roomArea(r).toFixed(1)} m² · {floors[r.floor]?.label}</small></span><ChevronDown size={14}/></button>)}</div>
        <div className="room-totals"><span>Superficie de la envolvente</span><strong>{(project.width*project.depth).toFixed(1)} m²</strong></div>
        <p className="footnote">Superficies estimadas desde los ejes de los tabiques, no superficies útiles certificadas. Para crear estancias nuevas, cierra su perímetro con paredes.</p>
      </>}
    </div>
    <div className="sidebar-bottom"><CircleHelp size={16}/><span>Consejo: empieza en 2D y comprueba el resultado en 3D.</span></div>
  </aside>;
}
function DimensionForm(){
  const {project,change}=useEditor();
  const [width,setWidth]=useState(project.width.toFixed(2));
  const [depth,setDepth]=useState(project.depth.toFixed(2));
  const [resizeMode,setResizeMode]=useState<'scale'|'keep'>('scale');
  useEffect(()=>{setWidth(project.width.toFixed(2));setDepth(project.depth.toFixed(2));},[project.width,project.depth]);
  const w=Number(width),d=Number(depth),valid=width!==''&&depth!==''&&Number.isFinite(w)&&Number.isFinite(d)&&w>=2&&w<=100&&d>=2&&d<=100;
  return <form noValidate className="properties-body dimension-form" onSubmit={e=>{e.preventDefault();if(valid)change(p=>resizeProject(p,w,d,resizeMode));}}>
    <p className="small-help">Cambia ancho y fondo en metros. Confirma los cambios para actualizar la distribución 2D y 3D.</p>
    <div className="field-grid"><label className="field"><span>Ancho (m)</span><input aria-label="Ancho de la vivienda" type="number" step="0.1" min="2" max="100" value={width} onChange={e=>setWidth(e.target.value)}/></label><label className="field"><span>Fondo (m)</span><input aria-label="Fondo de la vivienda" type="number" step="0.1" min="2" max="100" value={depth} onChange={e=>setDepth(e.target.value)}/></label></div>
    <div className="area-preview">Superficie prevista <strong>{valid?(w*d).toFixed(1):'—'} m²</strong></div>
    <label className="field"><span>Aplicar dimensiones</span><select aria-label="Modo de redimensionado" value={resizeMode} onChange={e=>setResizeMode(e.target.value as 'scale'|'keep')}><option value="scale">Escalar distribución proporcionalmente</option><option value="keep">Mantener posiciones interiores</option></select></label>
    <p className="footnote">Al escalar, se mueven paredes y centros de muebles pero sus tamaños físicos se mantienen. Si mantienes posiciones, puede haber objetos fuera del nuevo límite.</p>
    <button className="primary-btn resize-submit" type="submit" disabled={!valid||(w===project.width&&d===project.depth)}>Actualizar la planta</button>
    {projectWarnings(project).length>0&&<div className="geometry-warnings" role="status"><strong>Revisar geometría ({projectWarnings(project).length})</strong><ul>{projectWarnings(project).slice(0,8).map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
    <div className="section-label">ALTURA DE LOS MUROS</div><Field label="Altura" value={project.wallHeight} min={2} max={4} step={.01} onChange={n=>change(p=>{p.wallHeight=n;})}/>
  </form>;
}
function PropertyPanel(){
  const {project,selection,change,setSelection}=useEditor();
  const item=selection?.type==='furniture'?project.furniture.find(i=>i.id===selection.id):undefined;
  const room=selection?.type==='room'?project.rooms.find(i=>i.id===selection.id):undefined;
  const wall=selection?.type==='wall'?project.walls.find(i=>i.id===selection.id):undefined;
  const opening=selection?.type==='opening'?project.openings.find(i=>i.id===selection.id):undefined;
  const updateItem=(patch:Partial<Furniture>)=>{if(!item)return;change(p=>{const f=p.furniture.find(i=>i.id===item.id);if(f)Object.assign(f,patch);});};
  const remove=()=>{
    if(!selection)return;
    change(p=>{
      if(selection.type==='furniture')p.furniture=p.furniture.filter(i=>i.id!==selection.id);
      if(selection.type==='room')p.rooms=p.rooms.filter(i=>i.id!==selection.id);
      if(selection.type==='wall'){p.walls=p.walls.filter(i=>i.id!==selection.id);p.openings=p.openings.filter(i=>i.wallId!==selection.id);reconcileRooms(p);}
      if(selection.type==='opening')p.openings=p.openings.filter(i=>i.id!==selection.id);
    });setSelection(null);
  };
  const replaceProduct=(kind:string)=>{
    if(!item || item.kind==='model')return;
    const entry=catalog.find(product=>product.kind===kind);
    if(!entry || entry.kind==='model')return;
    // Keep the instance ID, position and rotation so selection, undo and JSON remain stable.
    change(p=>{
      const current=p.furniture.find(f=>f.id===item.id);
      if(!current || current.kind==='model')return;
      Object.assign(current,{
        kind:entry.kind,name:entry.name,w:entry.w,d:entry.d,h:entry.h,
        color:entry.color,productId:findProductSource(entry.kind)?.id,
      });
    });
  };
  // Reuse an already imported GLB without copying its bytes or changing the instance transform.
  // The asset remains in IndexedDB because other instances and undo history may refer to it.
  const replaceImportedModel=async(sourceId:string)=>{
    if(!item || item.kind!=='model')return;
    const source=project.furniture.find(f=>f.id===sourceId && f.kind==='model');
    if(!source || source.id===item.id)return;
    try{
      if(source.assetId && !await getModelAsset(source.assetId)){
        alert('El archivo 3D de origen ya no está disponible en este navegador.');
        return;
      }
      if(!source.assetId && !source.modelData){
        alert('El modelo de origen no contiene un archivo 3D reutilizable.');
        return;
      }
      change(p=>{
        const target=p.furniture.find(f=>f.id===item.id);
        if(!target || target.kind!=='model')return;
        target.name=source.name;
        target.assetId=source.assetId;
        target.modelData=source.modelData;
        target.productId=source.productId;
        // Retain target x/y, rotation and dimensions for a predictable replacement.
      });
    }catch{
      alert('No se ha podido comprobar el archivo 3D. El objeto no se ha modificado.');
    }
  };
  const duplicate=()=>{if(!item)return;const id=makeId();change(p=>p.furniture.push({...structuredClone(item),id,name:`${item.name} (copia)`,x:clamp(item.x+.25,0,p.width),y:clamp(item.y+.25,0,p.depth)}));setSelection({type:'furniture',id});};
  return <aside className="inspector">
    <div className="inspector-head"><span className="eyebrow">PANEL DE EDICIÓN</span><h2>{item?item.name:room?room.name:wall?'Tabique':opening?(opening.kind==='door'?'Puerta':'Ventana'):'Propiedades'}</h2><span>{selection?'Edición del elemento seleccionado':'Selecciona un elemento del plano'}</span></div>
    <div className="inspector-scroll">
      {!selection&&<><div className="section-label" style={{padding:'18px 20px 0'}}>DIMENSIONES DE LA VIVIENDA</div><DimensionForm/></>}
      {item&&<div className="properties-body"><div className="section-label">REFERENCIA DE CATÁLOGO</div><p className="small-help">{item.productId ?? findProductSource(item.kind)?.id ?? "Modelo importado sin referencia de catálogo"} · {findProductSource(item.kind)?.license ?? "Archivo aportado por el usuario"}</p>{item.kind==='model'&&<><div className="section-label">SUSTITUIR MODELO 3D</div><label className="field"><span>Modelo importado en este proyecto</span><select aria-label="Sustituir modelo 3D" value="" onChange={e=>{void replaceImportedModel(e.target.value);}}><option value="">Selecciona otro modelo…</option>{project.furniture.filter(f=>f.kind==='model'&&f.id!==item.id&&(f.assetId||f.modelData)).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><p className="footnote">Reutiliza el GLB sin duplicar el archivo. Mantiene posición, rotación, tamaño e identidad de esta instancia; admite deshacer.</p></>}{item.kind!=='model'&&<><div className="section-label">SUSTITUIR PRODUCTO</div><label className="field"><span>Diseño del catálogo</span><select aria-label="Sustituir producto" value={item.kind} onChange={e=>replaceProduct(e.target.value)}>{catalog.filter(entry=>entry.kind!=='model').map(entry=><option key={entry.kind} value={entry.kind}>{entry.name} · {entry.w} × {entry.d} m</option>)}</select></label><p className="footnote">Conserva la posición, orientación e identidad del objeto. Adopta las dimensiones y el acabado predeterminado del nuevo diseño. Puedes deshacer el cambio.</p></>}<div className="section-label">POSICIÓN</div><div className="field-grid"><Field label="X" value={item.x} min={0} max={project.width} onChange={n=>updateItem({x:n})}/><Field label="Y" value={item.y} min={0} max={project.depth} onChange={n=>updateItem({y:n})}/></div><div className="section-label">DIMENSIONES</div><div className="field-grid"><Field label="Ancho" value={item.w} min={.1} max={15} onChange={n=>updateItem({w:n})}/><Field label="Fondo" value={item.d} min={.1} max={15} onChange={n=>updateItem({d:n})}/><Field label="Alto" value={item.h} min={.03} max={6} onChange={n=>updateItem({h:n})}/><Field label="Rotación" value={item.rotation} min={0} max={360} step={15} suffix="°" onChange={n=>updateItem({rotation:n})}/></div>{item.kind==='model'&&<><div className="section-label">ORIENTACIÓN DEL MODELO GLB</div><label className="field"><span>Eje vertical de origen</span><select aria-label="Eje vertical del modelo GLB" value={item.modelUpAxis??'Y'} onChange={e=>updateItem({modelUpAxis:e.target.value as 'Y'|'Z'|'X'})}><option value="Y">Y (glTF estándar)</option><option value="Z">Z (modelos CAD)</option><option value="X">X (otros formatos)</option></select></label><p className="small-help">Corrige la orientación de esta instancia sin alterar el archivo original. Las dimensiones siguen siendo editables.</p><Field label="Elevación del GLB" value={item.modelElevation??0} min={-3} max={6} step={0.01} onChange={n=>updateItem({modelElevation:n})}/><div className="field-grid"><Field label="Desfase GLB X" value={item.modelOffsetX??0} min={-5} max={5} step={0.01} onChange={n=>updateItem({modelOffsetX:n})}/><Field label="Desfase GLB Z" value={item.modelOffsetZ??0} min={-5} max={5} step={0.01} onChange={n=>updateItem({modelOffsetZ:n})}/></div><p className="small-help">Ajusta el pivote horizontal del modelo en metros sin cambiar la posición del objeto en planta. Valor 0: centrado. Los cambios admiten deshacer.</p><p className="small-help">Desplaza la geometría verticalmente en metros sin mover su huella en el plano 2D. Valor 0: apoyado en el suelo; admite deshacer.</p></>}{item.kind==='model'&&<><div className="section-label">ACABADO PBR DEL GLB</div><label className="field"><span><input type="checkbox" checked={!!item.modelFinish} onChange={e=>updateItem({modelFinish:e.target.checked?{color:item.color,roughness:0.8,metalness:0}:undefined})}/> Sobrescribir materiales de esta instancia</span></label>{item.modelFinish&&<><label className="color-field">Color PBR <input aria-label="Color PBR del GLB" type="color" value={item.modelFinish.color} onChange={e=>updateItem({modelFinish:{...item.modelFinish!,color:e.target.value}})}/></label><Field label="Rugosidad PBR" value={item.modelFinish.roughness} min={0} max={1} step={0.05} onChange={n=>updateItem({modelFinish:{...item.modelFinish!,roughness:n}})}/><Field label="Metalicidad PBR" value={item.modelFinish.metalness} min={0} max={1} step={0.05} onChange={n=>updateItem({modelFinish:{...item.modelFinish!,metalness:n}})}/><ModelMaterialPicker item={item} onChange={materialName=>updateItem({modelFinish:{...item.modelFinish!,materialName}})}/><button type="button" className="btn" disabled={(item.modelFinishes?.length??0)>=32} onClick={()=>updateItem({modelFinishes:[...(item.modelFinishes??[]).filter(f=>f.materialName!==item.modelFinish!.materialName),item.modelFinish!],modelFinish:undefined})}>Guardar acabado y añadir otro</button><p className="small-help">Selecciona un material del archivo para cambiar solo sus superficies. El archivo original no se modifica.</p></>}<p className="small-help">Modifica todas las superficies PBR de esta instancia sin alterar el GLB original. Desactiva para recuperar sus materiales.</p></>}{item.kind==='model'&&(item.modelFinishes?.length??0)>0&&<><div className="section-label">ACABADOS GUARDADOS</div>{item.modelFinishes!.map((finish,index)=><div key={index} className="field"><span style={{display:"inline-flex",alignItems:"center",gap:8}}><span aria-hidden="true" style={{display:"inline-block",width:20,height:20,flexShrink:0,borderRadius:5,border:"1px solid #aaa",backgroundColor:finish.color}}/><span>{finish.materialName||'Todas las superficies'} · {finish.color}</span></span><button type="button" aria-label={`Subir acabado ${index+1}`} disabled={index===0} onClick={()=>updateItem({modelFinishes:item.modelFinishes!.map((f,i,arr)=>i===index-1?arr[index]:i===index?arr[index-1]:f)})}>↑</button><button type="button" aria-label={`Bajar acabado ${index+1}`} disabled={index===item.modelFinishes!.length-1} onClick={()=>updateItem({modelFinishes:item.modelFinishes!.map((f,i,arr)=>i===index+1?arr[index]:i===index?arr[index+1]:f)})}>↓</button><button type="button" onClick={()=>updateItem({modelFinish:finish,modelFinishes:item.modelFinishes!.filter((_,i)=>i!==index)})}>Editar</button><button type="button" onClick={()=>updateItem({modelFinishes:item.modelFinishes!.filter((_,i)=>i!==index)})}>Restaurar original</button></div>)}</>}<div className="section-label">ACABADO</div><label className="color-field">Color principal <input type="color" value={item.color} onChange={e=>updateItem({color:e.target.value})}/></label><div className="color-presets">{['#f1eee9','#d4c8b8','#a8b5a0','#c4a17b','#747b78','#3d4542'].map(c=><button key={c} style={{background:c}} onClick={()=>updateItem({color:c})} title={c}/>)}</div><div className="inspector-actions"><button onClick={duplicate}><Copy size={15}/> Duplicar</button><button className="danger" onClick={remove}><Trash2 size={15}/> Eliminar</button></div></div>}
      {room&&<div className="properties-body"><div className="section-label">ESTANCIA DELIMITADA POR PAREDES</div><label className="field"><span>Nombre</span><input value={room.name} onChange={e=>change(p=>{const r=p.rooms.find(i=>i.id===room.id);if(r)r.name=e.target.value;})}/></label><label className="field"><span>Tipo</span><select value={room.kind} onChange={e=>change(p=>{const r=p.rooms.find(i=>i.id===room.id);if(r)r.kind=e.target.value as RoomKind;})}>{Object.entries(KIND_NAMES).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><div className="area-preview">Área aproximada <strong>{roomArea(room).toFixed(2)} m²</strong></div><div className="section-label">PAVIMENTO</div><div className="floor-grid">{Object.entries(floors).map(([key,f])=><button key={key} className={room.floor===key?'active':''} onClick={()=>change(p=>{const r=p.rooms.find(i=>i.id===room.id);if(r)r.floor=key as FloorFinish;})}><i style={{background:f.color}}/><small>{f.label}</small></button>)}</div><p className="footnote">El contorno se genera desde los tabiques. Para cambiar el tamaño de la estancia, selecciona y mueve las paredes en el plano 2D. La superficie se calcula desde sus ejes, sin descontar espesor.</p></div>}
      {wall&&<div className="properties-body"><div className="section-label">PARED SELECCIONADA</div><div className="area-preview">Longitud <strong>{wallLength(wall).toFixed(2)} m</strong></div><p className="small-help">{wall.outer?'Pared exterior: se adapta al cambiar el ancho o fondo total del piso.':'Arrastra la pared en el plano 2D para desplazarla. Arrastra sus círculos verdes para mover los extremos.'}</p><Field label="Espesor" value={wall.thickness} min={.06} max={.4} step={.01} onChange={n=>change(p=>{p.walls.find(i=>i.id===wall.id)!.thickness=n;})}/>{!wall.outer&&<><div className="section-label">EXTREMOS (METROS)</div><div className="field-grid"><Field label="Inicio X" value={wall.a.x} min={0} max={project.width} onChange={n=>change(p=>{updateWallGeometry(p,wall.id,{x:n,y:wall.a.y},wall.b);reconcileRooms(p);})}/><Field label="Inicio Y" value={wall.a.y} min={0} max={project.depth} onChange={n=>change(p=>{updateWallGeometry(p,wall.id,{x:wall.a.x,y:n},wall.b);reconcileRooms(p);})}/><Field label="Final X" value={wall.b.x} min={0} max={project.width} onChange={n=>change(p=>{updateWallGeometry(p,wall.id,wall.a,{x:n,y:wall.b.y});reconcileRooms(p);})}/><Field label="Final Y" value={wall.b.y} min={0} max={project.depth} onChange={n=>change(p=>{updateWallGeometry(p,wall.id,wall.a,{x:wall.b.x,y:n});reconcileRooms(p);})}/></div><div className="inspector-actions"><button className="danger" onClick={remove}><Trash2 size={15}/> Eliminar tabique</button></div></>}</div>}
      {opening&&<div className="properties-body"><div className="section-label">HUECO DE {opening.kind==='door'?'PUERTA':'VENTANA'}</div><Field label="Anchura" value={opening.width} min={.3} max={3} onChange={n=>change(p=>{p.openings.find(i=>i.id===opening.id)!.width=n;})}/><Field label="Altura" value={opening.height} min={.3} max={3.5} onChange={n=>change(p=>{p.openings.find(i=>i.id===opening.id)!.height=n;})}/><Field label="Altura de antepecho" value={opening.sill} min={0} max={2} onChange={n=>change(p=>{p.openings.find(i=>i.id===opening.id)!.sill=n;})}/><label className="field"><span>Posición en el tabique</span><input type="range" min="0.05" max="0.95" step="0.01" value={opening.offset} onChange={e=>change(p=>{p.openings.find(i=>i.id===opening.id)!.offset=Number(e.target.value);})}/></label><div className="inspector-actions"><button className="danger" onClick={remove}><Trash2 size={15}/> Eliminar abertura</button></div></div>}
    </div>
    <div className="inspector-bottom"><span className="status-dot"/><span>Modelo a escala · unidades métricas</span></div>
  </aside>;

}
function Header({onBlank,onReset,onImport,onExport,onScreenshot,onSvg,toast}:{onBlank:()=>void;onReset:()=>void;onImport:()=>void;onExport:()=>void;onScreenshot:()=>void;onSvg:()=>void;toast:string}){
  const {project,change,undo,redo,history,redoStack,mode,setMode}=useEditor();
  return <header className="topbar">
    <div className="brand"><div className="brand-logo"><House size={19}/></div><div className="brand-text"><strong>atelier<span>60</span></strong><small>STUDIO DE INTERIORES</small></div></div>
    <div className="header-separator"/><div className="project-title"><input aria-label="Nombre del proyecto" value={project.name} onChange={e=>change(p=>{p.name=e.target.value;})}/><span><Check size={12}/> Guardado automático</span></div>
    <div className="header-center"><button onClick={undo} disabled={!history.length} title="Deshacer (Ctrl+Z)"><Undo2 size={18}/></button><button onClick={redo} disabled={!redoStack.length} title="Rehacer (Ctrl+Mayús+Z)"><Redo2 size={18}/></button><div className="header-separator"/>{([['2d','Plano 2D',<Grid2X2 size={15}/>],['split','Mixto',<SplitSquareVertical size={15}/>],['3d','Vista 3D',<Box size={15}/>]] as [Mode,string,ReactNode][]).map(([m,label,icon])=><button key={m} className={`mode-button ${mode===m?'active':''}`} onClick={()=>setMode(m)} title={label}>{icon}<span>{label}</span></button>)}</div>
    <div className="header-actions"><button onClick={onBlank} className="quiet-btn" title="Crear plano en blanco"><FilePlus2 size={17}/><span>Nuevo</span></button><button onClick={onImport} className="quiet-btn" title="Abrir proyecto JSON"><FolderOpen size={17}/><span>Abrir</span></button><button onClick={onExport} className="quiet-btn" title="Guardar proyecto JSON"><Save size={17}/><span>Exportar</span></button><div className="dropdown"><button onClick={onScreenshot} title="Descargar captura PNG"><Camera size={17}/><span>Imagen</span></button><button onClick={onSvg} title="Descargar plano vectorial SVG"><Image size={16}/></button></div><button onClick={onReset} className="primary-btn" title="Restaurar proyecto de ejemplo"><FilePlus2 size={17}/><span>Ejemplo</span></button></div>
    {toast&&<div className="toast">{toast}</div>}
  </header>;
}
function EditorToolbar(){
  const {tool,setTool,mode,setMode,wallsVisible,setWallsVisible,cutaway,setCutaway,setSelection}=useEditor();
  return <div className="editor-toolbar"><span className="toolbar-label">HERRAMIENTAS</span><div className="tool-group">{toolbar.map(t=><button key={t.type} title={t.hint} className={tool===t.type?'active':''} onClick={()=>{setTool(t.type);if(mode==='3d')setMode('split');}}>{t.icon}<span>{t.label}</span></button>)}</div><div className="toolbar-spacer"/><div className="view-controls"><button onClick={()=>{setSelection(null);setTool('select');setMode('2d');}} title="Cambiar ancho y fondo del piso"><Ruler size={16}/><span>Dimensiones</span></button><button title={wallsVisible?'Ocultar muros':'Mostrar muros'} onClick={()=>setWallsVisible(!wallsVisible)}>{wallsVisible?<Eye size={16}/>:<EyeOff size={16}/>}<span>Muros</span></button><button className={cutaway?'active-soft':''} onClick={()=>setCutaway(!cutaway)} title="Alternar muros seccionados o completos"><Layers size={16}/><span>Sección</span></button></div></div>;
}
function Help({onClose}:{onClose:()=>void}){
  return <div className="modal-backdrop" onClick={onClose}><div className="help-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="eyebrow">GUÍA RÁPIDA</div><h2>Diseña tu casa paso a paso</h2><p>Atelier 60 permite modificar dimensiones y paredes a escala, con cálculo conceptual de recintos y una vista 3D sincronizada.</p><div className="help-steps"><div><Grid2X2/><strong>01 · Dibujar</strong><span>Elige tabique o estancia y marca dos puntos en el plano. Pulsa en un tabique para insertar puertas o ventanas.</span></div><div><Armchair/><strong>02 · Amueblar</strong><span>Añade muebles desde el catálogo y arrástralos en 2D. Selecciona una pared y mueve sus extremos o su posición.</span></div><div><WandSparkles/><strong>03 · Personalizar</strong><span>Aplica estilos y selecciona pavimentos. La vista 3D refleja las modificaciones.</span></div><div><ArrowDownToLine/><strong>04 · Exportar</strong><span>Guarda un JSON editable o captura un PNG de la vista 3D. También puedes exportar el plano en SVG.</span></div></div><p className="help-note">Atajos: Ctrl/⌘+Z para deshacer · Ctrl/⌘+Mayús+Z para rehacer · Supr para eliminar lo seleccionado.</p><button className="primary-btn" onClick={onClose}>Empezar a diseñar</button></div></div>;
}
export default function App(){
  const {project,change,load,reset,selection,setSelection,undo,redo,mode}=useEditor();
  const [modelUnits,setModelUnits]=useState<'m'|'cm'|'mm'>('m');
  const [toast,setToast]=useState(''); const [help,setHelp]=useState(false); const [topView,setTopView]=useState(false);
  const jsonInput=useRef<HTMLInputElement>(null);const glbInput=useRef<HTMLInputElement>(null);const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const alert=useCallback((msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),4200);},[]);
  useEffect(()=>{const timer=setTimeout(()=>{if(!saveLocal(project))alert('Almacenamiento lleno: exporta el proyecto JSON para no perderlo.');},700);return()=>clearTimeout(timer);},[project,alert]);
  useEffect(()=>{
    // Migrate old browser projects with embedded data URLs to IndexedDB.
    let active=true;
    void(async()=>{
      const original=useEditor.getState().project;
      const converted:{id:string;assetId:string}[]=[];
      for(const f of original.furniture){
        if(f.kind==='model'&&f.modelData&&!f.assetId){
          try{const assetId=makeId();await putModelAsset(assetId,dataURLToBlob(f.modelData));converted.push({id:f.id,assetId});}catch{/* Keep legacy embedded data if storage denied. */}
        }
      }
      if(active&&converted.length)useEditor.getState().change(p=>{for(const f of p.furniture){const match=converted.find(c=>c.id===f.id);if(match){f.assetId=match.assetId;delete f.modelData;}}},false);
    })();
    return()=>{active=false;};
  },[]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{
    const target=e.target as HTMLElement;
    if(target.closest('input, textarea, select, [contenteditable="true"]'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z') {e.preventDefault();if(e.shiftKey)redo();else undo();}
    if((e.key==='Delete'||e.key==='Backspace')&&selection){e.preventDefault();change(p=>{
      if(selection.type==='furniture')p.furniture=p.furniture.filter(i=>i.id!==selection.id);
      if(selection.type==='room')p.rooms=p.rooms.filter(i=>i.id!==selection.id);
      if(selection.type==='opening')p.openings=p.openings.filter(i=>i.id!==selection.id);
      if(selection.type==='wall'){p.walls=p.walls.filter(i=>i.id!==selection.id);p.openings=p.openings.filter(i=>i.wallId!==selection.id);reconcileRooms(p);}
    });setSelection(null);}
    if(e.key==='Escape')setSelection(null);
  };window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[selection,change,undo,redo,setSelection]);
  const exportJSON=async()=>{
    try{
      const copy=structuredClone(project);
      for(const f of copy.furniture){
        if(f.assetId){const blob=await getModelAsset(f.assetId);if(!blob)throw Error(`Falta el modelo «${f.name}» en este navegador.`);f.modelData=await blobToDataURL(blob);delete f.assetId;}
      }
      download(`${fileSafe(project.name)||'proyecto'}-atelier60.json`,JSON.stringify(copy,null,2));alert('Proyecto portable exportado con modelos 3D.');
    }catch(err){alert(err instanceof Error?err.message:'No se ha podido exportar el proyecto.');}
  };
  const importJSON=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    const createdAssets:string[]=[];
    try{
      if(file.size>64*1024*1024)throw Error('El archivo supera 64 MB.');
      const content:unknown=JSON.parse(await file.text());
      if(!isProject(content))throw Error('El archivo no contiene un proyecto compatible.');
      const copy=structuredClone(content);
      // Non-portable JSON may contain references to browser-local models.
      // Refuse missing references before replacing a working project.
      for(const f of copy.furniture){
        if(f.kind==='model'&&f.assetId&&!f.modelData&&!await getModelAsset(f.assetId)){
          throw Error(`Falta el modelo «${f.name}» en este navegador. Importa un JSON portable con los modelos incluidos.`);
        }
      }
      for(const f of copy.furniture){
        if(f.kind==='model'&&f.modelData){
          const id=makeId();await putModelAsset(id,dataURLToBlob(f.modelData));
          createdAssets.push(id);f.assetId=id;delete f.modelData;
        }
      }
      reconcileRooms(copy);load(copy);alert('Proyecto cargado correctamente.');
    }catch(err){
      // A failed import must not leak assets from earlier successful writes.
      await Promise.allSettled(createdAssets.map(id=>deleteModelAsset(id)));
      alert(err instanceof Error?err.message:'El archivo no es válido.');
    }
    e.target.value='';
  };
  const importGLB=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;e.target.value='';
    if(!file.name.toLowerCase().endsWith('.glb')){alert('Solo se admiten archivos .glb autónomos.');return;}
    if(file.size>12*1024*1024){alert('Modelo demasiado grande. Máximo 12 MB.');return;}
    try{
      // Reject non-GLB files before persisting an unusable asset or editing the plan.
      const header=new DataView(await file.slice(0,12).arrayBuffer());
      if(file.size<20||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==file.size){
        throw Error('El archivo no es un GLB 2.0 válido.');
      }
      const chunk=new DataView(await file.slice(12,20).arrayBuffer());
      if(chunk.getUint32(4,true)!==0x4e4f534a||chunk.getUint32(0,true)>file.size-20){
        throw Error('El modelo GLB no contiene un bloque JSON válido.');
      }
      // Preserve the native metric footprint; never mutate the GLB or its pivots.
      // Legacy models and malformed bounds still use the editable 1 m fallback.
      let dimensions={w:1,d:1,h:1};
      try{
        const raw=await measureModelDimensions(file);
        const factor=modelUnits==='cm'?.01:modelUnits==='mm'?.001:1;
        dimensions={w:raw.w*factor,d:raw.d*factor,h:raw.h*factor};
        if(Object.values(dimensions).some(v=>!Number.isFinite(v)||v<.001||v>15))throw Error('Las dimensiones convertidas deben estar entre 1 mm y 15 m. Revisa las unidades del GLB.');
      }catch(err){
        if(err instanceof Error&&err.message.startsWith('Las dimensiones convertidas'))throw err;
        // Invalid geometry retains the legacy fallback without blocking import.
      }
      const assetId=makeId();await putModelAsset(assetId,file);
      // A failed WebGL preview must never prevent importing the actual model.
      // Generate on demand for this one file, not for every asset in the library.
      let thumbnail: string | undefined;
      try{thumbnail=await renderModelThumbnail(file);}catch{/* WebGL unavailable or unsupported GLB: keep the asset. */}
      try{await putModelMetadata(assetId,{name:file.name.replace(/\.glb$/i,''),source:'Importación local del usuario',thumbnail,...dimensions});}catch{/* The model blob remains usable if metadata storage fails. */}
      const id=makeId();change(p=>p.furniture.push({id,kind:'model',name:file.name.replace(/\.glb$/i,''),x:p.width/2,y:p.depth/2,...dimensions,rotation:0,color:'#e2e2df',assetId}));
      setSelection({type:'furniture',id});alert('Modelo guardado en IndexedDB e importado al proyecto.');
    }catch(err){alert(err instanceof Error?err.message:'No se ha podido guardar el modelo.');}
  };
  const capture=()=>{const canvas=canvasRef.current;if(mode==='2d'||!canvas){alert('Cambia a 3D o vista mixta para capturar una imagen.');return;}canvas.toBlob(blob=>{if(blob){download(`${fileSafe(project.name)}-render.png`,blob,'image/png');alert('Imagen PNG exportada.');}else alert('No se ha podido capturar el lienzo 3D.');});};
  const exportSVG=()=>{const source=document.querySelector('.plan-svg') as SVGSVGElement|null;if(!source){alert('Cambia a 2D o vista mixta para exportar el plano.');return;}const copy=source.cloneNode(true) as SVGSVGElement;copy.setAttribute('xmlns','http://www.w3.org/2000/svg');download(`${fileSafe(project.name)}-plano.svg`,new XMLSerializer().serializeToString(copy),'image/svg+xml');alert('Plano SVG exportado.');};
  const onBlank=()=>{if(window.confirm('¿Crear una vivienda en blanco? Exporta primero el proyecto actual si quieres conservarlo.')){load(blankProject());alert('Plano vacío creado. Dibuja las paredes en 2D.');}};
  const onReset=()=>{if(window.confirm('¿Restaurar la distribución de ejemplo? El proyecto actual quedará sustituido. Exporta antes un JSON si deseas conservarlo.')){reset();alert('Distribución inicial recuperada.');}};
  return <div className="app-shell">
    <input type="file" accept=".json,application/json" ref={jsonInput} className="file-hidden" onChange={importJSON}/><input type="file" accept=".glb,model/gltf-binary" ref={glbInput} className="file-hidden" onChange={importGLB}/>
    <Header onBlank={onBlank} onReset={onReset} onImport={()=>jsonInput.current?.click()} onExport={exportJSON} onScreenshot={capture} onSvg={exportSVG} toast={toast}/>
    <div className="workspace"><Sidebar importModel={()=>glbInput.current?.click()} modelUnits={modelUnits} setModelUnits={setModelUnits}/>
      <main className="editor-area"><div className="workspace-intro"><div><span className="eyebrow">TU ESPACIO, A TU MANERA</span><h1>Diseña cada rincón.</h1><p>Da forma a la distribución, elige acabados y vive el espacio en tres dimensiones.</p></div><div className="project-pill"><span className="live-dot"/><span>PROYECTO ACTIVO</span><strong>{(project.width*project.depth).toFixed(0)} m²</strong></div></div>
        <EditorToolbar/>
        <div className={`editors mode-${mode}`}>{mode!=='3d'&&<Plan2D/>}{mode!=='2d'&&<div className="scene-host"><Scene3D canvasRef={canvasRef} topView={topView}/><div className="camera-buttons"><button className={!topView?'selected':''} onClick={()=>setTopView(false)}><Box size={14}/> Isométrica</button><button className={topView?'selected':''} onClick={()=>setTopView(true)}><Grid2X2 size={14}/> Cenital</button></div></div>}</div>
        <div className="workspace-bottom"><div><span className="dot-green"/> Edición en tiempo real <span className="bottom-dot">·</span> Paso de dibujo: 10 cm <span className="bottom-dot">·</span> {projectWarnings(project).length} avisos</div><button onClick={()=>setHelp(true)}><CircleHelp size={15}/> Guía de uso</button></div>
      </main>
      <PropertyPanel/>
    </div>
    {help&&<Help onClose={()=>setHelp(false)}/>}
  </div>;
}
