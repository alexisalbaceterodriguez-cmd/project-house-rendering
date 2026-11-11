import type { Furniture, Point, Project, Room } from '../types';
import { wallProjection } from './geometry';
import { roomArea, roomVertices } from './topology';
function corners(f:Furniture):Point[]{const a=f.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:f.x+x*f.w/2*c-y*f.d/2*s,y:f.y+x*f.w/2*s+y*f.d/2*c}));}
function overlaps(a:Point[],b:Point[]){for(const p of [a,b])for(let i=0;i<p.length;i++){const next=p[(i+1)%p.length],dx=next.x-p[i].x,dy=next.y-p[i].y;const project=(shape:Point[])=>shape.map(v=>v.x*-dy+v.y*dx);const x=project(a),y=project(b);if(Math.max(...x)<=Math.min(...y)+.001||Math.max(...y)<=Math.min(...x)+.001)return false;}return true;}
export function findFreePlacement(project:Project,w:number,d:number):Point{
  const candidates:Point[]=[];
  for(let x=w/2+.15;x<=project.width-w/2-.15;x+=.4)for(let y=d/2+.15;y<=project.depth-d/2-.15;y+=.4)candidates.push({x,y});
  candidates.sort((a,b)=>Math.hypot(a.x-project.width/2,a.y-project.depth/2)-Math.hypot(b.x-project.width/2,b.y-project.depth/2));
  const occupied=project.furniture.filter(f=>f.kind!=='rug').map(corners);
  const wallShapes=project.walls.map(wall=>{const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,len=Math.hypot(dx,dy),nx=-dy/len*(wall.thickness/2+.05),ny=dx/len*(wall.thickness/2+.05);return [{x:wall.a.x+nx,y:wall.a.y+ny},{x:wall.b.x+nx,y:wall.b.y+ny},{x:wall.b.x-nx,y:wall.b.y-ny},{x:wall.a.x-nx,y:wall.a.y-ny}];});
  return candidates.find(p=>{const shape=[{x:p.x-w/2,y:p.y-d/2},{x:p.x+w/2,y:p.y-d/2},{x:p.x+w/2,y:p.y+d/2},{x:p.x-w/2,y:p.y+d/2}];return ![...occupied,...wallShapes].some(other=>overlaps(shape,other));})??{x:project.width/2,y:project.depth/2};
}
export function furnitureCollisions(project:Project):string[]{
  const notices:string[]=[];const items=project.furniture.filter(f=>f.kind!=='rug'&&f.kind!=='lamp'&&!['wall'].includes(f.module?.family??''));
  for(let i=0;i<items.length;i++){
    const f=items[i],shape=corners(f);
    for(let j=i+1;j<items.length;j++)if(overlaps(shape,corners(items[j])))notices.push(`«${f.name}» se solapa con «${items[j].name}».`);
    for(const wall of project.walls){
      const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,len=Math.hypot(dx,dy),nx=-dy/len*wall.thickness/2,ny=dx/len*wall.thickness/2;
      const polygon=[{x:wall.a.x+nx,y:wall.a.y+ny},{x:wall.b.x+nx,y:wall.b.y+ny},{x:wall.b.x-nx,y:wall.b.y-ny},{x:wall.a.x-nx,y:wall.a.y-ny}];
      if(overlaps(shape,polygon)){const p=wallProjection(wall,{x:f.x,y:f.y});const atDoor=project.openings.some(o=>o.wallId===wall.id&&o.kind==='door'&&Math.abs(o.offset-p.offset)*len+Math.max(f.w,f.d)/2<o.width/2);if(!atDoor){notices.push(`«${f.name}» intersecta una pared.`);break;}}
    }
  }return notices;
}
/** Approximate wall-thickness deduction; deliberately labelled, not a surveyed net area. */
export function approximateNetArea(room:Room,project:Project):number{
  let deduction=0;
  for(const vertices of [roomVertices(room),...(room.holes??[])])for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const host=project.walls.find(w=>{const p=wallProjection(w,mid);return Math.hypot(p.point.x-mid.x,p.point.y-mid.y)<.001;});
    if(host)deduction+=Math.hypot(b.x-a.x,b.y-a.y)*host.thickness/2;
  }return Math.max(0,roomArea(room)-deduction);
}
