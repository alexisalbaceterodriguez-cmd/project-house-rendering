import { Suspense, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { floors } from '../data/catalog';
import { clamp, wallLength, wallParts } from '../lib/geometry';
import { roomVertices } from '../lib/topology';
import { getModelAsset } from '../lib/assets';
import { useEditor } from '../store';
import type { Furniture, Opening, Project, Wall } from '../types';

function Box({position=[0,0,0],size,color,material='matte',opacity=1}:{position?:[number,number,number];size:[number,number,number];color:string;material?:'matte'|'glass'|'metal';opacity?:number}) {
  return <mesh castShadow={material!=='glass'} receiveShadow position={position}>
    <boxGeometry args={size}/><meshStandardMaterial color={color} roughness={material==='metal'?.28:material==='glass'?.08:.8} metalness={material==='metal'?.7:0} transparent={opacity<1||material==='glass'} opacity={material==='glass'?.38:opacity} depthWrite={material!=='glass'} />
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
  return <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,.021,0]}>
    <shapeGeometry args={[shape]}/>
    <meshStandardMaterial color={finish.color} side={THREE.DoubleSide} roughness={.8}/>
  </mesh>;
}
function WallModel({wall,project,cutaway,selected}:{wall:Wall;project:Project;cutaway:boolean;selected:boolean}){
  const len=wallLength(wall);
  const angle=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);
  const height=cutaway ? .9 : project.wallHeight;
  const openings=project.openings.filter(o=>o.wallId===wall.id);
  const parts=wallParts(wall,openings,height);
  return <group position={[wall.a.x,0,wall.a.y]} rotation={[0,-angle,0]}>
    {parts.map((p,i)=><Box key={i} position={[(p.from+p.to)/2,(p.bottom+p.top)/2,0]} size={[p.to-p.from,p.top-p.bottom,wall.thickness]} color={selected?'#b7cbbe':project.palette.walls}/>)}
    {!cutaway&&openings.map(o=><OpeningModel key={o.id} opening={o} length={len} thickness={wall.thickness}/>)}
  </group>;
}
function OpeningModel({opening:o,length,thickness}:{opening:Opening;length:number;thickness:number}){
  const x=o.offset*length;
  const pale='#d9d8d1';
  return <group position={[x,0,0]}>
    <Box position={[-o.width/2, o.height/2+o.sill,0]} size={[.045,o.height,thickness+.025]} color={pale}/>
    <Box position={[o.width/2, o.height/2+o.sill,0]} size={[.045,o.height,thickness+.025]} color={pale}/>
    <Box position={[0,o.height+o.sill,0]} size={[o.width,.055,thickness+.04]} color={pale}/>
    {o.kind==='window'?<>
      <Box position={[0,o.sill+o.height/2,0]} size={[o.width-.055,o.height-.055,.025]} color="#a8d5df" material="glass"/>
      <Box position={[0,o.sill+o.height/2,0]} size={[.028,o.height,.04]} color="#d1d4d0"/>
    </>:<group position={[-o.width/2+.03,o.sill,0]} rotation={[0,-.25,0]}>
      <Box position={[o.width*.47,o.height*.49,.014]} size={[o.width*.93,o.height*.97,.04]} color="#d4b99a" opacity={.6}/>
      <Box position={[o.width*.82,o.height*.47,.055]} size={[.11,.018,.04]} color="#97938b" material="metal"/>
    </group>}
  </group>;
}
function ImportedModel({url,item}:{url:string;item:Furniture}){
  const {scene}=useGLTF(url);
  const clone=useMemo(()=>{
    // A regular Object3D clone leaves skinned meshes bound to the original skeleton.
    // Clone bones and skin bindings together so animated furniture renders independently.
    const model=cloneSkeleton(scene);
    model.traverse(object=>{
      if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;
        // Never mutate materials held by the cached GLTF scene or another instance.
        if(item.modelFinish){
          const apply=(original:THREE.Material):THREE.Material=>{
            const material=original.clone();
            if(material instanceof THREE.MeshStandardMaterial){
              material.color.set(item.modelFinish!.color);
              material.roughness=item.modelFinish!.roughness;
              material.metalness=item.modelFinish!.metalness;
            }
            return material;
          };
          object.material=Array.isArray(object.material)?object.material.map(apply):apply(object.material);
        }
      }
    });
    // Rotate only this instance's clone. Keep the GLB bytes and cached scene intact.
    if(item.modelUpAxis==='Z')model.rotation.x=-Math.PI/2;
    if(item.modelUpAxis==='X')model.rotation.z=Math.PI/2;
    const oriented=new THREE.Group();oriented.add(model);
    return oriented;
  },[scene,item.modelUpAxis,item.modelFinish]);
  const {size,center}=useMemo(()=>{const bb=new THREE.Box3().setFromObject(clone);const dimensions=bb.getSize(new THREE.Vector3());const center=bb.getCenter(new THREE.Vector3());return{size:dimensions,center};},[clone]);
  return <group position={[item.modelOffsetX??0,item.modelElevation??0,item.modelOffsetZ??0]}><group scale={[item.w/Math.max(size.x,.001),item.h/Math.max(size.y,.001),item.d/Math.max(size.z,.001)]}>
    <primitive object={clone} position={[-center.x, -center.y+size.y/2, -center.z]}/>
  </group></group>;
}
function ModelShape({item}:{item:Furniture}){
  const [url,setUrl]=useState<string|null>(item.modelData??null);
  useEffect(()=>{
    if(item.modelData){setUrl(item.modelData);return;}
    if(!item.assetId){setUrl(null);return;}
    let active=true;let objectURL:string|undefined;
    getModelAsset(item.assetId).then(blob=>{
      if(blob&&active){objectURL=URL.createObjectURL(blob);setUrl(objectURL);}
    }).catch(()=>{if(active)setUrl(null);});
    return ()=>{active=false;if(objectURL)URL.revokeObjectURL(objectURL);};
  },[item.assetId,item.modelData]);
  return url?<Suspense fallback={<Box position={[0,item.h/2,0]} size={[item.w,item.h,item.d]} color="#ddd5c5"/>}><ImportedModel url={url} item={item}/></Suspense>:<Box position={[0,item.h/2,0]} size={[item.w,item.h,item.d]} color="#c3cbbe"/>;
}
function Bed({item}:{item:Furniture}){
  return <><Box position={[0,.20,0]} size={[item.w,.35,item.d]} color="#c0a489"/>
    <Box position={[0,.44,0]} size={[item.w*.94,.16,item.d*.94]} color={item.color}/>
    <Box position={[0,.55,-item.d*.36]} size={[item.w*.8,.13,item.d*.21]} color="#f8f5f0"/>
    <Box position={[0,.65,-item.d*.52]} size={[item.w,.95,.095]} color="#bc9c80"/>
    <Box position={[0,.54,item.d*.17]} size={[item.w*.84,.08,item.d*.40]} color="#c7b4a0"/>
  </>;
}
function FurnitureShape({item,project}:{item:Furniture;project:Project}){
  const {w,d,h}=item;
  const wood=project.palette.wood;
  switch(item.kind){
    case 'bed':case 'single-bed':return <Bed item={item}/>;
    case 'sofa':return <>
      <Box position={[0,.27,0]} size={[w,.48,d]} color={item.color}/>
      <Box position={[0,.60,-d*.37]} size={[w,.58,.19]} color={item.color}/>
      {[-1,1].map(v=><Box key={v} position={[v*(w/2-.14),.48,0]} size={[.24,.45,d]} color="#c4b7a9"/>)}
      <Box position={[0,.55,.13]} size={[w*.69,.10,d*.53]} color="#e4ddd3"/>
    </>;
    case 'table':case 'desk':case 'island':return <>
      <Box position={[0,h-.055,0]} size={[w,.11,d]} color={item.color}/>
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
    case 'lamp':return <><mesh castShadow position={[0,.04,0]}><cylinderGeometry args={[.16,.16,.08,24]}/><meshStandardMaterial color="#7b7871"/></mesh><Box position={[0,h/2,0]} size={[.027,h,.027]} color="#797875" material="metal"/><mesh position={[0,h-.12,0]}><coneGeometry args={[.27,.34,24,1,true]}/><meshStandardMaterial color="#eae0cd" side={THREE.DoubleSide}/></mesh><pointLight position={[0,h-.15,0]} intensity={.13} color="#fff2d3" distance={2}/></>;
    case 'rug':return <Box position={[0,.014,0]} size={[w,.028,d]} color={item.color}/>;
    case 'model':return <ModelShape item={item}/>;
  }
}
function ObjectModel({item,project,selected,onSelect}:{item:Furniture;project:Project;selected:boolean;onSelect:()=>void}){
  return <group position={[item.x,0,item.y]} rotation={[0,-item.rotation*Math.PI/180,0]} onClick={e=>{e.stopPropagation();onSelect();}} onPointerOver={()=>{document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='';}}>
    <FurnitureShape item={item} project={project}/>
    {selected&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><ringGeometry args={[Math.max(item.w,item.d)*.66,Math.max(item.w,item.d)*.68,40]}/><meshBasicMaterial color="#2b9071" side={THREE.DoubleSide}/></mesh>}
  </group>;
}
function CameraRig({project,top}:{project:Project;top:boolean}){
  const {camera}=useThree();
  useEffect(()=>{
    camera.position.set(project.width/2+(top?0:project.width*.65),top?Math.max(project.width,project.depth)*1.9:Math.max(project.width,project.depth)*1.05,project.depth/2+(top?.001:project.depth*1.3));
    camera.lookAt(project.width/2,0,project.depth/2);
    camera.updateProjectionMatrix();
  },[camera,top,project.width,project.depth]);
  return null;
}
export default function Scene3D({canvasRef,topView=false}:{canvasRef:MutableRefObject<HTMLCanvasElement|null>;topView?:boolean}){
  const {project,selection,setSelection,wallsVisible,cutaway}=useEditor();
  return <div className="scene-wrap">
    <div className="scene-topline"><span><span className="live-dot"/> VISTA 3D EN TIEMPO REAL</span><span>Arrastra para orbitar · Rueda para zoom</span></div>
    <Canvas shadows dpr={[1,1.8]} gl={{antialias:true,preserveDrawingBuffer:true}} camera={{position:[11,11,12],fov:42,near:.1,far:250}} onCreated={({gl})=>{canvasRef.current=gl.domElement;}} onPointerMissed={()=>setSelection(null)}>
      <color attach="background" args={['#f4f3ef']}/>
      <ambientLight intensity={.8}/>
      <hemisphereLight intensity={.6} groundColor="#ccc8bd" color="#e7f1ff"/>
      <directionalLight castShadow position={[-5,13,7]} intensity={2.3} shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-.0001}/>
      <CameraRig project={project} top={topView}/>
      <OrbitControls makeDefault target={[project.width/2,.05,project.depth/2]} enableDamping dampingFactor={.08} minDistance={2} maxDistance={50} maxPolarAngle={Math.PI*.495}/>
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[project.width/2,-.1,project.depth/2]}><planeGeometry args={[project.width+50,project.depth+50]}/><meshStandardMaterial color="#ebeae5" roughness={1}/></mesh>
      {project.rooms.map(room=><FloorSurface key={room.id} room={room}/>)}
      <Box position={[project.width/2,-.065,project.depth/2]} size={[project.width,.10,project.depth]} color="#d4c7b5"/>
      {wallsVisible&&project.walls.map(w=><WallModel key={w.id} wall={w} project={project} cutaway={cutaway} selected={selection?.type==='wall'&&selection.id===w.id}/>)}
      {project.furniture.map(item=><ObjectModel key={item.id} item={item} project={project} selected={selection?.type==='furniture'&&selection.id===item.id} onSelect={()=>setSelection({type:'furniture',id:item.id})}/>)}
      <ContactShadows position={[project.width/2,-.009,project.depth/2]} scale={Math.max(project.width,project.depth)*2} opacity={.22} blur={3.5} far={16}/>
    </Canvas>
    <div className="scene-footer"><span className="scene-legend"><span className="legend-square"/> Modelo paramétrico · escala métrica</span><span>WebGL</span></div>
  </div>;
}
