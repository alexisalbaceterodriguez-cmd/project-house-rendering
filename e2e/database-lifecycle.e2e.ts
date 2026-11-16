import { expect, test, type Page } from '@playwright/test';
import type { SavedDesign } from '../src/lib/projectLibrary';

type HoldingWindow = Window & { heldDatabase?: IDBDatabase; upgradeAborted?: boolean };
const assetsName = 'atelier60-assets-v1';
const versionsName = 'atelier60-project-library';

async function editor(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  await expect(page.getByText('Guardado en este navegador', { exact: true })).toBeVisible();
}
async function studio(page: Page, section: string) {
  await page.getByRole('button', { name: 'Estudio · modelos, acabados y versiones', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: section, exact: true }).click();
}

/** Hold an older connection in a second tab, either cooperative or from an old app. */
async function holdDatabase(page: Page, name: string, cooperative: boolean) {
  await page.evaluate(async ({ name, cooperative, assetsName }) => {
    // The sidebar creates assets v2 on mount. Replace only this isolated test fixture
    // before simulating an older app; otherwise opening v1 fails with VersionError.
    if (name === assetsName) await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('No se pudo preparar la base antigua'));
    });
    const upgrade = (database: IDBDatabase) => {
      if (name === assetsName) database.createObjectStore('models');
      else database.createObjectStore('designs', { keyPath: 'id' });
    };
    let database: IDBDatabase;
    if (cooperative) {
      const moduleUrl = '/src/lib/browserDatabase.ts';
      const { openBrowserDatabase } = await import(moduleUrl);
      database = await openBrowserDatabase({ name, version: 1, upgrade });
    } else {
      database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => upgrade(request.result);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    }
    (window as HoldingWindow).heldDatabase = database;
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(name === assetsName ? 'models' : 'designs', 'readwrite');
      if (name === assetsName) tx.objectStore('models').put(new Blob(['original model bytes']), 'old-model');
      else tx.objectStore('designs').put({ id: 'saved-version', name: 'Versión conservada', savedAt: new Date().toISOString(), project: JSON.parse(localStorage.getItem('atelier-60-project-v1')!) });
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }, { name, cooperative, assetsName });
}

function glb(): Buffer {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] }));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]), buffer = Buffer.alloc(20 + padded.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); return buffer;
}
async function inspectAssets(page: Page) {
  return page.evaluate(name => new Promise<{ version: number; count: number; original: string }>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result, tx = database.transaction('models', 'readonly');
      const count = tx.objectStore('models').count(), original = tx.objectStore('models').get('old-model');
      tx.oncomplete = () => { database.close(); void original.result.text().then((text: string) => resolve({ version: database.version, count: count.result, original: text }), reject); };
      tx.onerror = () => { database.close(); reject(tx.error); };
    };
  }), assetsName);
}

async function inspectDesigns(page: Page) {
  return page.evaluate(name => new Promise<{ version: number; designs: SavedDesign[] }>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result, tx = database.transaction('designs', 'readonly');
      const designs = tx.objectStore('designs').getAll();
      tx.oncomplete = () => { database.close(); resolve({ version: database.version, designs: designs.result }); };
      tx.onerror = tx.onabort = () => { database.close(); reject(tx.error); };
    };
  }), versionsName);
}

test('la pestaña antigua libera su conexión al actualizar la biblioteca de modelos', async ({ page, context }) => {
  await editor(page); await holdDatabase(page, assetsName, true);
  const other = await context.newPage(); await editor(other); await studio(other, 'Plano y revisión');
  await expect(other.locator('.resource-row').getByText(/old-model/)).toBeVisible();
  expect(await inspectAssets(other)).toEqual({ version: 2, count: 1, original: 'original model bytes' });
  expect(await page.evaluate(() => {
    try { (window as HoldingWindow).heldDatabase!.transaction('models'); return false; }
    catch (error) { return error instanceof DOMException && error.name === 'InvalidStateError'; }
  })).toBe(true);
  await expect(page.getByLabel('Nombre del proyecto', { exact: true })).toBeEditable();
});

