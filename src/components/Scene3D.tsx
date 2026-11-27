import { createContext, memo, Suspense, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { ContactShadows, Environment, Html, OrbitControls, PointerLockControls, SoftShadows, useEnvironment, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { floors } from '../data/catalog';
import { clamp, wallLength, wallParts, wallProjection } from '../lib/geometry';
import { roomArea,roomLabelPoint,roomVertices } from '../lib/topology';
import { getModelAsset } from '../lib/assets';
import { useEditor, useEditorPick } from '../store';
import type { Furniture, Opening, Project, Wall } from '../types';
import ErrorBoundary from './ErrorBoundary';
import PbrSurface, { usePbrMaps } from './PbrSurface';
import { registerCapture, registerSceneSource } from '../lib/sceneCapture';
import { defaultStudio, objectCamera, physicalProperties, studioSubject } from '../lib/studioRender';
import { textureMapsPending, useTextureLibraryRevision } from '../lib/textureCache';
import { heightToNormal, onSurfaceTexturesLoaded, surfaceMaps, type SurfaceKind } from '../lib/surfaceTextures';
import { latheGeometry, physicalBox, type Crown, type Profile } from '../lib/boxGeometry';
import { arcLampParts, arcLampBulb, leaningArtParts, blanketLadderParts, foldingScreenParts, wallCoatRackParts, barCartParts, officeChairParts, floorMirrorParts, recordConsoleParts, rotateEuler, bedParts, chairParts, bookshelfParts, deskParts, fridgeParts, islandParts, kitchenParts, lampParts, moduleHangHeight, moduleParts, armchairParts, sideboardParts, coffeeTableParts, tvUnitParts, tvParts, pendantParts, pendantShadeHeight, mirrorParts, artworkParts, furnitureElevation, benchParts, sideTableParts, coatRackParts, bathtubParts, dresserParts, shoeCabinetParts, wallShelfParts, towelRailParts, radiatorParts, washerParts, cribParts, barStoolParts, tableLampParts, tableLampShadeHeight, vaseParts, bookStackParts, placedElevation, cornerSofaParts, cornerSofaLeftParts, fruitBowlParts, tableClockParts, decorBowlParts, shelfBasketParts, throwPillowParts, foldedBlanketParts, bathTrayParts, cuttingBoardParts, kettleParts, utensilJarParts, umbrellaStandParts, doormatParts, soapDispenserParts, toothbrushCupParts, bathMatParts, towelStackParts, deskLampParts, laptopParts, wastebasketParts, deskOrganizerParts, blanketBasketParts, clothesRailParts, floorVaseParts, decorTrayParts, floorCushionParts, nestingTablesParts, tableSettingParts, wineSetParts, coffeeMachineParts, dishRackParts, herbPotsParts, FLOOR_COVER_KINDS, candleParts, candleFlames, photoFrameParts, sheerCurtainParts, poufParts, consoleTableParts, curtainParts, extendingTableParts, deskHutchParts, bunkBedParts, laundryBasketParts, floatingNightstandParts, nightstandParts, plantPotParts, plantSoilHeight, showerParts, sinkParts, sofaParts, tableParts, toiletParts, wardrobeParts, type FurniturePart } from '../lib/furnitureParts';
import { plantGeometry, seedFrom } from '../lib/plantGeometry';
const SurfaceContext=createContext<string|undefined>(undefined);
/** Redraw the on-demand canvas when scanned surface maps replace their procedural fallback. */
function SurfaceRefresh(){const invalidate=useThree(state=>state.invalidate);useEffect(()=>onSurfaceTexturesLoaded(invalidate),[invalidate]);return null;}
function textureProps(kind:SurfaceKind){const {map,normalMap,roughnessMap,metalnessMap}=surfaceMaps(kind);return {map,normalMap,roughnessMap,metalnessMap};}

// `role` names the material (atelier:<role>) so the Cycles engine can recognise
// window glass or door leaves after the scene is exported to glTF.
// `surface` adds metre-scaled image maps (textile weave, wood grain) that also travel in the render GLB.
// `bevel` rounds edges inside the same outer size (see EDGE_RADIUS); `crown` domes a cushion face. The GLB carries the same mesh.
// At night a lit shade glows warm (≈2700 K), as Cycles makes it emissive (make_glowing_shade).
const SHADE_GLOW={emissive:'#ffc98a',emissiveIntensity:1.4} as const;
const FLAME_GLOW='#ffb04a';
type Look={color:string;material?:'matte'|'glass'|'metal'|'mirror'|'gloss';opacity?:number;finishId?:string;role?:string;surface?:Extract<SurfaceKind,'textile'|'woodgrain'>};
type Shape={size:readonly [number,number,number];bevel?:number;crown?:Crown;lathe?:Profile;axis?:'z';rotation?:readonly [number,number,number]};
/** The part's solid centred on the origin, turned about its own centre when it has a rotation. */
const shapeGeometry=({size,bevel=0,crown,lathe,axis,rotation}:Shape)=>{
  const geometry=lathe?latheGeometry(lathe,size,undefined,axis):physicalBox(size,bevel,crown);
  if(rotation)geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
  return geometry;
};
/** One mesh with the material a part look describes; `thickness` is the glass slab depth. */
function LookMesh({geometry,position,thickness,look:{color,material='matte',opacity=1,finishId,role,surface}}:{geometry:THREE.BufferGeometry;position?:[number,number,number];thickness:number;look:Look}){
  const inherited=useContext(SurfaceContext);const id=finishId??inherited;
  const high=useEditor(state=>state.project.render?.quality==='high');
  const night=useEditor(state=>state.project.render?.lighting==='night');
  if(role==='flame')return <mesh position={position}><primitive object={geometry} attach="geometry"/><meshStandardMaterial name="atelier:flame" color={color} emissive={FLAME_GLOW} emissiveIntensity={1.6} roughness={1}/></mesh>;
  return <mesh castShadow={material!=='glass'&&role!=='sheer'} receiveShadow position={position}>
    <primitive object={geometry} attach="geometry"/>{id&&material==='matte'&&opacity===1?<Suspense fallback={<meshStandardMaterial color={color}/>}><PbrSurface id={id} color={color}/></Suspense>:material==='glass'?<meshPhysicalMaterial name="atelier:glass" color={color} roughness={.08} {...physicalProperties({finish:'glass',color},high)} thickness={thickness}/>:surface&&material==='matte'&&opacity===1?<meshStandardMaterial name={`atelier:${surface}`} color={color} roughness={1} metalness={0} {...textureProps(surface)}/>:material==='mirror'||material==='gloss'?<meshStandardMaterial name={role?`atelier:${role}`:undefined} color={color} roughness={material==='mirror'?.02:.06} metalness={material==='mirror'?1:0} envMapIntensity={material==='mirror'?1.6:1.2}/>:<meshStandardMaterial name={role?`atelier:${role}`:undefined} color={color} roughness={material==='metal'?.28:.8} metalness={material==='metal'?.7:0} envMapIntensity={material==='metal'?2.2:1} transparent={opacity<1} opacity={opacity} depthWrite={opacity>=1} {...(night&&role==='lampshade'?SHADE_GLOW:{})}/>}
  </mesh>;
}
// Part builders return fresh arrays on every call: compare tuples and profiles by value.
const sameProps=(a:object,b:object)=>{
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
  for(const k of Object.keys({...x,...y})){
    const p=x[k],q=y[k];if(p===q)continue;
    if(typeof p!=='object'||typeof q!=='object'||p===null||q===null||JSON.stringify(p)!==JSON.stringify(q))return false;
  }
  return true;
};
const Box=memo(function Box({position=[0,0,0],size,bevel,crown,lathe,axis,rotation,...look}:{position?:[number,number,number]}&Shape&Look){
  const geometry=useMemo(()=>shapeGeometry({size,bevel,crown,lathe,axis,rotation}),[...size,bevel,crown?.axis,crown?.amount,crown?.both,lathe&&JSON.stringify(lathe),axis,rotation?.join()]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <LookMesh geometry={geometry} position={position} thickness={Math.min(...size)} look={look}/>;
},sameProps);
/**
 * Every part of one object that shares a look, merged into a single mesh: one draw call (and one
 * shadow-map draw) per material instead of one per part. Materials, names and UVs are unchanged, so
 * the viewer and the render GLB look the same; Cycles reads roles per material, never per part.
 */
const PartGroup=memo(function PartGroup({parts,look}:{parts:readonly FurniturePart[];look:Look}){
  const geometry=useMemo(()=>{
    if(parts.length<2)return undefined;
    const pieces=parts.map(p=>{const g=shapeGeometry(p);g.clearGroups();g.translate(...p.position);return g;});
    const merged=mergeGeometries(pieces,false);for(const g of pieces)g.dispose();
    merged?.computeBoundingBox();merged?.computeBoundingSphere();
    return merged??undefined;
  },[JSON.stringify(parts.map(p=>[p.position,p.size,p.bevel,p.crown,p.lathe,p.axis,p.rotation]))]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  if(!geometry)return <>{parts.map(p=><Box key={p.name} position={p.position} size={p.size} bevel={p.bevel} crown={p.crown} lathe={p.lathe} axis={p.axis} rotation={p.rotation} {...look}/>)}</>;
  return <LookMesh geometry={geometry} thickness={Math.min(...parts.flatMap(p=>p.size))} look={look}/>;
},sameProps);
function FloorSurface({room}:{room:Project['rooms'][number]}){
  const finish=floors[room.floor]??floors.oak;
  const shape=useMemo(()=>{
    const points=roomVertices(room);
    const result=new THREE.Shape();
    if(!points.length)return result;
    result.moveTo(points[0].x,-points[0].y);
    for(const p of points.slice(1))result.lineTo(p.x,-p.y);
    result.closePath();
    for(const hole of room.holes??[]){
      const path=new THREE.Path();
      path.moveTo(hole[0].x,-hole[0].y);
      for(const p of hole.slice(1))path.lineTo(p.x,-p.y);
      path.closePath();
      result.holes.push(path);
    }
    return result;
  },[room]);
  return <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,.021,0]} userData={{atelierId:room.id,atelierType:'room',atelierKind:room.kind}}>
    <shapeGeometry args={[shape]}/>
    {room.materialId?<Suspense fallback={<meshStandardMaterial color={finish.color}/>}><PbrSurface id={room.materialId} color={finish.color}/></Suspense>
      :<meshStandardMaterial name={`atelier:floor-${room.floor}`} color="#ffffff" roughness={1} metalness={0} {...textureProps(`floor:${floors[room.floor]?room.floor:'oak'}`)}/>}
  </mesh>;
}
const WallModel=memo(function WallModel({wall,openings,wallHeight,color,cutaway,selected}:{wall:Wall;openings:Opening[];wallHeight:number;color:string;cutaway:boolean;selected:boolean}){
  const len=wallLength(wall);
  const angle=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);
  const height=cutaway ? .9 : wallHeight;
  const parts=wallParts(wall,openings,height);
  return <group position={[wall.a.x,0,wall.a.y]} rotation={[0,-angle,0]} userData={{atelierId:wall.id,atelierType:'wall'}}>
    {parts.map((p,i)=><group key={i}><Box position={[(p.from+p.to)/2,(p.bottom+p.top)/2,0]} size={[p.to-p.from,p.top-p.bottom,wall.thickness]} finishId={wall.materialId} color={color}/>{selected&&<mesh userData={{editorOverlay:true}} position={[(p.from+p.to)/2,(p.bottom+p.top)/2,0]}><boxGeometry args={[p.to-p.from+.005,p.top-p.bottom+.005,wall.thickness+.005]}/><meshBasicMaterial color="#2b9071" wireframe/></mesh>}</group>)}
    {!cutaway&&openings.map(o=><OpeningModel key={o.id} opening={o} length={len} thickness={wall.thickness}/>)}
  </group>;
},(a,b)=>a.wall===b.wall&&a.wallHeight===b.wallHeight&&a.color===b.color&&a.cutaway===b.cutaway&&a.selected===b.selected&&a.openings.length===b.openings.length&&a.openings.every((o,i)=>o===b.openings[i]));
function OpeningModel({opening:o,length,thickness}:{opening:Opening;length:number;thickness:number}){
  const x=o.offset*length;
  const pale='#d9d8d1';
  return <group position={[x,0,0]} userData={{atelierId:o.id,atelierType:'opening',atelierKind:o.kind}}>
    <Box position={[-o.width/2, o.height/2+o.sill,0]} size={[.045,o.height,thickness+.025]} color={pale}/>
    <Box position={[o.width/2, o.height/2+o.sill,0]} size={[.045,o.height,thickness+.025]} color={pale}/>
    <Box position={[0,o.height+o.sill,0]} size={[o.width,.055,thickness+.04]} color={pale}/>
    {o.kind==='window'?<>
      <Box position={[0,o.sill+o.height/2,0]} size={[o.width-.055,o.height-.055,.025]} color="#a8d5df" material="glass"/>
      <Box position={[0,o.sill+o.height/2,0]} size={[.028,o.height,.04]} color="#d1d4d0"/>
    </>:<group position={[-o.width/2+.03,o.sill,0]} rotation={[0,-.25,0]}>
      <Box position={[o.width*.47,o.height*.49,.014]} size={[o.width*.93,o.height*.97,.04]} color="#d4b99a" opacity={.6} role="door"/>
      <Box position={[o.width*.82,o.height*.47,.055]} size={[.11,.018,.04]} color="#97938b" material="metal"/>
    </group>}
  </group>;
}
function ImportedModel({url,item,selected}:{url:string;item:Furniture;selected:boolean}){
  const {scene}=useGLTF(url);
  const high=useEditor(state=>state.project.render?.quality==='high');
  const pbrMaps=usePbrMaps([item.modelFinish?.materialId,...(item.modelFinishes??[]).map(f=>f.materialId)]);
  const {change,setSelection}=useEditorPick('change','setSelection');
  // Shift-click picks the actual GLB mesh/material slot, including unnamed or shared materials.
  const pickSurface=(event:import('@react-three/fiber').ThreeEvent<MouseEvent>)=>{
    if(!event.nativeEvent.shiftKey)return;
    let meshIndex=0;let selectedMesh=-1;
    clone.traverse(object=>{
      if(object instanceof THREE.Mesh){if(object===event.object)selectedMesh=meshIndex;meshIndex++;}
    });
    if(selectedMesh<0)return;
    event.stopPropagation();
    const mesh=event.object as THREE.Mesh;
    const slot=Array.isArray(mesh.material)?(event.face?.materialIndex??0):0;
    const material=Array.isArray(mesh.material)?mesh.material[slot]:mesh.material;
    if(!(material instanceof THREE.MeshStandardMaterial))return;
    const materialName=`@mesh:${selectedMesh}:slot:${slot}`;
    setSelection({type:'furniture',id:item.id});
    change(project=>{
      const target=project.furniture.find(f=>f.id===item.id);
      if(!target)return;
      target.modelFinish={...(target.modelFinish??{color:'#ffffff',roughness:0.8,metalness:0}),materialName};
    });
  };
  const clone=useMemo(()=>{
    // A regular Object3D clone leaves skinned meshes bound to the original skeleton.
    // Clone bones and skin bindings together so animated furniture renders independently.
    const model=cloneSkeleton(scene);
    let meshIndex=0;
    model.traverse(object=>{
      if(object instanceof THREE.Mesh){
        const currentMesh=meshIndex++;
        object.castShadow=true;object.receiveShadow=true;
        // Never mutate materials held by the cached GLTF scene or another instance.
        if(item.modelFinish || item.modelFinishes?.length || !high){
          const apply=(original:THREE.Material,slot:number):THREE.Material=>{
            // Specific mesh overrides always win over shared-name and global finishes,
            // regardless of the order in which the user saved them.
            const finishes=[...(item.modelFinishes??[]),...(item.modelFinish?[item.modelFinish]:[])];
            const meshKey=`@mesh:${currentMesh}:slot:${slot}`;
            const finish=finishes.slice().reverse().find(f=>f.materialName===meshKey)
              ?? finishes.slice().reverse().find(f=>!!original.name && f.materialName===original.name)
              ?? finishes.slice().reverse().find(f=>!f.materialName);
            const highlighted=selected && item.modelFinish?.materialName===`@mesh:${currentMesh}:slot:${slot}`;
            const simplified=!high&&original instanceof THREE.MeshPhysicalMaterial;
            if(!finish && !highlighted&&!simplified)return original;
            const maps=finish?.materialId?pbrMaps.get(finish.materialId):undefined;
            const material=maps&&original instanceof THREE.MeshStandardMaterial?new THREE.MeshPhysicalMaterial():simplified?new THREE.MeshStandardMaterial().copy(original):original.clone();
            if(maps&&original instanceof THREE.MeshStandardMaterial){
              if(original instanceof THREE.MeshPhysicalMaterial)(material as THREE.MeshPhysicalMaterial).copy(original);
              else THREE.MeshStandardMaterial.prototype.copy.call(material,original);
            }
            material.userData={...material.userData,atelierOwned:true};
            if(material instanceof THREE.MeshStandardMaterial){
              if(finish){material.color.set(finish.color);material.roughness=finish.roughness;material.metalness=finish.metalness;
                if(maps){Object.assign(material,maps);}
              }
              // Visual feedback is transient: never serialize it or mutate cached GLTF materials.
              if(highlighted){material.userData.editorEmissive={color:material.emissive.clone(),intensity:material.emissiveIntensity};material.emissive.set('#2b9071');material.emissiveIntensity=0.22;}
            }
            return material;
          };
          object.material=Array.isArray(object.material)?object.material.map((material,slot)=>apply(material,slot)):apply(object.material,0);
        }
      }
    });
    // Rotate only this instance's clone. Keep the GLB bytes and cached scene intact.
    if(item.modelUpAxis==='Z')model.rotation.x=-Math.PI/2;
    if(item.modelUpAxis==='X')model.rotation.z=Math.PI/2;
    const oriented=new THREE.Group();oriented.add(model);
    return oriented;
  },[scene,item.modelUpAxis,item.modelFinish,item.modelFinishes,selected,pbrMaps,high]);
  useEffect(()=>()=>{clone.traverse(object=>{if(object instanceof THREE.Mesh){for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.userData.atelierOwned)material.dispose();}});},[clone]);
  const {size,center}=useMemo(()=>{const bb=new THREE.Box3().setFromObject(clone);const dimensions=bb.getSize(new THREE.Vector3());const center=bb.getCenter(new THREE.Vector3());return{size:dimensions,center};},[clone]);
  return <group position={[item.modelOffsetX??0,item.modelElevation??0,item.modelOffsetZ??0]}><group scale={[item.w/Math.max(size.x,.001),item.h/Math.max(size.y,.001),item.d/Math.max(size.z,.001)]}>
    <primitive object={clone} position={[-center.x, -center.y+size.y/2, -center.z]} onClick={pickSurface}/>
  </group></group>;
}
/** Models still fetching or parsing; captures wait for this to empty (loader progress has gaps between fetch and parse). */
const loadingModels=new Set<object>();
function trackModelLoad(){const token={};loadingModels.add(token);return()=>{loadingModels.delete(token);};}
function ModelLoading({item}:{item:Furniture}){
  useEffect(()=>trackModelLoad(),[]);
  return <Box position={[0,item.h/2,0]} size={[item.w,item.h,item.d]} color="#ddd5c5"/>;
}
function ModelShape({item,selected}:{item:Furniture;selected:boolean}){
  const [url,setUrl]=useState<string|null>(item.modelData??null);
  useEffect(()=>{
    if(item.modelData){setUrl(item.modelData);return;}
    if(!item.assetId){setUrl(null);return;}
    setUrl(null);
    let active=true;let objectURL:string|undefined;const done=trackModelLoad();
    getModelAsset(item.assetId).then(blob=>{
      if(blob&&active){objectURL=URL.createObjectURL(blob);setUrl(objectURL);}
    }).catch(()=>{if(active)setUrl(null);}).finally(done);
    return ()=>{active=false;done();if(objectURL)URL.revokeObjectURL(objectURL);};
  },[item.assetId,item.modelData]);
  const fallback=<group><Box position={[0,item.h/2,0]} size={[item.w,item.h,item.d]} color="#d2b7a4"/><Html center position={[0,item.h+.15,0]}><span className="model-unavailable">{item.name}: modelo no disponible</span></Html></group>;
  return url?<ErrorBoundary key={url} fallback={fallback}><Suspense fallback={<ModelLoading item={item}/>}><ImportedModel url={url} item={item} selected={selected}/></Suspense></ErrorBoundary>:fallback;
}
function ModuleModel({item,wood}:{item:Furniture;wood:string}){
  const m=item.module!;
  const parts=useMemo(()=>moduleParts(m.family,item.w,item.d,item.h,m.handles),[m.family,m.handles,item.w,item.d,item.h]);
  // Wall cabinets and hoods hang (moduleHangHeight); the rest stand on the floor.
  return <group position={[0,moduleHangHeight(m.family),0]}><Parts parts={parts} item={{...item,color:m.front}} wood={wood} worktop={m.worktop}/></group>;
}
// Parametric furniture is built from parts (src/lib/furnitureParts.ts), all inside the plan footprint.
// Share of light a voile stops; exported as glTF alpha, which Cycles reads back (make_sheer).
const SHEER_OPACITY=.55;
function Parts({parts,item,wood,worktop}:{parts:FurniturePart[];item:Furniture;wood:string;worktop?:string}){
  const groups=new Map<string,{look:Look;parts:FurniturePart[]}>();
  for(const p of parts){
    const look:Look={color:p.color==='item'?item.color:p.color==='wood'?wood:p.color,material:p.material,surface:p.surface,role:p.role,finishId:p.role==='worktop'?worktop:undefined,opacity:p.role==='sheer'?SHEER_OPACITY:undefined};
    const key=JSON.stringify(look),group=groups.get(key);
    if(group)group.parts.push(p);else groups.set(key,{look,parts:[p]});
  }
  return <>{[...groups].map(([key,group])=><PartGroup key={key} parts={group.parts} look={group.look}/>)}</>;
}
function WovenRug({item}:{item:Furniture}){
  const weave=useMemo(()=>{
    const size=128,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const alongWarp=(Math.floor(x/8)+Math.floor(y/8))%2===0;
      const fiber=alongWarp?x:y,cross=alongWarp?y:x;
      const yarn=Math.sin(Math.PI*(fiber%8+.5)/8);
      const shade=185+Math.round(43*yarn+9*Math.cos(cross*Math.PI/4)+8*Math.sin(fiber*Math.PI/2));
      const i=(y*size+x)*4;
      pixels.set([shade,shade,shade,255],i);
    }
    // A normal map (core glTF) instead of a bump map so the weave relief reaches Cycles.
    const height=new Float32Array(size*size);for(let i=0;i<height.length;i++)height[i]=pixels[i*4]/255;
    const make=(data:Uint8Array,srgb:boolean)=>{
      const texture=new THREE.DataTexture(data,size,size);
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.magFilter=THREE.LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;
      return texture;
    };
    return {map:make(pixels,true),normal:make(heightToNormal(height,size,1.6),false)};
  },[]);
  useEffect(()=>()=>{weave.map.dispose();weave.normal.dispose();},[weave]);
  for(const texture of [weave.map,weave.normal])texture.repeat.set(item.w/.22,item.d/.22);
  const border=Math.min(.035,item.w*.05,item.d*.05);
  const top=.028;
  return <group>
    <Box position={[0,top/2,0]} size={[item.w,top,item.d]} color={item.color}/>
    <mesh receiveShadow position={[0,top+.0005,0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[item.w-border*2,item.d-border*2]}/>
      <meshStandardMaterial name="atelier:rug-weave" color={item.color} map={weave.map} normalMap={weave.normal} roughness={.97}/>
    </mesh>
  </group>;
}
// The viewer's environment map is not the room, so a mirror reflects the scene through a planar
// Reflector laid 0.5 mm over its glass. It is excluded from the render GLB, where Cycles traces
// the metal glass (material `mirror`) itself.
function Mirror({item,wood,build=mirrorParts}:{item:Furniture;wood:string;build?:(w:number,d:number,h:number)=>FurniturePart[]}){
  const parts=useMemo(()=>build(item.w,item.d,item.h),[build,item.w,item.d,item.h]);
  const glass=parts.find(p=>p.name==='Luna')!;
  const reflector=useMemo(()=>{
    const [gw,gh]=glass.size,scale=640/Math.max(gw,gh);
    const r=new Reflector(new THREE.PlaneGeometry(gw,gh),{textureWidth:Math.round(gw*scale),textureHeight:Math.round(gh*scale),color:0x8a8d8c});
    r.userData.renderExclude=true;return r;
  },[glass.size[0],glass.size[1]]);
  useEffect(()=>()=>{reflector.geometry.dispose();reflector.dispose();},[reflector]);
  // Just in front of the glass along its own normal, so a tilted mirror keeps its reflector flush.
  const lift=rotateEuler([0,0,glass.size[2]/2+.0005],glass.rotation);
  return <><Parts parts={parts} item={item} wood={wood}/><primitive object={reflector} position={[glass.position[0]+lift[0],glass.position[1]+lift[1],glass.position[2]+lift[2]]} rotation={glass.rotation??[0,0,0]}/></>;
}
// Turned pot plus seeded foliage (src/lib/plantGeometry.ts): the same item id always grows the same plant.
function Plant({item,wood}:{item:Furniture;wood:string}){
  const {w,d,h}=item;
  const foliage=useMemo(()=>plantGeometry(w,d,h,plantSoilHeight(h),seedFrom(item.id)),[w,d,h,item.id]);
  useEffect(()=>()=>{foliage.stems.dispose();for(const g of foliage.leaves)g.dispose();},[foliage]);
  const tones=useMemo(()=>[new THREE.Color(item.color).offsetHSL(0,0,-.05).getStyle(),new THREE.Color(item.color).offsetHSL(.02,.04,.06).getStyle()],[item.color]);
  return <>
    <Parts parts={plantPotParts(w,d,h)} item={item} wood={wood}/>
    <mesh castShadow geometry={foliage.stems}><meshStandardMaterial color="#6a5d45" roughness={.9}/></mesh>
    {foliage.leaves.map((g,i)=><mesh key={i} castShadow receiveShadow geometry={g}><meshStandardMaterial name="atelier:leaf" color={tones[i]} roughness={.55} side={THREE.DoubleSide}/></mesh>)}
  </>;
}
// A lamp's bulb: a faint fill by day, switched on at night (Cycles places its own light there, renderPackage.interiorLights).
function LampLight({position,night,day=.13,distance,down=false}:{position:[number,number,number];night:boolean;day?:number;distance:number;down?:boolean}){
  // An opaque dome (arc lamp) sends its light down: a spot cone, so the wall above it stays dark as in Cycles.
  const target=useMemo(()=>new THREE.Object3D(),[]);
  if(night&&down)return <><primitive object={target} position={[position[0],position[1]-1,position[2]]}/><spotLight position={position} target={target} intensity={4.5} angle={1.05} penumbra={.85} color="#ffd9a8" distance={distance*2.4}/></>;
  return <pointLight position={position} intensity={night?2.2:day} color={night?'#ffd9a8':'#fff2d3'} distance={night?distance*2.4:distance}/>;
}
function FurnitureShape({item,wood,night,selected}:{item:Furniture;wood:string;night:boolean;selected:boolean}){
  if(item.module)return <ModuleModel item={item} wood={wood}/>;
  const {w,d,h}=item;
  switch(item.kind){
    case 'bed':case 'single-bed':case 'storage-bed':return <Parts parts={bedParts(w,d,item.kind==='storage-bed')} item={item} wood={wood}/>;
    case 'sofa':return <Parts parts={sofaParts(w,d)} item={item} wood={wood}/>;
    case 'table':return <Parts parts={tableParts(w,d,h)} item={item} wood={wood}/>;
    case 'desk':return <Parts parts={deskParts(w,d,h)} item={item} wood={wood}/>;
    case 'nightstand':return <Parts parts={nightstandParts(w,d,h)} item={item} wood={wood}/>;
    case 'armchair':return <Parts parts={armchairParts(w,d,h)} item={item} wood={wood}/>;
    case 'sideboard':return <Parts parts={sideboardParts(w,d,h)} item={item} wood={wood}/>;
    case 'coffee-table':return <Parts parts={coffeeTableParts(w,d,h)} item={item} wood={wood}/>;
    case 'tv-unit':return <Parts parts={tvUnitParts(w,d,h)} item={item} wood={wood}/>;
    case 'tv':return <Parts parts={tvParts(w,d,h)} item={item} wood={wood}/>;
    case 'table-lamp':return <><Parts parts={tableLampParts(w,d,h)} item={item} wood={wood}/><LampLight position={[0,h-tableLampShadeHeight(h)*.55,0]} night={night} day={.08} distance={1.6}/></>;
    case 'corner-sofa':return <Parts parts={cornerSofaParts(w,d,h)} item={item} wood={wood}/>;
    case 'corner-sofa-left':return <Parts parts={cornerSofaLeftParts(w,d,h)} item={item} wood={wood}/>;
    case 'vase':return <Parts parts={vaseParts(w,d,h)} item={item} wood={wood}/>;
    case 'fruit-bowl':return <Parts parts={fruitBowlParts(w,d,h)} item={item} wood={wood}/>;
    case 'photo-frame':return <Parts parts={photoFrameParts(w,d,h)} item={item} wood={wood}/>;
    case 'table-clock':return <Parts parts={tableClockParts(w,d,h)} item={item} wood={wood}/>;
    case 'decor-bowl':return <Parts parts={decorBowlParts(w,d,h)} item={item} wood={wood}/>;
    case 'throw-pillow':return <Parts parts={throwPillowParts(w,d,h)} item={item} wood={wood}/>;
    case 'folded-blanket':return <Parts parts={foldedBlanketParts(w,d,h)} item={item} wood={wood}/>;
    case 'bath-tray':return <Parts parts={bathTrayParts(w,d,h)} item={item} wood={wood}/>;
    case 'cutting-board':return <Parts parts={cuttingBoardParts(w,d,h)} item={item} wood={wood}/>;
    case 'kettle':return <Parts parts={kettleParts(w,d,h)} item={item} wood={wood}/>;
    case 'utensil-jar':return <Parts parts={utensilJarParts(w,d,h)} item={item} wood={wood}/>;
    case 'umbrella-stand':return <Parts parts={umbrellaStandParts(w,d,h)} item={item} wood={wood}/>;
    case 'doormat':return <Parts parts={doormatParts(w,d,h)} item={item} wood={wood}/>;
    case 'soap-dispenser':return <Parts parts={soapDispenserParts(w,d,h)} item={item} wood={wood}/>;
    case 'toothbrush-cup':return <Parts parts={toothbrushCupParts(w,d,h)} item={item} wood={wood}/>;
    case 'bath-mat':return <Parts parts={bathMatParts(w,d,h)} item={item} wood={wood}/>;
    case 'towel-stack':return <Parts parts={towelStackParts(w,d,h)} item={item} wood={wood}/>;
    case 'desk-lamp':return <Parts parts={deskLampParts(w,d,h)} item={item} wood={wood}/>;
    case 'laptop':return <Parts parts={laptopParts(w,d,h)} item={item} wood={wood}/>;
    case 'wastebasket':return <Parts parts={wastebasketParts(w,d,h)} item={item} wood={wood}/>;
    case 'desk-organizer':return <Parts parts={deskOrganizerParts(w,d,h)} item={item} wood={wood}/>;
    case 'blanket-basket':return <Parts parts={blanketBasketParts(w,d,h)} item={item} wood={wood}/>;
    case 'clothes-rail':return <Parts parts={clothesRailParts(w,d,h)} item={item} wood={wood}/>;
    case 'arc-lamp':return <><Parts parts={arcLampParts(w,d,h)} item={item} wood={wood}/><LampLight position={arcLampBulb(w,d,h)} night={night} distance={2.2} down/></>;
    case 'leaning-art':return <Parts parts={leaningArtParts(w,d,h)} item={item} wood={wood}/>;
    case 'blanket-ladder':return <Parts parts={blanketLadderParts(w,d,h)} item={item} wood={wood}/>;
    case 'folding-screen':return <Parts parts={foldingScreenParts(w,d,h)} item={item} wood={wood}/>;
    case 'wall-coat-rack':return <Parts parts={wallCoatRackParts(w,d,h)} item={item} wood={wood}/>;
    case 'bar-cart':return <Parts parts={barCartParts(w,d,h)} item={item} wood={wood}/>;
    case 'office-chair':return <Parts parts={officeChairParts(w,d,h)} item={item} wood={wood}/>;
    case 'floor-mirror':return <Mirror item={item} wood={wood} build={floorMirrorParts}/>;
    case 'record-console':return <Parts parts={recordConsoleParts(w,d,h)} item={item} wood={wood}/>;
    case 'floor-vase':return <Parts parts={floorVaseParts(w,d,h)} item={item} wood={wood}/>;
    case 'decor-tray':return <Parts parts={decorTrayParts(w,d,h)} item={item} wood={wood}/>;
    case 'floor-cushion':return <Parts parts={floorCushionParts(w,d,h)} item={item} wood={wood}/>;
    case 'nesting-tables':return <Parts parts={nestingTablesParts(w,d,h)} item={item} wood={wood}/>;
    case 'table-setting':return <Parts parts={tableSettingParts(w,d,h)} item={item} wood={wood}/>;
    case 'wine-set':return <Parts parts={wineSetParts(w,d,h)} item={item} wood={wood}/>;
    case 'coffee-machine':return <Parts parts={coffeeMachineParts(w,d,h)} item={item} wood={wood}/>;
    case 'dish-rack':return <Parts parts={dishRackParts(w,d,h)} item={item} wood={wood}/>;
    case 'herb-pots':return <Parts parts={herbPotsParts(w,d,h)} item={item} wood={wood}/>;
    case 'shelf-basket':return <Parts parts={shelfBasketParts(w,d,h)} item={item} wood={wood}/>;
    case 'table-plant':return <Plant item={item} wood={wood}/>;
    case 'candles':return <><Parts parts={candleParts(w,d,h)} item={item} wood={wood}/>{night&&candleFlames(w,d,h).map((p,i)=><pointLight key={i} position={p} intensity={.015} color="#ffb46b" distance={1.2}/>)}</>;
    case 'books':return <Parts parts={bookStackParts(w,d,h)} item={item} wood={wood}/>;
    case 'pouf':return <Parts parts={poufParts(w,d,h)} item={item} wood={wood}/>;
    case 'console-table':return <Parts parts={consoleTableParts(w,d,h)} item={item} wood={wood}/>;
    case 'sheer-curtain':return <Parts parts={sheerCurtainParts(w,d,h)} item={item} wood={wood}/>;
    case 'curtain':return <Parts parts={curtainParts(w,d,h)} item={item} wood={wood}/>;
    case 'extending-table':return <Parts parts={extendingTableParts(w,d,h,item.leaf)} item={item} wood={wood}/>;
    case 'desk-hutch':return <Parts parts={deskHutchParts(w,d,h)} item={item} wood={wood}/>;
    case 'bunk-bed':return <Parts parts={bunkBedParts(w,d,h)} item={item} wood={wood}/>;
    case 'laundry-basket':return <Parts parts={laundryBasketParts(w,d,h)} item={item} wood={wood}/>;
    case 'floating-nightstand':return <Parts parts={floatingNightstandParts(w,d,h)} item={item} wood={wood}/>;
    case 'washer':case 'dryer':return <Parts parts={washerParts(w,d,h,item.kind==='dryer')} item={item} wood={wood}/>;
    case 'crib':return <Parts parts={cribParts(w,d,h)} item={item} wood={wood}/>;
    case 'bar-stool':return <Parts parts={barStoolParts(w,d,h)} item={item} wood={wood}/>;
    case 'dresser':return <Parts parts={dresserParts(w,d,h)} item={item} wood={wood}/>;
    case 'shoe-cabinet':return <Parts parts={shoeCabinetParts(w,d,h)} item={item} wood={wood}/>;
    case 'wall-shelf':return <Parts parts={wallShelfParts(w,d,h)} item={item} wood={wood}/>;
    case 'towel-rail':return <Parts parts={towelRailParts(w,d,h)} item={item} wood={wood}/>;
    case 'radiator':return <Parts parts={radiatorParts(w,d,h)} item={item} wood={wood}/>;
    case 'bench':return <Parts parts={benchParts(w,d,h)} item={item} wood={wood}/>;
    case 'side-table':return <Parts parts={sideTableParts(w,d,h)} item={item} wood={wood}/>;
    case 'coat-rack':return <Parts parts={coatRackParts(w,d,h)} item={item} wood={wood}/>;
    case 'bathtub':return <Parts parts={bathtubParts(w,d,h)} item={item} wood={wood}/>;
    case 'mirror':return <Mirror item={item} wood={wood}/>;
    case 'artwork':return <Parts parts={artworkParts(w,d,h)} item={item} wood={wood}/>;
    case 'pendant':return <><Parts parts={pendantParts(w,d,h)} item={item} wood={wood}/><LampLight position={[0,pendantShadeHeight(w,h)*.35,0]} night={night} distance={2.4}/></>;
    case 'bookshelf':return <Parts parts={bookshelfParts(w,d,h)} item={item} wood={wood}/>;
    case 'island':return <Parts parts={islandParts(w,d,h)} item={item} wood={wood}/>;
    case 'chair':return <Parts parts={chairParts(w,d,h)} item={item} wood={wood}/>;
    case 'wardrobe':return <Parts parts={wardrobeParts(w,d,h)} item={item} wood={wood}/>;
    case 'kitchen':return <Parts parts={kitchenParts(w,d,h)} item={item} wood={wood}/>;
    case 'fridge':return <Parts parts={fridgeParts(w,d,h)} item={item} wood={wood}/>;
    case 'sink':return <Parts parts={sinkParts(w,d,h)} item={item} wood={wood}/>;
    case 'toilet':return <Parts parts={toiletParts(w,d,h)} item={item} wood={wood}/>;
    case 'shower':return <Parts parts={showerParts(w,d,h)} item={item} wood={wood}/>;
    case 'plant':return <Plant item={item} wood={wood}/>;
    case 'lamp':return <><Parts parts={lampParts(w,d,h)} item={item} wood={wood}/><LampLight position={[0,h-.15,0]} night={night} distance={2}/></>;
    case 'rug':return item.materialId?<Box position={[0,.014,0]} size={[w,.028,d]} color={item.color}/>:<WovenRug item={item}/>;
    case 'model':return <ModelShape item={item} selected={selected}/>;
  }
}
const selectFurniture=(id:string)=>useEditor.getState().setSelection({type:'furniture',id});
// Memoised per item: an edit re-renders only the objects whose data, support height or selection changed.
const ObjectModel=memo(function ObjectModel({item,elevation,wood,night,selected}:{item:Furniture;elevation:number;wood:string;night:boolean;selected:boolean}){
  const onSelect=()=>selectFurniture(item.id);
  return <group position={[item.x,0,item.y]} rotation={[0,-item.rotation*Math.PI/180,0]} userData={{atelierId:item.id,atelierType:'furniture',atelierKind:item.kind}} onClick={e=>{e.stopPropagation();onSelect();}} onPointerOver={()=>{document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='';}}>
    <SurfaceContext.Provider value={item.materialId}><group position={[0,elevation,0]}><FurnitureShape item={item} wood={wood} night={night} selected={selected}/></group></SurfaceContext.Provider>
    {selected&&<mesh userData={{editorOverlay:true}} rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><ringGeometry args={[Math.max(item.w,item.d)*.66,Math.max(item.w,item.d)*.68,40]}/><meshBasicMaterial color="#2b9071" side={THREE.DoubleSide}/></mesh>}
  </group>;
});
// Approximate near-floor occlusion from the placed footprint. Unlike a projected
// key-light shadow it stays under the furniture as the studio light rotates.
const FloorContact=memo(function FloorContact({item}:{item:Furniture}){
  const lift=Math.max(0,item.modelElevation??0);
  return <group position={[item.x,0,item.y]} rotation={[0,-item.rotation*Math.PI/180,0]}>
    <mesh raycast={()=>{}} userData={{renderExclude:true}} position={[item.modelOffsetX??0,.031,item.modelOffsetZ??0]} rotation={[-Math.PI/2,0,0]} scale={[item.w*1.45,item.d*1.45,1]}>
      <planeGeometry/>
      <shaderMaterial transparent depthWrite={false} uniforms={{strength:{value:.36*(1-lift/.45)}}}
        vertexShader={`varying vec2 coord;
          void main(){coord=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec2 coord;
          uniform float strength;
          void main(){
            vec2 edge=max(abs(coord)-vec2(.42),0.0);
            float occlusion=1.0-smoothstep(.03,.55,length(edge));
            gl_FragColor=vec4(.035,.025,.018,strength*occlusion);
            #include <colorspace_fragment>
          }`}/>
    </mesh>
  </group>;
});
function CameraRig({project,top}:{project:Project;top:boolean}){
  const {camera,controls}=useThree();
  const saved=project.render?.camera;
  useEffect(()=>{
    if(project.render?.walk&&!studioSubject(project)){const p=project.rooms[0]?roomLabelPoint(project.rooms[0]):{x:project.width/2,y:project.depth/2};camera.position.set(p.x,1.6,p.y);camera.lookAt(p.x,1.6,p.y-1);}
    else if(saved&&!top){camera.position.fromArray(saved.position);camera.lookAt(...saved.target);}
    else{camera.position.set(project.width/2+(top?0:project.width*.65),top?Math.max(project.width,project.depth)*1.9:Math.max(project.width,project.depth)*1.05,project.depth/2+(top?.001:project.depth*1.3));camera.lookAt(project.width/2,0,project.depth/2);}
    camera.updateProjectionMatrix();
  },[camera,top,project.width,project.depth,JSON.stringify(saved),project.render?.walk]);
  useEffect(()=>{
    const observer=()=>{
      const orbit=controls as unknown as {target?:THREE.Vector3}|undefined;
      const target=orbit?.target??camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3).add(camera.position);
      useEditor.getState().setLiveCamera({position:camera.position.toArray() as [number,number,number],target:target.toArray() as [number,number,number]});
    };
    const events=controls as unknown as {addEventListener:(type:string,handler:()=>void)=>void;removeEventListener:(type:string,handler:()=>void)=>void}|undefined;
    observer();events?.addEventListener('end',observer);events?.addEventListener('unlock',observer);
    return()=>{events?.removeEventListener('end',observer);events?.removeEventListener('unlock',observer);};
  },[camera,controls,top,project.render?.walk]);
  return null;
}
// While the camera is being dragged nothing in the scene moves, so the shadow maps stay valid:
// freeze them, and draw glass transmission and pixel density at draft level until the gesture ends.
// The final frame after release (and every capture) uses the full settings again.
export const viewerDpr=(high:boolean):[number,number]=>high?[1,2]:[1,1.3];
function InteractionQuality({high}:{high:boolean}){
  const {gl,controls,setDpr,invalidate}=useThree();
  useEffect(()=>{
    const events=controls as unknown as THREE.EventDispatcher<{start:object;end:object}>|null;
    if(!events?.addEventListener)return;
    let timer=0;
    const start=()=>{window.clearTimeout(timer);gl.shadowMap.autoUpdate=false;gl.transmissionResolutionScale=.25;if(high)setDpr(1);};
    // Damping keeps the camera gliding briefly after release; restore once it has settled.
    const end=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{gl.shadowMap.autoUpdate=true;gl.shadowMap.needsUpdate=true;gl.transmissionResolutionScale=high?1:.25;if(high)setDpr(viewerDpr(true));invalidate();},350);};
    events.addEventListener('start',start);events.addEventListener('end',end);
    return()=>{window.clearTimeout(timer);events.removeEventListener('start',start);events.removeEventListener('end',end);gl.shadowMap.autoUpdate=true;};
  },[gl,controls,setDpr,invalidate,high]);
  return null;
}
function CaptureRig({exposure,high}:{exposure:number;high:boolean}){
  const {gl,scene,camera,invalidate}=useThree();
  useEffect(()=>{gl.toneMappingExposure=exposure;gl.transmissionResolutionScale=high?1:.25;invalidate();},[gl,exposure,high,invalidate]);
  useEffect(()=>{
    const unregister=registerCapture(gl.domElement,async(width,height)=>{
      const project=useEditor.getState().project;
      const references=(project.materials??[]).flatMap(material=>Object.values(material.maps??{}));
      // Model loads can start after the DOM reports idle. Let pending React/loader work
      // settle for two frames, reading live progress rather than a render's stale value.
      const deadline=performance.now()+30_000;let settled=0;
      while(settled<2){
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        if(useEditor.getState().project!==project)throw new Error('El proyecto cambió mientras se preparaba la imagen. Vuelve a exportar.');
        if(performance.now()>deadline)throw new Error('Espera a que terminen de cargar los modelos y texturas antes de exportar.');
        settled=useProgress.getState().active||loadingModels.size||textureMapsPending(references)?0:settled+1;
      }
      const size=gl.getSize(new THREE.Vector2()),ratio=gl.getPixelRatio();
      const perspective=camera as THREE.PerspectiveCamera,aspect=perspective.aspect;
      const overlays:THREE.Object3D[]=[];scene.traverse(object=>{if(object.userData.editorOverlay&&object.visible){overlays.push(object);object.visible=false;}});
      const highlighted=new Set<THREE.MeshStandardMaterial>();
      scene.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.userData.editorEmissive)highlighted.add(material);});
      const emissives=[...highlighted].map(material=>({material,color:material.emissive.clone(),intensity:material.emissiveIntensity}));
      try{
        const max=gl.capabilities.maxTextureSize,viewport=gl.getContext().getParameter(gl.getContext().MAX_VIEWPORT_DIMS) as Int32Array;
        if(width>Math.min(max,viewport[0])||height>Math.min(max,viewport[1]))throw new Error('Esta GPU no admite esa resolución. Prueba 1920 × 1080.');
        for(const material of highlighted){const original=material.userData.editorEmissive;material.emissive.copy(original.color);material.emissiveIntensity=original.intensity;}
        gl.setPixelRatio(1);gl.setSize(width,height,false);perspective.aspect=width/height;perspective.updateProjectionMatrix();
        // Synchronous compile: three's compileAsync polls materials from a setTimeout and, if a
        // GLB/texture swap disposes one meanwhile, throws there and never resolves (export hung).
        gl.compile(scene,camera);gl.shadowMap.needsUpdate=true;gl.render(scene,camera);
        return await new Promise<Blob>((resolve,reject)=>gl.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('La GPU no pudo crear la imagen.')),'image/png'));
      }finally{overlays.forEach(object=>{object.visible=true;});for(const {material,color,intensity} of emissives){material.emissive.copy(color);material.emissiveIntensity=intensity;}gl.setPixelRatio(ratio);gl.setSize(size.x,size.y,false);perspective.aspect=aspect;perspective.updateProjectionMatrix();invalidate();}
    });
    const unregisterSource=registerSceneSource(gl.domElement,{scene,camera:camera as THREE.PerspectiveCamera,invalidate});
    return()=>{unregister();unregisterSource();};
  },[gl,scene,camera,invalidate]);return null;
}
function StudioLights({project,subject,high}:{project:Project;subject?:Furniture;high:boolean}){
  const settings=project.render?.studio??defaultStudio;
  const center=subject?objectCamera(subject).target:[project.width/2,1,project.depth/2];
  const span=subject?Math.max(subject.w,subject.d,subject.h,2):Math.max(project.width,project.depth);
  const target=useMemo(()=>new THREE.Object3D(),[]);
  target.position.set(center[0],center[1],center[2]);
  const angle=settings.azimuth*Math.PI/180;
  const key:[number,number,number]=[center[0]+Math.sin(angle)*span,center[1]+span*1.5,center[2]+Math.cos(angle)*span];
  const color=settings.warmth==='warm'?'#ffe0b5':settings.warmth==='cool'?'#ccddff':'#fff5eb';
  return <>
    <primitive object={target}/>
    {high&&<SoftShadows size={40} samples={16}/>}
    <ambientLight intensity={.12}/>
    <directionalLight target={target} position={key} intensity={settings.key} color={color} castShadow shadow-mapSize={[high?2048:1024,high?2048:1024]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} shadow-camera-far={span*6} shadow-normalBias={.008} shadow-bias={-.00005}/>
    <directionalLight target={target} position={[center[0]-span,center[1]+span*.5,center[2]+span*.7]} intensity={settings.fill} color="#e0ebff"/>
    <directionalLight target={target} position={[center[0]+span*.7,center[1]+span,center[2]-span]} intensity={settings.rim} color="#fff2e0"/>
    <ErrorBoundary fallback={null}><Suspense fallback={null}><Environment files={ENVIRONMENT_FILE} environmentIntensity={.45}/></Suspense></ErrorBoundary>
  </>;
}
function WalkRig({project}:{project:Project}){
  const {camera,invalidate}=useThree();const pressed=useMemo(()=>new Set<string>(),[]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if(e.code==='Escape'&&document.pointerLockElement){document.exitPointerLock();pressed.clear();return;}if(document.pointerLockElement&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();pressed.add(e.code);invalidate();}};
    const up=(e:KeyboardEvent)=>pressed.delete(e.code);const blur=()=>pressed.clear();
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  },[pressed,invalidate]);
  useFrame((_,delta)=>{
    if(!document.pointerLockElement)return;
    invalidate();
    const direction=camera.getWorldDirection(new THREE.Vector3());direction.y=0;direction.normalize();
    const right=new THREE.Vector3().crossVectors(direction,camera.up).normalize();
    const forward=Number(pressed.has('KeyW')||pressed.has('ArrowUp'))-Number(pressed.has('KeyS')||pressed.has('ArrowDown'));
    const sideways=Number(pressed.has('KeyD')||pressed.has('ArrowRight'))-Number(pressed.has('KeyA')||pressed.has('ArrowLeft'));
    const movement=direction.multiplyScalar(forward).add(right.multiplyScalar(sideways));
    if(movement.lengthSq()===0)return;movement.normalize().multiplyScalar(Math.min(delta,.05)*2);
    const next=camera.position.clone().add(movement);next.x=clamp(next.x,.2,project.width-.2);next.z=clamp(next.z,.2,project.depth-.2);
    const blocked=project.walls.some(w=>{
      const p=wallProjection(w,{x:next.x,y:next.z});if(Math.hypot(next.x-p.point.x,next.z-p.point.y)>w.thickness/2+.15)return false;
      return !project.openings.some(o=>o.wallId===w.id&&o.kind==='door'&&Math.abs(o.offset-p.offset)*wallLength(w)<o.width/2-.15);
    });if(!blocked)camera.position.copy(next);
  });return <PointerLockControls makeDefault selector=".scene-wrap canvas"/>;
}
const ENVIRONMENT_FILE=`${import.meta.env.BASE_URL}environment/studio.hdr`;
function EnvironmentReady({children}:{children:ReactNode}){useEnvironment({files:ENVIRONMENT_FILE});return <>{children}</>;}
/**
 * Mount the scene once the image-based light is decoded: the environment map changes every
 * material's shader, so drawing first would compile all of them twice. If the HDR cannot be
 * read the scene is drawn without it.
 */
