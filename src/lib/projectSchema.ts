import type { Project, WallGraph } from '../types';
import { isProject } from './validation';

/** Derived, serialized planar graph. Wall IDs remain the source of architectural geometry. */
export function buildWallGraph(project: Project): WallGraph {
  const points = new Map<string, {id:string;x:number;y:number}>();
  const previous=new Map((project.graph?.nodes??[]).map(node=>[`${node.x.toFixed(4)},${node.y.toFixed(4)}`,node.id]));
  const usedIds=new Set<string>();
  const node = (x:number,y:number,preferred?:string) => {
    const key = `${x.toFixed(4)},${y.toFixed(4)}`;
    if (!points.has(key)) {let id=previous.get(key)??preferred??`node:${key}`,suffix=1;while(usedIds.has(id))id=`node:${key}:${suffix++}`;usedIds.add(id);points.set(key, {id,x,y});}
    return points.get(key)!;
  };
  const edges: WallGraph['edges'] = [];
  for (const wall of project.walls) {
    const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,length2=dx*dx+dy*dy;
    const cuts=[0,1];
    for (const other of project.walls) {
      if(other.id===wall.id)continue;
      const sx=other.b.x-other.a.x,sy=other.b.y-other.a.y,den=dx*sy-dy*sx;
      const qx=other.a.x-wall.a.x,qy=other.a.y-wall.a.y;
      if(Math.abs(den)>1e-9){
        const t=(qx*sy-qy*sx)/den,u=(qx*dy-qy*dx)/den;
        if(t>1e-6&&t<1-1e-6&&u>=-1e-6&&u<=1+1e-6)cuts.push(t);
      }else for(const p of [other.a,other.b]){
        const t=((p.x-wall.a.x)*dx+(p.y-wall.a.y)*dy)/length2;
        if(t>0&&t<1&&Math.hypot(wall.a.x+t*dx-p.x,wall.a.y+t*dy-p.y)<.0001)cuts.push(t);
      }
    }
    const sorted=[...new Set(cuts.map(t=>Number(t.toFixed(7))))].sort((a,b)=>a-b);
    const oldEdges=project.graph?.edges.filter(edge=>edge.wallId===wall.id)??[];
    for(let i=1;i<sorted.length;i++)edges.push({wallId:wall.id,
      from:node(wall.a.x+dx*sorted[i-1],wall.a.y+dy*sorted[i-1],i===1?oldEdges[0]?.from:undefined).id,
      to:node(wall.a.x+dx*sorted[i],wall.a.y+dy*sorted[i],i===sorted.length-1?oldEdges.at(-1)?.to:undefined).id});
  }
  return {revision:1,nodes:[...points.values()],edges};
}

/** Additive migration: original v1 JSON stays accepted and all design metadata is retained. */
export function migrateProject(input: unknown): Project {
  if(!isProject(input))throw new Error('El archivo no contiene un proyecto compatible.');
  const project=structuredClone(input);
  project.schemaRevision=1;
  project.graph=buildWallGraph(project);
  return project;
}
