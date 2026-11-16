import type { CustomMaterial, Furniture, Project, StudioSettings } from '../types';

export const defaultStudio:StudioSettings={key:3,fill:1,rim:2,azimuth:-40,warmth:'neutral',background:'#e8e4de'};
export const finishPresets = {
  standard:{roughness:.65,metalness:0}, glass:{roughness:.08,metalness:0},
  varnish:{roughness:.3,metalness:0}, fabric:{roughness:.9,metalness:0},
} as const;

/** Explicit zeros reset physical extensions inherited from an imported GLB. */
export function physicalProperties(material:Pick<CustomMaterial,'finish'|'color'>,high:boolean) {
  return {
    transmission:high&&material.finish==='glass'?.96:0,
    thickness:material.finish==='glass'?.12:0,ior:1.5,
    clearcoat:high&&material.finish==='varnish'?1:0,clearcoatRoughness:.18,
    sheen:high&&material.finish==='fabric'?1:0,sheenRoughness:.8,
    opacity:!high&&material.finish==='glass'?.35:1,
    transparent:!high&&material.finish==='glass',
    depthWrite:high||material.finish!=='glass',
  };
}

export function studioSubject(project:Project):Furniture|undefined {
  return project.render?.lighting==='studio'?project.furniture.find(item=>item.id===project.render?.studio?.subjectId):undefined;
}

export function objectCamera(item:Furniture) {
  const distance=Math.max(2.2,Math.max(item.w,item.d,item.h)*2);
  const angle=-item.rotation*Math.PI/180,offsetX=item.modelOffsetX??0,offsetZ=item.modelOffsetZ??0;
  const target:[number,number,number]=[item.x+offsetX*Math.cos(angle)+offsetZ*Math.sin(angle),item.h*.45+(item.modelElevation??0),item.y-offsetX*Math.sin(angle)+offsetZ*Math.cos(angle)];
  return {position:[target[0]+distance*.65,target[1]+distance*.45,target[2]+distance*.75] as [number,number,number],target};
}
