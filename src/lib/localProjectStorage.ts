import type { Project } from '../types';
import { isProject } from './validation';

export const PROJECT_KEY = 'atelier-60-project-v1';
export const PROJECT_BACKUP_KEY = `${PROJECT_KEY}-backup`;

/** Cleanup must inspect both slots, never substitute the demo or skip an unreadable save. */
export function readPersistedProjects(): Project[] {
  const projects: Project[] = [];
  for (const key of [PROJECT_KEY, PROJECT_BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      const project: unknown = JSON.parse(raw);
      if (!isProject(project)) throw new Error('Invalid saved project');
      projects.push(project);
    } catch {
      throw new Error('No se pueden comprobar los guardados locales. Conserva los recursos y exporta una copia JSON antes de reparar el almacenamiento.');
    }
  }
  return projects;
}
