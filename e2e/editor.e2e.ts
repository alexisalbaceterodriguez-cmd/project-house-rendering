import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// Map metric plan coordinates to the real browser viewport, including SVG
// viewBox scaling and margins. This tests pointer interactions, not store internals.
async function planPoint(page: Page, x: number, y: number) {
  return page.locator('.plan-svg').evaluate((element, pos) => {
    const svg = element as SVGSVGElement;
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('El plano SVG no tiene una transformación de pantalla');
    const point = svg.createSVGPoint();
    point.x = pos.x;
    point.y = pos.y;
    const screen = point.matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  }, { x, y });
}

test('crear, editar, deshacer, guardar y recuperar una vivienda', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  await expect(page.locator('.plan-svg')).toBeVisible();

  // New creates a real editable shell with four perimeter walls.
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await expect(page.locator('.plan-wall')).toHaveCount(4);
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Nuevo proyecto');
  await page.getByLabel('Nombre del proyecto').fill('Vivienda E2E');

  await page.getByLabel('Ancho de la vivienda').fill('12');
  await page.getByLabel('Fondo de la vivienda').fill('7');
  await page.getByRole('button', { name: 'Actualizar la planta' }).click();
  await expect(page.locator('.plan-topline')).toContainText('12.0 × 7.0 m');

  // Draw an interior partition through the UI using SVG pointer coordinates.
  await page.getByRole('button', { name: 'Tabique' }).click();
  const a = await planPoint(page, 2, 2);
  const b = await planPoint(page, 5, 2);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  await expect(page.locator('.plan-wall')).toHaveCount(5);

  await page.getByRole('button', { name: 'Seleccionar' }).click();
  const wall = page.locator('.plan-wall').last();
  expect(Number(await wall.getAttribute('y1'))).toBeCloseTo(2, 1);
  const start = await planPoint(page, 3.5, 2);
  const end = await planPoint(page, 3.5, 3);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await wall.getAttribute('y1'))).toBeGreaterThan(2.4);

  // A drag should be one reversible history operation.
  await page.locator('button[title^="Deshacer"]').click();
  await expect.poll(async () => Number(await wall.getAttribute('y1'))).toBe(2);
  await page.locator('button[title^="Rehacer"]').click();
  await expect.poll(async () => Number(await wall.getAttribute('y1'))).toBeGreaterThan(2.4);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const download = await downloadPromise;
  const buffer = await readFile(await download.path());
  const exported = JSON.parse(buffer.toString('utf8')) as {
    name: string; width: number; depth: number; walls: Array<{ a: { y: number }; b: { y: number } }>;
  };
  expect(exported.name).toBe('Vivienda E2E');
  expect(exported.width).toBe(12);
  expect(exported.depth).toBe(7);
  expect(exported.walls).toHaveLength(5);
  expect(exported.walls[4].a.y).toBeGreaterThan(2.4);

  // Verify that autosave survives a page reload (not just in-memory state).
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('atelier-60-project-v1');
    if (!raw) return null;
    const project = JSON.parse(raw) as { width: number; walls: unknown[] };
    return project.width === 12 && project.walls.length === 5;
  })).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  await expect(page.locator('.plan-topline')).toContainText('12.0 × 7.0 m');
  await expect(page.locator('.plan-wall')).toHaveCount(5);

  // Import the exact downloaded JSON after replacing the active project.
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await expect(page.locator('.plan-wall')).toHaveCount(4);
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: 'vivienda-e2e.json',
    mimeType: 'application/json',
    buffer,
  });
  await expect(page.getByText('Proyecto cargado correctamente.')).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Vivienda E2E');
  await expect(page.locator('.plan-topline')).toContainText('12.0 × 7.0 m');
  await expect(page.locator('.plan-wall')).toHaveCount(5);
  expect(Number(await page.locator('.plan-wall').last().getAttribute('y1'))).toBeGreaterThan(2.4);
});

test('rechaza JSON corrupto sin perder el proyecto activo ni sus paredes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await page.getByLabel('Nombre del proyecto').fill('Trabajo que no debe perderse');
  await page.getByLabel('Ancho de la vivienda').fill('11');
  await page.getByRole('button', { name: 'Actualizar la planta' }).click();
  await expect(page.locator('.plan-topline')).toContainText('11.0');
  await expect(page.locator('.plan-wall')).toHaveCount(4);

  // Both syntactically broken JSON and a structurally invalid project must
  // leave the existing editor state untouched.
  for (const [name, contents] of [
    ['broken.json', '{invalid'],
    ['wrong-schema.json', JSON.stringify({ version: 1, name: 'Not a project' })],
  ]) {
    await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(contents),
    });
    await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Trabajo que no debe perderse');
    await expect(page.locator('.plan-topline')).toContainText('11.0');
    await expect(page.locator('.plan-wall')).toHaveCount(4);
  }
});

