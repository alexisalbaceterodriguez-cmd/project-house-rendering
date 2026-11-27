/**
 * Renders each scene written by scripts/accessory-scene.ts in the WebGL viewer and in Cycles with
 * the same camera: loads the project, exports the render package from the editor, posts it to the
 * local engine (python -m atelier_engine) and saves <name>-webgl.png / <name>-cycles.png.
 * Usage: node scripts/accessory-compare.mjs <scenes.json> <outDir> [baseUrl] [--webgl-only]
 * Needs the dev server (npm run dev -- --port 4173) and, unless --webgl-only, the engine running.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args=process.argv.slice(2),webglOnly=args.includes('--webgl-only');
const [scenesPath,outDir,base='http://127.0.0.1:4173']=args.filter(arg=>arg!=='--webgl-only');
const engine='http://127.0.0.1:8765';
const scenes=JSON.parse(await readFile(scenesPath,'utf8'));

function unzip(bytes){
  const end=bytes.length-22,count=bytes.readUInt16LE(end+10);let at=bytes.readUInt32LE(end+16);const files={};
  for(let i=0;i<count;i++){
    const size=bytes.readUInt32LE(at+24),nameLength=bytes.readUInt16LE(at+28),local=bytes.readUInt32LE(at+42);
    const name=bytes.subarray(at+46,at+46+nameLength).toString('utf8'),start=local+30+bytes.readUInt16LE(local+26);
    files[name]=bytes.subarray(start,start+size);at+=46+nameLength;
  }
  return files;
}

const browser=await chromium.launch({args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
for(const scene of scenes){
  const context=await browser.newContext({viewport:{width:1600,height:900},acceptDownloads:true});
  await context.addInitScript(project=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('atelier-60-project-v1',project);sessionStorage.setItem('seeded','1');}},JSON.stringify(scene.project));
  const page=await context.newPage();
  // The browser exports the package; this script posts it, so the editor must not see the engine.
  await page.route(`${engine}/**`,route=>route.abort());
  await page.goto(base);
  await page.getByRole('button',{name:'Vista 3D',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.scene-wrap')?.getAttribute('aria-busy')==='false',null,{timeout:120000});
  await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'Estudio · modelos, acabados y versiones',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Imagen y cámara',exact:true}).click();
  const panel=page.getByRole('region',{name:'Render fotorrealista con Cycles'});
  await panel.getByLabel('Iluminación Cycles',{exact:true}).selectOption(scene.preset);
  await panel.getByLabel('Resolución Cycles',{exact:true}).selectOption('1280x720');
  const download=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Descargar paquete de render',exact:true}).click();
  const zip=await readFile(await (await download).path());
  await context.close();
  const files=unzip(zip);
  await writeFile(join(outDir,`${scene.name}-webgl.png`),files['preview.png']);
  await writeFile(join(outDir,`${scene.name}.scene.json`),files['scene.json']);
  if(webglOnly){console.log(scene.name,'webgl ok');continue;}

  const posted=await fetch(`${engine}/renders`,{method:'POST',headers:{'content-type':'application/zip'},body:zip});
  const job=await posted.json();if(!posted.ok)throw new Error(JSON.stringify(job));
  const id=job.id??job.job?.id;let state;
  for(;;){
    state=await (await fetch(`${engine}/renders/${id}`)).json();
    if(['succeeded','failed','canceled'].includes(state.status))break;
    await new Promise(r=>setTimeout(r,2000));
  }
  if(state.status!=='succeeded')throw new Error(`${scene.name}: ${JSON.stringify(state.error??state)}`);
  await writeFile(join(outDir,`${scene.name}-cycles.png`),Buffer.from(await (await fetch(`${engine}/renders/${id}/outputs/beauty.png`)).arrayBuffer()));
  await writeFile(join(outDir,`${scene.name}.result.json`),Buffer.from(await (await fetch(`${engine}/renders/${id}/outputs/result.json`)).arrayBuffer()));
  console.log(scene.name,'ok',state.result?.renderSeconds??'');
}
await browser.close();
