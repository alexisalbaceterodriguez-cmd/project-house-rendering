/**
 * Lightweight planar subdivision engine. Wall axes form a planar graph and
 * bounded faces become room footprints. This is conceptual geometry based on
 * wall centre-lines, NOT a surveyed or code-compliant net area calculation.
 */
import type { Point, Project, Room, Wall } from '../types';
import { clamp, distance, makeId, wallProjection } from './geometry';
const EPS = 1e-5;
const KEY_PRECISION = 4;
const key = (p: Point) => `${p.x.toFixed(KEY_PRECISION)},${p.y.toFixed(KEY_PRECISION)}`;
const sub = (a:Point,b:Point):Point => ({x:a.x-b.x,y:a.y-b.y});
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
export const polygonArea=(pts:Point[])=>Math.abs(signedArea(pts));
const signedArea=(pts:Point[])=>pts.reduce((acc,p,i)=>acc+cross(p,pts[(i+1)%pts.length]),0)/2;
export function polygonCentroid(pts:Point[]):Point {
  let x=0,y=0,total=0;
  for(let i=0;i<pts.length;i++){
    const p=pts[i],q=pts[(i+1)%pts.length],a=cross(p,q);total+=a;x+=(p.x+q.x)*a;y+=(p.y+q.y)*a;
  }
  if(Math.abs(total)<EPS) return {x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length};
  return {x:x/(3*total),y:y/(3*total)};
}
export function pointInPolygon(pt:Point,poly:Point[]):boolean {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>pt.y)!==(b.y>pt.y))&&(pt.x<(b.x-a.x)*(pt.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
  }
  return inside;
}
export const roomVertices=(room:Room):Point[]=>room.vertices && room.vertices.length>=3?room.vertices:[{x:room.x,y:room.y},{x:room.x+room.w,y:room.y},{x:room.x+room.w,y:room.y+room.d},{x:room.x,y:room.y+room.d}];
export const roomArea=(room:Room)=>Math.max(0,polygonArea(roomVertices(room))-(room.holes??[]).reduce((acc,h)=>acc+polygonArea(h),0));
/** Place a room label in the habitable region, not inside a nested void. */
export function roomLabelPoint(room:Room):Point {
  const poly=roomVertices(room),centroid=polygonCentroid(poly);
  if(!(room.holes??[]).some(h=>pointInPolygon(centroid,h)))return centroid;
  for(const anchor of poly){
    const p={x:anchor.x*.88+centroid.x*.12,y:anchor.y*.88+centroid.y*.12};
    if(pointInPolygon(p,poly)&&!(room.holes??[]).some(h=>pointInPolygon(p,h)))return p;
  }
  return poly[0];
}

/** Endpoints and all proper line intersections are split into a half-edge graph. */
export function enclosedFaces(walls:Wall[],width:number,depth:number):Point[][] {
  const segments=walls.filter(w=>distance(w.a,w.b)>EPS);
  const cuts=segments.map(()=>[0,1]);
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i].a,b=segments[i].b,c=segments[j].a,d=segments[j].b;
    const r=sub(b,a),s=sub(d,c),den=cross(r,s);
    if(Math.abs(den)>EPS){
      const ca=sub(c,a),t=cross(ca,s)/den,u=cross(ca,r)/den;
      if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS){cuts[i].push(clamp(t,0,1));cuts[j].push(clamp(u,0,1));}
    }else if(Math.abs(cross(sub(c,a),r))<EPS){
      const rr=dot(r,r),ss=dot(s,s);
      if(rr>EPS&&ss>EPS){
        cuts[i].push(clamp(dot(sub(c,a),r)/rr,0,1),clamp(dot(sub(d,a),r)/rr,0,1));
        cuts[j].push(clamp(dot(sub(a,c),s)/ss,0,1),clamp(dot(sub(b,c),s)/ss,0,1));
      }
    }
  }
  const coords=new Map<string,Point>();
  const neighbours=new Map<string,Set<string>>();
  const link=(p:Point,q:Point)=>{
    const kp=key(p),kq=key(q);if(kp===kq)return;
    coords.set(kp,p);coords.set(kq,q);
    if(!neighbours.has(kp))neighbours.set(kp,new Set());
    if(!neighbours.has(kq))neighbours.set(kq,new Set());
    neighbours.get(kp)!.add(kq);neighbours.get(kq)!.add(kp);
  };
  segments.forEach((s,i)=>{
    const fractions=[...new Set(cuts[i].map(v=>Number(v.toFixed(6))))].sort((a,b)=>a-b);
    for(let j=0;j<fractions.length-1;j++){
      const at=(t:number)=>({x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t});
      const a=at(fractions[j]),b=at(fractions[j+1]);
      if(distance(a,b)>EPS)link(a,b);
    }
  });
  const ordered=new Map<string,string[]>();
  for(const [k,n] of neighbours){
    const a=coords.get(k)!;
    ordered.set(k,[...n].sort((k1,k2)=>{
      const b=coords.get(k1)!,c=coords.get(k2)!;
      return Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(c.y-a.y,c.x-a.x);
    }));
  }
  const seen=new Set<string>();
  const faces:Point[][]=[];
  for(const [start,ns] of ordered)for(const next of ns){
    const first=`${start}>${next}`;if(seen.has(first))continue;
    let a=start,b=next;const ring:Point[]=[];
    let closed=false;
    for(let step=0;step<Math.min(ordered.size*8,20000);step++){
      const edge=`${a}>${b}`;if(seen.has(edge))break;
      seen.add(edge);ring.push(coords.get(a)!);
      const n=ordered.get(b)!;const reverse=n.indexOf(a);
      if(reverse===-1)break;
      const c=n[(reverse-1+n.length)%n.length];
      a=b;b=c;
      if(`${a}>${b}`===first){closed=true;break;}
    }
    if(!closed||ring.length<3||signedArea(ring)<.1)continue;
    const center=polygonCentroid(ring);
    if(center.x<-EPS||center.x>width+EPS||center.y<-EPS||center.y>depth+EPS)continue;
    if(ring.some(p=>p.x<-.01||p.y<-.01||p.x>width+.01||p.y>depth+.01))continue;
    faces.push(ring);
  }
  return faces.sort((a,b)=>polygonCentroid(a).y-polygonCentroid(b).y||polygonCentroid(a).x-polygonCentroid(b).x);
}

