import type { Point, Project } from '../types';
import { roomVertices } from './topology';
import { candleFlames, furnitureElevation, pendantShadeHeight, placedElevation, tableLampShadeHeight } from './furnitureParts';

/**
 * Render package (`atelier-render-package` v1): the contract between the editor and
 * the Blender/Cycles engine in `render-engine/`. A zip with
 *   scene.json  – manifest: units, axes, camera, lighting, render settings, ids, licences
 *   scene.glb   – geometry and materials exported from the live three.js scene, with
 *                 every texture embedded (IndexedDB assets are not reachable by a server)
 *   preview.png – the WebGL image with the same camera, for A/B comparison
 * Coordinates are three.js world space: metres, Y up, right-handed. Plan (x, y) maps
 * to three (x, z). Room polygons stay in plan coordinates.
 */
export const RENDER_PACKAGE_FORMAT='atelier-render-package';
export const RENDER_PACKAGE_VERSION=1;
export type CyclesPreset='afternoon'|'day'|'night'|'studio';
export type CyclesQuality='draft'|'standard'|'high';
export type RenderPass='beauty'|'depth'|'normal'|'object_id'|'material_id'|'albedo';
export type Vec3=[number,number,number];
export type PackageCamera={position:Vec3;target:Vec3;fovY:number};
export type PackageOptions={preset:CyclesPreset;quality:CyclesQuality;width:number;height:number;verticals?:boolean;passes?:RenderPass[];exposure?:number};
export const QUALITY_SAMPLES:Record<CyclesQuality,number>={draft:64,standard:256,high:1024};
export const presetLabels:Record<CyclesPreset,string>={afternoon:'Tarde cálida',day:'Día luminoso',night:'Noche con lámparas',studio:'Estudio HDRI'};

type SunPreset={elevation:number;azimuthOffset:number;strength:number;temperature:number;sky:number;angle:number;windowPull:number};
const SUN:Record<'afternoon'|'day',SunPreset>={
  // Low, warm sun raking through the main window: long soft shadows.
  afternoon:{elevation:18,azimuthOffset:35,strength:4.5,temperature:4700,sky:.6,angle:2,windowPull:1.5},
  day:{elevation:48,azimuthOffset:20,strength:4,temperature:5600,sky:.5,angle:1.2,windowPull:1.5},
};

const round=(n:number,digits=4)=>Number(n.toFixed(digits));
const vec=(v:readonly number[]):Vec3=>[round(v[0]),round(v[1]),round(v[2])];

