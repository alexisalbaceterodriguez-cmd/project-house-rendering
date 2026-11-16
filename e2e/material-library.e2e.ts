import { readFile } from 'node:fs/promises';
import { expect,test,type Page } from '@playwright/test';
import type { Project } from '../src/types';
import { blankProject } from '../src/data/defaultProject';

async function studio(page:Page,section='Acabados'){
  if(!await page.getByRole('dialog').isVisible())await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:section,exact:true}).click();
}
async function saved(page:Page){await expect(page.getByText('Guardado en este navegador',{exact:true})).toBeVisible();}
async function blank(page:Page){
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Nuevo',exact:true}).click();await saved(page);
}
async function create(page:Page,name:string,pattern='fabric'){
  await page.getByLabel('Destino del acabado',{exact:true}).selectOption('walls');
  await page.getByLabel('Nombre del material',{exact:true}).fill(name);
  await page.getByLabel('Patrón del material',{exact:true}).selectOption(pattern);
  await page.getByRole('button',{name:'Crear y aplicar material',exact:true}).click();
  await expect(page.getByText('Material creado y aplicado. Puedes deshacer ambos cambios juntos.',{exact:true})).toBeVisible();
}
async function local(page:Page):Promise<Project>{return page.evaluate(()=>JSON.parse(localStorage.getItem('atelier-60-project-v1')!));}
async function exported(page:Page){
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar',exact:true}).click();
  return readFile(await (await download).path());
}
async function library(page:Page){
  return page.evaluate(async()=>{
    const url='/src/lib/materialLibrary.ts';const {listLibraryMaterials,browserMaterials}=await import(url);
    const entries=await listLibraryMaterials();
    const refs=[...new Set(entries.flatMap((entry:{material:{maps?:Record<string,string>}})=>Object.values(entry.material.maps??{})))];
    return {entries,textures:await Promise.all(refs.map(async id=>({id,data:await browserMaterials.get(id)})))};
  });
}

test('biblioteca de mapas entre proyectos, respaldo, versión, historial y JSON en otro navegador',{tag:'@smoke'},async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();await blank(page);
  await studio(page);await create(page,'Lino reutilizable');
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();await saved(page);
  const first=await local(page);expect(first.materials).toHaveLength(1);
  const maps=first.materials![0].maps!;expect(Object.values(maps).every(value=>/^texture:[a-f0-9]{64}$/.test(value))).toBe(true);
  const before=await library(page);expect(before.entries).toHaveLength(1);expect(before.textures.every(texture=>texture.data?.startsWith('data:image/'))).toBe(true);
  await page.getByTitle('Deshacer (Ctrl+Z)',{exact:true}).click();await saved(page);expect((await local(page)).materials).toBeUndefined();
  expect((await library(page)).textures).toEqual(before.textures);
  await page.getByTitle('Rehacer (Ctrl+Mayús+Z)',{exact:true}).click();await saved(page);expect((await local(page)).materials![0].maps).toEqual(maps);
  await studio(page,'Versiones');await page.getByLabel('Nombre de la versión',{exact:true}).fill('Versión con lino');
  await page.getByRole('button',{name:'Guardar versión del proyecto',exact:true}).click();
  await expect(page.getByRole('button',{name:'Restaurar Versión con lino',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();await blank(page);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('atelier-60-project-v1-backup')??'{}').materials?.[0]?.maps)).toEqual(maps);
  await studio(page);await page.getByLabel('Destino del acabado',{exact:true}).selectOption('walls');
  await page.getByRole('button',{name:'Reutilizar Lino reutilizable',exact:true}).click();
  await expect(page.getByText(/Material de la biblioteca reutilizado y aplicado/)).toBeVisible();
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();await saved(page);
  expect((await local(page)).walls.every(wall=>wall.materialId===first.materials![0].id)).toBe(true);
  expect((await library(page)).textures).toEqual(before.textures);expect((await library(page)).entries).toHaveLength(1);
  await page.reload();await page.getByRole('button',{name:'Plano 2D',exact:true}).click();await saved(page);
  expect((await local(page)).materials![0].maps).toEqual(maps);
  const bytes=await exported(page),portable=JSON.parse(bytes.toString()) as Project;
  expect(Object.values(portable.materials![0].maps!).every(value=>value.startsWith('data:image/'))).toBe(true);
  const fresh=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  try{
    const other=await fresh.newPage();other.on('pageerror',error=>errors.push(error.message));
    await other.goto('/');await other.getByRole('button',{name:'Plano 2D',exact:true}).click();
    await other.locator('input[accept*=".json"]').setInputFiles({name:'lino.json',mimeType:'application/json',buffer:bytes});
    await expect(other.getByText('Proyecto cargado correctamente.',{exact:true})).toBeVisible();await saved(other);
    expect((await local(other)).materials).toEqual((await local(page)).materials);
    expect((await library(other)).textures).toEqual(before.textures);
    // Import also derives room polygons from the unchanged walls.
    const roundtrip=JSON.parse((await exported(other)).toString()) as Project;
    expect(roundtrip).toMatchObject(portable);expect(roundtrip.materials).toEqual(portable.materials);
    expect(roundtrip.walls).toEqual(portable.walls);expect(roundtrip.rooms).toHaveLength(portable.rooms.length);
  }finally{await fresh.close();}
  await studio(page,'Versiones');await page.getByRole('button',{name:'Restaurar Versión con lino',exact:true}).click();
  await expect(page.getByText(/Restaurada «Versión con lino»/)).toBeVisible();
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();await saved(page);
  expect((await local(page)).materials![0].maps).toEqual(maps);expect(errors).toEqual([]);
});

