import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

function brokenGlb(): Buffer {
  // Valid GLB container, invalid JSON chunk: header checks alone accept it.
  const json = Buffer.from('{broken ');
  const glb = Buffer.alloc(20 + json.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  json.copy(glb, 20);
  return glb;
}

test('mantiene visibles las acciones de pared dentro del inspector', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  const point = await page.locator('.plan-svg').evaluate((svg: SVGSVGElement) => {
    const point = svg.createSVGPoint(); point.x = 6.8; point.y = 1.5;
    const screen = point.matrixTransform(svg.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.getByText('PARED SELECCIONADA', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar tabique', exact: true })).toBeVisible();
  const overflow = await page.locator('.inspector-scroll').evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('rechaza un modelo corrupto dentro de JSON y conserva el proyecto al abrir 3D', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Trabajo protegido');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const project = JSON.parse((await readFile(await (await downloadEvent).path())).toString('utf8'));
  project.name = 'Importación corrupta';
  project.furniture.push({
    id: 'broken-model', kind: 'model', name: 'GLB roto', x: 2, y: 2,
    w: 1, d: 1, h: 1, rotation: 0, color: '#ffffff',
    modelData: `data:model/gltf-binary;base64,${brokenGlb().toString('base64')}`,
  });
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: 'corrupto.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByText('El modelo GLB no se puede leer.')).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Trabajo protegido');
  await page.getByRole('button', { name: 'Vista 3D', exact: true }).click();
  await expect(page.locator('.scene-wrap canvas')).toBeVisible();
  const exportedEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const exported = JSON.parse((await readFile(await (await exportedEvent).path())).toString('utf8'));
  expect(exported.furniture.some((item: { id: string }) => item.id === 'broken-model')).toBe(false);
  expect(errors).toEqual([]);
});

test('rechaza GLB con cabecera válida y contenido ilegible antes de guardarlo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  await page.locator('input[type="file"][accept*=".glb"]').setInputFiles({
    name: 'cabecera-valida.glb', mimeType: 'model/gltf-binary', buffer: brokenGlb(),
  });
  await expect(page.getByText('El modelo GLB no se puede leer.')).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const project = JSON.parse((await readFile(await (await downloadEvent).path())).toString('utf8'));
  expect(project.furniture.some((item: { kind: string }) => item.kind === 'model')).toBe(false);
});

test('renderiza la vivienda y exporta un PNG tras cambiar entre las tres vistas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.plan-svg')).toBeVisible();
  await expect(page.locator('.scene-wrap canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  await expect(page.locator('.scene-wrap canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vista 3D', exact: true }).click();
  await expect(page.locator('.scene-wrap canvas')).toBeVisible();
  await expect.poll(() => page.locator('.scene-wrap canvas').evaluate((canvas: HTMLCanvasElement) => {
    // Read the displayed image through 2D canvas; Three.js may use a floating
    // point framebuffer that cannot be read with UNSIGNED_BYTE directly.
    const copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d')!;
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 160) {
      if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    return colors.size;
  })).toBeGreaterThan(10);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Imagen', exact: true }).click();
  const png = await readFile(await (await downloadEvent).path());
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.length).toBeGreaterThan(10_000);
  await page.getByRole('button', { name: 'Mixto', exact: true }).click();
  await expect(page.locator('.plan-svg')).toBeVisible();
  await expect(page.locator('.scene-wrap canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