test('recupera el respaldo válido cuando el guardado principal está corrupto', async ({ page }) => {
  await page.goto('/');
  // A fresh browser context has no saved project until autosave has run.
  // Exercise real saves through the UI instead of assuming localStorage
  // already contains a project immediately after page.goto().
  await page.getByLabel('Nombre del proyecto').fill('Respaldo recuperable');
  await expect.poll(async () => page.evaluate(() => {
    const primary = localStorage.getItem('atelier-60-project-v1');
    const backup = localStorage.getItem('atelier-60-project-v1-backup');
    return !!primary && !!backup
      && JSON.parse(primary).name === 'Respaldo recuperable'
      && JSON.parse(backup).name === 'Respaldo recuperable';
  })).toBe(true);

  // The next save should retain the previous good revision as backup.
  await page.getByLabel('Nombre del proyecto').fill('Cambio posterior');
  await expect.poll(async () => page.evaluate(() => {
    const primary = localStorage.getItem('atelier-60-project-v1');
    const backup = localStorage.getItem('atelier-60-project-v1-backup');
    return !!primary && !!backup
      && JSON.parse(primary).name === 'Cambio posterior'
      && JSON.parse(backup).name === 'Respaldo recuperable';
  })).toBe(true);

  await page.evaluate(() => localStorage.setItem('atelier-60-project-v1', '{broken'));
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Respaldo recuperable');
});


test('conserva un modelo GLB en IndexedDB y en un JSON portable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();

  // Minimal valid binary glTF 2.0 scene. No network models or third-party assets.
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] }));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const glb = Buffer.alloc(20 + padded.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);

  await page.locator('input[type="file"][accept*=".glb"]').setInputFiles({
    name: 'modelo-portable.glb', mimeType: 'model/gltf-binary', buffer: glb,
  });
  await expect(page.getByText('Modelo guardado en IndexedDB e importado al proyecto.')).toBeVisible();

  const stored = await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('atelier-60-project-v1') ?? '{}') as {
      furniture?: Array<{ kind: string; assetId?: string; modelData?: string }>;
    };
    return project.furniture?.find(f => f.kind === 'model');
  });
  // Autosave is debounced; the imported model must have an asset reference,
  // not a large inline data URL in localStorage.
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('atelier-60-project-v1');
    const data = raw && JSON.parse(raw) as { furniture: Array<{ kind: string; assetId?: string }> };
    return !!data?.furniture.some(f => f.kind === 'model' && !!f.assetId);
  })).toBe(true);
  expect(stored?.modelData).toBeUndefined();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const downloaded = await downloadPromise;
  const portable = await readFile(await downloaded.path());
  const exported = JSON.parse(portable.toString('utf8')) as {
    furniture: Array<{ kind: string; assetId?: string; modelData?: string }>;
  };
  const model = exported.furniture.find(f => f.kind === 'model');
  expect(model?.assetId).toBeUndefined();
  expect(model?.modelData).toMatch(/^data:.*;base64,/);
  expect(Buffer.from(model!.modelData!.split(',')[1], 'base64')).toEqual(glb);

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: 'portable.json', mimeType: 'application/json', buffer: portable,
  });
  await expect(page.getByText('Proyecto cargado correctamente.')).toBeVisible();
  const secondDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const second = JSON.parse((await readFile(await (await secondDownload).path())).toString('utf8')) as typeof exported;
  const restored = second.furniture.find(f => f.kind === 'model');
  expect(restored?.modelData).toBe(model?.modelData);
  expect(restored?.assetId).toBeUndefined();
});


