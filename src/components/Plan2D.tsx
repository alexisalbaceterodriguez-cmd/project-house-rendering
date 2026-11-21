import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { cachedFurnitureCollisions, cachedProjectWarnings } from '../lib/diagnosticsCache';
import { floors } from '../data/catalog';
import { clamp, distance, makeId, snap, wallProjection } from '../lib/geometry';
import { roomLabelPoint, reconcileRooms, roomArea, roomVertices, updateWallGeometry } from '../lib/topology';
import { useEditor, useEditorPick } from '../store';
import { cornerSofaLayout } from '../lib/furnitureParts';
import type { Furniture, Point, Wall } from '../types';

type ItemDown=(e:PointerEvent<SVGGElement>,item:Furniture)=>void;
// Memoised per item: dragging one object re-renders only its own symbol.
const PlanFurniture=memo(function PlanFurniture({item,selected,onDown}:{item:Furniture;selected:boolean;onDown:{current:ItemDown}}){
  return <g transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`} onPointerDown={e=>onDown.current(e,item)} className="plan-furniture">
    {iconFor(item)}
    {selected&&<rect x={-item.w/2-.06} y={-item.d/2-.06} width={item.w+.12} height={item.d+.12} stroke="#34765b" strokeWidth=".045" fill="none" strokeDasharray=".09 .05" rx=".04"/>}
  </g>;
});
function iconFor(item: Furniture) {
  if (item.kind === 'bed' || item.kind === 'single-bed' || item.kind === 'storage-bed' || item.kind === 'bunk-bed') return <><rect x={-item.w*.45} y={-item.d*.44} width={item.w*.9} height={item.d*.88} rx=".09" fill="#f3efe7" stroke="#beb6aa" strokeWidth=".024"/><rect x={-item.w*.38} y={-item.d*.39} width={item.w*.76} height={Math.min(.43,item.d*.25)} rx=".06" fill="#d1c2b2"/></>;
  if (item.kind === 'corner-sofa' || item.kind === 'corner-sofa-left') {
    // L outline (back on −y, chaise reaching the front on +x, or −x for the left-hand variant).
    const { seatD, chaise } = cornerSofaLayout(item.w, item.d), s = item.kind === 'corner-sofa' ? 1 : -1, w2 = item.w / 2, d2 = item.d / 2;
    const pts = [[-w2, -d2], [w2, -d2], [w2, d2], [w2 - chaise, d2], [w2 - chaise, -d2 + seatD], [-w2, -d2 + seatD]].map(([x, y]) => `${s * x},${y}`).join(' ');
    return <><polygon points={pts} fill={item.color} stroke="#968877" strokeWidth=".03" strokeLinejoin="round"/><line x1={-w2} y1={-d2 + .18} x2={w2} y2={-d2 + .18} stroke="#968877" strokeWidth=".02"/></>;
  }
  if (item.kind === 'sofa') return <><rect x={-item.w*.46} y={-item.d*.44} width={item.w*.92} height={item.d*.88} rx=".13" fill={item.color} stroke="#968877" strokeWidth=".03"/><rect x={-item.w*.4} y={-item.d*.4} width={item.w*.8} height=".17" rx=".05" fill="#b8a99b"/></>;
  if (item.kind === 'table-lamp') return <><circle r={item.w*.48} fill="#f6efdf" stroke="#968877" strokeWidth=".02"/><circle r={item.w*.14} fill="#968877"/></>;
  if (item.kind === 'vase') return <circle r={item.w*.48} fill="#ece6da" stroke="#968877" strokeWidth=".015"/>;
  if (item.kind === 'fruit-bowl') return <><circle r={Math.min(item.w, item.d)*.48} fill={item.color} stroke="#968877" strokeWidth=".01"/>{[0, 1, 2].map(i => <circle key={i} cx={Math.cos(Math.PI/2+i*2.094)*item.w*.19} cy={Math.sin(Math.PI/2+i*2.094)*item.d*.19} r={item.w*.13} fill={['#b8432f', '#e08a2c', '#e6c84a'][i]}/>)}</>;
  if (item.kind === 'table-clock') return <><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} fill={item.color} stroke="#968877" strokeWidth=".005"/><rect x={-item.w*.3} y={item.d*.3} width={item.w*.6} height={item.d*.12} fill="#f3efe6"/></>;
  if (item.kind === 'decor-bowl') return <><circle r={Math.min(item.w, item.d)*.5} fill={item.color} stroke="#968877" strokeWidth=".008"/>{[0, 1, 2].map(i => <circle key={i} cx={Math.cos(.524+i*2.094)*item.w*.15} cy={Math.sin(.524+i*2.094)*item.d*.15} r={Math.min(item.w, item.d)*.11} fill={['#a8814f', '#9a958c', '#ddd5c6'][i]}/>)}</>;
  if (item.kind === 'throw-pillow') return <><path d={`M${-item.w/2} ${-item.d/2}Q0 ${-item.d*.2} ${item.w/2} ${-item.d/2}Q${item.w*.4} 0 ${item.w/2} ${item.d/2}Q0 ${item.d*.2} ${-item.w/2} ${item.d/2}Q${-item.w*.4} 0 ${-item.w/2} ${-item.d/2}Z`} fill={item.color} stroke="#968877" strokeWidth=".006"/></>;
  if (item.kind === 'folded-blanket') return <><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} rx=".02" fill={item.color} stroke="#968877" strokeWidth=".006"/>{[-.25, 0, .25].map(k => <line key={k} x1={-item.w*.46} x2={item.w*.46} y1={k*item.d} y2={k*item.d} stroke="#fff" strokeOpacity=".35" strokeWidth=".006"/>)}</>;
  if (item.kind === 'cutting-board') return <><rect x={-item.w/2} y={-item.d/2} width={item.w*.8} height={item.d} rx=".01" fill={item.color} stroke="#968877" strokeWidth=".005"/><rect x={item.w*.3} y={-item.d*.2} width={item.w*.2} height={item.d*.4} fill={item.color} stroke="#968877" strokeWidth=".005"/><line x1={-item.w*.4} x2={item.w*.1} y1={item.d*.22} y2={item.d*.22} stroke="#6f6a63" strokeWidth=".02"/></>;
  if (item.kind === 'kettle') return <><circle r={Math.min(item.d, item.w*.66)/2} fill={item.color} stroke="#968877" strokeWidth=".006"/><rect x={-item.w/2} y={-.013} width={item.w*.2} height={.026} fill="#2b2723"/><rect x={item.w*.3} y={-.016} width={item.w*.2} height={.032} fill={item.color} stroke="#968877" strokeWidth=".004"/></>;
  if (item.kind === 'utensil-jar') return <><circle r={Math.min(item.w, item.d)/2} fill={item.color} stroke="#968877" strokeWidth=".006"/><circle cx={-item.w*.11} cy={-item.d*.03} r={item.w*.1} fill="#b58a5c"/><rect x={item.w*.06} y={-item.d*.1} width={item.w*.18} height={item.d*.04} fill="#2b2723"/></>;
  if (item.kind === 'umbrella-stand') return <><circle r={Math.min(item.w, item.d)/2} fill={item.color} stroke="#968877" strokeWidth=".01"/><circle cx={-item.w*.17} cy={-item.d*.06} r={.03} fill="#2f3e4f"/><circle cx={item.w*.17} cy={item.d*.07} r={.03} fill="#8a3b32"/></>;
  if (item.kind === 'doormat') return <><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} rx=".01" fill="#2b2723"/><rect x={-item.w/2+.015} y={-item.d/2+.015} width={item.w-.03} height={item.d-.03} fill={item.color} fillOpacity=".9"/></>;
  if (item.kind === 'soap-dispenser') return <><circle r={Math.min(item.w, item.d)/2} fill={item.color} stroke="#968877" strokeWidth=".004"/><circle r={.012} fill="#c9ccd0"/><rect x={-.004} y={0} width={.008} height={Math.min(item.w, item.d)*.45} fill="#c9ccd0"/></>;
  if (item.kind === 'toothbrush-cup') return <><circle r={Math.min(item.w, item.d)/2} fill={item.color} stroke="#968877" strokeWidth=".004"/><rect x={-item.w*.15-.006} y={-.0035} width={.012} height={.007} fill="#7fa9b8"/><rect x={item.w*.15-.006} y={-.0035} width={.012} height={.007} fill="#e7e2d8"/></>;
  if (item.kind === 'towel-stack') return <><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} rx=".02" fill={item.color} stroke="#968877" strokeWidth=".005"/><line x1={-item.w*.44} x2={item.w*.44} y1={item.d*.3} y2={item.d*.3} stroke="#968877" strokeWidth=".004"/></>;
  if (item.kind === 'bath-mat') return <rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} rx=".03" fill={item.color} stroke="#b9ad9c" strokeWidth=".01"/>;
  if (item.kind === 'bath-tray') return <><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} fill={item.color} stroke="#968877" strokeWidth=".006"/>{[-.25, 0, .25].map(k => <line key={k} x1={-item.w*.46} x2={item.w*.46} y1={k*item.d} y2={k*item.d} stroke="#6f5538" strokeWidth=".006"/>)}<circle cx={-item.w*.2} r={Math.min(.0325, item.d*.2)} fill="#f1ebdf"/></>;
  if (item.kind === 'shelf-basket') return <><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} rx=".01" fill={item.color} stroke="#968877" strokeWidth=".008"/><rect x={-item.w*.45} y={-item.d*.42} width={item.w*.9} height={item.d*.84} fill="#8f7a58" fillOpacity=".35"/></>;
  if (item.kind === 'photo-frame') return <><rect x={-item.w*.35} y={-item.d/2} width={item.w*.7} height={item.d} fill="#d8c7ad" stroke="#968877" strokeWidth=".005"/><rect x={-item.w/2} y={-.009} width={item.w} height={.018} fill={item.color}/></>;
  if (item.kind === 'candles') return <><ellipse rx={item.w*.48} ry={item.d*.48} fill={item.color} stroke="#968877" strokeWidth=".01"/>{[[-.2, -.12], [.18, -.08], [.02, .18]].map(([x, y], i) => <circle key={i} cx={x*item.w} cy={y*item.d} r={Math.min(item.w, item.d)*.15} fill="#f2ecdf" stroke="#968877" strokeWidth=".005"/>)}</>;
  if (item.kind === 'books') return <><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} fill="#e6dccb" stroke="#968877" strokeWidth=".015"/><rect x={-item.w*.4} y={-item.d*.42} width={item.w*.85} height={item.d*.8} fill="none" stroke="#968877" strokeWidth=".01"/></>;
  if (item.kind === 'plant' || item.kind === 'table-plant') return <><circle r={item.w*.4} fill="#e3d1bb"/><circle r={item.w*.3} fill="#759477"/><path d={`M 0 ${-item.w*.26} Q ${item.w*.3} 0 0 ${item.w*.25} Q ${-item.w*.3} 0 0 ${-item.w*.26}`} fill="#4f7054"/></>;
  if (item.kind === 'toilet') return <><rect x={-item.w*.4} y={-item.d*.43} width={item.w*.8} height={item.d*.28} rx=".03" fill="#e8e5df"/><ellipse cy={item.d*.09} rx={item.w*.3} ry={item.d*.28} fill="#f9f9f7" stroke="#bec6c3" strokeWidth=".025"/></>;
  if (item.kind === 'shower') return <><rect x={-item.w*.45} y={-item.d*.45} width={item.w*.9} height={item.d*.9} fill="#d7e0df" stroke="#8da7aa" strokeWidth=".02"/><circle r=".07" fill="#889ca0"/></>;
  return <><rect x={-item.w*.46} y={-item.d*.44} width={item.w*.92} height={item.d*.88} rx=".035" fill={item.color} stroke="#9b9186" strokeWidth=".025"/>{item.kind==='table' || item.kind==='desk' || item.kind==='kitchen' || item.kind==='island' ? <line x1={-item.w*.37} y1="0" x2={item.w*.37} y2="0" stroke="#ffffff" strokeOpacity=".45" strokeWidth=".018"/>: null}{item.kind==='extending-table'&&(item.leaf?[-item.leaf/2,item.leaf/2]:[0]).map(x=><line key={x} x1={x} y1={-item.d*.44} x2={x} y2={item.d*.44} stroke="#ffffff" strokeOpacity=".55" strokeWidth=".012"/>)}</>;
}
/** Magnetic joints when drawing walls: prefer an existing vertex, then a wall axis.
 * Reuse the exact coordinates so T junctions remain connected in the room graph. */
function snapToWallJoint(point: Point, walls: Wall[]): Point {
  const tolerance = .22;
  let nearest: Point | null = null;
  let best = tolerance;
  for (const wall of walls) {
    for (const endpoint of [wall.a, wall.b]) {
      const d = distance(point, endpoint);
      if (d < best) { best = d; nearest = endpoint; }
    }
  }
  if (nearest) return { ...nearest };
  best = tolerance;
  for (const wall of walls) {
    const projected = wallProjection(wall, point).point;
    const d = distance(point, projected);
    if (d < best) { best = d; nearest = projected; }
  }
  return nearest ? { ...nearest } : point;
}
export default function Plan2D() {
  const {project,tool,selection,setSelection,setTool,change,checkpoint,selectedFurniture,setFurnitureGroup}=useEditorPick('project','tool','selection','setSelection','setTool','change','checkpoint','selectedFurniture','setFurnitureGroup');
  const svg = useRef<SVGSVGElement>(null);
  type Drag = {type:'furniture';id:string;dx:number;dy:number;group?:{id:string;x:number;y:number}[];start:Point}|{type:'wall';id:string;start:Point;a:Point;b:Point;handle:'a'|'b'|'move';rooms:typeof project.rooms};
  const drag = useRef<Drag | null>(null);
  const pan = useRef<{ pointerId: number; clientX: number; clientY: number; scaleX: number; scaleY: number; center: Point } | null>(null);
  const spaceHeld = useRef(false);
  const [spacePanning, setSpacePanning] = useState(false);
  const [startWall, setStartWall] = useState<Point | null>(null);
  useEffect(() => {
    const editable = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'));
    };
    const down = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      if (event.code === 'Space' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        spaceHeld.current = true;
        setSpacePanning(true);
      }
      if (event.key === 'Escape') {
        spaceHeld.current = false;
        setSpacePanning(false);
        setStartWall(null);
        setPointer(null);
        if(drag.current){useEditor.getState().cancelDrag();drag.current=null;setAlignment(null);setSpacing([]);}
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') { spaceHeld.current = false; setSpacePanning(false); }
    };
    const blur = () => { spaceHeld.current = false; setSpacePanning(false); pan.current = null; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [alignment, setAlignment] = useState<{ x?: number; y?: number } | null>(null);
  const [spacing, setSpacing] = useState<{ axis: 'x' | 'y'; from: number; to: number; cross: number; metres: number }[]>([]);
  const [zoom, setZoom] = useState(1);
  const [viewCenter, setViewCenter] = useState<Point | null>(null);
  useEffect(()=>{const fit=()=>{setZoom(1);setViewCenter(null);};window.addEventListener('atelier60:fit-plan',fit);return()=>window.removeEventListener('atelier60:fit-plan',fit);},[]);
  // Keep the world-space point beneath the cursor fixed while zooming.
  const zoomAt = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const next = clamp(nextZoom, 1, 4);
    const currentCenter = viewCenter ?? { x: project.width / 2, y: project.depth / 2 };
    if (clientX !== undefined && clientY !== undefined && svg.current) {
      const matrix = svg.current.getScreenCTM();
      if (matrix) {
        const anchor = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
        const ratio = zoom / next;
        setViewCenter({
          x: clamp(anchor.x + (currentCenter.x - anchor.x) * ratio, 0, project.width),
          y: clamp(anchor.y + (currentCenter.y - anchor.y) * ratio, 0, project.depth),
        });
      }
    }
    setZoom(next);
  },[zoom,viewCenter,project.width,project.depth]);
  useEffect(()=>{
    const element=svg.current;
    const onWheel=(event:WheelEvent)=>{event.preventDefault();zoomAt(zoom*(event.deltaY<0?1.15:1/1.15),event.clientX,event.clientY);};
    element?.addEventListener('wheel',onWheel,{passive:false});
    return()=>element?.removeEventListener('wheel',onWheel);
  },[zoom,zoomAt]);
  const pt = (e: PointerEvent<SVGSVGElement | SVGElement>): Point => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return {x:0,y:0};
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: clamp(snap(p.x,project.editor?.grid??.1), 0, project.width), y: clamp(snap(p.y,project.editor?.grid??.1), 0, project.depth) };
  };
  // Middle-button panning works above walls, furniture and room labels without editing them.
  const onPanStart = (e: PointerEvent<SVGSVGElement>) => {
    if (!(e.button === 1 || (e.button === 0 && spaceHeld.current)) || drag.current || pan.current) return;
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    e.preventDefault();
    e.stopPropagation();
    pan.current = {
      pointerId: e.pointerId,
      clientX: e.clientX, clientY: e.clientY,
      scaleX: Math.hypot(matrix.a, matrix.b), scaleY: Math.hypot(matrix.c, matrix.d),
      center: viewCenter ?? { x: project.width / 2, y: project.depth / 2 },
    };
    svg.current?.setPointerCapture(e.pointerId);
  };
  const onBackground = (e: PointerEvent<SVGSVGElement>) => {
    if (pan.current || spaceHeld.current) return;
    if (e.target !== svg.current && (e.target as Element).getAttribute('data-floor') !== 'true') return;
    const p = tool === 'wall'&&project.editor?.magnet!==false ? snapToWallJoint(pt(e), project.walls) : pt(e);
    if (tool === 'wall') {
      if (!startWall) setStartWall(p);
      else {
        const endpoint = { ...p };
        const magneticJoint = project.walls.some(w => distance(endpoint,w.a)<.001 || distance(endpoint,w.b)<.001 || distance(endpoint,wallProjection(w,endpoint).point)<.001);
        if (!magneticJoint&&project.editor?.orthogonal!==false) {
          if (Math.abs(endpoint.x - startWall.x) < .35) endpoint.x = startWall.x;
          if (Math.abs(endpoint.y - startWall.y) < .35) endpoint.y = startWall.y;
        }
        if (distance(startWall, endpoint) > .3) change(project => {
          // Make a snapped T junction an actual pair of editable wall segments.
          // Keep opening centres at the same world position on either segment.
          const connectAt = (joint: Point) => {
            const existing = [...project.walls];
            for (const wall of existing) {
              if (wall.outer || distance(joint, wall.a) < .001 || distance(joint, wall.b) < .001) continue;
              const projection = wallProjection(wall, joint);
              const length = distance(wall.a, wall.b);
              const cut = projection.offset * length;
              if (distance(projection.point, joint) > .001 || cut < .35 || length - cut < .35) continue;
              const openings = project.openings.filter(o => o.wallId === wall.id);
              if (openings.some(o => Math.abs(o.offset * length - cut) < o.width / 2 + .05)) continue;
              const secondId = makeId();
              const oldEnd = { ...wall.b };
              wall.b = { ...joint };
              project.walls.push({ ...wall, id: secondId, a: { ...joint }, b: oldEnd });
              for (const opening of openings) {
                const centre = opening.offset * length;
                if (centre < cut) opening.offset = centre / cut;
                else { opening.wallId = secondId; opening.offset = (centre - cut) / (length - cut); }
              }
            }
          };
          connectAt(startWall);
          if (distance(startWall, endpoint) > .001) connectAt(endpoint);
          // Split both axes at proper crossings so each new segment has editable joints.
          // Reject cuts near ends and across existing doors/windows.
          const dx = endpoint.x - startWall.x, dy = endpoint.y - startWall.y;
          const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
          const crossings: Array<{t:number; point:Point}> = [];
          for (const wall of [...project.walls]) {
            if (wall.outer) continue;
            const wx = wall.b.x - wall.a.x, wy = wall.b.y - wall.a.y;
            const denominator = cross(dx,dy,wx,wy);
            if (Math.abs(denominator) < 1e-8) continue;
            const rx = wall.a.x - startWall.x, ry = wall.a.y - startWall.y;
            const t = cross(rx,ry,wx,wy) / denominator;
            const u = cross(rx,ry,dx,dy) / denominator;
            const newLength = distance(startWall,endpoint);
            const existingLength = distance(wall.a,wall.b);
            if (t * newLength < .35 || (1-t)*newLength < .35 ||
                u * existingLength < .35 || (1-u)*existingLength < .35) continue;
            if (project.openings.some(o => o.wallId === wall.id &&
                Math.abs(o.offset * existingLength - u * existingLength) < o.width/2 + .05)) continue;
            crossings.push({t,point:{x:startWall.x+t*dx,y:startWall.y+t*dy}});
          }
          crossings.sort((a,b)=>a.t-b.t);
          const joints = [startWall,...crossings.map(c=>c.point),endpoint];
          for (const crossing of crossings) connectAt(crossing.point);
          for (let i=1;i<joints.length;i++) {
            if (distance(joints[i-1],joints[i]) >= .35)
              project.walls.push({id:makeId(),a:{...joints[i-1]},b:{...joints[i]},thickness:.12});
          }
          reconcileRooms(project);
        });
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
    if (pan.current || spaceHeld.current) return;
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
  /** Split an interior wall at the clicked point while preserving the world-space
   * positions of all doors and windows. A cut through an opening is refused. */
  const splitWall = (id: string, e: React.MouseEvent<SVGLineElement>) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    const wall = project.walls.find(w => w.id === id);
    if (!wall || wall.outer) return;
    const length = distance(wall.a, wall.b);
    const cut = wallProjection(wall, pt(e as unknown as PointerEvent<SVGElement>));
    const splitAt = cut.offset * length;
    if (splitAt < .35 || length - splitAt < .35) return;
    const openings = project.openings.filter(o => o.wallId === id);
    if (openings.some(o => Math.abs(o.offset * length - splitAt) < o.width / 2 + .05)) return;
    const newId = makeId();
    change(p => {
      const target = p.walls.find(w => w.id === id);
      if (!target) return;
      const originalEnd = { ...target.b };
      target.b = { ...cut.point };
      p.walls.push({ ...target, id: newId, a: { ...cut.point }, b: originalEnd });
      for (const opening of p.openings.filter(o => o.wallId === id)) {
        const centre = opening.offset * length;
        if (centre < splitAt) opening.offset = centre / splitAt;
        else {
          opening.wallId = newId;
          opening.offset = (centre - splitAt) / (length - splitAt);
        }
      }
      reconcileRooms(p);
    });
    setSelection({ type: 'wall', id: newId });
  };

  const mergeSelectedWall = () => {
    if (tool !== 'select' || selection?.type !== 'wall') return;
    const first = project.walls.find(w => w.id === selection.id);
    if (!first || first.outer) return;
    const near = (a: Point, b: Point) => distance(a,b) < .001;
    const cross = (a: Point,b: Point,c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const matches = project.walls.filter(w => w.id !== first.id && !w.outer && Math.abs(w.thickness-first.thickness)<.001)
      .flatMap(other => {
        const pairs: Array<[Point,Point,Point]> = [];
        if (near(first.a,other.a)) pairs.push([first.a,first.b,other.b]);
        if (near(first.a,other.b)) pairs.push([first.a,first.b,other.a]);
        if (near(first.b,other.a)) pairs.push([first.b,first.a,other.b]);
        if (near(first.b,other.b)) pairs.push([first.b,first.a,other.a]);
        return pairs.filter(([joint,a,b]) => Math.abs(cross(a,joint,b)) < .001 &&
          (joint.x-a.x)*(b.x-joint.x)+(joint.y-a.y)*(b.y-joint.y)>0)
          .map(([joint,a,b]) => ({other,joint,a,b}));
      });
    if (matches.length !== 1) return;
    const {other,joint,a,b} = matches[0];
    if (project.walls.some(w => w.id!==first.id && w.id!==other.id &&
      (near(w.a,joint)||near(w.b,joint)))) return;
    const length = distance(a,b);
    const offsets = project.openings.filter(o=>o.wallId===first.id||o.wallId===other.id).map(o=>{
      const w=o.wallId===first.id?first:other;
      const centre={x:w.a.x+(w.b.x-w.a.x)*o.offset,y:w.a.y+(w.b.y-w.a.y)*o.offset};
      return {id:o.id,width:o.width,offset:distance(a,centre)/length};
    });
    if(offsets.some(o=>o.offset*length<o.width/2+.05||(1-o.offset)*length<o.width/2+.05)) return;
    change(p=>{
      const wall=p.walls.find(w=>w.id===first.id);
      if(!wall)return;
      wall.a={...a};wall.b={...b};
      p.walls=p.walls.filter(w=>w.id!==other.id);
      for(const entry of offsets){
        const opening=p.openings.find(o=>o.id===entry.id);
        if(opening){opening.wallId=first.id;opening.offset=entry.offset;}
      }
      reconcileRooms(p);
    });
    setSelection({type:'wall',id:first.id});
  };
  const onItemDown=(e:PointerEvent<SVGGElement>,item:Furniture)=>{
    if(tool!=='select')return;
    e.stopPropagation();
    if(e.shiftKey){setFurnitureGroup(selectedFurniture.includes(item.id)?selectedFurniture.filter(id=>id!==item.id):[...selectedFurniture,item.id]);return;}
    setAlignment(null);
    setSpacing([]);
    setSelection({type:'furniture',id:item.id}); checkpoint();
    const point=pt(e);drag.current={type:'furniture',id:item.id,dx:point.x-item.x,dy:point.y-item.y,start:point,group:selectedFurniture.includes(item.id)&&selectedFurniture.length>1?project.furniture.filter(f=>selectedFurniture.includes(f.id)).map(({id,x,y})=>({id,x,y})):undefined};
    svg.current?.setPointerCapture(e.pointerId);
  };
  const itemDownRef=useRef<ItemDown>(onItemDown);itemDownRef.current=onItemDown;
  const onMove=(e:PointerEvent<SVGSVGElement>)=>{
    if (pan.current) {
      if (e.pointerId !== pan.current.pointerId) return;
      const { clientX, clientY, scaleX, scaleY, center } = pan.current;
      setViewCenter({
        x: clamp(center.x + (clientX - e.clientX) / scaleX, 0, project.width),
        y: clamp(center.y + (clientY - e.clientY) / scaleY, 0, project.depth),
      });
      return;
    }
    const p=pt(e);setPointer(tool==='wall'&&project.editor?.magnet!==false ? snapToWallJoint(p,project.walls) : p);
    if(drag.current){
      if(drag.current.type==='furniture'){
        const groupDrag=drag.current;
        if(groupDrag.group){
          const bounds=groupDrag.group.map(original=>{const f=project.furniture.find(f=>f.id===original.id)!;const a=f.rotation*Math.PI/180;return {...original,hx:(Math.abs(Math.cos(a))*f.w+Math.abs(Math.sin(a))*f.d)/2,hy:(Math.abs(Math.sin(a))*f.w+Math.abs(Math.cos(a))*f.d)/2};});
          const dx=clamp(p.x-groupDrag.start.x,Math.max(...bounds.map(f=>f.hx-f.x)),Math.min(...bounds.map(f=>project.width-f.hx-f.x)));
          const dy=clamp(p.y-groupDrag.start.y,Math.max(...bounds.map(f=>f.hy-f.y)),Math.min(...bounds.map(f=>project.depth-f.hy-f.y)));
          change(next=>{for(const original of groupDrag.group!){const item=next.furniture.find(f=>f.id===original.id);if(item){item.x=original.x+dx;item.y=original.y+dy;}}},false);return;
        }
        const {id,dx,dy}=drag.current;
        change(project=>{const f=project.furniture.find(i=>i.id===id);if(f){
          const angle=f.rotation*Math.PI/180;const hx=(Math.abs(Math.cos(angle))*f.w+Math.abs(Math.sin(angle))*f.d)/2;
          const hy=(Math.abs(Math.sin(angle))*f.w+Math.abs(Math.cos(angle))*f.d)/2;
          const rawX=p.x-dx, rawY=p.y-dy;
          const others=project.furniture.filter(other=>other.id!==id);
          // Align centres AND visible edges, accounting for rotated bounding boxes.
          // Compare candidate translations, not absolute coordinates: different-size
          // furniture can share a left/right/top/bottom edge without sharing a centre.
          const nearest = (axis:'x'|'y') => {
            const raw=axis==='x'?rawX:rawY;
            const half=axis==='x'?hx:hy;
            const candidates=[0,-half,half];
            let best:{value:number;gap:number}|null=null;
            for(const other of others){
              const radians=other.rotation*Math.PI/180;
              const extent=(axis==='x'
                ? Math.abs(Math.cos(radians))*other.w+Math.abs(Math.sin(radians))*other.d
                : Math.abs(Math.sin(radians))*other.w+Math.abs(Math.cos(radians))*other.d)/2;
              const centre=axis==='x'?other.x:other.y;
              for(const offset of candidates){
                for(const target of [centre,centre-extent,centre+extent]){
                  const value=target-offset;
                  const gap=Math.abs(value-raw);
                  if(gap<=.18&&(!best||gap<best.gap))best={value,gap};
                }
              }
            }
            return best;
          };
          const nearestX=nearest('x');
          const nearestY=nearest('y');
          const x=clamp(project.editor?.magnet!==false&&nearestX?nearestX.value:snap(rawX,project.editor?.grid??.1),hx,Math.max(hx,project.width-hx));
          const y=clamp(project.editor?.magnet!==false&&nearestY?nearestY.value:snap(rawY,project.editor?.grid??.1),hy,Math.max(hy,project.depth-hy));
          f.x=x;f.y=y;
          // Show the nearest clear horizontal/vertical gap to another object.
          // Rotated furniture uses its visible axis-aligned footprint.
          const gaps: { axis:'x'|'y'; from:number; to:number; cross:number; metres:number }[] = [];
          for (const axis of ['x','y'] as const) {
            const ownCenter=axis==='x'?x:y;
            const ownHalf=axis==='x'?hx:hy;
            const ownCross=axis==='x'?y:x;
            const ownCrossHalf=axis==='x'?hy:hx;
            let best: typeof gaps[number] | undefined;
            for (const other of others) {
              const a=other.rotation*Math.PI/180;
              const ox=(Math.abs(Math.cos(a))*other.w+Math.abs(Math.sin(a))*other.d)/2;
              const oy=(Math.abs(Math.sin(a))*other.w+Math.abs(Math.cos(a))*other.d)/2;
              const otherCenter=axis==='x'?other.x:other.y;
              const otherHalf=axis==='x'?ox:oy;
              const otherCross=axis==='x'?other.y:other.x;
              const otherCrossHalf=axis==='x'?oy:ox;
              if(Math.abs(ownCross-otherCross)>ownCrossHalf+otherCrossHalf+.3)continue;
              const left=ownCenter+ownHalf<=otherCenter-otherHalf;
              const right=otherCenter+otherHalf<=ownCenter-ownHalf;
              if(!left&&!right)continue;
              const from=left?ownCenter+ownHalf:otherCenter+otherHalf;
              const to=left?otherCenter-otherHalf:ownCenter-ownHalf;
              const metres=to-from;
              if(metres>3 || (best && metres>=best.metres))continue;
              best={axis,from,to,cross:(ownCross+otherCross)/2,metres};
            }
            if(best)gaps.push(best);
          }
          setSpacing(gaps);
          setAlignment({x:nearestX&&Math.abs(x-nearestX.value)<.001?x:undefined,y:nearestY&&Math.abs(y-nearestY.value)<.001?y:undefined});
        }},false);
      }else{
        const move=drag.current;const dx=p.x-move.start.x,dy=p.y-move.start.y;
        const a=move.handle==='b'?move.a:{x:snap(move.a.x+dx,project.editor?.grid??.1),y:snap(move.a.y+dy,project.editor?.grid??.1)};
        const b=move.handle==='a'?move.b:{x:snap(move.b.x+dx,project.editor?.grid??.1),y:snap(move.b.y+dy,project.editor?.grid??.1)};
        const anchor=(v:Point):Point=>{
          const other=project.walls.filter(w=>w.id!==move.id).flatMap(w=>[w.a,w.b]);
          const nearest=other.reduce<{p:Point;d:number}|null>((best,q)=>{const d=distance(v,q);return d<.22&&(!best||d<best.d)?{p:q,d}:best;},null);
          return nearest?{...nearest.p}:v;
        };
        const aa=move.handle==='move'||project.editor?.magnet===false?a:anchor(a),bb=move.handle==='move'||project.editor?.magnet===false?b:anchor(b);
        change(project=>{updateWallGeometry(project,move.id,aa,bb,true,project.editor?.magnet!==false);project.rooms=structuredClone(move.rooms);reconcileRooms(project);},false);
      }
    }
  };
  const onDragEnd=(e:PointerEvent<SVGSVGElement>)=>{
    if (pan.current?.pointerId === e.pointerId) pan.current=null;
    if(drag.current)useEditor.getState().commitDrag();
    drag.current=null;
    setAlignment(null);
    setSpacing([]);
  };
  const warnings=cachedProjectWarnings(project);
  const movingName=drag.current?.type==='furniture'?project.furniture.find(f=>f.id===drag.current?.id)?.name:undefined;
  const previewCollisions=movingName?cachedFurnitureCollisions(project).filter(warning=>warning.includes(`«${movingName}»`)).slice(0,2):[];
  const roomPath=(room:typeof project.rooms[number])=>{
    const ring=(points:Point[])=>`M ${points.map(p=>`${p.x} ${p.y}`).join(' L ')} Z`;
    return [ring(roomVertices(room)),...(room.holes??[]).map(ring)].join(' ');
  };
  const spanX=project.width/zoom, spanY=project.depth/zoom;
  const center=viewCenter ?? {x:project.width/2,y:project.depth/2};
  const x0=center.x-spanX/2,y0=center.y-spanY/2;
  return <div className="plan-wrap">
    {previewCollisions.length>0&&<div className="collision-preview" role="status">{previewCollisions.join(' ')} Escape cancela el movimiento.</div>}
    <div className="plan-topline"><span><span className="live-dot"/> PLANO EDITABLE</span><span>{project.width.toFixed(1)} × {project.depth.toFixed(1)} m · {(project.width*project.depth).toFixed(0)} m²</span></div>
    <svg ref={svg} className="plan-svg" onPointerDownCapture={onPanStart} onAuxClick={e=>e.preventDefault()} style={{cursor:spacePanning?'grab':undefined}} viewBox={`${x0-.7} ${y0-.7} ${spanX+1.4} ${spanY+1.4}`} onPointerDown={onBackground} onPointerMove={onMove} onPointerUp={onDragEnd} onLostPointerCapture={onDragEnd} aria-label="Editor de plano 2D">
      <defs><pattern id="floor-grid" width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#c8c4bd" strokeWidth=".013"/></pattern></defs>
      <rect data-floor="true" x="0" y="0" width={project.width} height={project.depth} fill="#f8f7f4"/>
      {project.referenceImage&&<image href={project.referenceImage.data} x="0" y="0" width={project.referenceImage.width} height={project.referenceImage.height} opacity={project.referenceImage.opacity} pointerEvents="none"/>}
      {project.rooms.map(room=><g key={room.id} onPointerDown={e=>{if(tool==='select'){e.stopPropagation();setSelection({type:'room',id:room.id});}}}>
        <path data-floor="true" d={roomPath(room)} fillRule="evenodd" fill={floors[room.floor]?.color ?? '#e0d2bd'} opacity=".56"/>
        <text x={roomLabelPoint(room).x} y={roomLabelPoint(room).y} className="room-title" fontSize=".2" textAnchor="middle" opacity=".52">{room.name} ({roomArea(room).toFixed(1)}m²)</text>
        {selection?.type==='room' && selection.id===room.id && <path d={roomPath(room)} fill="none" stroke="#3a705b" strokeDasharray=".09 .07" strokeWidth=".045" pointerEvents="none"/>}
      </g>)}
      <rect data-floor="true" x="0" y="0" width={project.width} height={project.depth} fill="url(#floor-grid)" pointerEvents="none"/>
      {project.walls.map(w=><g key={w.id}>
        <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={selection?.type==='wall'&&selection.id===w.id?'#438a68':'#d5cdc2'} strokeWidth={w.thickness+.045} strokeLinecap="square" pointerEvents="none"/>
        <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={selection?.type==='wall'&&selection.id===w.id?'#3a866c':'#616768'} strokeWidth={w.thickness} strokeLinecap="square" onPointerDown={e=>onWall(w.id,e)} onDoubleClick={e=>splitWall(w.id,e)} className="plan-wall"/>
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
      {project.furniture.map(item=><PlanFurniture key={item.id} item={item} selected={selectedFurniture.includes(item.id)} onDown={itemDownRef}/>)}
       {alignment?.x !== undefined && <line x1={alignment.x} y1="0" x2={alignment.x} y2={project.depth} stroke="#198c9b" strokeWidth=".025" strokeDasharray=".12 .09" pointerEvents="none"/>}
       {alignment?.y !== undefined && <line x1="0" y1={alignment.y} x2={project.width} y2={alignment.y} stroke="#198c9b" strokeWidth=".025" strokeDasharray=".12 .09" pointerEvents="none"/>}
      {spacing.map((gap,i)=><g key={i} pointerEvents="none" className="dimension">
        {gap.axis==='x'?<><line x1={gap.from} y1={gap.cross} x2={gap.to} y2={gap.cross} stroke="#198c9b" strokeWidth=".018"/><line x1={gap.from} y1={gap.cross-.07} x2={gap.from} y2={gap.cross+.07} stroke="#198c9b" strokeWidth=".018"/><line x1={gap.to} y1={gap.cross-.07} x2={gap.to} y2={gap.cross+.07} stroke="#198c9b" strokeWidth=".018"/><text x={(gap.from+gap.to)/2} y={gap.cross-.09} textAnchor="middle" fontSize=".16" fill="#126b78" stroke="#f8f7f4" strokeWidth=".045" paintOrder="stroke">{gap.metres.toFixed(2)} m</text></>:<><line x1={gap.cross} y1={gap.from} x2={gap.cross} y2={gap.to} stroke="#198c9b" strokeWidth=".018"/><line x1={gap.cross-.07} y1={gap.from} x2={gap.cross+.07} y2={gap.from} stroke="#198c9b" strokeWidth=".018"/><line x1={gap.cross-.07} y1={gap.to} x2={gap.cross+.07} y2={gap.to} stroke="#198c9b" strokeWidth=".018"/><text x={gap.cross+.09} y={(gap.from+gap.to)/2} fontSize=".16" fill="#126b78" stroke="#f8f7f4" strokeWidth=".045" paintOrder="stroke">{gap.metres.toFixed(2)} m</text></>}
      </g>)}
      {startWall&&pointer&&<line x1={startWall.x} y1={startWall.y} x2={pointer.x} y2={pointer.y} stroke="#267658" strokeDasharray=".14 .09" strokeWidth=".055"/>}
      <g className="dimension"><line x1="0" y1="-.3" x2={project.width} y2="-.3" stroke="#888980" strokeWidth=".018"/><text x={project.width/2} y="-.38" textAnchor="middle" fontSize=".18">{project.width.toFixed(2)} m</text><line x1="-.3" y1="0" x2="-.3" y2={project.depth} stroke="#888980" strokeWidth=".018"/><text x="-.38" y={project.depth/2} textAnchor="middle" transform={`rotate(-90 -.38 ${project.depth/2})`} fontSize=".18">{project.depth.toFixed(2)} m</text></g>
    </svg>
    <div className="plan-footer"><span>{warnings.length?`${warnings.length} aviso(s) de geometría · `:''}{tool==='wall'||tool==='room'?(startWall?'Haz clic en el segundo extremo':'Haz clic para marcar el primer extremo (imán a muros existentes)'):tool==='door'||tool==='window'?'Haz clic en un tabique para insertar':'Arrastra muebles para alinearlos con guías; selecciona y arrastra un muro; botón central o Espacio + arrastre para mover; Esc cancela; doble clic divide' }</span><div className="zoom-tools">{selection?.type==='wall' && tool==='select' && <button type="button" title="Unir segmento colineal sin otras uniones" onClick={mergeSelectedWall}>Unir muros</button>}<button title="Alejar" onClick={()=>zoomAt(zoom/1.2)}>−</button><button title="Restablecer zoom y encuadre" onClick={()=>{setZoom(1);setViewCenter(null);}}>{Math.round(zoom*100)}%</button><button title="Acercar" onClick={()=>zoomAt(zoom*1.2)}>+</button></div></div>
  </div>;
}