/** Clip polygon against an axis-aligned rectangle (Sutherland–Hodgman). */
export function overlapRectangle(pts:Point[],r:{x:number;y:number;w:number;d:number}):number {
  let poly=pts;
  const lines:[(p:Point)=>boolean,(a:Point,b:Point)=>Point][]=[
    [p=>p.x>=r.x-EPS,(a,b)=>({x:r.x,y:a.y+(b.y-a.y)*(r.x-a.x)/(b.x-a.x)})],
    [p=>p.x<=r.x+r.w+EPS,(a,b)=>({x:r.x+r.w,y:a.y+(b.y-a.y)*(r.x+r.w-a.x)/(b.x-a.x)})],
    [p=>p.y>=r.y-EPS,(a,b)=>({x:a.x+(b.x-a.x)*(r.y-a.y)/(b.y-a.y),y:r.y})],
    [p=>p.y<=r.y+r.d+EPS,(a,b)=>({x:a.x+(b.x-a.x)*(r.y+r.d-a.y)/(b.y-a.y),y:r.y+r.d})]
  ];
  for(const [inside,intersection] of lines){
    if(!poly.length)return 0;
    const result:Point[]=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
      if(ia&&ib)result.push(b);
      else if(ia&&!ib)result.push(intersection(a,b));
      else if(!ia&&ib){result.push(intersection(a,b));result.push(b);}
    }
    poly=result;
  }
  return poly.length>=3?polygonArea(poly):0;
}

/**
 * Preserve editable room metadata by maximum area overlap, but always use wall
 * geometry for floors and area. New enclosed regions become new rooms.
 * Open or incomplete plans deliberately have no automatically enclosed rooms.
 */
