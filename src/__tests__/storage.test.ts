import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../data/defaultProject';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function storageMock(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('atelier-60-project-v1', initial);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}

describe('F0: almacenamiento y recuperación del editor', () => {
  it('recupera el último proyecto válido guardado en localStorage', async () => {
    const project = structuredClone(demoProject);
    project.name = 'Proyecto recuperado';
    const storage = storageMock(JSON.stringify(project));
    vi.stubGlobal('localStorage', storage);
    const { readProject } = await import('../store');
    expect(readProject().name).toBe('Proyecto recuperado');
  });

  it('recupera el ejemplo sin sobrescribir un JSON corrupto', async () => {
    const storage = storageMock('{invalid json');
    vi.stubGlobal('localStorage', storage);
    const { readProject } = await import('../store');
    const recovered = readProject();
    expect(recovered.id).toBe(demoProject.id);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('avisa de fallo de almacenamiento sin propagar la excepción', async () => {
    const storage = storageMock();
    storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    vi.stubGlobal('localStorage', storage);
    const { saveLocal } = await import('../store');
    expect(saveLocal(structuredClone(demoProject))).toBe(false);
  });

  it('recupera un proyecto válido desde el respaldo si el principal está corrupto', async () => {
    const project = structuredClone(demoProject);
    project.name = 'Rescatado del respaldo';
    const storage = storageMock('{broken');
    const backup = JSON.stringify(project);
    const originalGet = storage.getItem;
    storage.getItem.mockImplementation((key: string) =>
      key === 'atelier-60-project-v1-backup' ? backup : originalGet.getMockImplementation()!(key));
    vi.stubGlobal('localStorage', storage);
    const { readProject } = await import('../store');
    expect(readProject().name).toBe('Rescatado del respaldo');
  });

  it('rechaza guardar un proyecto inválido sin tocar el almacenamiento', async () => {
    const storage = storageMock();
    vi.stubGlobal('localStorage', storage);
    const { saveLocal } = await import('../store');
    const project = structuredClone(demoProject);
    project.walls[0].thickness = -1;
    expect(saveLocal(project)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('guarda una copia de recuperación junto al proyecto principal', async () => {
    const storage = storageMock();
    vi.stubGlobal('localStorage', storage);
    const { saveLocal } = await import('../store');
    expect(saveLocal(structuredClone(demoProject))).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      'atelier-60-project-v1-backup', JSON.stringify(demoProject));
  });

  it('lee el proyecto principal aunque falle el acceso al respaldo', async () => {
    const project = structuredClone(demoProject);
    project.name = 'Principal intacto';
    const storage = storageMock(JSON.stringify(project));
    const originalGet = storage.getItem.getMockImplementation()!;
    storage.getItem.mockImplementation((key: string) => {
      if (key === 'atelier-60-project-v1-backup') throw new Error('SecurityError');
      return originalGet(key);
    });
    vi.stubGlobal('localStorage', storage);
    const { readProject } = await import('../store');
    expect(readProject().name).toBe('Principal intacto');
  });

  it('recupera el respaldo cuando leer el principal lanza una excepción', async () => {
    const project = structuredClone(demoProject);
    project.name = 'Respaldo accesible';
    const storage = storageMock();
    const originalGet = storage.getItem.getMockImplementation()!;
    storage.getItem.mockImplementation((key: string) => {
      if (key === 'atelier-60-project-v1') throw new Error('SecurityError');
      if (key === 'atelier-60-project-v1-backup') return JSON.stringify(project);
      return originalGet(key);
    });
    vi.stubGlobal('localStorage', storage);
    const { readProject } = await import('../store');
    expect(readProject().name).toBe('Respaldo accesible');
  });

  it('guarda y restaura una edición, conservando deshacer y rehacer', async () => {
    const storage = storageMock();
    vi.stubGlobal('localStorage', storage);
    const { useEditor, saveLocal, readProject } = await import('../store');
    const original = structuredClone(demoProject);
    useEditor.getState().load(original);
    useEditor.getState().change(project => { project.name = 'Cambio guardado'; });
    expect(useEditor.getState().history).toHaveLength(1);
    expect(useEditor.getState().project.name).toBe('Cambio guardado');
    expect(saveLocal(useEditor.getState().project)).toBe(true);
    expect(readProject().name).toBe('Cambio guardado');
    useEditor.getState().undo();
    expect(useEditor.getState().project.name).toBe(original.name);
    useEditor.getState().redo();
    expect(useEditor.getState().project.name).toBe('Cambio guardado');
  });
});
