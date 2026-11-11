import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../src/types';

const assetId = 'retention-test-model';
const backupKey = 'atelier-60-project-v1-backup';
const protectedMessage = 'Este recurso está en uso por el proyecto, un respaldo, una versión o el historial. Consérvalo para evitar pérdidas.';

function glb(): Buffer {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] }));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const buffer = Buffer.alloc(20 + padded.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20);
  return buffer;
}

async function openResources(page: Page) {
  await page.getByRole('button', { name: 'Estudio · modelos, acabados y versiones', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Plano y revisión', exact: true }).click();
  return page.getByRole('button', { name: 'Eliminar recurso Modelo de prueba', exact: true });
}

async function seedResource(page: Page, inBackup = false) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  await expect(page.getByText('Guardado en este navegador', { exact: true })).toBeVisible();
  await page.evaluate(async ({ id, bytes, inBackup, backupKey }) => {
    const project = JSON.parse(localStorage.getItem('atelier-60-project-v1')!) as Project;
    project.name = 'Respaldo con modelo';
    if (inBackup) project.furniture.push({ id: 'retained-object', kind: 'model', name: 'Modelo de prueba',
      x: 2, y: 2, w: 1, d: 1, h: 1, rotation: 0, color: '#ffffff', assetId: id });
    localStorage.setItem(backupKey, JSON.stringify(project));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('atelier60-assets-v1', 2);
      request.onupgradeneeded = () => {
        for (const store of ['models', 'model-metadata']) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(['models', 'model-metadata'], 'readwrite');
        tx.objectStore('models').put(new Blob([new Uint8Array(bytes)], { type: 'model/gltf-binary' }), id);
        tx.objectStore('model-metadata').put({ name: 'Modelo de prueba', license: 'Modelo propio de prueba' }, id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }, { id: assetId, bytes: [...glb()], inBackup, backupKey });
}

async function resourceState(page: Page) {
  return page.evaluate(id => new Promise<{ blob: boolean; metadata: boolean }>((resolve, reject) => {
    const request = indexedDB.open('atelier60-assets-v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['models', 'model-metadata'], 'readonly');
      const model = tx.objectStore('models').get(id), metadata = tx.objectStore('model-metadata').get(id);
      tx.oncomplete = () => { db.close(); resolve({ blob: model.result instanceof Blob, metadata: !!metadata.result }); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), assetId);
}

test('conserva un GLB usado solo por el respaldo y permite recuperar y exportar el proyecto', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await seedResource(page, true);
  const remove = await openResources(page);
  await remove.click();
  await expect(page.getByText(protectedMessage, { exact: true })).toBeVisible();
  expect(await resourceState(page)).toEqual({ blob: true, metadata: true });
  await page.getByRole('button', { name: 'Cerrar estudio', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('atelier-60-project-v1', '{corrupt'));
  await page.reload();
  await expect(page.getByLabel('Nombre del proyecto', { exact: true })).toHaveValue('Respaldo con modelo');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const restored = JSON.parse((await readFile(await (await downloadEvent).path())).toString('utf8')) as Project;
  const model = restored.furniture.find(f => f.id === 'retained-object')!;
  expect(model.modelData).toBe(`data:model/gltf-binary;base64,${glb().toString('base64')}`);
  expect(model.assetId).toBeUndefined();
  expect(errors).toEqual([]);
});

test('revierte archivo y metadatos si aborta el borrado; permite eliminar un huérfano después', async ({ page }) => {
  await seedResource(page);
  const remove = await openResources(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.delete;
    (window as Window & { restoreResourceDelete?: () => void }).restoreResourceDelete = () => { IDBObjectStore.prototype.delete = original; };
    IDBObjectStore.prototype.delete = function (key) {
      const request = original.call(this, key);
      if (this.name === 'model-metadata') this.transaction.abort();
      return request;
    };
  });
  await remove.click();
  await expect(page.getByText('No se pudo eliminar el recurso. El archivo y sus datos se conservan.', { exact: true })).toBeVisible();
  expect(await resourceState(page)).toEqual({ blob: true, metadata: true });
  await page.evaluate(() => (window as Window & { restoreResourceDelete?: () => void }).restoreResourceDelete?.());
  await remove.click();
  await expect(page.getByText('Recurso eliminado de la biblioteca.', { exact: true })).toBeVisible();
  await expect(remove).toHaveCount(0);
  expect(await resourceState(page)).toEqual({ blob: false, metadata: false });
});

test('bloquea limpieza si el respaldo no se puede comprobar y conserva ambos registros', async ({ page }) => {
  await seedResource(page);
  await page.evaluate(key => localStorage.setItem(key, '{broken'), backupKey);
  const remove = await openResources(page);
  await remove.click();
  await expect(page.getByText('No se pueden comprobar los guardados locales. Conserva los recursos y exporta una copia JSON antes de reparar el almacenamiento.', { exact: true })).toBeVisible();
  expect(await resourceState(page)).toEqual({ blob: true, metadata: true });
});

test('protege el GLB del redo aunque ya no aparezca en el proyecto ni en los guardados', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  await page.locator('input[type="file"][accept*=".glb"]').setInputFiles({ name: 'Modelo de prueba.glb', mimeType: 'model/gltf-binary', buffer: glb() });
  await expect(page.getByText('Modelo guardado en IndexedDB e importado al proyecto.', { exact: true })).toBeVisible();
  await page.locator('button[title^="Deshacer"]').click();
  await expect(page.getByText('Guardado en este navegador', { exact: true })).toBeVisible();
  // Retain only the in-memory redo reference, independent of autosave timing.
  await page.evaluate(key => localStorage.setItem(key, localStorage.getItem('atelier-60-project-v1')!), backupKey);
  const remove = await openResources(page);
  await remove.click();
  await expect(page.getByText(protectedMessage, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar estudio', exact: true }).click();
  await page.locator('button[title^="Rehacer"]').click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const restored = JSON.parse((await readFile(await (await downloadEvent).path())).toString('utf8')) as Project;
  expect(restored.furniture.find(f => f.name === 'Modelo de prueba')?.modelData).toMatch(/^data:model\/gltf-binary;base64,/);
});
