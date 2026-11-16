import { describe,expect,it } from 'vitest';
import type { CustomMaterial } from '../types';
import { blankProject } from '../data/defaultProject';
import { embedMaterialMaps, resolveTextureMap, storeMaterialMaps, type LibraryMaterial, type MaterialAccess } from '../lib/materialLibrary';
import { hydratePortableProject, portableProject } from '../lib/portableProject';
import { validCustomMaterials } from '../lib/materialValidation';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const material:CustomMaterial={id:'custom:stone',name:'Piedra propia',category:'Piedra',color:'#ffffff',scale:1,roughness:.7,metalness:0,normalStrength:1,source:'Propio',license:'Creación propia',maps:{color:image,roughness:image}};
function storage(){
  const textures=new Map<string,string>(),definitions=new Map<string,LibraryMaterial>();
  const access:MaterialAccess={get:async id=>textures.get(id)??null,commit:async(images,entries)=>{
    images.forEach((data,id)=>textures.set(id,data));entries.forEach(entry=>definitions.set(entry.key,structuredClone(entry)));
  }};
  return {textures,definitions,access};
}

describe('Biblioteca de materiales portable e inmutable',()=>{
  it('deduplica píxeles, conserva definiciones e incorpora JSON v1 embebido sin modificar el original',async()=>{
    const db=storage(),source=[structuredClone(material),{...material,id:'custom:second',name:'Segunda piedra'}];
    const stored=await storeMaterialMaps(source,db.access);
    expect(db.textures.size).toBe(1);expect(db.definitions.size).toBe(2);
    expect(stored[0].maps?.color).toMatch(/^texture:[a-f0-9]{64}$/);
    expect(stored[0].maps?.color).toBe(stored[1].maps?.roughness);
    expect(source[0].maps?.color).toBe(image);
    expect(await embedMaterialMaps(stored,db.access)).toEqual(source);
    await storeMaterialMaps(stored,db.access);expect(db.textures.size).toBe(1);expect(db.definitions.size).toBe(2);
  });
  it('una definición modificada con el mismo ID no sobrescribe la utilizada por versiones o respaldos',async()=>{
    const db=storage();await storeMaterialMaps([material],db.access);
    await storeMaterialMaps([{...material,color:'#112233'}],db.access);
    expect([...db.definitions.values()].map(entry=>entry.material.color).sort()).toEqual(['#112233','#ffffff']);
    expect(db.textures.size).toBe(1);
  });
  it('rechaza referencias malformadas, URLs y colecciones demasiado grandes; acepta proyectos v1 anteriores',()=>{
    expect(validCustomMaterials([material])).toBe(true);
    expect(validCustomMaterials([{...material,maps:{color:`texture:${'a'.repeat(64)}`}}])).toBe(true);
    for(const value of ['texture:missing',`texture:${'A'.repeat(64)}`,'blob:somewhere','https://example.com/image.jpg'])
      expect(validCustomMaterials([{...material,maps:{normal:value}}])).toBe(false);
    expect(validCustomMaterials(Array.from({length:65},(_,i)=>({...material,id:`custom:${i}`})))).toBe(false);
  });
  it('un fallo de guardado deja intactos el material original y las referencias anteriores',async()=>{
    const db=storage(),previous=await storeMaterialMaps([material],db.access),source=structuredClone(material);
    const denied:MaterialAccess={...db.access,commit:async()=>{throw new Error('quota');}};
    await expect(storeMaterialMaps([{...source,color:'#000000'}],denied)).rejects.toThrow('quota');
    expect(source).toEqual(material);expect(db.definitions.size).toBe(1);
    expect(await embedMaterialMaps(previous,db.access)).toEqual([material]);
  });
  it('detecta píxeles ausentes o sustituidos sin borrar ni alterar la definición',async()=>{
    const db=storage(),stored=await storeMaterialMaps([material],db.access),id=stored[0].maps!.color!;
    db.textures.set(id,'data:image/png;base64,YWJj');
    await expect(resolveTextureMap(id,db.access)).rejects.toThrow('dañado');
    db.textures.delete(id);await expect(embedMaterialMaps(stored,db.access)).rejects.toThrow('Falta un mapa');
    expect(stored[0].maps?.color).toBe(id);expect(db.definitions.size).toBe(1);
    db.textures.set(id,image);expect(await embedMaterialMaps(stored,db.access)).toEqual([material]);
  });
  it('exporta mapas embebidos y los rehidrata en otro navegador preservando geometría y asignaciones',async()=>{
    const first=storage(),second=storage(),project=blankProject();
    project.materials=await storeMaterialMaps([material],first.access);project.walls[0].materialId=material.id;
    const portable=await portableProject(project,undefined,first.access);
    expect(portable.materials).toEqual([material]);expect(project.materials[0].maps?.color).toMatch(/^texture:/);
    const restored=await hydratePortableProject(JSON.parse(JSON.stringify(portable)),undefined,second.access);
    expect(second.textures.size).toBe(1);expect(restored.materials).toEqual(project.materials);
    expect(restored.walls).toEqual(project.walls);expect(restored.rooms).toEqual(project.rooms);
    expect(await portableProject(restored,undefined,second.access)).toEqual(portable);
  });
  it('un JSON con mapas solo locales ausentes no sustituye datos ni crea entradas parciales',async()=>{
    const first=storage(),second=storage(),project=blankProject();project.materials=await storeMaterialMaps([material],first.access);
    await expect(hydratePortableProject(project,undefined,second.access)).rejects.toThrow('Falta un mapa');
    expect(second.textures.size).toBe(0);expect(second.definitions.size).toBe(0);
    await expect(portableProject(project,undefined,second.access)).rejects.toThrow('Falta un mapa');
    expect(await embedMaterialMaps(project.materials,first.access)).toEqual([material]);
  });
});
