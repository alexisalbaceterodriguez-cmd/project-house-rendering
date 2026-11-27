// Genera las capturas de MANUAL.md a partir del editor real.
// Uso: con el editor (npm run dev) y, opcionalmente, el motor de render en marcha:
//   node scripts/manual-screenshots.mjs [urlEditor] [urlMotor]
// Por defecto: http://127.0.0.1:5173 y http://127.0.0.1:8765. Salida: docs/manual/*.png
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const ENGINE = process.argv[3] ?? 'http://127.0.0.1:8765';
const OUT = new URL('../docs/manual/', import.meta.url);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'es-ES', acceptDownloads: true });
await context.addInitScript(url => { try { localStorage.setItem('atelier-60-render-engine', url); } catch { /* sin almacenamiento */ } }, ENGINE);
const page = await context.newPage();
page.on('dialog', d => d.accept());

/** Dibuja recuadros rojos numerados sobre los elementos indicados. */
async function mark(items) {
  const boxes = [];
  for (const [locator, label] of items) {
    if (!(await locator.count())) { console.warn("sin elemento para", label); continue; }
    const box = await locator.first().boundingBox();
    if (box) boxes.push({ ...box, label });
  }
  await page.evaluate(list => {
    // Capa "popover" en la capa superior: queda por encima incluso del diálogo modal del Estudio.
    const layer = document.createElement('div');
    layer.className = '__manual-mark';
    layer.setAttribute('popover', 'manual');
    Object.assign(layer.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', margin: '0', padding: '0', border: '0', background: 'transparent', overflow: 'visible', pointerEvents: 'none' });
    document.body.appendChild(layer);
    layer.showPopover();
    for (const b of list) {
      const el = document.createElement('div');
      el.className = '__manual-mark';
      Object.assign(el.style, { position: 'fixed', left: `${b.x - 4}px`, top: `${b.y - 4}px`, width: `${b.width + 8}px`, height: `${b.height + 8}px`, border: '3px solid #e0322b', borderRadius: '8px', zIndex: 2147483647, pointerEvents: 'none', boxSizing: 'border-box' });
      if (b.label) {
        const tag = document.createElement('span');
        tag.textContent = b.label;
        Object.assign(tag.style, { position: 'absolute', left: b.x < 24 ? '4px' : '-14px', top: b.y < 24 ? '4px' : '-14px', minWidth: '24px', height: '24px', padding: '0 6px', borderRadius: '12px', background: '#e0322b', color: '#fff', font: '700 13px/24px system-ui, sans-serif', textAlign: 'center', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,.35)' });
        el.appendChild(tag);
      }
      layer.appendChild(el);
    }
  }, boxes);
}
const clear = () => page.evaluate(() => document.querySelectorAll('.__manual-mark').forEach(e => e.remove()));
async function shot(name, items = [], clip) {
  await mark(items);
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1'), clip });
  await clear();
  console.log('captura', name);
}
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
const settle = (ms = 1200) => page.waitForTimeout(ms);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await settle(3000);

// 01 · Vista general
const header = page.locator('header').first();
const aside = page.locator('aside.sidebar');
const toolbar = page.locator('.editor-toolbar');
const plan = page.locator('.plan-wrap');
const view3d = page.locator('.scene-host');
await shot('01-pantalla-general', [
  [header, '1'], [aside, '2'], [toolbar, '3'], [plan, '4'], [view3d, '5'], [button('Estudio · modelos, acabados y versiones'), '6'], [button('Guía de uso'), '7'],
]);

// 02 · Barra superior
const headerBox = await header.boundingBox();
await shot('02-barra-superior', [
  [page.getByLabel('Nombre del proyecto'), '1'], [page.getByTitle('Deshacer (Ctrl+Z)'), '2'], [page.locator('.header-center .mode-button').first(), '3'],
  [page.getByTitle('Crear plano en blanco'), '4'], [page.getByTitle('Abrir proyecto JSON'), '5'], [page.getByTitle('Guardar proyecto JSON'), '6'],
  [page.getByTitle('Descargar captura PNG'), '7'], [page.getByTitle('Restaurar proyecto de ejemplo'), '8'],
], { x: 0, y: 0, width: 1440, height: Math.ceil((headerBox?.height ?? 64) + 16) });

// 03 · Herramientas
const tbBox = await toolbar.boundingBox();
await shot('03-herramientas', [
  [button('Seleccionar', toolbar), '1'], [button('Tabique', toolbar), '2'], [button('Puerta', toolbar), '3'], [button('Ventana', toolbar), '4'], [button('Estancia', toolbar), '5'],
  [button('Dimensiones', toolbar), '6'], [button('Muros', toolbar), '7'], [button('Sección', toolbar), '8'],
], { x: Math.max(0, tbBox.x - 20), y: Math.max(0, tbBox.y - 20), width: Math.min(1440 - Math.max(0, tbBox.x - 20), tbBox.width + 40), height: tbBox.height + 40 });

// 04 · Catálogo y propiedades: añadir un sofá
const sofa = aside.getByRole('button', { name: /Sofá de 3 plazas/ }).first();
await shot('04-catalogo', [[aside.getByRole('button', { name: 'Objetos' }).first(), '1'], [aside.getByRole('textbox').first(), '2'], [sofa, '3']], { x: 0, y: 0, width: 520, height: 900 });
await sofa.click();
await settle(1500);
await shot('05-propiedades', [[page.locator('aside.inspector'), '']]);
await page.keyboard.press('Delete'); // retira el sofá de prueba para no alterar el ejemplo
await settle();

// 06 · Dimensiones
await page.keyboard.press('Escape');
await button('Dimensiones', toolbar).click();
await settle();
await shot('06-dimensiones', [[page.getByLabel('Ancho de la vivienda'), '1'], [page.getByLabel('Fondo de la vivienda'), '2'], [button('Actualizar la planta'), '3']]);

// 07 · Vista 3D
await button('Vista 3D').click();
await settle(2500);
await shot('07-vista-3d', [[button('Cenital'), '1'], [page.getByLabel('Presentar en pantalla completa'), '2']]);
await button('Mixto').click();
await settle();

// 08 · Guía de uso
await button('Guía de uso').click();
await settle(600);
await shot('08-guia-de-uso');
await button('Empezar a diseñar').click();

// Encuadre guardado del salón (el mismo de render-engine/demo), como si el usuario lo hubiera guardado.
// Se aplica antes de que arranque la aplicación: el guardado al salir de la pestaña pisaría un cambio hecho antes de recargar.
await page.evaluate(() => sessionStorage.setItem('__manualCamera', '1'));
await page.addInitScript(() => {
  if (sessionStorage.getItem('__manualCamera') !== '1') return;
  sessionStorage.removeItem('__manualCamera');
  for (const key of ['atelier-60-project-v1', 'atelier-60-project-v1-backup']) {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!stored) continue;
    const project = stored.project ?? stored;
    project.render = { lighting: 'day', exposure: 1, quality: 'draft', ...project.render, camera: { position: [3.88, 1.4, 3.3], target: [0.9, 1, 0.7] } };
    localStorage.setItem(key, JSON.stringify(stored));
  }
});
await page.reload();
await page.waitForLoadState('networkidle');
await settle(3000);

// 09-14 · Estudio y sus pestañas
await button('Estudio · modelos, acabados y versiones').click();
const dialog = page.getByRole('dialog');
await settle();
await shot('09-estudio-pestanas', [[dialog.getByRole('navigation', { name: 'Secciones del estudio' }), '']]);
const tabs = [['Acabados', '10-estudio-acabados'], ['Cocina y baño', '11-estudio-cocina-bano'], ['Versiones', '12-estudio-versiones'], ['Plano y revisión', '13-estudio-plano-revision']];
for (const [tab, name] of tabs) { await button(tab, dialog).click(); await settle(); await shot(name, [[button(tab, dialog), '']]); }

// 14-16 · Render Cycles
await button('Imagen y cámara', dialog).click();
await settle(2000);
const cycles = page.getByRole('region', { name: 'Render fotorrealista con Cycles' });
await dialog.getByRole('button', { name: 'Guardar encuadre actual' }).scrollIntoViewIfNeeded();
await settle();
await shot('14-imagen-y-camara', [[dialog.getByRole('button', { name: 'Guardar encuadre actual' }), '1'], [dialog.getByRole('button', { name: 'Exportar imagen PNG' }), '2']]);
await cycles.scrollIntoViewIfNeeded();
await settle();
await cycles.getByLabel('Calidad Cycles').selectOption('draft');
const res = cycles.getByLabel('Resolución Cycles');
const smallest = await res.locator('option').first().getAttribute('value');
await res.selectOption(smallest);
await shot('15-cycles-ajustes', [
  [cycles.getByLabel('Iluminación Cycles'), '1'], [cycles.getByLabel('Calidad Cycles'), '2'], [res, '3'],
  [button('Generar render Cycles', cycles), '4'], [button('Descargar paquete de render', cycles), '5'],
]);
const connected = await cycles.getByText(/Motor no conectado/).count() === 0;
if (connected) {
  await button('Generar render Cycles', cycles).click();
  await cycles.getByRole('button', { name: 'Cancelar render' }).waitFor({ state: 'attached', timeout: 60_000 }).catch(() => {});
  await cycles.getByRole('button', { name: 'Cancelar render' }).waitFor({ state: 'detached', timeout: 600_000 });
  await settle(3000);
  const download = cycles.getByRole('button', { name: 'Descargar PNG' }).first();
  await download.scrollIntoViewIfNeeded();
  // Solo la tarjeta del render recién terminado (la galería puede contener renders anteriores).
  const card = await download.locator('xpath=ancestor::*[.//img][1]').boundingBox();
  await shot('16-cycles-resultado', [[download, '']], card ? { x: card.x - 8, y: card.y - 8, width: card.width + 16, height: Math.min(card.height + 16, 900 - card.y + 8) } : undefined);
} else {
  console.warn('Motor no conectado: se omite 16.');
}

await browser.close();
