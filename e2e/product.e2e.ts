import { readFile } from 'node:fs/promises';
import { expect,test,type Page } from '@playwright/test';

async function studio(page:Page,tab:string){
  if(!await page.getByRole('dialog').isVisible())await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:tab,exact:true}).click();
  return page.getByRole('dialog');
}
async function closeStudio(page:Page){await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();}
async function exported(page:Page){
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar',exact:true}).click();
  return JSON.parse((await readFile(await (await promise).path())).toString('utf8'));
}
async function point(page:Page,x:number,y:number){return page.locator('.plan-svg').evaluate((svg:SVGSVGElement,p)=>{const point=svg.createSVGPoint();point.x=p.x;point.y=p.y;const screen=point.matrixTransform(svg.getScreenCTM()!);return{x:screen.x,y:screen.y};},{x,y});}

test('la rueda amplía sin desplazar la página y Escape revierte el arrastre',async({page})=>{
  const consoleErrors:string[]=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Nuevo',exact:true}).click();
  await page.getByRole('button',{name:'Tabique',exact:true}).click();
  for(const [x,y] of [[2,2],[5,2]]){const p=await point(page,x,y);await page.mouse.click(p.x,p.y);}
  await page.getByRole('button',{name:'Seleccionar',exact:true}).click();
  const a=await point(page,3.5,2),b=await point(page,3.5,3);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
  await expect.poll(()=>page.locator('.plan-wall').last().getAttribute('y1')).not.toBe('2');
  await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.plan-wall').last()).toHaveAttribute('y1','2');
  await page.locator('.plan-svg').hover();const scroll=await page.evaluate(()=>scrollY),before=await page.locator('.plan-svg').getAttribute('viewBox');
  await page.mouse.wheel(0,-300);await expect.poll(()=>page.locator('.plan-svg').getAttribute('viewBox')).not.toBe(before);
  expect(await page.evaluate(()=>scrollY)).toBe(scroll);expect(consoleErrors.filter(s=>s.includes('passive'))).toEqual([]);
});