test('un bloqueo avisa, abandona la migración y permite reintentar sin perder modelos', async ({ page, context }) => {
  const errors: string[] = [];
  await editor(page); await holdDatabase(page, assetsName, false);
  const other = await context.newPage(); other.on('pageerror', error => errors.push(error.message));
  await editor(other); await other.getByLabel('Nombre del proyecto', { exact: true }).fill('Proyecto protegido');
  await expect(other.getByRole('alert')).toContainText('Otra pestaña está bloqueando el almacenamiento local');
  const file = { name: 'reintento.glb', mimeType: 'model/gltf-binary', buffer: glb() };
  const input = other.locator('input[type="file"][accept*=".glb"]');
  await input.setInputFiles(file);
  await expect(other.locator('.toast')).toContainText('Otra pestaña está bloqueando el almacenamiento local', { timeout: 15_000 });
  await expect(other.getByLabel('Nombre del proyecto', { exact: true })).toHaveValue('Proyecto protegido');
  await page.evaluate(() => (window as HoldingWindow).heldDatabase!.close());
  // The rejected request must not silently upgrade the schema after the blocker closes.
  expect(await inspectAssets(other)).toEqual({ version: 1, count: 1, original: 'original model bytes' });
  await input.setInputFiles(file);
  await expect(other.getByText('Modelo guardado en IndexedDB e importado al proyecto.', { exact: true })).toBeVisible();
  expect(await inspectAssets(other)).toEqual({ version: 2, count: 2, original: 'original model bytes' });
  expect(errors).toEqual([]);
});

test('una versión más reciente en otra pestaña conserva propuestas y avisa sin bloquear el editor', async ({ page, context }) => {
  await editor(page); await holdDatabase(page, versionsName, true);
  const before = await inspectDesigns(page);
  const other = await context.newPage(); await editor(other);
  const savedCount = await other.evaluate(name => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onblocked = () => reject(new Error('La conexión anterior no se liberó'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result, tx = database.transaction('designs', 'readonly'), count = tx.objectStore('designs').count();
      tx.oncomplete = () => { database.close(); resolve(count.result); };
      tx.onerror = () => { database.close(); reject(tx.error); };
    };
  }), versionsName);
  expect(savedCount).toBe(1);
  await studio(page, 'Versiones');
  const save = page.getByRole('button', { name: 'Guardar versión del proyecto', exact: true });
  await save.click();
  await expect(page.getByText('Los datos locales pertenecen a una versión más reciente de Atelier 60. Recarga la aplicación antes de volver a intentarlo.', { exact: true })).toBeVisible();
  await expect(save).toBeEnabled(); await page.getByRole('button', { name: 'Cerrar estudio', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto', { exact: true })).toBeEditable();
  expect(await inspectDesigns(other)).toEqual({ ...before, version: 2 });
});

test('una apertura de versiones en cola termina con aviso y permite reintentar sin guardados tardíos', async ({ page, context }) => {
  const errors: string[] = [];
  await editor(page); await holdDatabase(page, versionsName, false);
  const before = await inspectDesigns(page);
  const other = await context.newPage(); other.on('pageerror', error => errors.push(error.message));
  await editor(other);
  // A pending upgrade blocks subsequent opens without firing their own blocked event.
  // Abort this simulated deployment once the old tab closes so the app can retry v1.
  await other.evaluate(name => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onblocked = () => resolve();
    request.onupgradeneeded = () => request.transaction!.abort();
    request.onerror = () => {
      if (request.error?.name === 'AbortError') (window as HoldingWindow).upgradeAborted = true;
      else reject(request.error);
    };
    request.onsuccess = () => { request.result.close(); reject(new Error('Se esperaba una conexión bloqueada')); };
  }), versionsName);
  await studio(other, 'Versiones');
  const save = other.getByRole('button', { name: 'Guardar versión del proyecto', exact: true });
  await save.click();
  await expect(other.getByText(/Otra pestaña está bloqueando el almacenamiento local/)).toBeVisible({ timeout: 15_000 });
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await other.getByRole('button', { name: 'Cerrar estudio', exact: true }).click();
  await other.getByLabel('Nombre del proyecto', { exact: true }).fill('Proyecto tras bloqueo');
  await page.evaluate(() => (window as HoldingWindow).heldDatabase!.close());
  await expect.poll(() => other.evaluate(() => (window as HoldingWindow).upgradeAborted)).toBe(true);
  expect(await inspectDesigns(other)).toEqual(before);
  await studio(other, 'Versiones');
  await expect(other.locator('.version-list article strong').filter({ hasText: 'Versión conservada' })).toBeVisible();
  await other.getByLabel('Nombre de la versión', { exact: true }).fill('Reintento confirmado');
  await save.click();
  await expect(other.getByText('Versión guardada con geometría, modelos, acabados y cámara.', { exact: true })).toBeVisible();
  const after = await inspectDesigns(other);
  expect(after.version).toBe(1); expect(after.designs).toHaveLength(2);
  expect(after.designs).toContainEqual(before.designs[0]);
  expect(after.designs.find(design => design.name === 'Reintento confirmado')?.project.name).toBe('Proyecto tras bloqueo');
  expect(errors).toEqual([]);
});
