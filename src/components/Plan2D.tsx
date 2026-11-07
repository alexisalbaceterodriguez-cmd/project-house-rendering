import { useRef, useState, type PointerEvent } from 'react';
import { floors } from '../data/catalog';
import { clamp, distance, makeId, snap, wallProjection } from '../lib/geometry';
import { polygonCentroid, projectWarnings, reconcileRooms, roomArea, roomVertices, updateWallGeometry } from '../lib/topology';
import { useEditor } from '../store';
import type { Furniture, Point } from '../types';

function iconFor(item: Furniture) {
  if (item.kind === 'bed' || item.kind === 'single-bed') return <><rect x={-item.w*.45} y={-item.d*.44} width={item.w*.9} height={item.d*.88} rx=".09" fill="#f3efe7" stroke="#beb6aa" strokeWidth=".024"/><rect x={-item.w*.38} y={-item.d*.39} width={item.w*.76} height={Math.min(.43,item.d*.25)} rx=".06" fill="#d1c2b2"/></>;
  if (item.kind === 'sofa') return <><rect x={-item.w*.46} y={-item.d*.44} width={item.w*.92} height={item.d*.88} rx=".13" fill={item.color} stroke="#968877" strokeWidth=".03"/><rect x={-item.w*.4} y={-item.d*.4} width={item.w*.8} height=".17" rx=".05" fill="#b8a99b"/></>;
  if (item.kind === 'plant') return <><circle r={item.w*.4} fill="#e3d1bb"/><circle r={item.w*.3} fill="#759477"/><path d={`M 0 ${-item.w*.26} Q ${item.w*.3} 0 0 ${item.w*.25} Q ${-item.w*.3} 0 0 ${-item.w*.26}`} fill="#4f7054"/></>;
  if (item.kind === 'toilet') return <><rect x={-item.w*.4} y={-item.d*.43} width={item.w*.8} height={item.d*.28} rx=".03" fill="#e8e5df"/><ellipse cy={item.d*.09} rx={item.w*.3} ry={item.d*.28} fill="#f9f9f7" stroke="#bec6c3" strokeWidth=".025"/></>;
  if (item.kind === 'shower') return <><rect x={-item.w*.45} y={-item.d*.45} width={item.w*.9} height={item.d*.9} fill="#d7e0df" stroke="#8da7aa" strokeWidth=".02"/><circle r=".07" fill="#889ca0"/></>;
  return <><rect x={-item.w*.46} y={-item.d*.44} width={item.w*.92} height={item.d*.88} rx=".035" fill={item.color} stroke="#9b9186" strokeWidth=".025"/>{item.kind==='table' || item.kind==='desk' || item.kind==='kitchen' || item.kind==='island' ? <line x1={-item.w*.37} y1="0" x2={item.w*.37} y2="0" stroke="#ffffff" strokeOpacity=".45" strokeWidth=".018"/>: null}</>;
}
export default function Plan2D() {
  const { project, tool, selection, setSelection, setTool, change, checkpoint } = useEditor();
  const svg = useRef<SVGSVGElement>(null);
  type Drag = {type:'furniture';id:string;dx:number;dy:number}|{type:'wall';id:string;start:Point;a:Point;b:Point;handle:'a'|'b'|'move';rooms:typeof project.rooms};
  const drag = useRef<Drag | null>(null);
  const [startWall, setStartWall] = useState<Point | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [zoom, setZoom] = useState(1);
  const pt = (e: PointerEvent<SVGSVGElement | SVGElement>): Point => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return {x:0,y:0};
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: clamp(snap(p.x), 0, project.width), y: clamp(snap(p.y), 0, project.depth) };
  };
  const onBackground = (e: PointerEvent<SVGSVGElement>) => {
    if (e.target !== svg.current && (e.target as Element).getAttribute('data-floor') !== 'true') return;
    const p = pt(e);
    if (tool === 'wall') {
      if (!startWall) setStartWall(p);
      else {
        const endpoint = { ...p };
        if (Math.abs(endpoint.x - startWall.x) < .35) endpoint.x = startWall.x;
        if (Math.abs(endpoint.y - startWall.y) < .35) endpoint.y = startWall.y;
        if (distance(startWall, endpoint) > .3) change(project => {project.walls.push({id:makeId(),a:startWall,b:endpoint,thickness:.12});reconcileRooms(project);});
        setStartWall(null);
      }
    } else if (tool === 'room') {
      if (!startWall) setStartWall(p);
      else {
        const x=Math.min(startWall.x,p.x), y=Math.min(startWall.y,p.y), w=Math.abs(startWall.x-p.x), d=Math.abs(startWall.y-p.y);
        if (w>.5 && d>.5) {
          const id=makeId();
          change(project => {
            project.rooms.push({id,name:`Estancia ${project.rooms.length+1}`,kind:'bedroom',x,y,w,d,floor:'oak'});
            const points=[{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}];
            points.forEach((a,i)=>project.walls.push({id:makeId(),a,b:points[(i+1)%4],thickness:.11}));
            reconcileRooms(project);
          });
          setSelection({type:'room',id});
        }
        setStartWall(null);
      }
    } else {setSelection(null);}
  };
  const onWall = (id: string, e: PointerEvent<SVGElement>, handle: 'a'|'b'|'move'='move') => {
    e.stopPropagation();
    const wall=project.walls.find(w=>w.id===id)!;
    if (tool === 'door' || tool === 'window') {
      const pos=wallProjection(wall,pt(e));
      const length=distance(wall.a,wall.b);
      if(length < .55)return;
      const width=Math.min(tool === 'door' ? .8 : 1.2,Math.max(.3,length-.2));
      const offset=clamp(pos.offset,width/2/length,1-width/2/length);
      const openingId=makeId();
      const overlap=project.openings.some(o=>o.wallId===id&&Math.abs((o.offset-offset)*length)<(o.width+width)/2+.1);
      if(overlap)return;
      change(p=>p.openings.push({id:openingId,wallId:id,kind:tool,width,offset,height:tool==='door'?2.1:1.2,sill:tool==='door'?0:.9}));
      setSelection({type:'opening',id:openingId}); setTool('select');
    } else if(tool==='select') {
      setSelection({type:'wall',id});
      if(!wall.outer){
        checkpoint();drag.current={type:'wall',id,start:pt(e),a:{...wall.a},b:{...wall.b},handle,rooms:structuredClone(project.rooms)};
        svg.current?.setPointerCapture(e.pointerId);
      }
    }
  };
  const onItemDown=(e:PointerEvent<SVGGElement>,item:Furniture)=>{
    if(tool!=='select')return;
    e.stopPropagation();
    setSelection({type:'furniture',id:item.id}); checkpoint();
    const point=pt(e);drag.current={type:'furniture',id:item.id,dx:point.x-item.x,dy:point.y-item.y};
    svg.current?.setPointerCapture(e.pointerId);
  };
  const onMove=(e:PointerEvent<SVGSVGElement>)=>{
    const p=pt(e);setPointer(p);
    if(drag.current){
      if(drag.current.type==='furniture'){
        const {id,dx,dy}=drag.current;
        change(project=>{const f=project.furniture.find(i=>i.id===id);if(f){
          const angle=f.rotation*Math.PI/180;const hx=(Math.abs(Math.cos(angle))*f.w+Math.abs(Math.sin(angle))*f.d)/2;
          const hy=(Math.abs(Math.sin(angle))*f.w+Math.abs(Math.cos(angle))*f.d)/2;
          f.x=clamp(snap(p.x-dx),hx,Math.max(hx,project.width-hx));f.y=clamp(snap(p.y-dy),hy,Math.max(hy,project.depth-hy));
        }},false);
      }else{
        const move=drag.current;const dx=p.x-move.start.x,dy=p.y-move.start.y;
        const a=move.handle==='b'?move.a:{x:snap(move.a.x+dx),y:snap(move.a.y+dy)};
        const b=move.handle==='a'?move.b:{x:snap(move.b.x+dx),y:snap(move.b.y+dy)};
        const anchor=(v:Point):Point=>{
          const other=project.walls.filter(w=>w.id!==move.id).flatMap(w=>[w.a,w.b]);
          const nearest=other.reduce<{p:Point;d:number}|null>((best,q)=>{const d=distance(v,q);return d<.22&&(!best||d<best.d)?{p:q,d}:best;},null);
          return nearest?{...nearest.p}:v;
        };
        const aa=move.handle==='move'?a:anchor(a),bb=move.handle==='move'?b:anchor(b);
        change(project=>{updateWallGeometry(project,move.id,aa,bb);project.rooms=structuredClone(move.rooms);reconcileRooms(project);},false);
      }
    }
  };
  const onDragEnd=()=>{drag.current=null;};
  const warnings=projectWarnings(project);
  const spanX=project.width/zoom, spanY=project.depth/zoom;
  const x0=(project.width-spanX)/2,y0=(project.depth-spanY)/2;
  return <div className="plan-wrap">
    <div className="plan-topline"><span><span className="live-dot"/> PLANO EDITABLE</span><span>{project.width.toFixed(1)} × {project.depth.toFixed(1)} m · {(project.width*project.depth).toFixed(0)} m²</span></div>
    <svg ref={svg} className="plan-svg" viewBox={`${x0-.7} ${y0-.7} ${spanX+1.4} ${spanY+1.4}`} onPointerDown={onBackground} onPointerMove={onMove} onPointerUp={onDragEnd} onLostPointerCapture={onDragEnd} aria-label="Editor de plano 2D">
      <defs><pattern id="floor-grid" width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#c8c4bd" strokeWidth=".013"/></pattern></defs>
      <rect data-floor="true" x="0" y="0" width={project.width} height={project.depth} fill="#f8f7f4"/>
      {project.rooms.map(room=><g key={room.id} onPointerDown={e=>{if(tool==='select'){e.stopPropagation();setSelection({type:'room',id:room.id});}}}>
        <polygon data-floor="true" points={roomVertices(room).map(v=>`${v.x},${v.y}`).join(' ')} fill={floors[room.floor]?.color ?? '#e0d2bd'} opacity=".56"/>
        <text x={polygonCentroid(roomVertices(room)).x} y={polygonCentroid(roomVertices(room)).y} className="room-title" fontSize=".2" textAnchor="middle" opacity=".52">{room.name} ({roomArea(room).toFixed(1)}m²)</text>
        {selection?.type==='room' && selection.id===room.id && <polygon points={roomVertices(room).map(v=>`${v.x},${v.y}`).join(' ')} fill="none" stroke="#3a705b" strokeDasharray=".09 .07" strokeWidth=".045" pointerEvents="none"/>}
      </g>)}
      <rect data-floor="true" x="0" y="0" width={project.width} height={project.depth} fill="url(#floor-grid)" pointerEvents="none"/>
      {project.walls.map(w=><g key={w.id}>
        <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={selection?.type==='wall'&&selection.id===w.id?'#438a68':'#d5cdc2'} strokeWidth={w.thickness+.045} strokeLinecap="square" pointerEvents="none"/>
        <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={selection?.type==='wall'&&selection.id===w.id?'#3a866c':'#616768'} strokeWidth={w.thickness} strokeLinecap="square" onPointerDown={e=>onWall(w.id,e)} className="plan-wall"/>
      </g>)}
      {selection?.type==='wall'&&project.walls.filter(w=>w.id===selection.id).map(w=><g key={`handles-${w.id}`}>
        {[['a',w.a],['b',w.b]].map(([endpoint,p])=>{const v=p as Point;return <circle key={endpoint as string} cx={v.x} cy={v.y} r=".17" fill="#ffffff" stroke="#287b56" strokeWidth=".06" className="wall-handle" onPointerDown={e=>onWall(w.id,e,endpoint as 'a'|'b')}/>;})}
        <text x={(w.a.x+w.b.x)/2} y={(w.a.y+w.b.y)/2-.23} textAnchor="middle" fontSize=".2" className="wall-measure">{distance(w.a,w.b).toFixed(2)} m</text>
      </g>)}
      {project.openings.map(o=>{const wall=project.walls.find(w=>w.id===o.wallId);if(!wall)return null;const len=distance(wall.a,wall.b);const angle=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)*180/Math.PI;const cx=wall.a.x+(wall.b.x-wall.a.x)*o.offset,cy=wall.a.y+(wall.b.y-wall.a.y)*o.offset;
        return <g key={o.id} transform={`translate(${cx} ${cy}) rotate(${angle})`} onPointerDown={e=>{e.stopPropagation();setSelection({type:'opening',id:o.id});}} className="plan-opening">
          <line x1={-o.width/2} y1="0" x2={o.width/2} y2="0" stroke={floors.oak.color} strokeWidth=".21"/>
          {o.kind==='window'? <><line x1={-o.width/2} y1="-.025" x2={o.width/2} y2="-.025" stroke="#4f9baf" strokeWidth=".038"/><line x1={-o.width/2} y1=".025" x2={o.width/2} y2=".025" stroke="#4f9baf" strokeWidth=".038"/></> : <><line x1={-o.width/2} y1="0" x2={-o.width/2} y2={-o.width} stroke="#8d6b4d" strokeWidth=".025"/><path d={`M ${-o.width/2} ${-o.width} A ${o.width} ${o.width} 0 0 1 ${o.width/2} 0`} stroke="#8d6b4d" strokeWidth=".025" fill="none" strokeDasharray=".08 .05"/></>}
          {selection?.type==='opening'&&selection.id===o.id&&<rect x={-o.width/2} y="-.12" width={o.width} height=".24" stroke="#3a866c" strokeWidth=".04" fill="none"/>}
        </g>;
      })}
      {project.furniture.map(item=><g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`} onPointerDown={e=>onItemDown(e,item)} className="plan-furniture">
        {iconFor(item)}
        {selection?.type==='furniture'&&selection.id===item.id&&<rect x={-item.w/2-.06} y={-item.d/2-.06} width={item.w+.12} height={item.d+.12} stroke="#34765b" strokeWidth=".045" fill="none" strokeDasharray=".09 .05" rx=".04"/>}
      </g>)}
      {startWall&&pointer&&<line x1={startWall.x} y1={startWall.y} x2={pointer.x} y2={pointer.y} stroke="#267658" strokeDasharray=".14 .09" strokeWidth=".055"/>}
      <g className="dimension"><line x1="0" y1="-.3" x2={project.width} y2="-.3" stroke="#888980" strokeWidth=".018"/><text x={project.width/2} y="-.38" textAnchor="middle" fontSize=".18">{project.width.toFixed(2)} m</text><line x1="-.3" y1="0" x2="-.3" y2={project.depth} stroke="#888980" strokeWidth=".018"/><text x="-.38" y={project.depth/2} textAnchor="middle" transform={`rotate(-90 -.38 ${project.depth/2})`} fontSize=".18">{project.depth.toFixed(2)} m</text></g>
    </svg>
    <div className="plan-footer"><span>{warnings.length?`${warnings.length} aviso(s) de geometría · `:''}{tool==='wall'||tool==='room'?(startWall?'Haz clic en el segundo extremo':'Haz clic para marcar el primer extremo'):tool==='door'||tool==='window'?'Haz clic en un tabique para insertar':'Selecciona un muro para arrastrarlo o modificar sus extremos' }</span><div className="zoom-tools"><button title="Alejar" onClick={()=>setZoom(z=>Math.max(1,z-.2))}>−</button><span>{Math.round(zoom*100)}%</span><button title="Acercar" onClick={()=>setZoom(z=>Math.min(2.6,z+.2))}>+</button></div></div>
  </div>;
}
