import type { Project,RoomKind,FloorFinish,FurnitureKind } from '../types';
import { wallLength } from './geometry';
const object=(a:unknown):a is Record<string,unknown>=>a!==null&&typeof a==='object'&&!Array.isArray(a);
const str=(s:unknown,n=180):s is string=>typeof s==='string'&&s.length>0&&s.length<=n;
const num=(n:unknown,min=-100,max=100)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const coord=(a:unknown)=>object(a)&&num(a.x,-100,200)&&num(a.y,-100,200);
const color=(a:unknown)=>typeof a==='string'&&/^#[0-9a-fA-F]{6}$/.test(a);
const material=(a:unknown)=>a===undefined||(typeof a==='string'&&a.length<=120);
const vector=(a:unknown)=>Array.isArray(a)&&a.length===3&&a.every(n=>num(n,-500,500));
const kinds:Set<RoomKind>=new Set(['living','bedroom','bathroom','hall']);
const finishes:Set<FloorFinish>=new Set(['oak','ash','walnut','stone','terrazzo','concrete']);
const furnitureKinds:Set<FurnitureKind>=new Set(['sofa','bed','single-bed','table','chair','wardrobe','desk','kitchen','island','sink','fridge','toilet','shower','plant','lamp','rug','model']);
const validModelFinish=(f:unknown)=>object(f)&&color(f.color)&&num(f.roughness,0,1)&&num(f.metalness,0,1)&&material(f.materialId)&&(f.materialName===undefined||(typeof f.materialName==='string'&&f.materialName.length<=120));
/** Strict structural validation; geometric feasibility is reported separately. */
export function isProject(a:unknown):a is Project{
  if(!object(a))return false;
  if(a.schemaRevision!==undefined&&a.schemaRevision!==1)return false;
  if(a.editor!==undefined){const s=a.editor;if(!object(s)||!num(s.grid,.01,1)||typeof s.magnet!=='boolean'||typeof s.orthogonal!=='boolean')return false;}
  if(a.render!==undefined){
    const r=a.render;
    if(!object(r)||!['day','night','studio'].includes(r.lighting as string)||!num(r.exposure,.2,3)||!['draft','high'].includes(r.quality as string)||(r.walk!==undefined&&typeof r.walk!=='boolean'))return false;
    if(r.camera!==undefined&&(!object(r.camera)||!vector(r.camera.position)||!vector(r.camera.target)))return false;
  }
  if(a.referenceImage!==undefined){const r=a.referenceImage;if(!object(r)||typeof r.data!=='string'||r.data.length>8*1024*1024||!/^data:image\/(png|jpeg|webp);base64,/.test(r.data)||!num(r.width,.1,200)||!num(r.height,.1,200)||!num(r.opacity,0,1))return false;}
  if(!object(a)||a.version!==1||!str(a.id)||!(typeof a.name==='string'&&a.name.length<=180)||!num(a.width,2,100)||!num(a.depth,2,100)||!num(a.wallHeight,1.8,6))return false;
  if(!Array.isArray(a.rooms)||a.rooms.length>200||!Array.isArray(a.walls)||a.walls.length>500||!Array.isArray(a.openings)||a.openings.length>500||!Array.isArray(a.furniture)||a.furniture.length>1000)return false;
  const palette=a.palette;
  if(!object(palette)||!['walls','accent','wood','textile','metal'].every(key=>color(palette[key])))return false;
  if(!a.rooms.every((r:unknown)=>object(r)&&str(r.id)&&typeof r.name==='string'&&r.name.length<=180&&kinds.has(r.kind as RoomKind)&&finishes.has(r.floor as FloorFinish)&&num(r.x,-100,200)&&num(r.y,-100,200)&&num(r.w,.01,200)&&num(r.d,.01,200)&&(r.vertices===undefined||(Array.isArray(r.vertices)&&r.vertices.length>=3&&r.vertices.length<=500&&r.vertices.every(coord)))&&(r.holes===undefined||(Array.isArray(r.holes)&&r.holes.length<=100&&r.holes.every((h:unknown)=>Array.isArray(h)&&h.length>=3&&h.length<=500&&h.every(coord))))))return false;
  if(!a.walls.every((w:unknown)=>object(w)&&str(w.id)&&coord(w.a)&&coord(w.b)&&num(w.thickness,.04,1)&&(w.outer===undefined||typeof w.outer==='boolean')))return false;
  if(!a.openings.every((o:unknown)=>object(o)&&str(o.id)&&str(o.wallId)&&['door','window'].includes(o.kind as string)&&num(o.offset,0,1)&&num(o.width,.1,8)&&num(o.height,.1,6)&&num(o.sill,0,6)))return false;
  if(!a.furniture.every((f:unknown)=>object(f)&&str(f.id)&&str(f.name,300)&&furnitureKinds.has(f.kind as FurnitureKind)&&num(f.x,-100,200)&&num(f.y,-100,200)&&num(f.w,.02,50)&&num(f.d,.02,50)&&num(f.h,.01,15)&&num(f.rotation,-3600,3600)&&color(f.color)&&(f.modelFinish===undefined||(f.kind==='model'&&validModelFinish(f.modelFinish)))&&(f.modelFinishes===undefined||(f.kind==='model'&&Array.isArray(f.modelFinishes)&&f.modelFinishes.length<=32&&f.modelFinishes.every(validModelFinish)))&&(f.productId===undefined||str(f.productId,180))&&(!f.assetId||str(f.assetId,150))&&(!f.modelData||(typeof f.modelData==='string'&&f.modelData.length<=18*1024*1024&&f.modelData.startsWith('data:')))))return false;
  if(a.resources!==undefined){
    if(!Array.isArray(a.resources)||a.resources.length>1000||!a.resources.every((r:unknown)=>object(r)&&str(r.id,150)&&typeof r.data==='string'&&r.data.startsWith('data:')&&r.data.length<=18*1024*1024&&(a.furniture as Project['furniture']).some(f=>f.kind==='model'&&f.assetId===r.id)))return false;
    if(new Set(a.resources.map((r:{id:string})=>r.id)).size!==a.resources.length)return false;
  }
  const walls=a.walls as Project['walls'];
  const wallIds=new Set(walls.map(w=>w.id));
  if(a.graph!==undefined){
    const g=a.graph;
    if(!object(g)||g.revision!==1||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.length>130000||g.edges.length>260000)return false;
    if(!g.nodes.every((n:unknown)=>object(n)&&str(n.id,180)&&coord(n)))return false;
    const nodeIds=new Set(g.nodes.map((n:{id:string})=>n.id));
    if(nodeIds.size!==g.nodes.length||!g.edges.every((e:unknown)=>object(e)&&str(e.wallId)&&wallIds.has(e.wallId as string)&&typeof e.from==='string'&&typeof e.to==='string'&&nodeIds.has(e.from)&&nodeIds.has(e.to)))return false;
  }
  for(const value of [...a.rooms,...a.walls,...a.furniture])if(!material(value.materialId))return false;
  for(const f of a.furniture){
    if(f.unitPrice!==undefined&&!num(f.unitPrice,0,1000000))return false;
    if(f.productSource!==undefined){const s=f.productSource;if(!object(s)||!['manufacturer','reference','source','license','attribution'].every(key=>typeof s[key]==='string'&&(s[key] as string).length<=2000))return false;}
    if(f.modelUpAxis!==undefined&&!['X','Y','Z'].includes(f.modelUpAxis as string))return false;
    if(f.modelElevation!==undefined&&!num(f.modelElevation,-3,6))return false;
    if(f.modelOffsetX!==undefined&&!num(f.modelOffsetX,-5,5))return false;
    if(f.modelOffsetZ!==undefined&&!num(f.modelOffsetZ,-5,5))return false;
    if(f.module!==undefined){const m=f.module;if(!object(m)||!['base','wall','column','sink','hob','oven','vanity'].includes(m.family as string)||!color(m.front)||!material(m.worktop)||!['bar','none'].includes(m.handles as string))return false;}
  }
  if(walls.some(w=>wallLength(w)<.1))return false;
  if((a.openings as Project['openings']).some(o=>!wallIds.has(o.wallId)))return false;
  for(const values of [a.rooms,a.walls,a.openings,a.furniture]){
    const ids=values.map(v=>(v as {id:string}).id);if(new Set(ids).size!==ids.length)return false;
  }
  return true;
}
