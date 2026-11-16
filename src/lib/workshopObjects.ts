import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createMaterialMaps } from './proceduralTextures';

export type ObjectRecipe={family:'sofa'|'sideboard'|'table'|'lamp';name:string;w:number;d:number;h:number;color:string;accent:string};
export const objectTemplates:Record<ObjectRecipe['family'],ObjectRecipe>={
  sofa:{family:'sofa',name:'Sofá de autor',w:2.3,d:.95,h:.82,color:'#c8b99f',accent:'#64452f'},
  sideboard:{family:'sideboard',name:'Aparador acanalado',w:1.8,d:.45,h:.8,color:'#8e6140',accent:'#b49a60'},
  table:{family:'table',name:'Mesa de comedor',w:1.8,d:.9,h:.75,color:'#b58a5e',accent:'#333431'},
  lamp:{family:'lamp',name:'Lámpara escultórica',w:.5,d:.5,h:1.5,color:'#e3d7c0',accent:'#aa8a4f'},
};
function validateRecipe(recipe:ObjectRecipe) {
  if(!Object.keys(objectTemplates).includes(recipe.family)||!recipe.name.trim()||recipe.name.length>180
    ||![recipe.w,recipe.d,recipe.h].every(value=>Number.isFinite(value)&&value>=.2&&value<=6)
    ||![recipe.color,recipe.accent].every(value=>/^#[a-fA-F0-9]{6}$/.test(value)))throw new Error('Indica un nombre, colores válidos y medidas entre 0,2 y 6 m.');
}

/** Original geometry in metres. Named materials remain editable as separate GLB parts. */
export function buildWorkshopObject(recipe:ObjectRecipe):THREE.Group {
  validateRecipe(recipe);
  const group=new THREE.Group();group.name=recipe.name;
  const wood=new THREE.MeshPhysicalMaterial({name:'Madera',color:recipe.family==='sofa'?recipe.accent:recipe.color,roughness:.48,clearcoat:.2,clearcoatRoughness:.35});
  const fabric=new THREE.MeshPhysicalMaterial({name:'Tapizado',color:recipe.color,roughness:.92,sheen:.65,sheenColor:new THREE.Color(recipe.color),sheenRoughness:.9});
  const metal=new THREE.MeshStandardMaterial({name:'Metal',color:recipe.accent,roughness:.25,metalness:.85});
  const ceramic=new THREE.MeshPhysicalMaterial({name:'Cerámica',color:recipe.color,roughness:.35,clearcoat:.3});
  const add=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,position:[number,number,number])=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  const box=(name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material,radius=.012)=>{
    const geometry=new RoundedBoxGeometry(...size,3,Math.min(radius,...size.map(value=>value*.45)));
    // Project physical UVs, preserving repeat size across objects of different dimensions.
    const uv=geometry.attributes.uv,pos=geometry.attributes.position,normal=geometry.attributes.normal;
    for(let i=0;i<uv.count;i++){
      const n=[Math.abs(normal.getX(i)),Math.abs(normal.getY(i)),Math.abs(normal.getZ(i))];
      if(n[1]>=n[0]&&n[1]>=n[2])uv.setXY(i,pos.getX(i),pos.getZ(i));
      else if(n[0]>=n[2])uv.setXY(i,pos.getZ(i),pos.getY(i));
      else uv.setXY(i,pos.getX(i),pos.getY(i));
    }
    return add(name,geometry,material,position);
  };
  const cylinder=(name:string,radius:number,height:number,position:[number,number,number],material:THREE.Material)=>add(name,new THREE.CylinderGeometry(radius,radius,height,24),material,position);
  const {w,d,h}=recipe;
  if(recipe.family==='sofa') {
    const leg=h*.13,seat=h*.38,arm=Math.min(w*.09,.18),back=d*.17;
    for(const x of [-1,1])for(const z of [-1,1])cylinder(`Pata ${x} ${z}`,Math.min(w,d)*.028,leg,[x*(w/2-arm),leg/2,z*(d/2-back)],wood);
    box('Bastidor',[w*.94,h*.22,d*.92],[0,leg+h*.11,0],fabric,.045);
    for(const x of [-1,1])box(`Brazo ${x}`,[arm,h*.55,d],[x*(w-arm)/2,leg+h*.4,0],fabric,.055);
    box('Respaldo',[w-arm*1.5,h*.64,back],[0,h*.65,-(d-back)/2],fabric,.055);
    const count=Math.max(2,Math.round(w/.78)),inner=w-arm*2;
    for(let i=0;i<count;i++){
      const x=-inner/2+(i+.5)*inner/count;
      box(`Cojín de asiento ${i+1}`,[inner/count-.018,h*.19,d-back-.04],[x,leg+seat,d*.04],fabric,.05);
      const pillow=box(`Cojín de respaldo ${i+1}`,[inner/count-.025,h*.38,d*.17],[x,h*.72,-d*.24],fabric,.065);pillow.rotation.x=-.12;
      const seamMaterial=new THREE.MeshStandardMaterial({name:'Costuras',color:recipe.color,roughness:1});
      const points=[[-.43,-.4],[-.43,.4],[.43,.4],[.43,-.4],[-.43,-.4]].map(([sx,sz])=>new THREE.Vector3(x+sx*(inner/count-.018),leg+seat+h*.085,d*.04+sz*(d-back-.04)));
      add(`Ribete ${i+1}`,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true,'centripetal'),32,.002,5,true),seamMaterial,[0,0,0]);
    }
  } else if(recipe.family==='sideboard') {
    const foot=h*.17,thickness=.025;
    box('Cuerpo',[w,h-foot,d],[0,foot+(h-foot)/2,0],wood);
    box('Tapa',[w+.012,thickness,d+.012],[0,h,0],wood,.008);
    for(const x of [-1,1])for(const z of [-1,1])cylinder(`Pie ${x} ${z}`,Math.min(w,d)*.035,foot,[x*w*.4,foot/2,z*d*.32],metal);
    const count=Math.min(90,Math.max(10,Math.round(w/.032))),spacing=w/count;
    for(let i=0;i<count;i++){
      const x=-w/2+(i+.5)*spacing;
      box(`Listón ${i+1}`,[spacing*.7,(h-foot)*.92,.022],[x,foot+(h-foot)/2,d/2+.008],wood,.009);
    }
    const doors=Math.max(2,Math.round(w/.6));
    for(let i=1;i<doors;i++)box(`Junta de puerta ${i}`,[.004,(h-foot)*.94,.026],[-w/2+i*w/doors,foot+(h-foot)/2,d/2+.012],metal,.001);
    for(let i=0;i<doors;i++)cylinder(`Tirador ${i+1}`,.012,.075,[-w/2+(i+.72)*w/doors,h*.64,d/2+.045],metal);
  } else if(recipe.family==='table') {
    const top=Math.min(.055,h*.1);
    box('Tablero',[w,top,d],[0,h-top/2,0],wood,.02);
    box('Faldón',[w*.8,h*.09,d*.75],[0,h-top-h*.045,0],wood);
    for(const x of [-1,1])for(const z of [-1,1]){
      const mesh=cylinder(`Pata ${x} ${z}`,Math.min(w,d)*.045,h-top,[x*w*.38,(h-top)/2,z*d*.33],wood);mesh.rotation.z=-x*.035;
      cylinder(`Regatón ${x} ${z}`,Math.min(w,d)*.047,.012,[x*w*.38,.006,z*d*.33],metal);
    }
  } else {
    cylinder('Base metálica',Math.min(w,d)*.3,h*.035,[0,h*.0175,0],metal);
    const profile=[new THREE.Vector2(w*.16,0),new THREE.Vector2(w*.22,h*.08),new THREE.Vector2(w*.2,h*.3),new THREE.Vector2(w*.1,h*.5),new THREE.Vector2(w*.05,h*.58)];
    add('Cuerpo torneado',new THREE.LatheGeometry(profile,64),ceramic,[0,h*.035,0]);
    cylinder('Cuello',w*.025,h*.15,[0,h*.63,0],metal);
    const shade=new THREE.MeshPhysicalMaterial({name:'Pantalla',color:recipe.color,roughness:.85,side:THREE.DoubleSide,sheen:.5});
    add('Pantalla de lino',new THREE.CylinderGeometry(w*.31,w*.5,h*.32,64,1,true),shade,[0,h*.83,0]);
    const bulb=new THREE.MeshStandardMaterial({name:'Bombilla',color:'#fff3d2',emissive:'#ffe0a0',emissiveIntensity:.7});
    add('Bombilla',new THREE.SphereGeometry(w*.08,20,12),bulb,[0,h*.76,0]);
  }
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  // Normalize final extents, including feet, handles and bevels, to the requested footprint.
  const wrapper=new THREE.Group();group.position.set(-center.x,-bounds.min.y,-center.z);wrapper.add(group);
  wrapper.scale.set(w/size.x,h/size.y,d/size.z);wrapper.name=recipe.name;wrapper.userData={atelierRecipe:recipe};wrapper.updateMatrixWorld(true);
  // Materials not used by this family never enter the scene; release them too.
  const used=new Set<THREE.Material>();group.traverse(node=>{if(node instanceof THREE.Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])used.add(material);});
  for(const material of [wood,fabric,metal,ceramic])if(!used.has(material))material.dispose();
  return wrapper;
}