export function pointInPolygon(p:Point,polygon:Point[]):boolean{
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

/** Window closest to the camera target, with its outward (towards the exterior) plan normal. */
export function mainWindow(project:Project,target:Point):{id:string;center:Point;outward:Point}|undefined{
  const polygons=project.rooms.map(roomVertices);
  const inside=(p:Point)=>polygons.some(polygon=>pointInPolygon(p,polygon));
  const middle={x:project.width/2,y:project.depth/2};
  const candidates=project.openings.filter(o=>o.kind==='window').flatMap(o=>{
    const wall=project.walls.find(w=>w.id===o.wallId);if(!wall)return [];
    const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,length=Math.hypot(dx,dy);if(length<1e-6)return [];
    const center={x:wall.a.x+dx*o.offset,y:wall.a.y+dy*o.offset};
    let normal={x:-dy/length,y:dx/length};
    const probe=(sign:number)=>inside({x:center.x+normal.x*sign*.4,y:center.y+normal.y*sign*.4});
    const front=probe(1),back=probe(-1);
    // Outward = the side that is not inside a room; fall back to "away from the plan centre".
    if((front&&!back)||(front===back&&(center.x-middle.x)*normal.x+(center.y-middle.y)*normal.y<0))normal={x:-normal.x,y:-normal.y};
    return [{id:o.id,center,outward:normal,distance:Math.hypot(center.x-target.x,center.y-target.y)}];
  });
  candidates.sort((a,b)=>a.distance-b.distance);
  const best=candidates[0];
  return best&&{id:best.id,center:best.center,outward:best.outward};
}

/** Direction towards the sun (three space) so that it shines in through the main window. */
export function sunDirection(project:Project,target:Point,preset:SunPreset):Vec3{
  const window=mainWindow(project,target);
  const outward=window?.outward??{x:.45,y:-.89};
  const angle=preset.azimuthOffset*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const n={x:outward.x*cos-outward.y*sin,y:outward.x*sin+outward.y*cos};
  const el=preset.elevation*Math.PI/180;
  return vec([n.x*Math.cos(el),Math.sin(el),n.y*Math.cos(el)]);
}

/**
 * Rooms with no window of their own (bathrooms, halls): no window opening has a point just
 * inside the room on either side of its wall. Daylight presets switch their ceiling light on,
 * with a power proportional to the floor area, so they do not render black.
 */
export const LIT_ROOM_WATTS_PER_M2=4;
export function windowlessRooms(project:Project){
  const probes=project.openings.filter(o=>o.kind==='window').flatMap(o=>{
    const wall=project.walls.find(w=>w.id===o.wallId);if(!wall)return [];
    const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,length=Math.hypot(dx,dy);if(length<1e-6)return [];
    const center={x:wall.a.x+dx*o.offset,y:wall.a.y+dy*o.offset},n={x:-dy/length,y:dx/length},step=wall.thickness/2+.1;
    return [{x:center.x+n.x*step,y:center.y+n.y*step},{x:center.x-n.x*step,y:center.y-n.y*step}];
  });
  return project.rooms.flatMap(room=>{
    const polygon=roomVertices(room);if(probes.some(p=>pointInPolygon(p,polygon)))return [];
    const area=Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
    return [{id:room.id,power:Math.round(LIT_ROOM_WATTS_PER_M2*area)}];
  });
}

/** Most interior point lights the engine contract accepts (MAX_INTERIOR_LIGHTS in contract.py). */
export const MAX_INTERIOR_LIGHTS=64;
/** Every night light the project's furniture asks for, strongest first, before the contract's cap. */
export function interiorLights(project:Project){
  // Floor lamps light from under the shade's top; pendants from inside their bell (furnitureElevation);
  // table lamps from inside their shade, on top of the furniture they stand on (placedElevation);
  // every candle from its own flame, a small warm source (about 1900 K) rotated with the tray.
  const lampY=(f:Project['furniture'][number])=>f.kind==='pendant'?furnitureElevation(f,project.wallHeight)+pendantShadeHeight(f.w,f.h)*.35
    :f.kind==='table-lamp'?placedElevation(f,project.furniture,project.wallHeight)+f.h-tableLampShadeHeight(f.h)*.55:Math.max(.3,f.h-.15);
  const SOURCES:Record<string,{power:number;temperature:number;radius:number}>={lamp:{power:60,temperature:2700,radius:.06},pendant:{power:60,temperature:2700,radius:.06},'table-lamp':{power:35,temperature:2700,radius:.04}};
  const flame={power:1.5,temperature:1900,radius:.006};
  return project.furniture.flatMap(f=>{
    if(f.kind==='candles'){
      // Scene3D turns the item by -rotation about +y: local (x,z) → world (x·cos−z·sin, x·sin+z·cos).
      const a=f.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),y0=placedElevation(f,project.furniture,project.wallHeight);
      return candleFlames(f.w,f.d,f.h).map(([x,y,z],i)=>({id:`${f.id}:llama-${i+1}`,position:vec([f.x+x*c-z*s,y0+y,f.y+x*s+z*c]),...flame}));
    }
    return f.kind in SOURCES?[{id:f.id,position:vec([f.x,lampY(f),f.y]),...SOURCES[f.kind]}]:[];
  }).sort((a,b)=>b.power-a.power);
}

