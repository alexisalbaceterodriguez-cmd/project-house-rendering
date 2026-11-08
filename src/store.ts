import { create } from 'zustand';
import type { Project, Selection, Tool, Mode } from './types';
import { isProject } from './lib/validation';
import { demoProject } from './data/defaultProject';
import { reconcileRooms } from './lib/topology';
const KEY = 'atelier-60-project-v1';
const BACKUP_KEY = `${KEY}-backup`;
export {isProject} from './lib/validation';
export const readProject = (): Project => {
  try {
    // Prefer the primary save, but recover from a previously verified backup
    // when a browser extension, interrupted write or manual edit corrupts it.
    for (const raw of [localStorage.getItem(KEY), localStorage.getItem(BACKUP_KEY)]) {
      if (!raw) continue;
      let data: unknown;
      try { data = JSON.parse(raw); } catch { continue; }
      if (isProject(data)) {
        // One-time compatibility fix for the earlier public demo: its salon wall
        // had an open 1 m gap, so no closed room could be inferred.
        if(data.id==='atelier-60-demo'){
          const old=data.walls.find(w=>w.id==='living-top');
          if(old&&Math.abs(old.b.y-3)<.01&&data.walls.some(w=>w.id==='living-bottom')){
            old.b.y=6;
            data.walls=data.walls.filter(w=>w.id!=='living-bottom');
            data.openings.push({id:'living-entry',wallId:'living-top',kind:'door',offset:.59,width:.85,height:2.1,sill:0});
            reconcileRooms(data);
          }
        }
        return data;
      }
    }
  } catch { /* private browsing or invalid file: start with template */ }
  const fresh=structuredClone(demoProject);reconcileRooms(fresh);return fresh;
};
type Store = {
  project: Project; selection: Selection; tool: Tool; mode: Mode; wallsVisible: boolean; cutaway: boolean;
  history: Project[]; redoStack: Project[];
  setSelection: (value: Selection) => void; setTool: (tool: Tool) => void; setMode: (mode: Mode) => void;
  setWallsVisible: (v: boolean) => void; setCutaway: (v: boolean) => void;
  change: (updater: (p: Project) => void, record?: boolean) => void;
  checkpoint: () => void; undo: () => void; redo: () => void;
  load: (project: Project) => void; reset: () => void;
};
export const useEditor = create<Store>((set, get) => ({
  project: readProject(), selection: null, tool: 'select', mode: 'split', wallsVisible: true, cutaway: true,
  history: [], redoStack: [],
  setSelection: selection => set({ selection }), setTool: tool => set({ tool }), setMode: mode => set({ mode }),
  setWallsVisible: wallsVisible => set({ wallsVisible }), setCutaway: cutaway => set({ cutaway }),
  checkpoint: () => set(s => ({ history: [...s.history.slice(-39), structuredClone(s.project)], redoStack: [] })),
  change: (updater, record = true) => {
    const previous = get().project;
    const next = structuredClone(previous);
    updater(next);
    set(s => ({ project: next, history: record ? [...s.history.slice(-39), previous] : s.history, redoStack: record ? [] : s.redoStack }));
  },
  undo: () => set(s => s.history.length ? ({ project: s.history[s.history.length - 1], history: s.history.slice(0, -1), redoStack: [s.project, ...s.redoStack].slice(0, 40), selection: null }) : s),
  redo: () => set(s => s.redoStack.length ? ({ project: s.redoStack[0], history: [...s.history, s.project].slice(-40), redoStack: s.redoStack.slice(1), selection: null }) : s),
  load: project => set({ project, history: [], redoStack: [], selection: null, tool: 'select' }),
  reset: () => {const fresh=structuredClone(demoProject);reconcileRooms(fresh);set({ project: fresh, history: [], redoStack: [], selection: null, tool: 'select' });},
}));
export function saveLocal(project: Project): boolean {
  if (!isProject(project)) return false;
  try {
    const serialized = JSON.stringify(project);
    localStorage.setItem(KEY, serialized);
    // Backup is best effort: a quota error must not mark a successful primary
    // write as failed. Never back up invalid project data.
    try { localStorage.setItem(BACKUP_KEY, serialized); } catch { /* optional recovery copy */ }
    return true;
  } catch { return false; }
}