function AfterEnvironment({children}:{children:ReactNode}){return <ErrorBoundary fallback={children}><Suspense fallback={null}><EnvironmentReady>{children}</EnvironmentReady></Suspense></ErrorBoundary>;}
/**
 * Mount the scene content hidden and link its shaders in the background (KHR_parallel_shader_compile)
 * before drawing it: otherwise the first frame blocks the page for most of a second while every
 * material variant compiles. `after` (capture hooks, one-shot contact shadows) mounts once shown.
 */
function WarmShaders({children,after,onReady}:{children:ReactNode;after:ReactNode;onReady:(ready:true)=>void}){
  const group=useRef<THREE.Group>(null);const {gl,camera,scene,invalidate}=useThree();const [ready,setReady]=useState(false);
  useEffect(()=>{
    const content=group.current;let live=true,poll=0;
    const show=()=>{if(!live)return;live=false;setReady(true);onReady(true);invalidate();};
    // compile() only starts linking; poll the programs here instead of compileAsync(), whose loop throws
    // when a material is disposed mid-compile (a scene edit) and then never resolves.
    const wait=(pending:Set<THREE.Material>)=>{
      if(!live)return;
      for(const material of pending){const program=(gl.properties.get(material) as {currentProgram?:{isReady():boolean}}).currentProgram;if(!program||program.isReady())pending.delete(material);}
      if(pending.size)poll=window.setTimeout(()=>wait(pending),10);else show();
    };
    // One frame lets the environment and loaders attach first, so the compiled variants are the ones drawn.
    const frame=requestAnimationFrame(()=>{try{if(content)wait(gl.compile(content,camera,scene));else show();}catch{show();}});
    const fallback=window.setTimeout(show,5000);
    return()=>{live=false;cancelAnimationFrame(frame);window.clearTimeout(poll);window.clearTimeout(fallback);};
  },[gl,camera,scene,invalidate,onReady]);
  return <><group ref={group} visible={ready}>{children}</group>{ready&&after}</>;
}
/** While the viewer is hidden behind the 2D plan nothing is drawn; redraw the latest state when it is shown. */
function ResumeOnShow({active}:{active:boolean}){
  const invalidate=useThree(state=>state.invalidate);
  useEffect(()=>{if(!active)return;invalidate();const frame=requestAnimationFrame(()=>invalidate());return()=>cancelAnimationFrame(frame);},[active,invalidate]);
  return null;
}
export default function Scene3D({canvasRef,topView=false,active=true}:{canvasRef:MutableRefObject<HTMLCanvasElement|null>;topView?:boolean;active?:boolean}){
  const [warm,setWarm]=useState(false);
  useTextureLibraryRevision();
  // liveCamera is read on purpose: its first sync (after CameraRig places the camera) re-renders the
  // scene so OrbitControls re-applies its target; without it the first PNG export differs from later ones.
  const {project,selection,setSelection,wallsVisible,cutaway,cameraLocked}=useEditorPick('project','selection','setSelection','wallsVisible','cutaway','cameraLocked','liveCamera');
  const {active:loading}=useProgress();
  const render=project.render??{lighting:'day',exposure:1,quality:'draft'};const high=render.quality==='high';
  const studio=render.lighting==='studio',subject=studioSubject(project);
  const center=subject?objectCamera(subject).target:[project.width/2,0,project.depth/2];
  const span=subject?Math.max(subject.w,subject.d,subject.h,2):Math.max(project.width,project.depth);
  const ground=subject?(subject.modelElevation??0)-.012:-.009;
  return <div className="scene-wrap" aria-busy={loading||!warm||textureMapsPending((project.materials??[]).flatMap(material=>Object.values(material.maps??{})))}>
    <div className="scene-title"><span>{subject?'Estudio de producto':'Perspectiva 3D'}</span><strong>{subject?.name??project.name}</strong></div>
    <Canvas frameloop={active?"demand":"never"} shadows dpr={viewerDpr(high)} gl={{antialias:true,preserveDrawingBuffer:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:render.exposure}} camera={{position:[11,11,12],fov:42,near:.1,far:1000}} onCreated={({gl})=>{canvasRef.current=gl.domElement;}} onPointerMissed={()=>setSelection(null)}>
      <SurfaceRefresh/>
      <ResumeOnShow active={active}/>
      <color attach="background" args={[studio?(render.studio??defaultStudio).background:'#f4f3ef']}/>
      {studio?<StudioLights project={project} subject={subject} high={high}/>:<>
      <ambientLight intensity={render.lighting==='night'?.08:.35}/>
      <hemisphereLight intensity={render.lighting==='night'?.12:.4} groundColor="#ccc8bd" color="#e7f1ff"/>
      {/* Image-based light: metals need something to reflect, or they render almost black. */}
      <ErrorBoundary fallback={null}><Suspense fallback={null}><Environment files={ENVIRONMENT_FILE} environmentIntensity={render.lighting==='night'?.08:.28}/></Suspense></ErrorBoundary>
      <directionalLight castShadow position={[-5,13,7]} intensity={render.lighting==='night'?.2:2.3} color={render.lighting==='night'?'#a8bfff':'#fff5e8'} shadow-mapSize-width={high?2048:1024} shadow-mapSize-height={high?2048:1024} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-.0001}/>
      {/* Night: one ceiling light per room, as Cycles lights every room (roomLights), not one lamp for the whole house. */}
      {/* Mounted only at night: zero-intensity lights still cost per pixel (the E2E suite on software GL ran ~2× slower), so a one-off shader recompile when switching presets (~1 s on the example) is the cheaper trade. */}
      {render.lighting==='night'&&project.rooms.map(room=>{const p=roomLabelPoint(room);return <pointLight key={room.id} position={[p.x,project.wallHeight-.25,p.y]} intensity={clamp(.55*roomArea(room),3,12)} color="#ffd6a3" decay={2}/>;})}
      </>}
      <InteractionQuality high={high}/>
      <CameraRig project={project} top={!cameraLocked&&topView}/>
      {render.walk&&!subject?<WalkRig project={project}/>:<OrbitControls makeDefault target={project.render?.camera?.target??[project.width/2,.05,project.depth/2]} enableRotate={!cameraLocked} enableZoom={!cameraLocked} enablePan={!cameraLocked} enableDamping dampingFactor={.08} minDistance={.4} maxDistance={500} maxPolarAngle={Math.PI*.495}/>}
      <AfterEnvironment><WarmShaders onReady={setWarm} after={<>
        {subject&&<group userData={{renderExclude:true}}><ContactShadows key={JSON.stringify([subject.id,subject.w,subject.d,subject.h,subject.x,subject.y,subject.rotation,ground])} frames={1} position={[center[0],ground+.001,center[2]]} scale={span*2} opacity={.35} blur={2.5} far={span*2}/></group>}
        {/* Registered with the scene content, so exports and captures wait until it is mounted and shown. */}
        <CaptureRig exposure={render.exposure} high={high}/>
      </>}>
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[center[0],subject?ground:-.1,center[2]]} userData={{atelierId:'ground',atelierType:'ground'}}><planeGeometry args={subject?[span*8+50,span*8+50]:[project.width+50,project.depth+50]}/><meshStandardMaterial color={studio?(render.studio??defaultStudio).background:'#ebeae5'} roughness={studio?.85:1}/></mesh>
      {!subject&&<>
      {project.rooms.map(room=><FloorSurface key={room.id} room={room}/>)}
      <group userData={{atelierId:'slab',atelierType:'slab'}}><Box position={[project.width/2,-.065,project.depth/2]} size={[project.width,.10,project.depth]} color="#d4c7b5"/></group>
      {wallsVisible&&project.walls.map(w=><WallModel key={w.id} wall={w} openings={project.openings.filter(o=>o.wallId===w.id)} wallHeight={project.wallHeight} color={project.palette.walls} cutaway={cutaway} selected={selection?.type==='wall'&&selection.id===w.id}/>)}
      </>}
      {(subject?[subject]:project.furniture).map(item=><ObjectModel key={item.id} item={item} elevation={item.module?0:placedElevation(item,project.furniture,project.wallHeight)} wood={project.palette.wood} night={render.lighting==='night'} selected={selection?.type==='furniture'&&selection.id===item.id}/>)}
      {!subject&&project.furniture.filter(item=>!FLOOR_COVER_KINDS.has(item.kind)&&placedElevation(item,project.furniture,project.wallHeight)<=0&&Math.max(0,item.modelElevation??0)<.45).map(item=><FloorContact key={item.id} item={item}/>)}
      </WarmShaders></AfterEnvironment>
    </Canvas>
    <div className="scene-navigation">{render.walk&&!subject?'WASD para caminar · Esc para liberar el cursor':'Arrastra para orbitar · Rueda para acercar · Mayús + clic para editar un material'}</div>
  </div>;
}
