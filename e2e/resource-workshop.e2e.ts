import { readFile,writeFile } from 'node:fs/promises';
import { expect,test } from '@playwright/test';
import type { Project } from '../src/types';

test('crea objeto y material propios, renderiza y conserva ambos en JSON portable',{tag:'@smoke'},async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByRole('button',{name:'Plano 2D',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Nuevo',exact:true}).click();
  await page.getByLabel('Nombre del proyecto',{exact:true}).fill('Proyecto del taller');
  await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();
  await page.getByLabel('Diseño del objeto',{exact:true}).selectOption('table');
  await page.getByLabel('Nombre del objeto creado',{exact:true}).fill('Mesa a medida');
  await page.getByLabel('Ancho del objeto creado',{exact:true}).fill('1.6');
  await page.getByRole('button',{name:'Crear e insertar objeto',exact:true}).click();
  await expect(page.getByText(/Objeto creado a escala/)).toBeVisible({timeout:20_000});
  await page.getByRole('dialog').getByRole('button',{name:'Acabados',exact:true}).click();
  await page.getByLabel('Nombre del material',{exact:true}).fill('Mármol del taller');
  await page.getByLabel('Patrón del material',{exact:true}).selectOption('marble');
  await page.getByLabel('Color base del material',{exact:true}).fill('#e3d9c5');
  await page.getByRole('button',{name:'Crear y aplicar material',exact:true}).click();
  await expect(page.getByText('Material creado y aplicado. Puedes deshacer ambos cambios juntos.',{exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Imagen y cámara',exact:true}).click();
  await page.getByRole('button',{name:'Encuadrar objeto seleccionado',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar estudio',exact:true}).click();
  await expect(page.getByText('Guardado en este navegador',{exact:true})).toBeVisible();
  // Actual WebGL capture checks that exported maps and generated geometry load together.
  const capture=page.waitForEvent('download');await page.getByRole('button',{name:'Imagen',exact:true}).click();
  const png=await readFile(await (await capture).path());
  expect(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))).toBe(true);
  await writeFile('test-results/workshop-render.png',png);
  await page.screenshot({path:'test-results/workshop-interface.png'});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar',exact:true}).click();
  const bytes=await readFile(await (await download).path()),portable=JSON.parse(bytes.toString('utf8')) as Project;
  expect(portable.materials).toHaveLength(1);expect(portable.materials![0].maps?.normal).toMatch(/^data:image\/jpeg;base64,/);
  expect(portable.furniture).toHaveLength(1);expect(portable.furniture[0]).toMatchObject({name:'Mesa a medida',w:1.6,modelFinish:{materialId:portable.materials![0].id}});
  expect(portable.furniture[0].modelData).toMatch(/^data:model\/gltf-binary;base64,/);
  await page.reload();await expect(page.getByLabel('Nombre del proyecto',{exact:true})).toHaveValue('Proyecto del taller');
  await page.locator('input[accept*=".json"]').setInputFiles({name:'taller.json',mimeType:'application/json',buffer:bytes});
  await expect(page.getByText('Proyecto cargado correctamente.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Acabados',exact:true}).click();
  await expect(page.getByRole('button',{name:'Aplicar Mármol del taller',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const project=JSON.parse(localStorage.getItem('atelier-60-project-v1')??'{}');return project.materials?.[0]?.name;
  })).toBe('Mármol del taller');
  expect(errors).toEqual([]);
});
