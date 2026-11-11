import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { materialCatalog, materialUrl } from '../data/materialCatalog';

/** Cached image sources, independent texture transforms for every assigned surface. */
export function usePbrMaps(ids:(string|undefined)[]){
  const unique=[...new Set(ids.filter((id):id is string=>!!id&&materialCatalog.some(m=>m.id===id)))].sort();
  const key=unique.join('|');
  const originals=useTexture(unique.flatMap(id=>{
    const entry=materialCatalog.find(m=>m.id===id)!;return [materialUrl(entry,'color'),materialUrl(entry,'normal'),materialUrl(entry,'roughness')];
  }));
  const maps=useMemo(()=>{
    const result=new Map<string,{map:THREE.Texture;normalMap:THREE.Texture;roughnessMap:THREE.Texture}>();
    unique.forEach((id,index)=>{
      const entry=materialCatalog.find(m=>m.id===id)!;
      const textures=originals.slice(index*3,index*3+3).map((source,i)=>{
        const texture=source.clone();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.repeat.set(1/entry.scale,1/entry.scale);texture.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;
        texture.needsUpdate=true;return texture;
      });
      result.set(id,{map:textures[0],normalMap:textures[1],roughnessMap:textures[2]});
    });return result;
  // useTexture returns cached entries; key identifies the ordered texture list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  useEffect(()=>()=>{for(const set of maps.values())Object.values(set).forEach(t=>t.dispose());},[maps]);
  return maps;
}
export default function PbrSurface({id,color='#ffffff'}:{id?:string;color?:string}){
  const maps=usePbrMaps([id]);const entry=materialCatalog.find(m=>m.id===id);
  return <meshStandardMaterial color={entry?'#ffffff':color} roughness={entry?.roughness??.8} metalness={entry?.metalness??0} side={THREE.DoubleSide} {...(id?maps.get(id):{})}/>;
}
