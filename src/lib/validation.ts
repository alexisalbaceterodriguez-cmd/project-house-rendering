import type { Project,RoomKind,FloorFinish,FurnitureKind } from '../types';
import { wallLength } from './geometry';
const object=(a:unknown):a is Record<string,unknown>=>a!==null&&typeof a==='object'&&!Array.isArray(a);
const str=(s:unknown,n=180):s is string=>typeof s==='string'&&s.length>0&&s.length<=n;
const num=(n:unknown,min=-100,max=100)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const coord=(a:unknown)=>object(a)&&num(a.x,-100,200)&&num(a.y,-100,200);
const color=(a:unknown)=>typeof a==='string'&&/^#[0-9a-fA-F]{6}$/.test(a);
const kinds:Set<RoomKind>=new Set(['living','bedroom','bathroom','hall']);
const finishes:Set<FloorFinish>=new Set(['oak','ash','walnut','stone','terrazzo','concrete']);
const furnitureKinds:Set<FurnitureKind>=new Set(['sofa','bed','single-bed','table','chair','wardrobe','desk','kitchen','island','sink','fridge','toilet','shower','plant','lamp','rug','model']);
/** Strict structural validation; geometric feasibility is reported separately. */
export function isProject(a:unknown):a is Project{
  if(!object(a)||a.version!==1||!str(a.id)||!(typeof a.name==='string'&&a.name.length<=180)||!num(a.width,2,100)||!num(a.depth,2,100)||!num(a.wallHeight,1.8,6))return false;
  if(!Array.isArray(a.rooms)||a.rooms.length>200||!Array.isArray(a.walls)||a.walls.length>500||!Array.isArray(a.openings)||a.openings.length>500||!Array.isArray(a.furniture)||a.furniture.length>1000)return false;
  const palette=a.palette;
  if(!object(palette)||!['walls','accent','wood','textile','metal'].every(key=>color(palette[key])))return false;
  if(!a.rooms.every((r:unknown)=>object(r)&&str(r.id)&&typeof r.name==='string'&&r.name.length<=180&&kinds.has(r.kind as RoomKind)&&finishes.has(r.floor as FloorFinish)&&num(r.x,-100,200)&&num(r.y,-100,200)&&num(r.w,.01,200)&&num(r.d,.01,200)&&(r.vertices===undefined||(Array.isArray(r.vertices)&&r.vertices.length>=3&&r.vertices.length<=500&&r.vertices.every(coord)))&&(r.holes===undefined||(Array.isArray(r.holes)&&r.holes.length<=100&&r.holes.every((h:unknown)=>Array.isArray(h)&&h.length>=3&&h.length<=500&&h.every(coord))))))return false;
  if(!a.walls.every((w:unknown)=>object(w)&&str(w.id)&&coord(w.a)&&coord(w.b)&&num(w.thickness,.04,1)&&(w.outer===undefined||typeof w.outer==='boolean')))return false;
  if(!a.openings.every((o:unknown)=>object(o)&&str(o.id)&&str(o.wallId)&&['door','window'].includes(o.kind as string)&&num(o.offset,0,1)&&num(o.width,.1,8)&&num(o.height,.1,6)&&num(o.sill,0,6)))return false;
  if(!a.furniture.every((f:unknown)=>object(f)&&str(f.id)&&str(f.name,300)&&furnitureKinds.has(f.kind as FurnitureKind)&&num(f.x,-100,200)&&num(f.y,-100,200)&&num(f.w,.02,50)&&num(f.d,.02,50)&&num(f.h,.01,15)&&num(f.rotation,-3600,3600)&&color(f.color)&&(f.modelFinish===undefined||(f.kind==='model'&&object(f.modelFinish)&&color(f.modelFinish.color)&&num(f.modelFinish.roughness,0,1)&&num(f.modelFinish.metalness,0,1)&&(f.modelFinish.materialName===undefined||(typeof f.modelFinish.materialName==='string'&&f.modelFinish.materialName.length<=120))))&&(f.productId===undefined||str(f.productId,180))&&(!f.assetId||str(f.assetId,150))&&(!f.modelData||(typeof f.modelData==='string'&&f.modelData.length<=18*1024*1024&&f.modelData.startsWith('data:')))))return false;
  const walls=a.walls as Project['walls'];
  if(walls.some(w=>wallLength(w)<.1))return false;
  if((a.openings as Project['openings']).some(o=>!walls.some(w=>w.id===o.wallId)))return false;
  for(const values of [a.rooms,a.walls,a.openings,a.furniture]){
    const ids=values.map(v=>(v as {id:string}).id);if(new Set(ids).size!==ids.length)return false;
  }
  return true;
}
