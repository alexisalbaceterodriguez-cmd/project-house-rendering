import { readFile } from 'node:fs/promises';
import { expect,test } from '@playwright/test';

/** Minimal reader for the stored (uncompressed) zip written by renderPackage.storedZip. */
function unzip(bytes:Buffer){
  const end=bytes.length-22;expect(bytes.readUInt32LE(end)).toBe(0x06054b50);
  const count=bytes.readUInt16LE(end+10);let at=bytes.readUInt32LE(end+16);const files:Record<string,Buffer>={};
  for(let i=0;i<count;i++){
    expect(bytes.readUInt32LE(at)).toBe(0x02014b50);
    const size=bytes.readUInt32LE(at+24),nameLength=bytes.readUInt16LE(at+28),local=bytes.readUInt32LE(at+42);
    const name=bytes.subarray(at+46,at+46+nameLength).toString('utf8');
    const start=local+30+bytes.readUInt16LE(local+26);
    files[name]=bytes.subarray(start,start+size);at+=46+nameLength;
  }
  return files;
}

test('exporta el paquete de render Cycles con geometría GLB, IDs estables y avisa si el motor no está',{tag:'@smoke'},async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  // CI has no Blender: the local engine is unreachable on purpose.
  await page.route('http://127.0.0.1:8765/**',route=>route.abort());
  await page.goto('/');
  await page.getByRole('button',{name:'Vista 3D',exact:true}).click();
  await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Imagen y cámara',exact:true}).click();
  const panel=page.getByRole('region',{name:'Render fotorrealista con Cycles'});
  await expect(panel.getByRole('status')).toContainText('Motor no conectado');
  await expect(panel.getByText(/No hay conexión con el motor de render/).first()).toBeVisible();

  await panel.getByLabel('Iluminación Cycles',{exact:true}).selectOption('afternoon');
  await panel.getByLabel('Resolución Cycles',{exact:true}).selectOption('960x540');
  const download=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Descargar paquete de render',exact:true}).click();
  const zip=await readFile(await (await download).path());
  const files=unzip(zip);
  expect(Object.keys(files)).toEqual(['scene.json','scene.glb','preview.png']);

  const manifest=JSON.parse(files['scene.json'].toString('utf8'));
  expect(manifest).toMatchObject({format:'atelier-render-package',schemaVersion:1,units:'m',upAxis:'Y'});
  expect(manifest.render).toMatchObject({width:960,height:540,samples:256});
  expect(manifest.geometry.bytes).toBe(files['scene.glb'].length);
  const furniture=manifest.objects.filter((o:{type:string})=>o.type==='furniture');
  expect(furniture.length).toBeGreaterThan(0);
  expect(manifest.lighting.sun.strength).toBeGreaterThan(0);

  // GLB: binary glTF whose JSON chunk keeps the editor ids as extras and named materials.
  const glb=files['scene.glb'];
  expect(glb.subarray(0,4).toString('latin1')).toBe('glTF');
  const json=glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8');
  for(const item of furniture)expect(json).toContain(`"atelierId":"${item.id}"`);
  expect(json).toContain('"atelierType":"wall"');
  expect(json).not.toContain('renderExclude');
  // WebGL reference at the same aspect ratio as the requested render.
  const preview=files['preview.png'];
  expect(preview.readUInt32BE(16)/preview.readUInt32BE(20)).toBeCloseTo(960/540,2);

  // Generating without an engine explains how to start it instead of failing silently.
  await panel.getByRole('button',{name:'Generar render Cycles',exact:true}).click();
  await expect(page.locator('.studio-message')).toContainText(/motor de render/);
  expect(errors).toEqual([]);
});
