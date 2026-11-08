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