export function disposeWorkshopObject(group:THREE.Group):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  group.traverse(node=>{if(node instanceof THREE.Mesh){geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){
    materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
  }}});
  textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
}

export async function createWorkshopGLB(recipe:ObjectRecipe):Promise<Blob> {
  const object=buildWorkshopObject(recipe);
  try {
    const materials=new Set<THREE.MeshStandardMaterial>();
    object.traverse(node=>{if(node instanceof THREE.Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material instanceof THREE.MeshStandardMaterial)materials.add(material);});
    for(const material of materials)if(material.name==='Madera'||material.name==='Tapizado'||material.name==='Pantalla'){
      const maps=createMaterialMaps(material.name==='Madera'?'wood':'fabric',`#${material.color.getHexString()}`,42,256);
      const loader=new THREE.TextureLoader();
      [material.map,material.normalMap,material.roughnessMap]=await Promise.all([maps.color,maps.normal,maps.roughness].map(url=>loader.loadAsync(url)));
      material.map.colorSpace=THREE.SRGBColorSpace;
      for(const texture of [material.map,material.normalMap,material.roughnessMap]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.needsUpdate=true;}
      material.color.set('#ffffff');
    }
    const buffer=await new GLTFExporter().parseAsync(object,{binary:true,maxTextureSize:1024});
    if(!(buffer instanceof ArrayBuffer))throw new Error('No se pudo generar el objeto 3D.');
    return new Blob([buffer],{type:'model/gltf-binary'});
  } finally {disposeWorkshopObject(object);}
}
