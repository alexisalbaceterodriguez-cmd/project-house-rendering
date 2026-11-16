import { readFile,writeFile } from 'node:fs/promises';
import { expect,test,type Page } from '@playwright/test';
import type { Project } from '../src/types';
import { blankProject } from '../src/data/defaultProject';
import { defaultStudio } from '../src/lib/studioRender';

async function studio(page:Page,tab:string){
  if(!await page.getByRole('dialog').isVisible())await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:tab,exact:true}).click();
}
async function exported(page:Page):Promise<Buffer>{
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar',exact:true}).click();
  return readFile(await (await download).path());
}
async function png(page:Page){
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar imagen PNG',exact:true}).click();
  return readFile(await (await download).path());
}

test('estudio de sofá propio: luces, tejido físico, PNG HD y recuperación portable',{tag:'@smoke'},async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Nuevo',exact:true}).click();
  const initial=JSON.parse((await exported(page)).toString()) as Project;
  await studio(page,'Modelos');
  await page.getByLabel('Diseño del objeto',{exact:true}).selectOption('sofa');
  await page.getByLabel('Nombre del objeto creado',{exact:true}).fill('Sofá lino verde · 260 cm');
  await page.getByLabel('Ancho del objeto creado',{exact:true}).fill('2.6');
  await page.getByLabel('Color del objeto creado',{exact:true}).fill('#788871');
  await page.getByRole('button',{name:'Crear e insertar objeto',exact:true}).click();
  await expect(page.getByText(/Objeto creado a escala/)).toBeVisible({timeout:20_000});
  await studio(page,'Acabados');
  await page.getByLabel('Nombre del material',{exact:true}).fill('Lino verde físico');
  await page.getByLabel('Respuesta física del material',{exact:true}).selectOption('fabric');
  await page.getByLabel('Patrón del material',{exact:true}).selectOption('fabric');
  await page.getByLabel('Color base del material',{exact:true}).fill('#788871');
  await page.getByRole('button',{name:'Crear y aplicar material',exact:true}).click();
  await studio(page,'Imagen y cámara');
  await page.getByRole('button',{name:'Preparar estudio del objeto seleccionado',exact:true}).click();
  await page.getByLabel('Tono de luz',{exact:true}).selectOption('warm');
  await page.getByLabel('Luz de relleno',{exact:true}).fill('1.4');
  await expect(page.getByLabel('Calidad 3D',{exact:true})).toHaveValue('high');
  await expect(page.getByLabel('Contenido del estudio',{exact:true})).not.toHaveValue('');
  await page.getByLabel('Resolución de imagen',{exact:true}).selectOption('1920x1080');
  // Wait on actual asset requests and shaders before the first HD export.
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  await expect(page.getByText('Guardado en este navegador',{exact:true})).toBeVisible();
  await expect(page.locator('.model-unavailable')).toHaveCount(0);
  await expect(page.locator('.scene-wrap')).toHaveAttribute('aria-busy','false');
  await studio(page,'Imagen y cámara');
  const canvasSize=await page.locator('.scene-wrap canvas').evaluate((canvas:HTMLCanvasElement)=>[canvas.width,canvas.height]);
  const image=await png(page);expect(image.readUInt32BE(16)).toBe(1920);expect(image.readUInt32BE(20)).toBe(1080);
  await writeFile('test-results/studio-sofa-hd.png',image);
  await expect.poll(()=>page.locator('.scene-wrap canvas').evaluate((canvas:HTMLCanvasElement)=>[canvas.width,canvas.height])).toEqual(canvasSize);
  await page.getByLabel('Luz principal',{exact:true}).fill('0');
  const changed=await png(page);expect(changed.equals(image)).toBe(false);
  // A failed encoder restores the canvas; retry remains usable.
  await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback){HTMLCanvasElement.prototype.toBlob=original;callback(null);};});
  await page.getByRole('button',{name:'Exportar imagen PNG',exact:true}).click();
  await expect(page.getByText('La GPU no pudo crear la imagen.',{exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('.scene-wrap canvas').evaluate((canvas:HTMLCanvasElement)=>[canvas.width,canvas.height])).toEqual(canvasSize);
  await page.getByLabel('Luz principal',{exact:true}).fill('3');
  expect((await png(page)).equals(image)).toBe(true);
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  await page.screenshot({path:'test-results/studio-sofa-interface.png'});
  const bytes=await exported(page),portable=JSON.parse(bytes.toString()) as Project;
  expect(portable.walls).toEqual(initial.walls);expect(portable.rooms).toEqual(initial.rooms);
  expect(portable.render).toMatchObject({lighting:'studio',quality:'high',studio:{key:3,fill:1.4,warmth:'warm',subjectId:portable.furniture[0].id}});
  expect(portable.materials![0].finish).toBe('fabric');expect(portable.furniture[0].modelData).toMatch(/^data:model\/gltf-binary/);
  await page.reload();await studio(page,'Imagen y cámara');
  await expect(page.getByLabel('Tono de luz',{exact:true})).toHaveValue('warm');
  await page.getByLabel('Contenido del estudio',{exact:true}).selectOption('');
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  await page.locator('input[accept*=".json"]').setInputFiles({name:'estudio.json',mimeType:'application/json',buffer:bytes});
  await expect(page.getByText('Proyecto cargado correctamente.',{exact:true})).toBeVisible();
  await studio(page,'Imagen y cámara');
  await expect(page.getByLabel('Contenido del estudio',{exact:true})).toHaveValue(portable.furniture[0].id);
  expect(errors).toEqual([]);
});

test('vidrio y barniz en estudio de escena exportan UHD y cambian a calidad rápida',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const project=blankProject();project.name='Vidrio y barniz';project.walls=[];project.rooms=[];
  project.materials=(['glass','varnish'] as const).map((finish,index)=>({id:`custom:${finish}`,name:finish,category:'Físico',finish,color:index?'#865d36':'#d9e9ed',roughness:index?.3:.08,metalness:0,scale:1,normalStrength:1,source:'Propio',license:'Creación propia'}));
  project.furniture=project.materials.map((material,index)=>({id:material.id,kind:'table',name:material.name,x:4+index*2,y:3,w:1.5,d:.8,h:.75,rotation:0,color:material.color,materialId:material.id}));
  project.render={lighting:'studio',exposure:1,quality:'high',studio:defaultStudio,camera:{position:[8,3.2,7],target:[5,.4,3]}};
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  await page.locator('input[accept*=".json"]').setInputFiles({name:'fisicos.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.getByText('Proyecto cargado correctamente.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Vista 3D',exact:true}).click();
  await expect(page.locator('.scene-wrap')).toHaveAttribute('aria-busy','false');
  await studio(page,'Imagen y cámara');await page.getByLabel('Resolución de imagen',{exact:true}).selectOption('3840x2160');
  const image=await png(page);expect(image.readUInt32BE(16)).toBe(3840);expect(image.readUInt32BE(20)).toBe(2160);
  await writeFile('test-results/studio-physical-uhd.png',image);
  await page.getByLabel('Calidad 3D',{exact:true}).selectOption('draft');
  await page.getByLabel('Resolución de imagen',{exact:true}).selectOption('1280x720');
  expect((await png(page)).readUInt32BE(16)).toBe(1280);
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  await page.screenshot({path:'test-results/studio-physical-interface.png'});
  expect(errors).toEqual([]);
});