export function reconcileRooms(p:Project):void {
  const faces=enclosedFaces(p.walls,p.width,p.depth);
  // Disconnected nested rings are legitimate rooms. Their parent floor must
  // contain a void, otherwise both floors and areas would double count.
  const holes=faces.map((_,i)=>{
    const area=polygonArea(faces[i]);
    return faces.filter((candidate,j)=>{
      if(j===i||polygonArea(candidate)>=area-.01)return false;
      const childCentroid=polygonCentroid(candidate);
      if(!pointInPolygon(childCentroid,faces[i]))return false;
      const ancestorArea=Math.min(...faces.filter((other,k)=>k!==j&&polygonArea(other)>polygonArea(candidate)+.01&&pointInPolygon(childCentroid,other)).map(polygonArea));
      return Math.abs(ancestorArea-area)<.01;
    });
  });
  const previous=p.rooms;
  // Global matching prevents a newly enclosed inner room from stealing the
  // identity of a larger existing room just because it is visited first.
  const candidates=faces.flatMap((poly,faceIndex)=>previous.map(room=>({faceIndex,room,score:overlapRectangle(poly,room)})))
    .sort((a,b)=>b.score-a.score);
  const assignments=new Map<number,Room>();const matched=new Set<string>();
  for(const candidate of candidates){
    if(candidate.score<=.05)break;
    if(assignments.has(candidate.faceIndex)||matched.has(candidate.room.id))continue;
    assignments.set(candidate.faceIndex,candidate.room);matched.add(candidate.room.id);
  }
  const result:Room[]=[];
  for(const [faceIndex,poly] of faces.entries()){
    const original=assignments.get(faceIndex);
    const xs=poly.map(v=>v.x),ys=poly.map(v=>v.y);const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,d=Math.max(...ys)-y;
    result.push({id:original?.id??makeId(),name:original?.name??`Estancia ${result.length+1}`,kind:original?.kind??'bedroom',floor:original?.floor??'oak',x,y,w,d,vertices:poly,holes:holes[faceIndex]});
  }
  p.rooms=result;
}

/** Resize the envelope and optionally rescale the floor-plan geometry. Furniture
 * maintains its physical size; only its centre position is transformed. */
export function resizeProject(p:Project,width:number,depth:number,mode:'scale'|'keep'='scale') {
  if(!Number.isFinite(width)||!Number.isFinite(depth)||width<2||depth<2||width>100||depth>100)throw Error('Dimensiones fuera de rango.');
  const sx=width/p.width,sy=depth/p.depth;
  if(mode==='scale'){
    p.walls.forEach(w=>{w.a.x*=sx;w.b.x*=sx;w.a.y*=sy;w.b.y*=sy;});
    p.rooms.forEach(r=>{r.x*=sx;r.y*=sy;r.w*=sx;r.d*=sy;r.vertices?.forEach(v=>{v.x*=sx;v.y*=sy;});r.holes?.forEach(h=>h.forEach(v=>{v.x*=sx;v.y*=sy;}));});
    p.furniture.forEach(f=>{f.x*=sx;f.y*=sy;});
  }else{
    // Keep interior geometry fixed; reposition only the exterior perimeter.
    // A shorter envelope may leave interior elements outside; warnings flag them.
    p.walls.forEach(w=>{
      if(!w.outer)return;
      for(const v of [w.a,w.b]){if(Math.abs(v.x-p.width)<EPS)v.x=width;if(Math.abs(v.y-p.depth)<EPS)v.y=depth;}
    });
  }
  p.width=width;p.depth=depth;
  reconcileRooms(p);
}

/** Move a single wall endpoint or translate a wall while keeping endpoint joints.
 * The envelope is modified only through resizeProject. */