test('impide exportar un JSON incompleto si falta un modelo en IndexedDB', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();

  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] }));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const glb = Buffer.alloc(20 + padded.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  await page.locator('input[type="file"][accept*=".glb"]').setInputFiles({
    name: 'modelo-que-desaparece.glb', mimeType: 'model/gltf-binary', buffer: glb,
  });
  await expect(page.getByText('Modelo guardado en IndexedDB e importado al proyecto.')).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('atelier-60-project-v1');
    const project = raw && JSON.parse(raw) as { furniture: Array<{ assetId?: string }> };
    return !!project?.furniture.some(f => f.assetId);
  })).toBe(true);

  // Simulate browser storage eviction without changing the project geometry.
  await page.evaluate(async () => {
    const raw = localStorage.getItem('atelier-60-project-v1');
    if (!raw) throw Error('Missing saved project');
    const project = JSON.parse(raw) as { furniture: Array<{ assetId?: string }> };
    const id = project.furniture.find(f => f.assetId)?.assetId;
    if (!id) throw Error('Missing model asset reference');
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('atelier60-assets-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('models', 'readwrite');
        transaction.objectStore('models').delete(id);
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    });
  });

  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.getByRole('button', { name: 'Exportar' }).click();
  await expect(page.getByText(/Falta el modelo .* en este navegador/)).toBeVisible();
  expect(downloaded).toBe(false);
  await expect(page.locator('.plan-wall')).toHaveCount(4);
});


test('rechaza un GLB corrupto sin añadir muebles ni guardar activos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await expect(page.locator('.plan-wall')).toHaveCount(4);

  // A .glb extension is not proof that the binary payload is glTF.
  await page.locator('input[type="file"][accept*=".glb"]').setInputFiles({
    name: 'corrupto.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.from('not-a-valid-binary-glb'),
  });
  await expect(page.getByText('El archivo no es un GLB 2.0 válido.')).toBeVisible();
  await expect(page.locator('.plan-wall')).toHaveCount(4);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const exported = JSON.parse((await readFile(await (await downloadPromise).path())).toString('utf8')) as { furniture: unknown[] };
  expect(exported.furniture).toHaveLength(0);
});


test('avisa de cuota de IndexedDB sin alterar el plano ni añadir un modelo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await expect(page.locator('.plan-wall')).toHaveCount(4);

  // Force a real IndexedDB transaction failure without filling the runner disk.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as Window & { restoreModelPut?: () => void }).restoreModelPut = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'models') throw new DOMException('Disk full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });

  try {
    const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] }));
    const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
    const glb = Buffer.alloc(20 + padded.length);
    glb.writeUInt32LE(0x46546c67, 0);
    glb.writeUInt32LE(2, 4);
    glb.writeUInt32LE(glb.length, 8);
    glb.writeUInt32LE(padded.length, 12);
    glb.writeUInt32LE(0x4e4f534a, 16);
    padded.copy(glb, 20);
    await page.locator('input[type="file"][accept*=".glb"]').setInputFiles({
      name: 'cuota.glb', mimeType: 'model/gltf-binary', buffer: glb,
    });
    await expect(page.getByText(/Almacenamiento de modelos 3D lleno/)).toBeVisible();
    await expect(page.locator('.plan-wall')).toHaveCount(4);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const download = await downloadPromise;
    const project = JSON.parse((await readFile(await download.path())).toString('utf8')) as { furniture: unknown[]; walls: unknown[] };
    expect(project.furniture).toHaveLength(0);
    expect(project.walls).toHaveLength(4);
  } finally {
    await page.evaluate(() => (window as Window & { restoreModelPut?: () => void }).restoreModelPut?.());
  }
});


test('revierte activos escritos si falla el segundo GLB de una importación JSON', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const original = JSON.parse((await readFile(await (await downloadPromise).path())).toString('utf8'));
  const modelData = 'data:model/gltf-binary;base64,' + Buffer.from('example').toString('base64');
  original.furniture = [1, 2].map(n => ({
    id: 'import-model-' + n, kind: 'model', name: 'Modelo ' + n,
    x: 1 + n, y: 1, w: 1, d: 1, h: 1, rotation: 0,
    color: '#e2e2df', modelData,
  }));

  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    let count = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'models' && ++count === 2) {
        throw new DOMException('Disk full', 'QuotaExceededError');
      }
      return originalPut.apply(this, args);
    };
  });
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: 'dos-modelos.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(page.getByText(/Almacenamiento de modelos 3D lleno/)).toBeVisible();
  await expect(page.locator('.plan-wall')).toHaveCount(4);
  const keys = await page.evaluate(async () => {
    return new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = indexedDB.open('atelier60-assets-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('models', 'readonly');
        const keys = tx.objectStore('models').getAllKeys();
        keys.onsuccess = () => resolve(keys.result);
        keys.onerror = () => reject(keys.error);
        tx.oncomplete = () => db.close();
      };
    });
  });
  expect(keys).toHaveLength(0);
  const afterDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const after = JSON.parse((await readFile(await (await afterDownload).path())).toString('utf8'));
  expect(after.furniture).toHaveLength(0);
});
