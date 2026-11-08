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

  it('mantiene la revisión anterior en el respaldo tras una segunda edición', async () => {
    const storage = storageMock();
    vi.stubGlobal('localStorage', storage);
    const { saveLocal, readProject } = await import('../store');
    const first = structuredClone(demoProject);
    first.name = 'Versión anterior';
    const second = structuredClone(first);
    second.name = 'Versión actual';
    expect(saveLocal(first)).toBe(true);
    expect(saveLocal(second)).toBe(true);
    expect(readProject().name).toBe('Versión actual');
    expect(JSON.parse(storage.getItem('atelier-60-project-v1-backup')!)).toEqual(first);
  });

  it('no sustituye un respaldo válido por un principal corrupto', async () => {
    const storage = storageMock('{broken');
    const backup = structuredClone(demoProject);
    backup.name = 'Copia protegida';
    storage.setItem('atelier-60-project-v1-backup', JSON.stringify(backup));
    vi.stubGlobal('localStorage', storage);
    const { saveLocal } = await import('../store');
    const next = structuredClone(demoProject);
    next.name = 'Proyecto nuevo';
    expect(saveLocal(next)).toBe(true);
    expect(JSON.parse(storage.getItem('atelier-60-project-v1-backup')!)).toEqual(backup);
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


  it('conserva el proyecto anterior cuando falla la escritura principal', async () => {
    const first = structuredClone(demoProject);
    first.name = 'Última versión persistida';
    const storage = storageMock(JSON.stringify(first));
    const originalSet = storage.setItem.getMockImplementation()!;
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === 'atelier-60-project-v1') throw new Error('QuotaExceededError');
      return originalSet(key, value);
    });
    vi.stubGlobal('localStorage', storage);
    const { saveLocal, readProject } = await import('../store');
    const changed = structuredClone(first);
    changed.name = 'Versión no guardada';
    expect(saveLocal(changed)).toBe(false);
    expect(readProject().name).toBe('Última versión persistida');
    expect(JSON.parse(storage.getItem('atelier-60-project-v1-backup')!)).toEqual(first);
  });

  it('no sobrescribe una copia de seguridad válida si falla el guardado', async () => {
    const first = structuredClone(demoProject);
    first.name = 'Versión estable';
    const storage = storageMock();
    vi.stubGlobal('localStorage', storage);
    const { saveLocal, readProject } = await import('../store');
    expect(saveLocal(first)).toBe(true);
    const second = structuredClone(first);
    second.name = 'Versión intermedia';
    expect(saveLocal(second)).toBe(true);
    const previousSet = storage.setItem.getMockImplementation()!;
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === 'atelier-60-project-v1') throw new Error('QuotaExceededError');
      return previousSet(key, value);
    });
    const third = structuredClone(second);
    third.name = 'Versión fallida';
    expect(saveLocal(third)).toBe(false);
    expect(readProject().name).toBe('Versión intermedia');
    expect(JSON.parse(storage.getItem('atelier-60-project-v1-backup')!)).toEqual(second);
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
