import { useEffect,useState } from 'react';
import { useEditor } from '../store';
import { updateWallGeometry,reconcileRooms } from '../lib/topology';
import { wallLength } from '../lib/geometry';
export default function WallEditingTools(){
  const {project,selection,change}=useEditor();const wall=selection?.type==='wall'?project.walls.find(w=>w.id===selection.id):undefined;
  const [endpoint,setEndpoint]=useState<'a'|'b'>('b'),[linked,setLinked]=useState(true),[x,setX]=useState(0),[y,setY]=useState(0),[message,setMessage]=useState('');
  const [length,setLength]=useState(1),[angle,setAngle]=useState(0);
  useEffect(()=>{if(wall){setX(wall[endpoint].x);setY(wall[endpoint].y);setLength(wallLength(wall));setAngle(Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)*180/Math.PI);}},[wall?.id,wall?.a.x,wall?.a.y,wall?.b.x,wall?.b.y,endpoint]);
  if(!wall||wall.outer)return null;
  const apply=(a:{x:number;y:number},b:{x:number;y:number})=>{
    const before=JSON.stringify(project.walls),preview=structuredClone(project);updateWallGeometry(preview,wall.id,a,b,linked,project.editor?.magnet!==false);
    if(JSON.stringify(preview.walls)===before){setMessage('No se ha cambiado la pared: revisa sus uniones, longitud mínima y aberturas.');return;}
    change(p=>{updateWallGeometry(p,wall.id,a,b,linked,p.editor?.magnet!==false);reconcileRooms(p);});setMessage(linked?'Pared actualizada manteniendo conexiones.':'Extremo editado con sus uniones separadas. Puedes deshacer.');
  };
  return <section><h4>Pared seleccionada: {wall.id.slice(0,12)}</h4><label className="studio-check"><input type="checkbox" checked={linked} onChange={e=>setLinked(e.target.checked)}/> Mantener uniones conectadas</label><p className="small-help">Desactiva esta opción para separar expresamente una unión. El resto de las paredes permanecerá en su posición.</p>
    <label>Extremo<select aria-label="Extremo para separar" value={endpoint} onChange={e=>setEndpoint(e.target.value as 'a'|'b')}><option value="a">Inicio</option><option value="b">Final</option></select></label>
    <label>Coordenada X (m)<input aria-label="Coordenada X de unión" type="number" step=".01" value={x} onChange={e=>setX(Number(e.target.value))}/></label><label>Coordenada Y (m)<input aria-label="Coordenada Y de unión" type="number" step=".01" value={y} onChange={e=>setY(Number(e.target.value))}/></label><button onClick={()=>apply(endpoint==='a'?{x,y}:wall.a,endpoint==='b'?{x,y}:wall.b)}>Aplicar extremo y conexiones</button>
    <label>Longitud del tabique (m)<input type="number" aria-label="Longitud precisa del tabique" min=".2" max="100" step=".01" value={length} onChange={e=>setLength(Number(e.target.value))}/></label><label>Ángulo (grados)<input type="number" aria-label="Ángulo preciso del tabique" min="-360" max="360" step="1" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><button onClick={()=>{if(!Number.isFinite(length)||length<.2||length>100||!Number.isFinite(angle))return;const a=angle*Math.PI/180;apply(wall.a,{x:wall.a.x+Math.cos(a)*length,y:wall.a.y+Math.sin(a)*length});}}>Aplicar longitud y ángulo</button>
    {message&&<p role="status">{message}</p>}
  </section>;
}
