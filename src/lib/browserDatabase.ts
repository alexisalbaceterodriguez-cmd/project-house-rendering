export const DATABASE_OPEN_TIMEOUT_MS = 10_000;
export const DATABASE_BLOCKED_MESSAGE = 'Otra pestaña está bloqueando el almacenamiento local. Ciérrala y vuelve a intentarlo. El proyecto actual se conserva.';
const unavailableMessage = 'No se puede abrir el almacenamiento local. Exporta una copia JSON y comprueba los permisos del navegador.';
const newerVersionMessage = 'Los datos locales pertenecen a una versión más reciente de Atelier 60. Recarga la aplicación antes de volver a intentarlo.';

type DatabaseOptions = { name: string; version: number; upgrade: (database: IDBDatabase) => void };

/** Close on versionchange; abandoned opens must never leak a connection or run a late migration.
 * https://www.w3.org/TR/IndexedDB/#opening
 */
export function openBrowserDatabase({ name, version, upgrade }: DatabaseOptions): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === 'undefined') throw new Error(unavailableMessage);
      request = indexedDB.open(name, version);
    } catch { reject(new Error(unavailableMessage)); return; }

    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const abortUpgrade = () => {
      try { request.transaction?.abort(); } catch { /* Upgrade already finished. */ }
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      abortUpgrade();
      reject(error);
    };
    request.onblocked = () => fail(new Error(DATABASE_BLOCKED_MESSAGE));
    request.onupgradeneeded = () => {
      if (settled) { abortUpgrade(); return; }
      try { upgrade(request.result); } catch { fail(new Error(unavailableMessage)); }
    };
    request.onerror = () => fail(request.error?.name === 'VersionError'
      ? new Error(newerVersionMessage) : request.error ?? new Error(unavailableMessage));
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => database.close();
      settled = true;
      clearTimeout(timer);
      resolve(database);
    };
    // An open can queue behind another blocked request without firing its own blocked event.
    timer = setTimeout(() => fail(new Error(DATABASE_BLOCKED_MESSAGE)), DATABASE_OPEN_TIMEOUT_MS);
  });
}