export function buildLighting(project:Project,camera:PackageCamera,preset:CyclesPreset,exposure=0){
  const target={x:camera.target[0],y:camera.target[2]};
  // Past the cap the weakest sources (candle flames before lamps) are left out; the Cycles panel says so.
  const lamps=interiorLights(project).slice(0,MAX_INTERIOR_LIGHTS);
  if(preset==='studio')return {preset,exposure,sun:{direction:[.3,.8,.5] as Vec3,strength:0,angle:1.5,temperature:5600},sky:{strength:1},hdri:'studio',ceiling:'off',roomLights:false,litRooms:[] as {id:string;power:number}[],interior:[]};
  if(preset==='night'){
    const direction=sunDirection(project,target,{...SUN.day,elevation:10});
    return {preset,exposure,sun:{direction,strength:0,angle:1.5,temperature:4000},sky:{strength:.02},hdri:null,ceiling:'auto',roomLights:true,litRooms:[] as {id:string;power:number}[],interior:lamps};
  }
  const sun=SUN[preset];
  // windowPull (EV): the engine darkens only the sky seen through the glazing, not the light it casts.
  return {preset,exposure,windowPull:sun.windowPull,sun:{direction:sunDirection(project,target,sun),strength:sun.strength,angle:sun.angle,temperature:sun.temperature},sky:{strength:sun.sky},hdri:null,ceiling:'auto',roomLights:false,litRooms:windowlessRooms(project),interior:[]};
}

export function buildManifest(project:Project,camera:PackageCamera,options:PackageOptions,geometry:{sha256:string;bytes:number},contentHash:string,createdAt=new Date().toISOString()){
  const passes=[...new Set<RenderPass>(['beauty',...(options.passes??[])])].sort();
  return {
    format:RENDER_PACKAGE_FORMAT,schemaVersion:RENDER_PACKAGE_VERSION,
    generator:{app:'atelier-60',version:'1'},createdAt,
    units:'m',upAxis:'Y',handedness:'right',
    coordinates:'three.js world: metres, +Y up, right-handed; plan (x, y) -> (x, z). rooms[].polygon uses plan coordinates.',
    project:{id:project.id,name:project.name.slice(0,200)||'Proyecto',contentHash,wallHeight:project.wallHeight,width:project.width,depth:project.depth},
    geometry:{file:'scene.glb',sha256:geometry.sha256,bytes:geometry.bytes},
    rooms:project.rooms.map(room=>({id:room.id,name:room.name.slice(0,200),kind:room.kind,polygon:roomVertices(room).map(p=>[round(p.x),round(p.y)])})),
    objects:[
      ...project.walls.map(w=>({id:w.id,type:'wall'})),
      ...project.openings.map(o=>({id:o.id,type:'opening',kind:o.kind})),
      ...project.rooms.map(r=>({id:r.id,type:'room',kind:r.kind,name:r.name.slice(0,200)})),
      ...project.furniture.map(f=>({id:f.id,type:'furniture',kind:f.kind,name:f.name.slice(0,200)})),
    ],
    camera:{position:vec(camera.position),target:vec(camera.target),fovY:round(camera.fovY,3),near:.05,far:1000,verticals:!!options.verticals},
    lighting:buildLighting(project,camera,options.preset,options.exposure??0),
    render:{engine:'cycles',width:options.width,height:options.height,samples:QUALITY_SAMPLES[options.quality],quality:options.quality,denoise:true,passes},
    assets:project.furniture.filter(f=>f.productSource||f.assetId).map(f=>({id:f.id,name:f.name.slice(0,200),kind:f.productSource?.reference??f.kind,source:f.productSource?.source??'Importación local del usuario',license:f.productSource?.license??'Sin licencia declarada',attribution:f.productSource?.attribution??''})),
    materials:(project.materials??[]).map(m=>({id:m.id,name:m.name,kind:m.category,source:m.source,license:m.license,attribution:''})),
  };
}
export type RenderManifest=ReturnType<typeof buildManifest>;