export function updateWallGeometry(p:Project,id:string,nextA:Point,nextB:Point,linked=true) {
  const target=p.walls.find(w=>w.id===id);
  if(!target||target.outer)return;
  const oldA={...target.a},oldB={...target.b};
  const constrain=(v:Point):Point=>({x:clamp(v.x,0,p.width),y:clamp(v.y,0,p.depth)});
  // A partition attached to the fixed perimeter may slide along that edge,
  // but dragging its handle must never leave an open gap at the envelope.
  const keepExteriorJoint = (oldPoint: Point, proposed: Point): Point => {
    if (!linked) return proposed;
    const exterior = p.walls.filter(w => w.outer &&
      distance(wallProjection(w, oldPoint).point, oldPoint) < .001);
    if (!exterior.length) return proposed;
    // Two perimeter edges meet at a corner: keep the corner fixed.
    if (exterior.length > 1) return { ...oldPoint };
    return constrain(wallProjection(exterior[0], proposed).point);
  };
  // When dragging a single handle, snap it onto a nearby interior wall
  // axis to create an exact T-junction. Do not snap whole-wall translations:
  // those must preserve the user's requested displacement.
  const snapInteriorJoint = (point:Point):Point => {
    if (!linked) return point;
    // Prefer existing vertices over axes: joining a real endpoint creates
    // one shared node rather than two almost-coincident T connections.
    let best=point,nearest=.12;
    for (const wall of p.walls) {
      if (wall.id===id) continue;
      for (const endpoint of [wall.a,wall.b]) {
        const gap=distance(point,endpoint);
        if (gap<nearest) { nearest=gap;best={...endpoint}; }
      }
    }
    if (best!==point) return best;
    // Existing X intersections are valid graph nodes even when neither wall
    // has an endpoint there. Prefer them over an arbitrary nearby wall axis.
    const hosts=p.walls.filter(w=>w.id!==id);
    for(let i=0;i<hosts.length;i++)for(let j=i+1;j<hosts.length;j++){
      const first=hosts[i],second=hosts[j];
      const r=sub(first.b,first.a),s=sub(second.b,second.a);
      const denominator=cross(r,s);
      if(Math.abs(denominator)<EPS)continue;
      const delta=sub(second.a,first.a);
      const t=cross(delta,s)/denominator,u=cross(delta,r)/denominator;
      if(t<-EPS||t>1+EPS||u<-EPS||u>1+EPS)continue;
      const intersection={x:first.a.x+t*r.x,y:first.a.y+t*r.y};
      const gap=distance(point,intersection);
      if(gap<nearest){nearest=gap;best=intersection;}
    }
    if(best!==point)return best;
    for (const wall of p.walls) {
      if (wall.id===id || wall.outer) continue;
      const projection=wallProjection(wall,point);
      const gap=distance(point,projection.point);
      if (gap<nearest) { nearest=gap;best={...projection.point}; }
    }
    return best;
  };
  // A handle joined to the middle of another partition is a T-junction.
  // Slide along its host axis rather than detaching when dragged farther
  // than the ordinary 12 cm snap radius. Shared vertices remain free to move
  // as a group through the propagation logic below.
  const keepInteriorTJoint=(oldPoint:Point,proposed:Point):Point=>{
    if(!linked)return proposed;
    if(p.walls.some(w=>w.id!==id &&
      (distance(w.a,oldPoint)<.001||distance(w.b,oldPoint)<.001)))return proposed;
    const host=p.walls.find(w=>{
      if(w.id===id||w.outer)return false;
      const projection=wallProjection(w,oldPoint);
      return projection.offset>.001&&projection.offset<.999&&distance(projection.point,oldPoint)<.001;
    });
    return host?constrain(wallProjection(host,proposed).point):proposed;
  };
  const movedA=distance(oldA,nextA)>.0001;
  const movedB=distance(oldB,nextB)>.0001;
  const a=keepExteriorJoint(oldA,constrain(movedA&&!movedB?keepInteriorTJoint(oldA,snapInteriorJoint(nextA)):nextA));
  const b=keepExteriorJoint(oldB,constrain(movedB&&!movedA?keepInteriorTJoint(oldB,snapInteriorJoint(nextB)):nextB));
  if(distance(a,b)<.2)return;

  // Prepare all connected endpoint moves before touching the project. Reject a
  // drag that would collapse a neighbouring wall rather than tearing the joint.
  const proposed=new Map<string,{a:Point;b:Point}>();
  proposed.set(id,{a,b});
  if(linked){
    const direction=sub(oldB,oldA);
    const denominator=Math.max(EPS,dot(direction,direction));
    for(const other of p.walls){
      if(other.id===id||other.outer)continue;
      const endpoints=([other.a,other.b] as const).map(v=>{
        if(distance(v,oldA)<.001)return {...a};
        if(distance(v,oldB)<.001)return {...b};
        // A T-junction is an endpoint resting inside another wall's axis.
        // Interpolate its position on the edited axis, including when only
        // one handle moves or the wall rotates. Translation is a special case.
        // This preserves the joint rather than leaving a gap in the plan.
        const fraction=dot(sub(v,oldA),direction)/denominator;
        const projected={x:oldA.x+fraction*direction.x,y:oldA.y+fraction*direction.y};
        if(fraction>EPS&&fraction<1-EPS&&distance(v,projected)<.001)
          return constrain({x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction});
        return {...v};
      });
      if(distance(endpoints[0],other.a)>.0001||distance(endpoints[1],other.b)>.0001)
        proposed.set(other.id,{a:endpoints[0],b:endpoints[1]});
    }
  }
  // Propagate a moved shared vertex through connected branches, including
  // endpoints belonging to a T-junction carried by the edited wall. The
  // first pass above only updates walls touching the selected wall directly.
  // Use original coordinates for matching, so propagation cannot drift.
  if(linked){
    let changed=true;
    while(changed){
      changed=false;
      for(const source of p.walls){
        const moved=proposed.get(source.id);
        if(!moved)continue;
        for(const [oldVertex,newVertex] of [[source.a,moved.a],[source.b,moved.b]] as const){
          if(distance(oldVertex,newVertex)<.0001)continue;
          for(const neighbour of p.walls){
            if(neighbour.id===source.id)continue;
            const touchesA=distance(neighbour.a,oldVertex)<.001;
            const touchesB=distance(neighbour.b,oldVertex)<.001;
            if(!touchesA&&!touchesB)continue;
            // The exterior envelope is fixed. Reject rather than detach a
            // partition from a fixed perimeter vertex.
            if(neighbour.outer)return;
            const current=proposed.get(neighbour.id)??{a:neighbour.a,b:neighbour.b};
            if((touchesA&&distance(current.a,newVertex)>.0001)||
               (touchesB&&distance(current.b,newVertex)>.0001)){
              // Another branch may already have moved the same vertex to a
              // different destination; reject the ambiguous edit atomically.
              if((touchesA&&distance(current.a,neighbour.a)>.0001)||
                 (touchesB&&distance(current.b,neighbour.b)>.0001))return;
              proposed.set(neighbour.id,{
                a:touchesA?{...newVertex}:current.a,
                b:touchesB?{...newVertex}:current.b
              });
              changed=true;
            }
          }
        }
      }
    }
  }
  // Openings must continue to fit after the resize. A rejected drag leaves
  // every affected wall unchanged, including the selected wall.
  for(const [wallId,points] of proposed){
    const length=distance(points.a,points.b);
    if(length<.2)return;
    if(p.openings.some(o=>o.wallId===wallId &&
      (o.offset*length-o.width/2<.05||(1-o.offset)*length-o.width/2<.05)))return;
  }
  // Reject newly introduced interior crossings and collinear overlaps. A wall
  // drag must not silently create an unsplit X junction or duplicate wall axis.
  // Existing crossings are tolerated until the dedicated topology editor can
  // explicitly split them, so older projects remain editable.
  const intersection=(u:{a:Point;b:Point},v:{a:Point;b:Point})=>{
    const r=sub(u.b,u.a),s=sub(v.b,v.a),den=cross(r,s),delta=sub(v.a,u.a);
    if(Math.abs(den)<EPS){
      if(Math.abs(cross(delta,r))>EPS)return false;
      const rr=dot(r,r);
      if(rr<EPS)return false;
      const t0=dot(delta,r)/rr,t1=dot(sub(v.b,u.a),r)/rr;
      return Math.min(1,Math.max(t0,t1))-Math.max(0,Math.min(t0,t1))>1e-4;
    }
    const t=cross(delta,s)/den,k=cross(delta,r)/den;
    return t>1e-4&&t<1-1e-4&&k>1e-4&&k<1-1e-4;
  };
  for(let i=0;i<p.walls.length;i++)for(let j=i+1;j<p.walls.length;j++){
    const first=p.walls[i],second=p.walls[j];
    if(!proposed.has(first.id)&&!proposed.has(second.id))continue;
    const nextFirst=proposed.get(first.id)??first;
    const nextSecond=proposed.get(second.id)??second;
    if(intersection(nextFirst,nextSecond)&&!intersection(first,second))return;
  }
  for(const [wallId,points] of proposed){
    const wall=p.walls.find(w=>w.id===wallId);
    if(wall){wall.a=points.a;wall.b=points.b;}
  }
}

