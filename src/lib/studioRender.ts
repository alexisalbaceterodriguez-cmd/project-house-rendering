import type { CustomMaterial, Furniture, Point, Project, StudioSettings, Wall } from '../types';

export const defaultStudio:StudioSettings={key:3,fill:1,rim:2,azimuth:-40,warmth:'neutral',background:'#e8e4de'};
export const lightPresets=[
  {name:'Catálogo',settings:{key:3.2,fill:1.6,rim:1.2,azimuth:-35,warmth:'neutral',background:'#eae7df'}},
  {name:'Luz de tarde',settings:{key:3.7,fill:.55,rim:.8,azimuth:65,warmth:'warm',background:'#ddc9b2'}},
  {name:'Luz fría',settings:{key:2.6,fill:.85,rim:2.4,azimuth:-115,warmth:'cool',background:'#bfcbd1'}},
] as const;
export const finishPresets = {
  standard:{roughness:.65,metalness:0}, glass:{roughness:.08,metalness:0},
  varnish:{roughness:.3,metalness:0}, fabric:{roughness:.9,metalness:0},
} as const;

/** Explicit zeros reset physical extensions inherited from an imported GLB. */
export function physicalProperties(material:Pick<CustomMaterial,'finish'|'color'>,high:boolean) {
  return {
    transmission:high&&material.finish==='glass'?.96:0,
    // Metres: thin furniture glazing, rather than a 12 cm solid block.
    thickness:material.finish==='glass'?.01:0,ior:1.5,
    clearcoat:high&&material.finish==='varnish'?1:0,clearcoatRoughness:.28,
    sheen:high&&material.finish==='fabric'?.65:0,sheenRoughness:.9,
    opacity:!high&&material.finish==='glass'?.35:1,
    transparent:!high&&material.finish==='glass',
    depthWrite:high||material.finish!=='glass',
  };
}

export function studioSubject(project:Project):Furniture|undefined {
  return project.render?.lighting==='studio'?project.furniture.find(item=>item.id===project.render?.studio?.subjectId):undefined;
}

const pointSegmentDistance=(p:Point,a:Point,b:Point)=>{
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};

/**
 * Horizontal distance the camera can travel from `from` along `dir` before it would enter a wall.
 * Approaching a wall that already sits close to the object (a sofa against the wall) is allowed
 * as long as the camera does not get nearer to it than the object itself.
 */
function clearRun(walls:Wall[],from:Point,dir:Point,max:number) {
  const step=.05;
  for(let run=step;run<=max+1e-9;run+=step){
    const p={x:from.x+dir.x*run,y:from.y+dir.y*run};
    for(const wall of walls){
      const clearance=wall.thickness/2+.2,d=pointSegmentDistance(p,wall.a,wall.b);
      if(d<clearance&&d<pointSegmentDistance(from,wall.a,wall.b)-1e-6)return Math.max(0,run-step);
    }
  }
  return max;
}

/**
 * Close-up camera for one object. With the project, the camera looks at the object from the first
 * direction (starting at the usual front-right diagonal) whose line of sight is free of walls, and
 * stays below the ceiling; when every direction is blocked it moves closer, in front of the wall.
 */
export function objectCamera(item:Furniture,project?:Pick<Project,'walls'|'wallHeight'>) {
  const distance=Math.max(2.2,Math.max(item.w,item.d,item.h)*2);
  const angle=-item.rotation*Math.PI/180,offsetX=item.modelOffsetX??0,offsetZ=item.modelOffsetZ??0;
  const target:[number,number,number]=[item.x+offsetX*Math.cos(angle)+offsetZ*Math.sin(angle),item.h*.45+(item.modelElevation??0),item.y-offsetX*Math.sin(angle)+offsetZ*Math.cos(angle)];
  const fallback:[number,number,number]=[target[0]+distance*.65,target[1]+distance*.45,target[2]+distance*.75];
  if(!project?.walls.length)return {position:fallback,target};
  const horizontal=distance*Math.hypot(.65,.75),rise=.45/Math.hypot(.65,.75),base=Math.atan2(.75,.65);
  const from={x:target[0],y:target[2]};
  let best={run:-1,dir:{x:Math.cos(base),y:Math.sin(base)}};
  for(let i=0;i<16;i++){
    const turn=Math.ceil(i/2)*(i%2?1:-1)*Math.PI/8,dir={x:Math.cos(base+turn),y:Math.sin(base+turn)};
    const run=clearRun(project.walls,from,dir,horizontal);
    if(run>best.run+1e-6)best={run,dir};
    if(run>=horizontal)break;
  }
  const run=Math.max(best.run,.3);
  const height=Math.min(target[1]+run*rise,Math.max(target[1]+.2,project.wallHeight-.15));
  return {position:[from.x+best.dir.x*run,height,from.y+best.dir.y*run] as [number,number,number],target};
}
