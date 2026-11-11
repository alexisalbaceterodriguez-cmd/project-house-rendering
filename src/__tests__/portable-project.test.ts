import { Buffer } from 'node:buffer';
import { describe,expect,it } from 'vitest';
import { blankProject } from '../data/defaultProject';
import { hydratePortableProject,portableProject } from '../lib/portableProject';
function model(){const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[]}],nodes:[]}));const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),buffer=Buffer.alloc(20+padded.length);buffer.writeUInt32LE(0x46546c67,0);buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(padded.length,12);buffer.writeUInt32LE(0x4e4f534a,16);padded.copy(buffer,20);return new Blob([buffer]);}
function storage(){const blobs=new Map<string,Blob>();return{blobs,get:async(id:string)=>blobs.get(id)??null,put:async(id:string,blob:Blob)=>{blobs.set(id,blob);},delete:async(id:string)=>{blobs.delete(id);},encode:async(blob:Blob)=>'data:model/gltf-binary;base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64')};}
describe('JSON portable sin duplicar bytes de modelos compartidos',()=>{
  it('conserva el formato anterior para un modelo y exporta una sola copia para instancias repetidas',async()=>{
    const p=blankProject(),assets=storage();assets.blobs.set('shared',model());
    p.furniture.push({id:'a',kind:'model',name:'A',x:2,y:2,w:1,d:1,h:1,rotation:0,color:'#ffffff',assetId:'shared'});
    const single=await portableProject(p,assets);expect(single.furniture[0].modelData).toMatch(/^data:/);expect(single.furniture[0].assetId).toBeUndefined();
    p.furniture.push({...p.furniture[0],id:'b',x:4});const portable=await portableProject(p,assets);
    expect(portable.resources).toHaveLength(1);expect(portable.furniture.every(f=>!f.modelData&&f.assetId==='shared')).toBe(true);
    const otherBrowser=storage(),restored=await hydratePortableProject(JSON.parse(JSON.stringify(portable)),otherBrowser);
    expect(otherBrowser.blobs.size).toBe(1);expect(restored.furniture[0].assetId).toBe(restored.furniture[1].assetId);expect(restored.furniture[0].assetId).not.toBe('shared');expect(restored.resources).toBeUndefined();expect(restored.walls).toEqual(p.walls);
  });
  it('revierte todos los recursos si falla un segundo modelo',async()=>{
    const assets=storage(),p=blankProject();assets.blobs.set('a',model());assets.blobs.set('b',model());
    for(const [id,assetId] of [['1','a'],['2','a'],['3','b'],['4','b']])p.furniture.push({id,kind:'model',name:id,x:2,y:2,w:1,d:1,h:1,rotation:0,color:'#ffffff',assetId});
    const portable=await portableProject(p,assets),target=storage();let count=0;const put=target.put;target.put=async(id,blob)=>{if(++count===2)throw new Error('quota');await put(id,blob);};
    await expect(hydratePortableProject(portable,target)).rejects.toThrow('quota');expect(target.blobs.size).toBe(0);
  });
});