test('fallo atómico conserva material activo; mapa dañado avisa y permite reparar y reintentar',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();await blank(page);
  await studio(page);await create(page,'Material conservado');await saved(page);
  const original=await local(page),before=await library(page),portable=await page.evaluate(async()=>{
    const url='/src/lib/portableProject.ts';const {portableProject}=await import(url);
    return portableProject(JSON.parse(localStorage.getItem('atelier-60-project-v1')!));
  });
  await page.evaluate(()=>{
    const put=IDBObjectStore.prototype.put;let count=0;
    IDBObjectStore.prototype.put=function(value,key){
      if(this.name==='textures'&&++count===2){IDBObjectStore.prototype.put=put;throw new DOMException('injected quota','QuotaExceededError');}
      return put.call(this,value,key);
    };
  });
  await page.getByLabel('Nombre del material',{exact:true}).fill('No debe guardarse');
  await page.getByLabel('Patrón del material',{exact:true}).selectOption('marble');
  await page.getByRole('button',{name:'Crear y aplicar material',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'El material activo se conserva.'})).toBeVisible();
  expect((await local(page)).materials).toEqual(original.materials);expect(await library(page)).toEqual(before);
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  // Corrupt pixels on disk, then clear in-memory caches with a genuine reload.
  await page.evaluate(async id=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('atelier60-material-library');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('textures','readwrite');tx.objectStore('textures').put('data:image/png;base64,YWJj',id);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};});
  },original.materials![0].maps!.color!);
  await page.reload();
  await expect(page.getByRole('alert').filter({hasText:'Falta un mapa del material o está dañado.'})).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto',{exact:true})).toBeEditable();
  await saved(page);expect((await local(page)).materials).toEqual(original.materials);
  await studio(page);await page.getByRole('button',{name:'Aplicar Material conservado',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Falta un mapa del material o está dañado.'})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  // Import repairs content under the same digest without clearing current definitions/history.
  await page.locator('input[accept*=".json"]').setInputFiles({name:'reparado.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(portable))});
  await expect(page.getByText('Proyecto cargado correctamente.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reintentar mapas',exact:true}).click();
  await expect(page.locator('.material-storage-notice')).toHaveCount(0);await saved(page);
  expect((await local(page)).materials).toEqual(original.materials);expect(errors).toEqual([]);
});

test('migra mapas de un guardado v1 antiguo solo tras guardarlos y permite reintentar una cuota fallida',async({page})=>{
  const project=blankProject();project.name='Proyecto v1 embebido';
  project.materials=[{id:'custom:legacy',name:'Mapa antiguo',category:'Propio',color:'#ffffff',scale:1,roughness:.7,metalness:0,normalStrength:1,source:'Propio',license:'Propia',maps:{color:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}}];
  project.walls[0].materialId=project.materials[0].id;
  await page.addInitScript(project=>{
    if(localStorage.getItem('legacy-prepared'))return;
    localStorage.setItem('legacy-prepared','yes');localStorage.setItem('atelier-60-project-v1',JSON.stringify(project));
    (window as Window&{denyLegacyMaterials?:boolean}).denyLegacyMaterials=true;
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){
      if(this.name==='textures'&&(window as Window&{denyLegacyMaterials?:boolean}).denyLegacyMaterials)throw new DOMException('legacy quota','QuotaExceededError');
      return put.call(this,value,key);
    };
  },project);
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Los mapas embebidos siguen activos'})).toBeVisible();await saved(page);
  expect((await local(page)).materials).toEqual(project.materials);
  // Export remains possible while migration has failed.
  expect(JSON.parse((await exported(page)).toString()).materials).toEqual(project.materials);
  await page.evaluate(()=>{(window as Window&{denyLegacyMaterials?:boolean}).denyLegacyMaterials=false;});
  await page.getByRole('button',{name:'Reintentar mapas',exact:true}).click();
  await expect(page.locator('.material-storage-notice')).toHaveCount(0);
  await expect.poll(async()=>(await local(page)).materials![0].maps!.color).toMatch(/^texture:[a-f0-9]{64}$/);
  expect((await local(page)).walls).toEqual(project.walls);
  await page.reload();await page.getByRole('button',{name:'Plano 2D',exact:true}).click();await saved(page);
  expect((await local(page)).materials![0].maps!.color).toMatch(/^texture:/);
  expect(JSON.parse((await exported(page)).toString()).materials).toEqual(project.materials);
});