test('un GLB ya guardado que se corrompe muestra marcador y permite seguir editando',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  const project=await exported(page);
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[]}],nodes:[]}));
  const padding=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]),glb=Buffer.alloc(20+padding.length);
  glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padding.length,12);glb.writeUInt32LE(0x4e4f534a,16);padding.copy(glb,20);
  project.furniture.push({id:'damage',kind:'model',name:'Modelo para reparar',x:2,y:2,w:1,d:1,h:1,rotation:0,color:'#ffffff',modelData:'data:model/gltf-binary;base64,'+glb.toString('base64')});
  await page.locator('input[accept*=".json"]').setInputFiles({name:'modelo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.getByText('Proyecto cargado correctamente.')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('atelier-60-project-v1')??'{}').furniture?.some((f:{id:string})=>f.id==='damage'))).toBe(true);
  await page.evaluate(async()=>{
    const p=JSON.parse(localStorage.getItem('atelier-60-project-v1')!);const id=p.furniture.find((f:{id:string})=>f.id==='damage').assetId;
    await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('atelier60-assets-v1');req.onsuccess=()=>{const db=req.result,tx=db.transaction('models','readwrite');tx.objectStore('models').put(new Blob(['broken bytes']),id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});
  });
  await page.reload();await expect(page.getByText('Modelo para reparar: modelo no disponible')).toBeVisible();
  await expect(page.getByRole('button',{name:'Exportar',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Plano 2D',exact:true}).click();await page.getByLabel('Nombre del proyecto').fill('Sigo trabajando');
  const p=await exported(page);expect(p.name).toBe('Sigo trabajando');expect(p.walls).toEqual(project.walls);
});

test('guarda y restaura tres cocinas con acabados distintos sin mover paredes ni cámara',async({page})=>{
  await page.goto('/');const base=await exported(page);
  await studio(page,'Imagen y cámara');await page.getByRole('button',{name:'Guardar encuadre actual',exact:true}).click();
  await studio(page,'Cocina y baño');await page.getByRole('button',{name:'Añadir Módulo bajo',exact:true}).click();
  for(const [name,color] of [['Cocina A','#aabbcc'],['Cocina B','#886644'],['Cocina C','#445566']]){
    await studio(page,'Cocina y baño');await page.getByLabel('Color de frentes',{exact:true}).fill(color);await page.getByRole('button',{name:'Aplicar al módulo seleccionado',exact:true}).click();
    await studio(page,'Versiones');await page.getByLabel('Nombre de la versión',{exact:true}).fill(name);await page.getByRole('button',{name:'Guardar versión del proyecto',exact:true}).click();
    await expect(page.getByText('Versión guardada con geometría, modelos, acabados y cámara.',{exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Restaurar Cocina A',exact:true}).click();await expect(page.getByText(/Restaurada «Cocina A»/)).toBeVisible();await closeStudio(page);
  const a=await exported(page);expect(a.furniture.find((f:{module?:unknown})=>f.module)?.module.front).toBe('#aabbcc');expect(a.walls).toEqual(base.walls);expect(a.render.camera).toBeTruthy();
  await studio(page,'Versiones');await page.getByRole('button',{name:'Restaurar Cocina C',exact:true}).click();await expect(page.getByText(/Restaurada «Cocina C»/)).toBeVisible();await closeStudio(page);
  const c=await exported(page);expect(c.furniture.find((f:{module?:unknown})=>f.module)?.module.front).toBe('#445566');expect(c.render.camera).toEqual(a.render.camera);expect(c.walls).toEqual(a.walls);
  await page.reload();await studio(page,'Versiones');await expect(page.getByRole('button',{name:'Restaurar Cocina B',exact:true})).toBeVisible();
});

test('aplica cuatro texturas, compara propuestas y exporta PNG configurable',async({page})=>{
  await page.goto('/');await studio(page,'Acabados');await page.getByLabel('Destino del acabado').selectOption('floors');
  for(const material of ['Madera natural','Porcelánico claro','Tejido natural','Enlucido blanco']){
    await page.getByRole('dialog').getByRole('button',{name:new RegExp('^'+material)}).click();
    await expect(page.getByText('Acabado aplicado. Deshacer recupera el anterior.',{exact:true})).toBeVisible();
  }
  await page.getByRole('dialog').getByRole('button',{name:/^Madera natural/}).click();await studio(page,'Versiones');await page.getByLabel('Nombre de la versión',{exact:true}).fill('Suelo A');await page.getByRole('button',{name:'Guardar versión del proyecto',exact:true}).click();await expect(page.getByText('Versión guardada con geometría, modelos, acabados y cámara.',{exact:true})).toBeVisible();
  await studio(page,'Acabados');await page.getByRole('dialog').getByRole('button',{name:/^Porcelánico claro/}).click();await studio(page,'Versiones');
  await page.getByLabel('Propuesta para comparar').selectOption({label:'Suelo A'});await page.getByRole('button',{name:'Preparar comparación con el proyecto actual',exact:true}).click();
  await page.getByRole('button',{name:'Ver propuesta B',exact:true}).click();await closeStudio(page);const b=await exported(page);expect(b.rooms.every((r:{materialId?:string})=>r.materialId==='wood')).toBe(true);
  await studio(page,'Versiones');await page.getByRole('button',{name:'Ver propuesta A',exact:true}).click();await closeStudio(page);const a=await exported(page);expect(a.rooms.every((r:{materialId?:string})=>r.materialId==='tile')).toBe(true);expect(a.walls).toEqual(b.walls);expect(a.render.camera).toEqual(b.render.camera);
  await studio(page,'Imagen y cámara');await page.getByLabel('Resolución de imagen').selectOption('1280x720');
  const pngEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar imagen PNG',exact:true}).click();const png=await readFile(await (await pngEvent).path());expect(png.readUInt32BE(16)).toBe(1280);expect(png.readUInt32BE(20)).toBe(720);expect(png.length).toBeGreaterThan(10_000);
  await studio(page,'Versiones');await page.getByRole('button',{name:'Ver propuesta B',exact:true}).click();await studio(page,'Imagen y cámara');
  const secondPng=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar imagen PNG',exact:true}).click();const alternate=await readFile(await (await secondPng).path());expect(alternate.readUInt32BE(16)).toBe(1280);expect(alternate.readUInt32BE(20)).toBe(720);expect(alternate.equals(png)).toBe(false);
});

test('inserta tres modelos autorizados, reutiliza activos y conserva atribuciones en JSON',async({page})=>{
  test.setTimeout(180_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  await studio(page,'Modelos');
  for(const name of ['Butaca de terciopelo','Sofá de cuero y madera','Lámpara Bonsell 19 pulgadas']){
    await page.getByRole('button',{name:'Insertar '+name,exact:true}).click();await expect(page.getByText(name+' añadido a escala. Puedes moverlo en el plano.',{exact:true})).toBeVisible({timeout:60_000});
  }
  await closeStudio(page);const project=await exported(page);const models=project.furniture.filter((f:{kind:string})=>f.kind==='model');expect(models).toHaveLength(3);
  for(const model of models){expect(model.productSource.license).toMatch(/^CC/);expect(model.modelData).toMatch(/^data:/);expect(model.w).toBeGreaterThan(.02);expect(model.h).toBeGreaterThan(.02);}
  await page.getByRole('button',{name:'Vista 3D',exact:true}).click();await expect(page.locator('.scene-wrap canvas')).toBeVisible();await expect(page.locator('.model-unavailable')).toHaveCount(0,{timeout:60_000});
  const imageEvent=page.waitForEvent('download',{timeout:15000});await page.getByRole('button',{name:'Imagen',exact:true}).click();await expect(page.getByText('Imagen PNG exportada.',{exact:true})).toBeVisible();expect((await readFile(await (await imageEvent).path())).length).toBeGreaterThan(10_000);expect(errors).toEqual([]);
  await studio(page,'Versiones');await page.getByLabel('Nombre de la versión',{exact:true}).fill('Biblioteca real');await page.getByRole('button',{name:'Guardar versión del proyecto',exact:true}).click();await expect(page.getByText('Versión guardada con geometría, modelos, acabados y cámara.',{exact:true})).toBeVisible();await closeStudio(page);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Nuevo',exact:true}).click();await studio(page,'Modelos');await page.getByRole('button',{name:'Insertar Butaca de terciopelo',exact:true}).click();await expect(page.getByText('Butaca de terciopelo añadido a escala. Puedes moverlo en el plano.',{exact:true})).toBeVisible({timeout:60_000});await closeStudio(page);
  const count=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const req=indexedDB.open('atelier60-assets-v1');req.onsuccess=()=>{const db=req.result,tx=db.transaction('models','readonly'),count=tx.objectStore('models').count();count.onsuccess=()=>resolve(count.result);count.onerror=()=>reject(count.error);tx.oncomplete=()=>db.close();};}));expect(count).toBe(3);
  await page.getByRole('button',{name:'Vista 3D',exact:true}).click();await expect(page.locator('.scene-wrap canvas')).toBeVisible();
  await expect(page.locator('.model-unavailable')).toHaveCount(0,{timeout:60_000});expect(errors).toEqual([]);
  await studio(page,'Plano y revisión');await page.getByRole('button',{name:'Eliminar recurso Sofá de cuero y madera',exact:true}).click();await expect(page.getByText('Este recurso está en uso por el proyecto, un respaldo, una versión o el historial. Consérvalo para evitar pérdidas.',{exact:true})).toBeVisible();
});

test('el estudio permite guardar y recuperar propuestas en pantalla móvil',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await studio(page,'Versiones');
  await page.getByLabel('Nombre de la versión',{exact:true}).fill('Propuesta móvil');await page.getByRole('button',{name:'Guardar versión del proyecto',exact:true}).click();
  await expect(page.getByText('Versión guardada con geometría, modelos, acabados y cámara.',{exact:true})).toBeVisible();
  const bounds=await page.getByRole('dialog').evaluate(e=>({width:e.clientWidth,content:e.scrollWidth}));expect(bounds.content-bounds.width).toBeLessThanOrEqual(1);
  await closeStudio(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.reload();await studio(page,'Versiones');await expect(page.getByRole('button',{name:'Restaurar Propuesta móvil',exact:true})).toBeVisible();
});

test('guarda referencia calibrada y ajustes entre recargas',async({page})=>{
  await page.goto('/');await studio(page,'Plano y revisión');
  await page.getByLabel('Paso de rejilla',{exact:true}).selectOption('0.05');
  await page.getByLabel('Ajuste magnético',{exact:true}).uncheck();
  await page.getByLabel('Imagen de plano de referencia').setInputFiles({name:'plano.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
  await expect(page.getByLabel('Ancho real de referencia',{exact:true})).toBeVisible();await page.getByLabel('Ancho real de referencia',{exact:true}).fill('12');await closeStudio(page);
  const saved=await exported(page);expect(saved.editor.grid).toBe(.05);expect(saved.editor.magnet).toBe(false);expect(saved.referenceImage.width).toBe(12);expect(saved.referenceImage.data).toMatch(/^data:image\/jpeg/);
  await page.reload();await studio(page,'Plano y revisión');await expect(page.getByLabel('Ancho real de referencia',{exact:true})).toHaveValue('12');await expect(page.getByLabel('Ajuste magnético',{exact:true})).not.toBeChecked();
});

test('usa iluminación HDRI y recorre la vivienda en primera persona',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Vista 3D',exact:true}).click();await expect(page.locator('.scene-wrap canvas')).toBeVisible();
  await studio(page,'Imagen y cámara');await page.getByLabel('Iluminación',{exact:true}).selectOption('studio');await page.getByLabel('Calidad 3D',{exact:true}).selectOption('high');
  await page.getByRole('button',{name:'Recorrer en primera persona',exact:true}).click();await closeStudio(page);
  await page.locator('.scene-wrap canvas').click({position:{x:300,y:200}});await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
  await page.keyboard.down('KeyW');await page.evaluate(()=>new Promise(resolve=>{let count=0;const frame=()=>++count>8?resolve(null):requestAnimationFrame(frame);requestAnimationFrame(frame);}));await page.keyboard.up('KeyW');await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(false);
  await studio(page,'Imagen y cámara');await page.getByRole('button',{name:'Guardar encuadre actual',exact:true}).click();await closeStudio(page);const project=await exported(page);
  expect(project.render.lighting).toBe('studio');expect(project.render.quality).toBe('high');expect(project.render.camera.position[1]).toBeCloseTo(1.6);expect(project.render.camera.position[0]).toBeGreaterThan(0);expect(project.render.camera.position[2]).toBeGreaterThan(0);
});

test('personaliza una submalla GLB sin modificar otra instancia del mismo recurso',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();await studio(page,'Modelos');
  await page.getByRole('button',{name:'Insertar Butaca de terciopelo',exact:true}).click();await expect(page.getByText('Butaca de terciopelo añadido a escala. Puedes moverlo en el plano.',{exact:true})).toBeVisible();await closeStudio(page);
  await page.getByRole('button',{name:'Duplicar',exact:true}).click();await page.getByLabel('Sobrescribir materiales de esta instancia',{exact:true}).check();
  const picker=page.getByLabel('Material GLB objetivo',{exact:true});const surface=picker.locator('option[value^="@mesh:"]').first();await expect(surface).toBeAttached();await picker.selectOption((await surface.getAttribute('value'))!);
  await studio(page,'Acabados');await page.getByRole('dialog').getByRole('button',{name:/^Tejido natural/}).click();await closeStudio(page);
  const project=await exported(page),models=project.furniture.filter((f:{kind:string})=>f.kind==='model');expect(models).toHaveLength(2);expect(models[0].modelData).toBe(models[1].modelData);expect(models[0].modelFinish).toBeUndefined();expect(models[1].modelFinish.materialId).toBe('fabric');expect(models[1].modelFinish.materialName).toMatch(/^@mesh:/);
  await page.locator('button[title^="Deshacer"]').click();const undone=await exported(page);expect(undone.furniture.find((f:{id:string})=>f.id===models[1].id).modelFinish.materialId).toBeUndefined();
  await page.locator('button[title^="Rehacer"]').click();const redone=await exported(page);expect(redone.furniture.find((f:{id:string})=>f.id===models[1].id).modelFinish.materialId).toBe('fabric');
  expect(redone.resources).toHaveLength(1);
  await page.locator('input[accept*=".json"]').setInputFiles({name:'instancias.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(redone))});await expect(page.getByText('Proyecto cargado correctamente.')).toBeVisible();
  const restored=await exported(page);expect(restored.resources).toHaveLength(1);expect(restored.resources[0].data).toBe(redone.resources[0].data);expect(restored.furniture.filter((f:{kind:string})=>f.kind==='model')).toHaveLength(2);
});

test('conserva precios, exporta presupuesto y prepara plano para impresión PDF',async({page})=>{
  await page.addInitScript(()=>{window.print=()=>{document.body.dataset.printCalled='yes';};});
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();await page.locator('.plan-furniture').first().click();await studio(page,'Plano y revisión');
  await page.getByLabel('Precio del objeto seleccionado',{exact:true}).fill('123.45');const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar presupuesto CSV',exact:true}).click();const csv=(await readFile(await (await csvEvent).path())).toString('utf8');expect(csv).toContain('123.45');
  await closeStudio(page);const project=await exported(page);expect(project.furniture[0].unitPrice).toBe(123.45);
  await studio(page,'Plano y revisión');await page.getByRole('button',{name:'Imprimir plano / guardar PDF',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-print-called','yes');
  await page.emulateMedia({media:'print'});await expect(page.locator('.print-sheet')).toBeVisible();await expect(page.locator('.sidebar')).toBeHidden();await expect(page.locator('.plan-svg')).toBeVisible();
});
