import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { resolveMaterial } from '../lib/projectMaterials';
import { useEditor } from '../store';
import ErrorBoundary from './ErrorBoundary';

/** Cached pixels, separate texture transforms and physical properties per assignment. */
export function usePbrMaps(ids:(string|undefined)[]){
  const materials=useEditor(state=>state.project.materials);
  const entries=[...new Set(ids.filter((id):id is string=>!!id))].sort()
    .map(id=>resolveMaterial({materials},id)).filter(entry=>entry!==undefined);
  const slots=entries.flatMap(entry=>(['color','normal','roughness'] as const)
    .flatMap(map=>entry.maps?.[map]?[{id:entry.id,map,url:entry.maps[map]!}]:[]));
  const key=JSON.stringify(entries);
  const originals=useTexture(slots.map(slot=>slot.url));
  const maps=useMemo(()=>{
    const result=new Map<string,{
      map:THREE.Texture|null;normalMap:THREE.Texture|null;roughnessMap:THREE.Texture|null;
      color:THREE.Color;roughness:number;metalness:number;normalScale:THREE.Vector2;
    }>();
    for(const entry of entries)result.set(entry.id,{
      map:null,normalMap:null,roughnessMap:null,color:new THREE.Color(entry.color),
      roughness:entry.roughness,metalness:entry.metalness,normalScale:new THREE.Vector2(entry.normalStrength,entry.normalStrength),
    });
    slots.forEach((slot,index)=>{
      const entry=entries.find(entry=>entry.id===slot.id)!;
      const texture=originals[index].clone();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(1/entry.scale,1/entry.scale);
      texture.colorSpace=slot.map==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.needsUpdate=true;
      result.get(slot.id)![slot.map==='color'?'map':slot.map==='normal'?'normalMap':'roughnessMap']=texture;
    });return result;
  // Cached sources and material parameters are identified by key, including edited maps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  useEffect(()=>()=>{for(const set of maps.values())for(const texture of [set.map,set.normalMap,set.roughnessMap])texture?.dispose();},[maps]);
  return maps;
}
function MaterialSurface({id,color='#ffffff'}:{id?:string;color?:string}){
  const maps=usePbrMaps([id]);
  return <meshStandardMaterial color={color} roughness={.8} metalness={0} side={THREE.DoubleSide} {...(id?maps.get(id):{})}/>;
}
export default function PbrSurface({id,color='#ffffff'}:{id?:string;color?:string}){
  return <ErrorBoundary key={id} fallback={<meshStandardMaterial color={color} roughness={.8} side={THREE.DoubleSide}/>}><MaterialSurface id={id} color={color}/></ErrorBoundary>;
}
