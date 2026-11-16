import { describe,expect,it } from 'vitest';
import * as THREE from 'three';
import { blankProject } from '../data/defaultProject';
import type { CustomMaterial } from '../types';
import { isProject } from '../lib/validation';
import { assignMaterial, validCustomMaterials } from '../lib/projectMaterials';
import { applyAppearance } from '../lib/designVariants';
import { buildWorkshopObject,disposeWorkshopObject,objectTemplates } from '../lib/workshopObjects';

const material:CustomMaterial={id:'custom:sample',name:'Latón cepillado',category:'Metal',color:'#bc995b',roughness:.3,metalness:.9,scale:.5,normalStrength:.7,source:'Propio',license:'Creación propia'};

describe('Recursos propios y persistencia',()=>{
  it('conserva materiales y mapas en JSON v1; rechaza duplicados, valores no finitos y URLs externas',()=>{
    const project=blankProject();project.materials=[structuredClone(material)];
    expect(isProject(JSON.parse(JSON.stringify(project)))).toBe(true);
    expect(isProject(blankProject())).toBe(true);
    expect(validCustomMaterials([material,material])).toBe(false);
    expect(validCustomMaterials([{...material,normalStrength:NaN}])).toBe(false);
    expect(validCustomMaterials([{...material,maps:{color:'https://example.com/track.png'}}])).toBe(false);
    expect(validCustomMaterials([{...material,maps:{color:'data:image/svg+xml;base64,PHN2Zz4='}}])).toBe(false);
  });
  it('aplica un acabado solo al objeto y superficie elegidos, manteniendo las demás capas',()=>{
    const project=blankProject();project.materials=[material];
    project.furniture=[1,2].map(index=>({id:`item${index}`,name:'Modelo',kind:'model',x:2,y:2,w:1,d:1,h:1,rotation:0,color:'#ffffff',
      modelFinish:{color:'#ffffff',roughness:.8,metalness:0,materialName:'@mesh:0:slot:0'},
      modelFinishes:[{color:'#aabbcc',roughness:.5,metalness:0,materialName:'@mesh:1:slot:0'}]}));
    const other=structuredClone(project.furniture[1]),walls=structuredClone(project.walls);
    assignMaterial(project,material.id,'selection',{type:'furniture',id:'item1'});
    expect(project.furniture[0].modelFinish).toMatchObject({materialId:material.id,materialName:'@mesh:0:slot:0',roughness:.3,metalness:.9});
    expect(project.furniture[0].modelFinishes).toEqual(other.modelFinishes);
    expect(project.furniture[1]).toEqual(other);expect(project.walls).toEqual(walls);
    expect(()=>assignMaterial(project,material.id,'selection',{type:'opening',id:'door'})).toThrow('Selecciona');
  });
  it('comparar A/B lleva las definiciones propias sin cambiar cámara ni arquitectura',()=>{
    const base=blankProject(),variant=structuredClone(base);variant.materials=[material];variant.walls[0].materialId=material.id;
    const result=applyAppearance(base,variant);
    expect(result.materials).toEqual([material]);expect(result.walls[0].materialId).toBe(material.id);
    expect(base.materials).toBeUndefined();expect(result.render).toEqual(base.render);
    result.materials![0].color='#000000';expect(variant.materials[0].color).toBe(material.color);
  });
});

describe('Geometría original a escala',()=>{
  it.each(Object.values(objectTemplates))('$family conserva dimensiones, base y materiales editables',recipe=>{
    const object=buildWorkshopObject(recipe);
    try {
      const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(recipe.w,5);expect(size.z).toBeCloseTo(recipe.d,5);expect(size.y).toBeCloseTo(recipe.h,5);
      expect(bounds.min.y).toBeCloseTo(0,5);
      const names=new Set<string>();let pieces=0;
      object.traverse(node=>{if(node instanceof THREE.Mesh){pieces++;const position=node.geometry.attributes.position;expect(Array.from(position.array).every(Number.isFinite)).toBe(true);for(const material of Array.isArray(node.material)?node.material:[node.material])names.add(material.name);}});
      expect(pieces).toBeGreaterThan(4);expect(names.size).toBeGreaterThanOrEqual(2);
    } finally {disposeWorkshopObject(object);}
  });
  it('rechaza recetas inválidas antes de generar geometría',()=>{
    expect(()=>buildWorkshopObject({...objectTemplates.table,w:Infinity})).toThrow('medidas');
    expect(()=>buildWorkshopObject({...objectTemplates.lamp,h:-1})).toThrow('medidas');
  });
});
