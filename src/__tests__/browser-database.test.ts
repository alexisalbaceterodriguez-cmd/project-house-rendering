import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATABASE_OPEN_TIMEOUT_MS, openBrowserDatabase } from '../lib/browserDatabase';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function fixture() {
  const database = { close: vi.fn(), onversionchange: null } as unknown as IDBDatabase;
  const request = {
    result: database, error: null, transaction: null,
    onblocked: null, onupgradeneeded: null, onerror: null, onsuccess: null,
  } as unknown as IDBOpenDBRequest;
  vi.stubGlobal('indexedDB', { open: vi.fn(() => request) });
  const upgrade = vi.fn();
  return { database, request, upgrade, open: () => openBrowserDatabase({ name: 'test', version: 2, upgrade }) };
}
function fire(request: IDBOpenDBRequest, event: 'blocked' | 'upgradeneeded' | 'error' | 'success') {
  const callback = request[`on${event}`];
  (callback as ((event: Event) => void) | null)?.call(request, new Event(event));
}

describe('Aperturas IndexedDB recuperables entre pestañas', () => {
  it('cierra la conexión ante una actualización o borrado desde otra pestaña', async () => {
    const { database, request, open } = fixture();
    const promise = open(); fire(request, 'success');
    expect(await promise).toBe(database);
    database.onversionchange!.call(database, new Event('versionchange') as IDBVersionChangeEvent);
    expect(database.close).toHaveBeenCalledOnce();
  });

  it('rechaza un bloqueo y aborta una migración que llega después de abandonar la apertura', async () => {
    const { request, upgrade, open } = fixture();
    const promise = open(), rejection = expect(promise).rejects.toThrow('Otra pestaña');
    fire(request, 'blocked'); await rejection;
    const abort = vi.fn(); Object.defineProperty(request, 'transaction', { value: { abort } });
    fire(request, 'upgradeneeded'); fire(request, 'error');
    expect(abort).toHaveBeenCalledOnce(); expect(upgrade).not.toHaveBeenCalled();
  });

  it('cierra un resultado tardío de una solicitud bloqueada, sin dejar conexiones ocultas', async () => {
    const { database, request, open } = fixture();
    const rejection = expect(open()).rejects.toThrow('vuelve a intentarlo');
    fire(request, 'blocked'); await rejection; fire(request, 'success');
    expect(database.close).toHaveBeenCalledOnce();
  });

  it('limita la espera de una solicitud en cola que no emite blocked', async () => {
    vi.useFakeTimers();
    const { database, request, open } = fixture();
    const rejection = expect(open()).rejects.toThrow('El proyecto actual se conserva');
    await vi.advanceTimersByTimeAsync(DATABASE_OPEN_TIMEOUT_MS); await rejection;
    fire(request, 'success'); expect(database.close).toHaveBeenCalledOnce();
  });

  it('cancela el temporizador al abrir; no cierra una conexión válida por tiempo transcurrido', async () => {
    vi.useFakeTimers();
    const { database, request, open } = fixture();
    const promise = open(); fire(request, 'success'); await promise;
    await vi.advanceTimersByTimeAsync(DATABASE_OPEN_TIMEOUT_MS * 2);
    expect(database.close).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it('aborta el upgrade si falla la migración, sin fingir una apertura válida', async () => {
    const { request, upgrade, open } = fixture(), abort = vi.fn();
    Object.defineProperty(request, 'transaction', { value: { abort } });
    upgrade.mockImplementation(() => { throw new Error('Migration failed'); });
    const rejection = expect(open()).rejects.toThrow('No se puede abrir');
    fire(request, 'upgradeneeded'); await rejection; expect(abort).toHaveBeenCalledOnce();
  });

  it('avisa de datos más recientes en lugar de borrar o degradar la base', async () => {
    const { request, upgrade, open } = fixture();
    Object.defineProperty(request, 'error', { value: new DOMException('Newer database', 'VersionError') });
    const rejection = expect(open()).rejects.toThrow('versión más reciente');
    fire(request, 'error'); await rejection; expect(upgrade).not.toHaveBeenCalled();
  });

  it.each(['missing', 'denied'])('avisa cuando IndexedDB no está disponible (%s)', async source => {
    vi.stubGlobal('indexedDB', source === 'missing' ? undefined : { open: () => { throw new Error('SecurityError'); } });
    await expect(openBrowserDatabase({ name: 'test', version: 1, upgrade: vi.fn() })).rejects.toThrow('Exporta una copia JSON');
  });
});
