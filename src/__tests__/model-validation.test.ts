import { describe,expect,it } from 'vitest';
import { validateGLB } from '../lib/modelValidation';
function glb(document:unknown){const json=new TextEncoder().encode(JSON.stringify(document)),padded=Math.ceil(json.length/4)*4,buffer=new ArrayBuffer(20+padded),view=new DataView(buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,padded,true);view.setUint32(16,0x4e4f534a,true);const bytes=new Uint8Array(buffer);bytes.fill(32,20);bytes.set(json,20);return new Blob([buffer]);}
describe('GLB autónomos y válidos',()=>{
  it('admite una escena mínima válida sin geometría ni recursos externos',async()=>{await expect(validateGLB(glb({asset:{version:'2.0'},scene:0,scenes:[{nodes:[]}],nodes:[]}))).resolves.toBeUndefined();});
  it('rechaza bytes arbitrarios y ficheros truncados',async()=>{await expect(validateGLB(new Blob(['not a model']))).rejects.toThrow('GLB 2.0 válido');});
  it('rechaza imágenes externas antes de solicitar ninguna URL',async()=>{await expect(validateGLB(glb({asset:{version:'2.0'},images:[{uri:'https://example.invalid/texture.png'}]}))).rejects.toThrow('depende de archivos externos');});
  it('rechaza referencias a buffers no declarados',async()=>{await expect(validateGLB(glb({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,1]}],bufferViews:[{buffer:0,byteLength:36}]}))).rejects.toThrow('no se puede leer');});
});
