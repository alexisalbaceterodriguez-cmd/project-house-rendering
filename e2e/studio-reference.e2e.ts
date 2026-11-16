import { readFile,writeFile } from 'node:fs/promises';
import { expect,test } from '@playwright/test';
import { blankProject } from '../src/data/defaultProject';
import { defaultStudio } from '../src/lib/studioRender';
import { applyAppearance } from '../src/lib/designVariants';
import type { Project } from '../src/types';

test('referencia de madera, vidrio y tejido: HD repetible, A/B y cambio de calidad',{tag:'@smoke'},async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE.WebGLProgram|shader error|GL_INVALID/i.test(message.text()))errors.push(message.text());});
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  const project:Project=process.env.STUDIO_REFERENCE_PROJECT?JSON.parse(await readFile(process.env.STUDIO_REFERENCE_PROJECT,'utf8')):await page.evaluate(async project=>{
    const modulePath='/src/lib/workshopObjects.ts';const {createWorkshopGLB,objectTemplates}=await import(modulePath);
    const texturePath='/src/lib/proceduralTextures.ts';const {createMaterialMaps}=await import(texturePath);
    project.name='Referencia · roble, lino y vidrio';project.walls=[];project.rooms=[];project.openings=[];
    project.materials=[
      {id:'custom:linen',name:'Lino salvia',category:'Tejido',finish:'fabric',color:'#ffffff',roughness:.9,metalness:0,scale:.25,normalStrength:.35,maps:createMaterialMaps('fabric','#889380'),source:'Propio',license:'Creación propia'},
      {id:'custom:oak',name:'Roble barnizado',category:'Madera',finish:'varnish',color:'#ffffff',roughness:.48,metalness:0,scale:.65,normalStrength:.25,maps:createMaterialMaps('wood','#ac8054'),source:'Propio',license:'Creación propia'},
      {id:'custom:glass',name:'Vidrio claro',category:'Vidrio',finish:'glass',color:'#edf5f5',roughness:.05,metalness:0,scale:1,normalStrength:0,source:'Propio',license:'Creación propia'},
    ];
    for(const [index,family] of (['sofa','sideboard','table'] as const).entries()){
      const recipe={...objectTemplates[family],...(family==='table'?{w:1.2,d:.65,h:.4}:{} )};
      const blob=await createWorkshopGLB(recipe);
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});
      const material=project.materials![index===0?0:index===1?1:2];
      project.furniture.push({id:`reference-${family}`,kind:'model',name:recipe.name,x:index===1?6:3.5,y:index===2?4.4:2.8,w:recipe.w,d:recipe.d,h:recipe.h,rotation:0,color:recipe.color,modelData:data,
        modelFinishes:[{materialName:index===0?'Tapizado':index===1?'Madera':'@mesh:0:slot:0',color:material.color,roughness:material.roughness,metalness:0,materialId:material.id}]});
    }
    return project;
  },{...blankProject(),furniture:[]} as Project);
  project.render??={lighting:'studio',quality:'high',exposure:1,studio:{...defaultStudio,azimuth:-35,fill:1.4},camera:{position:[8.8,4.1,9.5],target:[4.3,.55,3.1]}};
  const importProject=async(value:Project)=>{
    await page.locator('input[accept*=".json"]').setInputFiles({name:'referencia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    await expect(page.getByText('Proyecto cargado correctamente.',{exact:true})).toBeVisible();
  };
  await importProject(project);await page.getByRole('button',{name:'Vista 3D',exact:true}).click();
  const panel=async()=>{await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Imagen y cámara',exact:true}).click();};
  const capture=async()=>{
    await expect(page.locator('.scene-wrap')).toHaveAttribute('aria-busy','false');
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar imagen PNG',exact:true}).click();
    return readFile(await (await download).path());
  };
  await panel();await page.getByLabel('Resolución de imagen',{exact:true}).selectOption('1920x1080');
  const image=await capture();expect(image.readUInt32BE(16)).toBe(1920);expect(image.readUInt32BE(20)).toBe(1080);
  await writeFile('test-results/studio-reference-hd.png',image);await writeFile('test-results/studio-reference.json',JSON.stringify(project));
  expect((await capture()).equals(image)).toBe(true);
  await page.getByLabel('Calidad 3D',{exact:true}).selectOption('draft');const draft=await capture();expect(draft.equals(image)).toBe(false);
  await page.getByLabel('Calidad 3D',{exact:true}).selectOption('high');expect((await capture()).equals(image)).toBe(true);
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  const variant=structuredClone(project);variant.materials![0].color='#b87850';variant.render!.studio!.key=0;
  const comparison=applyAppearance(project,variant);expect(comparison.render).toEqual(project.render);
  await importProject(comparison);await panel();const alternate=await capture();expect(alternate.equals(image)).toBe(false);
  await writeFile('test-results/studio-reference-b-hd.png',alternate);
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar',exact:true}).click();
  const portable=JSON.parse(await readFile(await (await download).path(),'utf8')) as Project;
  expect(portable.render).toEqual(project.render);expect(portable.walls).toEqual(project.walls);
  expect(portable.furniture.map(({modelData,assetId,...item})=>item)).toEqual(comparison.furniture.map(({modelData,assetId,...item})=>item));
  expect(errors).toEqual([]);
});
