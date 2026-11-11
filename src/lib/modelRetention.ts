import type { Project } from '../types';
import { deleteModelResource } from './assets';
import { readPersistedProjects } from './localProjectStorage';
import { listDesigns } from './projectLibrary';
import { isProject } from './validation';

type RetentionAccess = {
  listSaved: () => Promise<readonly { project: Project }[]>;
  readPersisted: () => readonly Project[];
  deleteResource: (id: string, assertUnused: () => void) => Promise<void>;
};
const browserAccess: RetentionAccess = {
  listSaved: listDesigns, readPersisted: readPersistedProjects, deleteResource: deleteModelResource,
};

/** Only explicitly unused resources may be removed; unreadable references block cleanup. */
export async function deleteUnusedModelResource(
  id: string, getLiveProjects: () => readonly Project[], access: RetentionAccess = browserAccess,
): Promise<void> {
  const saved = await access.listSaved();
  await access.deleteResource(id, () => {
    // Read live history and both browser saves at the last synchronous point before deletion.
    const projects = [...getLiveProjects(), ...access.readPersisted(), ...saved.map(v => v.project)];
    if (!projects.every(isProject)) throw new Error('No se pueden comprobar todas las versiones. Conserva el recurso y revisa los proyectos guardados.');
    if (projects.some(p => p.furniture.some(f => f.assetId === id))) {
      throw new Error('Este recurso está en uso por el proyecto, un respaldo, una versión o el historial. Consérvalo para evitar pérdidas.');
    }
  });
}
