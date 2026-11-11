import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankProject } from '../data/defaultProject';
import { PROJECT_BACKUP_KEY, PROJECT_KEY, readPersistedProjects } from '../lib/localProjectStorage';
import { deleteUnusedModelResource } from '../lib/modelRetention';
import type { Project } from '../types';

afterEach(() => vi.unstubAllGlobals());

function withModel(): Project {
  const project = blankProject();
  project.furniture.push({ id: 'object', kind: 'model', name: 'Modelo protegido', x: 2, y: 2,
    w: 1, d: 1, h: 1, rotation: 0, color: '#ffffff', assetId: 'retained' });
  return project;
}
function access() {
  const remove = vi.fn();
  return {
    remove,
    listSaved: vi.fn(async (): Promise<{ project: Project }[]> => []),
    readPersisted: vi.fn((): Project[] => []),
    deleteResource: vi.fn(async (_id: string, assertUnused: () => void) => { assertUnused(); remove(); }),
  };
}

describe('Referencias de guardado necesarias para recuperar modelos', () => {
  it('lee principal y respaldo aunque el primero sea válido, sin escribir ni migrar', () => {
    const primary = blankProject(), backup = withModel();
    const getItem = vi.fn((key: string) => JSON.stringify(key === PROJECT_KEY ? primary : backup));
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });
    expect(readPersistedProjects()).toEqual([primary, backup]);
    expect(getItem.mock.calls.map(([key]) => key)).toEqual([PROJECT_KEY, PROJECT_BACKUP_KEY]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each(['{broken', JSON.stringify({ version: 999 }), ''])('bloquea limpieza con respaldo ilegible (%s)', raw => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === PROJECT_KEY ? JSON.stringify(blankProject()) : raw });
    expect(() => readPersistedProjects()).toThrow('No se pueden comprobar los guardados locales');
  });

  it('no confunde denegación de lectura con ausencia de referencias', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('SecurityError'); } });
    expect(() => readPersistedProjects()).toThrow('Conserva los recursos');
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readPersistedProjects()).toEqual([]);
  });
});

describe('Borrado conservador de recursos reutilizables', () => {
  it.each(['live', 'persisted', 'version'])('conserva un GLB referenciado solo en %s', async source => {
    const io = access();
    if (source === 'persisted') io.readPersisted.mockReturnValue([withModel()]);
    if (source === 'version') io.listSaved.mockResolvedValue([{ project: withModel() }]);
    await expect(deleteUnusedModelResource('retained', () => source === 'live' ? [withModel()] : [blankProject()], io))
      .rejects.toThrow('Consérvalo para evitar pérdidas');
    expect(io.remove).not.toHaveBeenCalled();
  });

  it('vuelve a leer estado y respaldo después de la espera de IndexedDB', async () => {
    const io = access();
    let live = [blankProject()];
    // Simulate a new edit while IDB is opening, after the version list was read.
    io.deleteResource.mockImplementation(async (_id, assertUnused) => {
      live = [withModel()];
      assertUnused();
      io.remove();
    });
    await expect(deleteUnusedModelResource('retained', () => live, io)).rejects.toThrow('en uso');
    expect(io.remove).not.toHaveBeenCalled();
    expect(io.readPersisted).toHaveBeenCalledOnce();
  });

  it('no elimina nada si no se pueden comprobar versiones o guardados', async () => {
    const io = access();
    io.listSaved.mockRejectedValueOnce(new Error('IndexedDB blocked'));
    await expect(deleteUnusedModelResource('retained', () => [], io)).rejects.toThrow('IndexedDB blocked');
    expect(io.deleteResource).not.toHaveBeenCalled();
    io.readPersisted.mockImplementation(() => { throw new Error('SecurityError'); });
    await expect(deleteUnusedModelResource('retained', () => [], io)).rejects.toThrow('SecurityError');
    expect(io.remove).not.toHaveBeenCalled();
  });

  it('conserva recursos si una versión guardada está corrupta', async () => {
    const io = access(), corrupt = withModel();
    corrupt.walls[0].thickness = -1;
    io.listSaved.mockResolvedValue([{ project: corrupt }]);
    await expect(deleteUnusedModelResource('retained', () => [], io)).rejects.toThrow('No se pueden comprobar todas las versiones');
    expect(io.remove).not.toHaveBeenCalled();
  });

  it('permite retirar un huérfano sin borrar recursos de otros objetos', async () => {
    const io = access();
    io.listSaved.mockResolvedValue([{ project: withModel() }]);
    io.readPersisted.mockReturnValue([withModel(), blankProject()]);
    await deleteUnusedModelResource('orphan', () => [withModel()], io);
    expect(io.deleteResource).toHaveBeenCalledWith('orphan', expect.any(Function));
    expect(io.remove).toHaveBeenCalledOnce();
  });
});
