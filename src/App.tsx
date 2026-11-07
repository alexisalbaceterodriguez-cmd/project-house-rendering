import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Armchair, ArrowDownToLine, Box, Camera, Check, ChevronDown, CircleHelp, Copy, DoorOpen, Eye, EyeOff, FilePlus2, FolderOpen, Grid2X2, Hammer, House, Image, Layers, LayoutGrid, Maximize2, Move, Paintbrush, PanelRightClose, Plus, Redo2, RotateCcw, RotateCw, Ruler, Save, Settings2, SlidersHorizontal, SplitSquareVertical, Trash2, Undo2, Upload, WandSparkles } from 'lucide-react';
import Plan2D from './components/Plan2D';
import Scene3D from './components/Scene3D';
import { catalog, floors, styles } from './data/catalog';
import { clamp, download, fileSafe, makeId } from './lib/geometry';
import { isProject, saveLocal, useEditor } from './store';
import type { FloorFinish, Furniture, Mode, Palette, Project, RoomKind, Selection, Tool } from './types';

type SideTab = 'objects' | 'materials' | 'rooms';
const toolbar: {type:Tool;label:string;icon:ReactNode;hint:string}[] = [
  {type:'select',label:'Seleccionar',icon:<Move size={17}/>,hint:'Seleccionar y mover objetos'},
  {type:'wall',label:'Tabique',icon:<Ruler size={17}/>,hint:'Dibuja dos puntos para crear un tabique'},
  {type:'door',label:'Puerta',icon:<DoorOpen size={17}/>,hint:'Haz clic sobre un tabique para crear una puerta'},
  {type:'window',label:'Ventana',icon:<Maximize2 size={17}/>,hint:'Haz clic sobre un tabique para crear una ventana'},
  {type:'room',label:'Estancia',icon:<LayoutGrid size={17}/>,hint:'Marca dos esquinas para crear una estancia rectangular'},
];
const KIND_NAMES:Record<RoomKind,string>={living:'Zona de día',bedroom:'Dormitorio',bathroom:'Baño',hall:'Pasillo / distribuidor'};
const kindColors:Record<string,string>={living:'#d7c6a9',bedroom:'#ccd2bd',bathroom:'#b1c8c8',hall:'#d1d1ce'};
function Field({label,value,onChange,min=-100,max=100,step=.1,suffix='m'}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;step?:number;suffix?:string}){
  return <label className="field"><span>{label}</span><div className="input-suffix"><input type="number" min={min} max={max} step={step} value={Number(value.toFixed(3))} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(clamp(n,min,max));}}/><small>{suffix}</small></div></label>;
}
function Sidebar({importModel}:{importModel:()=>void}){
  const [tab,setTab]=useState<SideTab>('objects');
  const [filter,setFilter]=useState('Todos');
  const [search,setSearch]=useState('');
  const { project,change,setSelection,setTool,setMode }=useEditor();
  const groups=['Todos',...new Set(catalog.map(item=>item.category))];
  const visible=catalog.filter(o=>(filter==='Todos'||o.category===filter)&&o.name.toLowerCase().includes(search.toLowerCase()));
  const add=(entry:typeof catalog[number])=>{
    const id=makeId();
    change(p=>p.furniture.push({id,kind:entry.kind,name:entry.name,x:clamp(2+(p.furniture.length%5)*.22,.5,p.width-.5),y:clamp(2.7,.5,p.depth-.5),w:entry.w,d:entry.d,h:entry.h,rotation:0,color:entry.color}));
    setSelection({type:'furniture',id}); setTool('select');setMode('split');
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
        <div className="section-label">CATÁLOGO PARAMÉTRICO</div>
        <div className="catalog-grid">{visible.map(c=><button className="catalog-card" key={c.kind} onClick={()=>add(c)} title={`Añadir ${c.name}`}><span className="catalog-icon">{c.icon}</span><span className="catalog-name">{c.name}</span><small>{c.w} × {c.d} m</small><span className="add-overlay"><Plus size={15}/></span></button>)}</div>
        <button className="import-card" onClick={importModel}><Upload size={18}/><span><strong>Importar modelo 3D</strong><small>Archivo .glb local · máx. 6 MB</small></span><Plus size={16}/></button>
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
        <div className="room-list">{project.rooms.map(r=><button key={r.id} onClick={()=>{setSelection({type:'room',id:r.id});setTool('select');}}><i style={{background:kindColors[r.kind]}}/><span><strong>{r.name}</strong><small>{(r.w*r.d).toFixed(1)} m² · {floors[r.floor]?.label}</small></span><ChevronDown size={14}/></button>)}</div>
        <div className="room-totals"><span>Superficie de la envolvente</span><strong>{(project.width*project.depth).toFixed(1)} m²</strong></div>
        <p className="footnote">Las superficies de habitaciones pueden solaparse si editas sus dimensiones. Este editor no sustituye una comprobación técnica de arquitectura.</p>
      </>}
    </div>
    <div className="sidebar-bottom"><CircleHelp size={16}/><span>Consejo: empieza en 2D y comprueba el resultado en 3D.</span></div>
  </aside>;
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
      if(selection.type==='wall'){p.walls=p.walls.filter(i=>i.id!==selection.id);p.openings=p.openings.filter(i=>i.wallId!==selection.id);}
      if(selection.type==='opening')p.openings=p.openings.filter(i=>i.id!==selection.id);
    });setSelection(null);
  };
  const duplicate=()=>{if(!item)return;const id=makeId();change(p=>p.furniture.push({...structuredClone(item),id,name:`${item.name} (copia)`,x:clamp(item.x+.25,0,p.width),y:clamp(item.y+.25,0,p.depth)}));setSelection({type:'furniture',id});};
  return <aside className="inspector">
    <div className="inspector-head"><span className="eyebrow">PANEL DE EDICIÓN</span><h2>{item?item.name:room?room.name:wall?'Tabique':opening?(opening.kind==='door'?'Puerta':'Ventana'):'Propiedades'}</h2><span>{selection?'Edición del elemento seleccionado':'Selecciona un elemento del plano'}</span></div>
    <div className="inspector-scroll">
      {!selection&&<><div className="empty-properties"><SlidersHorizontal size={28}/><strong>Selecciona un objeto</strong><p>Haz clic sobre un mueble, habitación, muro o abertura para modificarlo.</p></div><div className="section-label">CONFIGURACIÓN GENERAL</div><div className="properties-body"><Field label="Ancho de la vivienda" value={project.width} min={4} max={40} onChange={n=>resize(n,project.depth)}/><Field label="Largo de la vivienda" value={project.depth} min={4} max={40} onChange={n=>resize(project.width,n)}/><Field label="Altura de los muros" value={project.wallHeight} min={2} max={4} onChange={n=>change(p=>{p.wallHeight=n;})}/><p className="footnote">Al cambiar el tamaño exterior, las posiciones y habitaciones se ajustan proporcionalmente. El mobiliario conserva su tamaño real.</p></div></>}
      {item&&<div className="properties-body"><div className="section-label">POSICIÓN</div><div className="field-grid"><Field label="X" value={item.x} min={0} max={project.width} onChange={n=>updateItem({x:n})}/><Field label="Y" value={item.y} min={0} max={project.depth} onChange={n=>updateItem({y:n})}/></div><div className="section-label">DIMENSIONES</div><div className="field-grid"><Field label="Ancho" value={item.w} min={.1} max={15} onChange={n=>updateItem({w:n})}/><Field label="Fondo" value={item.d} min={.1} max={15} onChange={n=>updateItem({d:n})}/><Field label="Alto" value={item.h} min={.03} max={6} onChange={n=>updateItem({h:n})}/><Field label="Rotación" value={item.rotation} min={0} max={360} step={15} suffix="°" onChange={n=>updateItem({rotation:n})}/></div><div className="section-label">ACABADO</div><label className="color-field">Color principal <input type="color" value={item.color} onChange={e=>updateItem({color:e.target.value})}/></label><div className="color-presets">{['#f1eee9','#d4c8b8','#a8b5a0','#c4a17b','#747b78','#3d4542'].map(c=><button key={c} style={{background:c}} onClick={()=>updateItem({color:c})} title={c}/>)}</div><div className="inspector-actions"><button onClick={duplicate}><Copy size={15}/> Duplicar</button><button className="danger" onClick={remove}><Trash2 size={15}/> Eliminar</button></div></div>}
      {room&&<div className="properties-body"><div className="section-label">IDENTIDAD</div><label className="field"><span>Nombre</span><input value={room.name} onChange={e=>change(p=>{const r=p.rooms.find(i=>i.id===room.id);if(r)r.name=e.target.value;})}/></label><label className="field"><span>Tipo de estancia</span><select value={room.kind} onChange={e=>change(p=>{const r=p.rooms.find(i=>i.id===room.id);if(r)r.kind=e.target.value as RoomKind;})}>{Object.entries(KIND_NAMES).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><div className="section-label">PAVIMENTO</div><div className="floor-grid">{Object.entries(floors).map(([key,f])=><button key={key} className={room.floor===key?'active':''} onClick={()=>change(p=>{const r=p.rooms.find(i=>i.id===room.id);if(r)r.floor=key as FloorFinish;})}><i style={{background:f.color}}/><small>{f.label}</small></button>)}</div><div className="section-label">PERÍMETRO CONCEPTUAL</div><div className="field-grid"><Field label="X" value={room.x} onChange={n=>change(p=>{p.rooms.find(i=>i.id===room.id)!.x=n;})}/><Field label="Y" value={room.y} onChange={n=>change(p=>{p.rooms.find(i=>i.id===room.id)!.y=n;})}/><Field label="Ancho" value={room.w} min={.5} onChange={n=>change(p=>{p.rooms.find(i=>i.id===room.id)!.w=n;})}/><Field label="Fondo" value={room.d} min={.5} onChange={n=>change(p=>{p.rooms.find(i=>i.id===room.id)!.d=n;})}/></div><p className="footnote">Editar el perímetro cambia el pavimento, no los tabiques; mueve o redibuja los muros por separado.</p><div className="inspector-actions"><button className="danger" onClick={remove}><Trash2 size={15}/> Eliminar estancia</button></div></div>}
      {wall&&<div className="properties-body"><div className="section-label">TABIQUE</div><Field label="Grosor" value={wall.thickness} min={.06} max={.4} step={.01} onChange={n=>change(p=>{p.walls.find(i=>i.id===wall.id)!.thickness=n;})}/><div className="section-label">EXTREMOS DEL SEGMENTO</div><div className="field-grid"><Field label="Inicio X" value={wall.a.x} onChange={n=>change(p=>{p.walls.find(i=>i.id===wall.id)!.a.x=n;})}/><Field label="Inicio Y" value={wall.a.y} onChange={n=>change(p=>{p.walls.find(i=>i.id===wall.id)!.a.y=n;})}/><Field label="Final X" value={wall.b.x} onChange={n=>change(p=>{p.walls.find(i=>i.id===wall.id)!.b.x=n;})}/><Field label="Final Y" value={wall.b.y} onChange={n=>change(p=>{p.walls.find(i=>i.id===wall.id)!.b.y=n;})}/></div><p className="footnote">Las puertas y ventanas de este tabique se adaptan a su nuevo recorrido.</p><div className="inspector-actions"><button className="danger" onClick={remove}><Trash2 size={15}/> Eliminar tabique</button></div></div>}
      {opening&&<div className="properties-body"><div className="section-label">HUECO DE {opening.kind==='door'?'PUERTA':'VENTANA'}</div><Field label="Anchura" value={opening.width} min={.3} max={3} onChange={n=>change(p=>{p.openings.find(i=>i.id===opening.id)!.width=n;})}/><Field label="Altura" value={opening.height} min={.3} max={3.5} onChange={n=>change(p=>{p.openings.find(i=>i.id===opening.id)!.height=n;})}/><Field label="Altura de antepecho" value={opening.sill} min={0} max={2} onChange={n=>change(p=>{p.openings.find(i=>i.id===opening.id)!.sill=n;})}/><label className="field"><span>Posición en el tabique</span><input type="range" min="0.05" max="0.95" step="0.01" value={opening.offset} onChange={e=>change(p=>{p.openings.find(i=>i.id===opening.id)!.offset=Number(e.target.value);})}/></label><div className="inspector-actions"><button className="danger" onClick={remove}><Trash2 size={15}/> Eliminar abertura</button></div></div>}
    </div>
    <div className="inspector-bottom"><span className="status-dot"/><span>Modelo a escala · unidades métricas</span></div>
  </aside>;
  function resize(width:number,depth:number){change(p=>{const sx=width/p.width,sy=depth/p.depth;p.rooms.forEach(r=>{r.x*=sx;r.y*=sy;r.w*=sx;r.d*=sy;});p.walls.forEach(w=>{w.a.x*=sx;w.b.x*=sx;w.a.y*=sy;w.b.y*=sy;});p.furniture.forEach(f=>{f.x*=sx;f.y*=sy;});p.width=width;p.depth=depth;});}
}
function Header({onReset,onImport,onExport,onScreenshot,onSvg,toast}:{onReset:()=>void;onImport:()=>void;onExport:()=>void;onScreenshot:()=>void;onSvg:()=>void;toast:string}){
  const {project,change,undo,redo,history,redoStack,mode,setMode}=useEditor();
  return <header className="topbar">
    <div className="brand"><div className="brand-logo"><House size={19}/></div><div className="brand-text"><strong>atelier<span>60</span></strong><small>STUDIO DE INTERIORES</small></div></div>
    <div className="header-separator"/><div className="project-title"><input aria-label="Nombre del proyecto" value={project.name} onChange={e=>change(p=>{p.name=e.target.value;})}/><span><Check size={12}/> Guardado automático</span></div>
    <div className="header-center"><button onClick={undo} disabled={!history.length} title="Deshacer (Ctrl+Z)"><Undo2 size={18}/></button><button onClick={redo} disabled={!redoStack.length} title="Rehacer (Ctrl+Mayús+Z)"><Redo2 size={18}/></button><div className="header-separator"/>{([['2d','Plano 2D',<Grid2X2 size={15}/>],['split','Mixto',<SplitSquareVertical size={15}/>],['3d','Vista 3D',<Box size={15}/>]] as [Mode,string,ReactNode][]).map(([m,label,icon])=><button key={m} className={`mode-button ${mode===m?'active':''}`} onClick={()=>setMode(m)} title={label}>{icon}<span>{label}</span></button>)}</div>
    <div className="header-actions"><button onClick={onImport} className="quiet-btn" title="Abrir proyecto JSON"><FolderOpen size={17}/><span>Abrir</span></button><button onClick={onExport} className="quiet-btn" title="Guardar proyecto JSON"><Save size={17}/><span>Exportar</span></button><div className="dropdown"><button onClick={onScreenshot} title="Descargar captura PNG"><Camera size={17}/><span>Imagen</span></button><button onClick={onSvg} title="Descargar plano vectorial SVG"><Image size={16}/></button></div><button onClick={onReset} className="primary-btn" title="Restaurar proyecto de ejemplo"><FilePlus2 size={17}/><span>Ejemplo</span></button></div>
    {toast&&<div className="toast">{toast}</div>}
  </header>;
}
function EditorToolbar(){
  const {tool,setTool,mode,setMode,wallsVisible,setWallsVisible,cutaway,setCutaway}=useEditor();
  return <div className="editor-toolbar"><span className="toolbar-label">HERRAMIENTAS</span><div className="tool-group">{toolbar.map(t=><button key={t.type} title={t.hint} className={tool===t.type?'active':''} onClick={()=>{setTool(t.type);if(mode==='3d')setMode('split');}}>{t.icon}<span>{t.label}</span></button>)}</div><div className="toolbar-spacer"/><div className="view-controls"><button title={wallsVisible?'Ocultar muros':'Mostrar muros'} onClick={()=>setWallsVisible(!wallsVisible)}>{wallsVisible?<Eye size={16}/>:<EyeOff size={16}/>}<span>Muros</span></button><button className={cutaway?'active-soft':''} onClick={()=>setCutaway(!cutaway)} title="Alternar muros seccionados o completos"><Layers size={16}/><span>Sección</span></button></div></div>;
}
function Help({onClose}:{onClose:()=>void}){
  return <div className="modal-backdrop" onClick={onClose}><div className="help-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="eyebrow">GUÍA RÁPIDA</div><h2>Diseña tu casa paso a paso</h2><p>Atelier 60 es un editor conceptual de espacios, con medidas en metros y una vista 3D sincronizada.</p><div className="help-steps"><div><Grid2X2/><strong>01 · Dibujar</strong><span>Elige tabique o estancia y marca dos puntos en el plano. Pulsa en un tabique para insertar puertas o ventanas.</span></div><div><Armchair/><strong>02 · Amueblar</strong><span>Añade muebles desde el catálogo, arrástralos en 2D y ajusta dimensiones, color y giro en Propiedades.</span></div><div><WandSparkles/><strong>03 · Personalizar</strong><span>Aplica estilos y selecciona pavimentos. La vista 3D refleja las modificaciones.</span></div><div><ArrowDownToLine/><strong>04 · Exportar</strong><span>Guarda un JSON editable o captura un PNG de la vista 3D. También puedes exportar el plano en SVG.</span></div></div><p className="help-note">Atajos: Ctrl/⌘+Z para deshacer · Ctrl/⌘+Mayús+Z para rehacer · Supr para eliminar lo seleccionado.</p><button className="primary-btn" onClick={onClose}>Empezar a diseñar</button></div></div>;
}
export default function App(){
  const {project,change,load,reset,selection,setSelection,undo,redo,mode}=useEditor();
  const [toast,setToast]=useState(''); const [help,setHelp]=useState(false); const [topView,setTopView]=useState(false);
  const jsonInput=useRef<HTMLInputElement>(null);const glbInput=useRef<HTMLInputElement>(null);const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const alert=useCallback((msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),4200);},[]);
  useEffect(()=>{const timer=setTimeout(()=>{if(!saveLocal(project))alert('Almacenamiento lleno: exporta el proyecto JSON para no perderlo.');},700);return()=>clearTimeout(timer);},[project,alert]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{
    const target=e.target as HTMLElement;
    if(target.closest('input, textarea, select, [contenteditable="true"]'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z') {e.preventDefault();if(e.shiftKey)redo();else undo();}
    if((e.key==='Delete'||e.key==='Backspace')&&selection){e.preventDefault();change(p=>{
      if(selection.type==='furniture')p.furniture=p.furniture.filter(i=>i.id!==selection.id);
      if(selection.type==='room')p.rooms=p.rooms.filter(i=>i.id!==selection.id);
      if(selection.type==='opening')p.openings=p.openings.filter(i=>i.id!==selection.id);
      if(selection.type==='wall'){p.walls=p.walls.filter(i=>i.id!==selection.id);p.openings=p.openings.filter(i=>i.wallId!==selection.id);}
    });setSelection(null);}
    if(e.key==='Escape')setSelection(null);
  };window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[selection,change,undo,redo,setSelection]);
  const exportJSON=()=>{download(`${fileSafe(project.name)||'proyecto'}-atelier60.json`,JSON.stringify(project,null,2));alert('Proyecto JSON exportado.');};
  const importJSON=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;try{const content=JSON.parse(await file.text());if(!isProject(content))throw Error('El archivo no contiene un proyecto compatible.');load(content);alert('Proyecto cargado correctamente.');}catch(err){alert(err instanceof Error?err.message:'El archivo no es válido.');}e.target.value='';};
  const importGLB=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;e.target.value='';
    if(!file.name.toLowerCase().endsWith('.glb')){alert('Solo se admiten archivos .glb autónomos.');return;}
    if(file.size>6*1024*1024){alert('Este modelo supera 6 MB. Optimízalo antes de importarlo.');return;}
    const reader=new FileReader();reader.onload=()=>{
      const data=reader.result;if(typeof data!=='string')return;
      const id=makeId();change(p=>p.furniture.push({id,kind:'model',name:file.name.replace(/\.glb$/i,''),x:p.width/2,y:p.depth/2,w:1,d:1,h:1,rotation:0,color:'#e2e2df',modelData:data}));setSelection({type:'furniture',id});alert('Modelo importado. Puedes modificar sus dimensiones.');
    };reader.onerror=()=>alert('No se ha podido leer el archivo GLB.');reader.readAsDataURL(file);
  };
  const capture=()=>{const canvas=canvasRef.current;if(mode==='2d'||!canvas){alert('Cambia a 3D o vista mixta para capturar una imagen.');return;}canvas.toBlob(blob=>{if(blob){download(`${fileSafe(project.name)}-render.png`,blob,'image/png');alert('Imagen PNG exportada.');}else alert('No se ha podido capturar el lienzo 3D.');});};
  const exportSVG=()=>{const source=document.querySelector('.plan-svg') as SVGSVGElement|null;if(!source){alert('Cambia a 2D o vista mixta para exportar el plano.');return;}const copy=source.cloneNode(true) as SVGSVGElement;copy.setAttribute('xmlns','http://www.w3.org/2000/svg');download(`${fileSafe(project.name)}-plano.svg`,new XMLSerializer().serializeToString(copy),'image/svg+xml');alert('Plano SVG exportado.');};
  const onReset=()=>{if(window.confirm('¿Restaurar la distribución de ejemplo? El proyecto actual quedará sustituido. Exporta antes un JSON si deseas conservarlo.')){reset();alert('Distribución inicial recuperada.');}};
  return <div className="app-shell">
    <input type="file" accept=".json,application/json" ref={jsonInput} className="file-hidden" onChange={importJSON}/><input type="file" accept=".glb,model/gltf-binary" ref={glbInput} className="file-hidden" onChange={importGLB}/>
    <Header onReset={onReset} onImport={()=>jsonInput.current?.click()} onExport={exportJSON} onScreenshot={capture} onSvg={exportSVG} toast={toast}/>
    <div className="workspace"><Sidebar importModel={()=>glbInput.current?.click()}/>
      <main className="editor-area"><div className="workspace-intro"><div><span className="eyebrow">TU ESPACIO, A TU MANERA</span><h1>Diseña cada rincón.</h1><p>Da forma a la distribución, elige acabados y vive el espacio en tres dimensiones.</p></div><div className="project-pill"><span className="live-dot"/><span>PROYECTO ACTIVO</span><strong>{(project.width*project.depth).toFixed(0)} m²</strong></div></div>
        <EditorToolbar/>
        <div className={`editors mode-${mode}`}>{mode!=='3d'&&<Plan2D/>}{mode!=='2d'&&<div className="scene-host"><Scene3D canvasRef={canvasRef} topView={topView}/><div className="camera-buttons"><button className={!topView?'selected':''} onClick={()=>setTopView(false)}><Box size={14}/> Isométrica</button><button className={topView?'selected':''} onClick={()=>setTopView(true)}><Grid2X2 size={14}/> Cenital</button></div></div>}</div>
        <div className="workspace-bottom"><div><span className="dot-green"/> Edición en tiempo real <span className="bottom-dot">·</span> Paso de dibujo: 10 cm</div><button onClick={()=>setHelp(true)}><CircleHelp size={15}/> Guía de uso</button></div>
      </main>
      <PropertyPanel/>
    </div>
    {help&&<Help onClose={()=>setHelp(false)}/>}
  </div>;
}
