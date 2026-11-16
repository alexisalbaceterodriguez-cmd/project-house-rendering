import { useEffect, useState, Suspense } from 'react';
import type { CustomMaterial } from '../types';
import { useEditor } from '../store';
import { isMaterialImage } from '../lib/materialValidation';
import { storeMaterialMaps } from '../lib/materialLibrary';
import { readTextureMap, retryTextureMaps, textureMapErrors, useTextureLibraryRevision } from '../lib/textureCache';

function Preview({material}:{material:CustomMaterial}){
  useTextureLibraryRevision();
  const url=material.maps?.color?readTextureMap(material.maps.color):undefined;
  return url?<img src={url} alt={material.name}/>:<div className="material-swatch" style={{background:material.color}}/>;
}
export function MaterialPreview({material}:{material:CustomMaterial}){
  return <Suspense fallback={<div className="material-swatch" style={{background:material.color}}/>}><Preview material={material}/></Suspense>;
}
/** Migrate legacy embedded maps only after durable storage; never replace a material edited while waiting. */
export default function MaterialStorage(){
  const materials=useEditor(state=>state.project.materials),projectId=useEditor(state=>state.project.id);
  const [migrationError,setMigrationError]=useState(''),[attempt,setAttempt]=useState(0);
  useTextureLibraryRevision();
  useEffect(()=>{
    setMigrationError('');
    if(!materials?.some(material=>Object.values(material.maps??{}).some(isMaterialImage)))return;
    let active=true;
    storeMaterialMaps(materials).then(converted=>{
      if(!active||useEditor.getState().project.id!==projectId)return;
      const replacements=new Map(materials.map((material,index)=>[JSON.stringify(material),converted[index]]));
      const current=useEditor.getState();
      if(!current.project.materials?.some(material=>replacements.has(JSON.stringify(material))))return;
      current.change(project=>{project.materials=project.materials?.map(material=>replacements.get(JSON.stringify(material))??material);},false);
    }).catch(error=>{if(active)setMigrationError(`${error instanceof Error?error.message:'No se pudo guardar la biblioteca.'} Los mapas embebidos siguen activos; puedes exportar JSON y reintentar.`);});
    return()=>{active=false;};
  },[materials,projectId,attempt]);
  const references=(materials??[]).flatMap(material=>Object.values(material.maps??{}));
  const errors=[migrationError,...textureMapErrors(references)].filter(Boolean);
  return errors.length?<div className="material-storage-notice" role="alert"><span>{errors.join(' ')}</span><button onClick={()=>{retryTextureMaps();setAttempt(value=>value+1);}}>Reintentar mapas</button></div>:null;
}
