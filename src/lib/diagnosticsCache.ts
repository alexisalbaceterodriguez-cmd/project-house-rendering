import type { Project } from '../types';
import { furnitureCollisions } from './diagnostics';
import { projectWarnings } from './topology';

/**
 * Per-project memo for the UI. The store never mutates a committed project (every edit yields a new
 * object, see `change`), so a result keyed by the project's identity stays valid for as long as that
 * object lives. Several panels ask for the same warnings on every render; this makes the repeats free.
 * Code that edits a project in place (tests, drafts) must keep calling the uncached functions.
 */
function memoByProject<T>(compute:(project:Project)=>T):(project:Project)=>T{
  const cache=new WeakMap<Project,T>();
  return project=>{
    if(cache.has(project))return cache.get(project) as T;
    const value=compute(project);cache.set(project,value);return value;
  };
}

export const cachedProjectWarnings=memoByProject(projectWarnings);
export const cachedFurnitureCollisions=memoByProject(furnitureCollisions);