/** Warnings are advisory, not normative building-code validation. */
export function projectWarnings(p:Project):string[] {
  const issues:string[]=[];
  for(const w of p.walls){
    if(distance(w.a,w.b)<.2)issues.push(`Tabique «${w.id}» demasiado corto`);
    if([w.a,w.b].some(v=>v.x<-.001||v.y<-.001||v.x>p.width+.001||v.y>p.depth+.001))issues.push(`Tabique «${w.id}» fuera de la planta`);
  }
  for(const o of p.openings){
    const wall=p.walls.find(w=>w.id===o.wallId);if(!wall){issues.push('Abertura sin tabique');continue;}
    const len=distance(wall.a,wall.b);
    if(o.offset*len-o.width/2<.05||o.offset*len+o.width/2>len-.05)issues.push(`Abertura «${o.id}» excede su tabique`);
    if(o.sill+o.height>p.wallHeight+.01)issues.push(`Abertura «${o.id}» supera la altura de la pared`);
  }
  for(const f of p.furniture){
    const angle=f.rotation*Math.PI/180;
    const hx=(Math.abs(Math.cos(angle))*f.w+Math.abs(Math.sin(angle))*f.d)/2;
    const hy=(Math.abs(Math.sin(angle))*f.w+Math.abs(Math.cos(angle))*f.d)/2;
    if(f.x<hx-.001||f.x>p.width-hx+.001||f.y<hy-.001||f.y>p.depth-hy+.001)issues.push(`«${f.name}» sobresale de la vivienda`);
  }
  return issues;
}