export async function sha256Hex(data:ArrayBuffer|Uint8Array|string):Promise<string>{
  const bytes=typeof data==='string'?new TextEncoder().encode(data):data instanceof Uint8Array?data:new Uint8Array(data);
  const digest=await crypto.subtle.digest('SHA-256',bytes as BufferSource);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

/** Hash of the editable project, without portable resources (they are already in the GLB). */
export function projectContentHash(project:Project){
  const {resources:_resources,...rest}=project;
  return sha256Hex(JSON.stringify(rest));
}

let crcTable:Uint32Array|undefined;
export function crc32(bytes:Uint8Array):number{
  if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}}
  let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

/** Minimal deterministic zip writer (stored, no compression; GLB and PNG are already compact). */
export function storedZip(files:{name:string;data:Uint8Array}[]):Uint8Array{
  const encoder=new TextEncoder(),local:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
  const DOS_DATE=(0<<9)|(1<<5)|1;// 1980-01-01, fixed for reproducible packages
  for(const file of files){
    const name=encoder.encode(file.name),crc=crc32(file.data),size=file.data.length;
    if(size>=0xffffffff)throw new Error('El paquete de render supera el tamaño admitido.');
    const header=new DataView(new ArrayBuffer(30));
    header.setUint32(0,0x04034b50,true);header.setUint16(4,20,true);header.setUint16(6,0x0800,true);header.setUint16(8,0,true);
    header.setUint16(10,0,true);header.setUint16(12,DOS_DATE,true);header.setUint32(14,crc,true);header.setUint32(18,size,true);header.setUint32(22,size,true);
    header.setUint16(26,name.length,true);header.setUint16(28,0,true);
    local.push(new Uint8Array(header.buffer),name,file.data);
    const entry=new DataView(new ArrayBuffer(46));
    entry.setUint32(0,0x02014b50,true);entry.setUint16(4,20,true);entry.setUint16(6,20,true);entry.setUint16(8,0x0800,true);entry.setUint16(10,0,true);
    entry.setUint16(12,0,true);entry.setUint16(14,DOS_DATE,true);entry.setUint32(16,crc,true);entry.setUint32(20,size,true);entry.setUint32(24,size,true);
    entry.setUint16(28,name.length,true);entry.setUint32(42,offset,true);
    central.push(new Uint8Array(entry.buffer),name);
    offset+=30+name.length+size;
  }
  const centralSize=central.reduce((n,part)=>n+part.length,0);
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,centralSize,true);end.setUint32(16,offset,true);
  const parts=[...local,...central,new Uint8Array(end.buffer)],out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
  let at=0;for(const part of parts){out.set(part,at);at+=part.length;}
  return out;
}

export type RenderPackage={zip:Blob;manifest:RenderManifest;preview:Blob;idempotencyKey:string;glbBytes:number};

/** Stable key for "same scene, same camera, same settings": lets the engine reuse a finished render. */
export async function packageKey(manifest:RenderManifest){
  const {createdAt:_createdAt,...stable}=manifest;
  return sha256Hex(JSON.stringify(stable));
}

export async function assemblePackage(project:Project,camera:PackageCamera,options:PackageOptions,glb:ArrayBuffer,preview:Blob):Promise<RenderPackage>{
  const glbBytes=new Uint8Array(glb);
  const manifest=buildManifest(project,camera,options,{sha256:await sha256Hex(glbBytes),bytes:glbBytes.length},await projectContentHash(project));
  const json=new TextEncoder().encode(JSON.stringify(manifest,null,2));
  const zip=storedZip([{name:'scene.json',data:json},{name:'scene.glb',data:glbBytes},{name:'preview.png',data:new Uint8Array(await preview.arrayBuffer())}]);
  return {zip:new Blob([zip as BlobPart],{type:'application/zip'}),manifest,preview,idempotencyKey:await packageKey(manifest),glbBytes:glbBytes.length};
}
