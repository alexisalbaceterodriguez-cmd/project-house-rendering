import { createContext, Suspense, useContext, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls, PointerLockControls, SoftShadows, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { floors } from '../data/catalog';
import { clamp, wallLength, wallParts, wallProjection } from '../lib/geometry';
import { roomLabelPoint,roomVertices } from '../lib/topology';
import { getModelAsset } from '../lib/assets';
import { useEditor } from '../store';
import type { Furniture, Opening, Project, Wall } from '../types';
import ErrorBoundary from './ErrorBoundary';
import PbrSurface, { usePbrMaps } from './PbrSurface';
import { registerCapture, registerSceneSource } from '../lib/sceneCapture';
import { defaultStudio, objectCamera, physicalProperties, studioSubject } from '../lib/studioRender';
import { textureMapsPending, useTextureLibraryRevision } from '../lib/textureCache';
import { heightToNormal, surfaceMaps, type SurfaceKind } from '../lib/surfaceTextures';
const SurfaceContext=createContext<string|undefined>(undefined);
function textureProps(kind:SurfaceKind){const {map,normalMap,roughnessMap,metalnessMap}=surfaceMaps(kind);return {map,normalMap,roughnessMap,metalnessMap};}

// `role` names the material (atelier:<role>) so the Cycles engine can recognise
// window glass or door leaves after the scene is exported to glTF.
// `surface` adds metre-scaled image maps (textile weave, wood grain) that also travel in the render GLB.
function Box({position=[0,0,0],size,color,material='matte',opacity=1,finishId,role,surface}:{position?:[number,number,number];size:[number,number,number];color:string;material?:'matte'|'glass'|'metal';opacity?:number;finishId?:string;role?:string;surface?:Extract<SurfaceKind,'textile'|'woodgrain'>}) {
  const inherited=useContext(SurfaceContext);const id=finishId??inherited;
  const high=useEditor(state=>state.project.render?.quality==='high');
  const geometry=useMemo(()=>{
    const g=new THREE.BoxGeometry(...size);const uv=g.attributes.uv,normal=g.attributes.normal,pos=g.attributes.position;
    for(let i=0;i<uv.count;i++){
      if(Math.abs(normal.getY(i))>.5)uv.setXY(i,pos.getX(i),pos.getZ(i));
      else if(Math.abs(normal.getX(i))>.5)uv.setXY(i,pos.getZ(i),pos.getY(i));
      else uv.setXY(i,pos.getX(i),pos.getY(i));
    }return g;
  },[...size]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh castShadow={material!=='glass'} receiveShadow position={position}>
    <primitive object={geometry} attach="geometry"/>{id&&material==='matte'&&opacity===1?<Suspense fallback={<meshStandardMaterial color={color}/>}><PbrSurface id={id} color={color}/></Suspense>:material==='glass'?<meshPhysicalMaterial name="atelier:glass" color={color} roughness={.08} {...physicalProperties({finish:'glass',color},high)} thickness={Math.min(...size)}/>:surface&&material==='matte'&&opacity===1?<meshStandardMaterial name={`atelier:${surface}`} color={color} roughness={1} metalness={0} {...textureProps(surface)}/>:<meshStandardMaterial name={role?`atelier:${role}`:undefined} color={color} roughness={material==='metal'?.28:.8} metalness={material==='metal'?.7:0} transparent={opacity<1} opacity={opacity}/>}
  </mesh>;
}
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
function WallModel({wall,project,cutaway,selected}:{wall:Wall;project:Project;cutaway:boolean;selected:boolean}){
  const len=wallLength(wall);
  const angle=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);
  const height=cutaway ? .9 : project.wallHeight;
  const openings=project.openings.filter(o=>o.wallId===wall.id);
  const parts=wallParts(wall,openings,height);
  return <group position={[wall.a.x,0,wall.a.y]} rotation={[0,-angle,0]} userData={{atelierId:wall.id,atelierType:'wall'}}>
    {parts.map((p,i)=><group key={i}><Box position={[(p.from+p.to)/2,(p.bottom+p.top)/2,0]} size={[p.to-p.from,p.top-p.bottom,wall.thickness]} finishId={wall.materialId} color={project.palette.walls}/>{selected&&<mesh userData={{editorOverlay:true}} position={[(p.from+p.to)/2,(p.bottom+p.top)/2,0]}><boxGeometry args={[p.to-p.from+.005,p.top-p.bottom+.005,wall.thickness+.005]}/><meshBasicMaterial color="#2b9071" wireframe/></mesh>}</group>)}
    {!cutaway&&openings.map(o=><OpeningModel key={o.id} opening={o} length={len} thickness={wall.thickness}/>)}
  </group>;
}
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
  const {change,setSelection}=useEditor();
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
function ModelShape({item,selected}:{item:Furniture;selected:boolean}){
  const [url,setUrl]=useState<string|null>(item.modelData??null);
  useEffect(()=>{
    if(item.modelData){setUrl(item.modelData);return;}
    if(!item.assetId){setUrl(null);return;}
    setUrl(null);
    let active=true;let objectURL:string|undefined;
    getModelAsset(item.assetId).then(blob=>{
      if(blob&&active){objectURL=URL.createObjectURL(blob);setUrl(objectURL);}
    }).catch(()=>{if(active)setUrl(null);});
    return ()=>{active=false;if(objectURL)URL.revokeObjectURL(objectURL);};
  },[item.assetId,item.modelData]);
  const fallback=<group><Box position={[0,item.h/2,0]} size={[item.w,item.h,item.d]} color="#d2b7a4"/><Html center position={[0,item.h+.15,0]}><span className="model-unavailable">{item.name}: modelo no disponible</span></Html></group>;
  return url?<ErrorBoundary key={url} fallback={fallback}><Suspense fallback={<Box position={[0,item.h/2,0]} size={[item.w,item.h,item.d]} color="#ddd5c5"/>}><ImportedModel url={url} item={item} selected={selected}/></Suspense></ErrorBoundary>:fallback;
}
function ModuleModel({item}:{item:Furniture}){
  const m=item.module!;const elevation=m.family==='wall'?1.45:0;
  return <group position={[0,elevation,0]}>
    <Box position={[0,item.h/2,0]} size={[item.w,item.h,item.d]} color="#ece7dd"/>
    <Box position={[0,item.h/2,item.d/2+.012]} size={[item.w-.025,item.h-.035,.025]} color={m.front}/>
    {m.handles==='bar'&&<Box position={[item.w*.28,item.h*.7,item.d/2+.04]} size={[.14,.018,.025]} color="#68665f" material="metal"/>}
    {m.family!=='wall'&&m.family!=='column'&&<Box position={[0,item.h+.018,0]} size={[item.w+.025,.036,item.d+.04]} color="#c4c0b6" finishId={m.worktop}/>}
    {(m.family==='sink'||m.family==='vanity')&&<><Box position={[0,item.h+.04,0]} size={[item.w*.65,.025,item.d*.55]} color="#b4b9b5" material="metal"/><Box position={[0,item.h+.16,-item.d*.3]} size={[.025,.27,.025]} color="#878d8a" material="metal"/></>}
    {m.family==='hob'&&<Box position={[0,item.h+.045,0]} size={[item.w*.8,.02,item.d*.7]} color="#272a29"/>}
    {m.family==='oven'&&<Box position={[0,item.h*.5,item.d/2+.035]} size={[item.w*.8,item.h*.65,.025]} color="#343a39"/>}
  </group>;
}
function Bed({item}:{item:Furniture}){
  return <><Box position={[0,.20,0]} size={[item.w,.35,item.d]} color="#c0a489"/>
    <Box position={[0,.44,0]} size={[item.w*.94,.16,item.d*.94]} color={item.color} surface="textile"/>
    <Box position={[0,.55,-item.d*.36]} size={[item.w*.8,.13,item.d*.21]} color="#f8f5f0" surface="textile"/>
    <Box position={[0,.65,-item.d*.52]} size={[item.w,.95,.095]} color="#bc9c80"/>
    <Box position={[0,.54,item.d*.17]} size={[item.w*.84,.08,item.d*.40]} color="#c7b4a0" surface="textile"/>
  </>;
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
function FurnitureShape({item,project,selected}:{item:Furniture;project:Project;selected:boolean}){
  if(item.module)return <ModuleModel item={item}/>;
  const {w,d,h}=item;
  const wood=project.palette.wood;
  switch(item.kind){
    case 'bed':case 'single-bed':return <Bed item={item}/>;
    case 'sofa':return <>
      <Box position={[0,.27,0]} size={[w,.48,d]} color={item.color} surface="textile"/>
      <Box position={[0,.60,-d*.37]} size={[w,.58,.19]} color={item.color} surface="textile"/>
      {[-1,1].map(v=><Box key={v} position={[v*(w/2-.14),.48,0]} size={[.24,.45,d]} color="#c4b7a9" surface="textile"/>)}
      <Box position={[0,.55,.13]} size={[w*.69,.10,d*.53]} color="#e4ddd3" surface="textile"/>
    </>;
    case 'table':case 'desk':case 'island':return <>
      <Box position={[0,h-.055,0]} size={[w,.11,d]} color={item.color} surface="woodgrain"/>
      {[-1,1].flatMap(x=>[-1,1].map(z=><Box key={`${x}-${z}`} position={[x*(w/2-.13),h/2-.03,z*(d/2-.12)]} size={[.075,h-.1,.075]} color={wood}/>))}
      {item.kind==='island'&&<Box position={[0,h*.48,0]} size={[w*.9,h*.72,d*.75]} color="#e5e0d8"/>}
    </>;
    case 'chair':return <><Box position={[0,.45,0]} size={[w,.08,d]} color={item.color}/><Box position={[0,.70,-d*.43]} size={[w,.52,.08]} color={item.color}/>{[-1,1].flatMap(x=>[-1,1].map(z=><Box key={`${x}-${z}`} position={[x*w*.37,.22,z*d*.36]} size={[.045,.44,.045]} color={wood}/>))}</>;
    case 'wardrobe':return <><Box position={[0,h/2,0]} size={[w,h,d]} color={item.color}/><Box position={[0,h/2,d/2+.003]} size={[.016,h*.94,.008]} color="#b1aa9f"/><Box position={[-.08,h/2,d/2+.016]} size={[.018,.19,.018]} color="#a59b8e" material="metal"/><Box position={[.08,h/2,d/2+.016]} size={[.018,.19,.018]} color="#a59b8e" material="metal"/></>;
    case 'kitchen':return <><Box position={[0,h/2,0]} size={[w,h,d]} color={item.color}/><Box position={[0,h-.025,0]} size={[w+.03,.05,d+.035]} color="#b2aa9e"/><Box position={[0,h*.45,d/2+.004]} size={[.02,h*.83,.015]} color="#c9c3b7"/>
      <Box position={[-w*.24,h+.006,0]} size={[.55,.012,.37]} color="#3b3c3c"/>
      <Box position={[w*.24,h+.005,0]} size={[.48,.012,.33]} color="#9da6a4"/>
    </>;
    case 'fridge':return <><Box position={[0,h/2,0]} size={[w,h,d]} color={item.color}/><Box position={[0,h*.47,d/2+.01]} size={[w*.88,.016,.012]} color="#acb1ad"/><Box position={[w*.34,h*.72,d/2+.018]} size={[.024,.18,.02]} color="#8d9390" material="metal"/></>;
    case 'sink':return <><Box position={[0,h/2,0]} size={[w,h,d]} color={wood}/><Box position={[0,h+.02,0]} size={[w,.06,d]} color="#eeeae4"/><mesh position={[0,h+.05,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[Math.min(w,d)*.3,28]}/><meshStandardMaterial color="#d2d6d3"/></mesh><Box position={[0,h+.12,-d*.25]} size={[.02,.16,.02]} color="#8b9898" material="metal"/></>;
    case 'toilet':return <><Box position={[0,.27,-d*.29]} size={[w,.5,d*.27]} color="#f5f5f2"/><mesh castShadow position={[0,.42,d*.10]}><cylinderGeometry args={[w*.42,w*.36,.13,24]}/><meshStandardMaterial color="#f6f6f4"/></mesh><mesh position={[0,.50,d*.10]}><torusGeometry args={[w*.3,.045,9,25]}/><meshStandardMaterial color="#f8f8f5"/></mesh></>;
    case 'shower':return <><Box position={[0,.04,0]} size={[w,.08,d]} color="#f0f0ee"/><Box position={[w/2,.99,0]} size={[.018,1.95,d]} color="#b3d5db" material="glass"/><Box position={[0,.99,d/2]} size={[w,1.95,.018]} color="#b3d5db" material="glass"/><Box position={[-w*.35,1.1,-d*.35]} size={[.04,2.08,.04]} color="#8d9696" material="metal"/><mesh position={[-w*.32,2.08,-d*.35]}><cylinderGeometry args={[.13,.13,.025,24]}/><meshStandardMaterial color="#a1a5a2" metalness={.7}/></mesh></>;
    case 'plant':return <><mesh castShadow position={[0,.24,0]}><cylinderGeometry args={[w*.27,w*.2,.48,12]}/><meshStandardMaterial color="#b7a185"/></mesh>{[[0,.75,0],[.12,.98,.12],[-.13,.95,-.08],[0,1.2,.02]].map((p,i)=><mesh key={i} position={p as [number,number,number]}><sphereGeometry args={[.23,9,7]}/><meshStandardMaterial color={i%2?'#4f8060':'#6d9875'}/></mesh>)}</>;
    case 'lamp':return <><mesh castShadow position={[0,.04,0]}><cylinderGeometry args={[.16,.16,.08,24]}/><meshStandardMaterial color="#7b7871"/></mesh><Box position={[0,h/2,0]} size={[.027,h,.027]} color="#797875" material="metal"/><mesh position={[0,h-.12,0]}><coneGeometry args={[.27,.34,24,1,true]}/><meshStandardMaterial name="atelier:lampshade" color="#eae0cd" side={THREE.DoubleSide}/></mesh><pointLight position={[0,h-.15,0]} intensity={.13} color="#fff2d3" distance={2}/></>;
    case 'rug':return item.materialId?<Box position={[0,.014,0]} size={[w,.028,d]} color={item.color}/>:<WovenRug item={item}/>;
    case 'model':return <ModelShape item={item} selected={selected}/>;
  }
}
function ObjectModel({item,project,selected,onSelect}:{item:Furniture;project:Project;selected:boolean;onSelect:()=>void}){
  return <group position={[item.x,0,item.y]} rotation={[0,-item.rotation*Math.PI/180,0]} userData={{atelierId:item.id,atelierType:'furniture',atelierKind:item.kind}} onClick={e=>{e.stopPropagation();onSelect();}} onPointerOver={()=>{document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='';}}>
    <SurfaceContext.Provider value={item.materialId}><FurnitureShape item={item} project={project} selected={selected}/></SurfaceContext.Provider>
    {selected&&<mesh userData={{editorOverlay:true}} rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><ringGeometry args={[Math.max(item.w,item.d)*.66,Math.max(item.w,item.d)*.68,40]}/><meshBasicMaterial color="#2b9071" side={THREE.DoubleSide}/></mesh>}
  </group>;
}
// Approximate near-floor occlusion from the placed footprint. Unlike a projected
// key-light shadow it stays under the furniture as the studio light rotates.
function FloorContact({item}:{item:Furniture}){
  const lift=Math.max(0,item.modelElevation??0);
  if(item.kind==='rug'||item.module?.family==='wall'||lift>=.45)return null;
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
}
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
function CaptureRig({exposure,high}:{exposure:number;high:boolean}){
  const {gl,scene,camera,invalidate}=useThree();
  useEffect(()=>{gl.toneMappingExposure=exposure;gl.transmissionResolutionScale=high?1:.25;invalidate();},[gl,exposure,high,invalidate]);
  useEffect(()=>{
    const unregister=registerCapture(gl.domElement,async(width,height)=>{
      const project=useEditor.getState().project;
      const references=(project.materials??[]).flatMap(material=>Object.values(material.maps??{}));
      // Model loads can start after the DOM reports idle. Let pending React/loader work
      // settle for two frames, reading live progress rather than a render's stale value.
      const deadline=performance.now()+10_000;let settled=0;
      while(settled<2){
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        if(useEditor.getState().project!==project)throw new Error('El proyecto cambió mientras se preparaba la imagen. Vuelve a exportar.');
        if(performance.now()>deadline)throw new Error('Espera a que terminen de cargar los modelos y texturas antes de exportar.');
        settled=useProgress.getState().active||textureMapsPending(references)?0:settled+1;
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
    <ErrorBoundary fallback={null}><Suspense fallback={null}><Environment files={`${import.meta.env.BASE_URL}environment/studio.hdr`} environmentIntensity={.45}/></Suspense></ErrorBoundary>
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
export default function Scene3D({canvasRef,topView=false}:{canvasRef:MutableRefObject<HTMLCanvasElement|null>;topView?:boolean}){
  useTextureLibraryRevision();
  const {project,selection,setSelection,wallsVisible,cutaway,cameraLocked}=useEditor();
  const {active}=useProgress();
  const render=project.render??{lighting:'day',exposure:1,quality:'draft'};const high=render.quality==='high';
  const studio=render.lighting==='studio',subject=studioSubject(project);
  const center=subject?objectCamera(subject).target:[project.width/2,0,project.depth/2];
  const span=subject?Math.max(subject.w,subject.d,subject.h,2):Math.max(project.width,project.depth);
  const ground=subject?(subject.modelElevation??0)-.012:-.009;
  return <div className="scene-wrap" aria-busy={active||textureMapsPending((project.materials??[]).flatMap(material=>Object.values(material.maps??{})))}>
    <div className="scene-title"><span>{subject?'Estudio de producto':'Perspectiva 3D'}</span><strong>{subject?.name??project.name}</strong></div>
    <Canvas frameloop="demand" shadows dpr={high?[1,2]:[1,1.3]} gl={{antialias:true,preserveDrawingBuffer:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:render.exposure}} camera={{position:[11,11,12],fov:42,near:.1,far:1000}} onCreated={({gl})=>{canvasRef.current=gl.domElement;}} onPointerMissed={()=>setSelection(null)}>
      <color attach="background" args={[studio?(render.studio??defaultStudio).background:'#f4f3ef']}/>
      {studio?<StudioLights project={project} subject={subject} high={high}/>:<>
      <ambientLight intensity={render.lighting==='night'?.12:.65}/>
      <hemisphereLight intensity={render.lighting==='night'?.18:.6} groundColor="#ccc8bd" color="#e7f1ff"/>
      <directionalLight castShadow position={[-5,13,7]} intensity={render.lighting==='night'?.2:2.3} color={render.lighting==='night'?'#a8bfff':'#fff5e8'} shadow-mapSize-width={high?2048:1024} shadow-mapSize-height={high?2048:1024} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-.0001}/>
      {render.lighting==='night'&&<pointLight position={[project.width/2,2.3,project.depth/2]} intensity={35} color="#ffd6a3" decay={2}/>}
      </>}
      <CaptureRig exposure={render.exposure} high={high}/>
      <CameraRig project={project} top={!cameraLocked&&topView}/>
      {render.walk&&!subject?<WalkRig project={project}/>:<OrbitControls makeDefault target={project.render?.camera?.target??[project.width/2,.05,project.depth/2]} enableRotate={!cameraLocked} enableZoom={!cameraLocked} enablePan={!cameraLocked} enableDamping dampingFactor={.08} minDistance={.4} maxDistance={500} maxPolarAngle={Math.PI*.495}/>}
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[center[0],subject?ground:-.1,center[2]]} userData={{atelierId:'ground',atelierType:'ground'}}><planeGeometry args={subject?[span*8+50,span*8+50]:[project.width+50,project.depth+50]}/><meshStandardMaterial color={studio?(render.studio??defaultStudio).background:'#ebeae5'} roughness={studio?.85:1}/></mesh>
      {!subject&&<>
      {project.rooms.map(room=><FloorSurface key={room.id} room={room}/>)}
      <group userData={{atelierId:'slab',atelierType:'slab'}}><Box position={[project.width/2,-.065,project.depth/2]} size={[project.width,.10,project.depth]} color="#d4c7b5"/></group>
      {wallsVisible&&project.walls.map(w=><WallModel key={w.id} wall={w} project={project} cutaway={cutaway} selected={selection?.type==='wall'&&selection.id===w.id}/>)}
      </>}
      {(subject?[subject]:project.furniture).map(item=><ObjectModel key={item.id} item={item} project={project} selected={selection?.type==='furniture'&&selection.id===item.id} onSelect={()=>setSelection({type:'furniture',id:item.id})}/>)}
      {subject?<group userData={{renderExclude:true}}><ContactShadows key={JSON.stringify([subject.id,subject.w,subject.d,subject.h,subject.x,subject.y,subject.rotation,ground])} frames={1} position={[center[0],ground+.001,center[2]]} scale={span*2} opacity={.35} blur={2.5} far={span*2}/></group>
        :project.furniture.map(item=><FloorContact key={item.id} item={item}/>)}

    </Canvas>
    <div className="scene-navigation">{render.walk&&!subject?'WASD para caminar · Esc para liberar el cursor':'Arrastra para orbitar · Rueda para acercar · Mayús + clic para editar un material'}</div>
  </div>;
}
