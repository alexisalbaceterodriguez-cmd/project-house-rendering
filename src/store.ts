import { create } from 'zustand';
import type { Project, Selection, Tool, Mode } from './types';
import { isProject } from './lib/validation';
import { demoProject } from './data/defaultProject';
import { reconcileRooms } from './lib/topology';
import { buildWallGraph, migrateProject } from './lib/projectSchema';
import type { CameraView } from './types';
import { PROJECT_KEY as KEY, PROJECT_BACKUP_KEY as BACKUP_KEY } from './lib/localProjectStorage';
export {isProject} from './lib/validation';
export const readProject = (): Project => {
  try {
    // Prefer the primary save, but recover from a previously verified backup
    // when a browser extension, interrupted write or manual edit corrupts it.
    for (const key of [KEY, BACKUP_KEY]) {
      // A failure reading the optional backup must never hide a valid primary.
      let raw: string | null;
      try { raw = localStorage.getItem(key); } catch { continue; }
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
        return migrateProject(data);
      }
    }
  } catch { /* private browsing or invalid file: start with template */ }
  const fresh=structuredClone(demoProject);reconcileRooms(fresh);return migrateProject(fresh);
};
type Store = {
  project: Project; selection: Selection; tool: Tool; mode: Mode; wallsVisible: boolean; cutaway: boolean;
  history: Project[]; redoStack: Project[];
  setSelection: (value: Selection) => void; setTool: (tool: Tool) => void; setMode: (mode: Mode) => void;
  setWallsVisible: (v: boolean) => void; setCutaway: (v: boolean) => void;
  change: (updater: (p: Project) => void, record?: boolean) => void;
  checkpoint: () => void; undo: () => void; redo: () => void;
  cancelDrag: () => void; commitDrag:()=>void; dragCheckpoint:{project:Project;history:Project[];redoStack:Project[]}|null; liveCamera: CameraView | null; setLiveCamera:(camera:CameraView)=>void;
  selectedFurniture:string[];setFurnitureGroup:(ids:string[])=>void;
  cameraLocked:boolean;setCameraLocked:(locked:boolean)=>void;
  load: (project: Project) => void; reset: () => void;
};
export const useEditor = create<Store>((set, get) => ({
  project: readProject(), selection: null, tool: 'select', mode: 'split', wallsVisible: true, cutaway: true,
  history: [], redoStack: [],
  liveCamera:null,dragCheckpoint:null,setLiveCamera:liveCamera=>set({liveCamera}),
  selectedFurniture:[],setFurnitureGroup:ids=>set(s=>({selectedFurniture:ids.filter(id=>s.project.furniture.some(f=>f.id===id)),selection:ids.length?{type:'furniture',id:ids[ids.length-1]}:null})),
  cameraLocked:false,setCameraLocked:cameraLocked=>set({cameraLocked}),
  setSelection: selection => set(s=>({ selection,selectedFurniture:selection?.type==='furniture'?(s.selectedFurniture.includes(selection.id)?s.selectedFurniture:[selection.id]):[] })), setTool: tool => set({ tool }), setMode: mode => set({ mode }),
  setWallsVisible: wallsVisible => set({ wallsVisible }), setCutaway: cutaway => set({ cutaway }),
  checkpoint: () => set(s => ({dragCheckpoint:{project:s.project,history:s.history,redoStack:s.redoStack}, history: [...s.history.slice(-39), structuredClone(s.project)], redoStack: [] })),
  cancelDrag: () => set(s=>s.dragCheckpoint?{...s.dragCheckpoint,dragCheckpoint:null}:s),
  commitDrag:()=>set(s=>s.dragCheckpoint&&JSON.stringify(s.project)===JSON.stringify(s.dragCheckpoint.project)?{...s.dragCheckpoint,dragCheckpoint:null}:{dragCheckpoint:null}),
  change: (updater, record = true) => {
    const previous = get().project;
    const next = structuredClone(previous);
    updater(next);
    // A malformed edit must not enter the live state or the undo history.
    // This also prevents autosave from repeatedly failing on invalid geometry.
    // The graph still describes the previous geometry until this transaction
    // commits; validate domain data first, then regenerate its references.
    if (!isProject({...next,graph:undefined})) return;
    next.schemaRevision=1;next.graph=buildWallGraph({...next,graph:previous.graph});
    set(s => ({ project: next, history: record ? [...s.history.slice(-39), previous] : s.history, redoStack: record ? [] : s.redoStack }));
  },
  undo: () => set(s => s.history.length ? ({ project: s.history[s.history.length - 1], history: s.history.slice(0, -1), redoStack: [s.project, ...s.redoStack].slice(0, 40), selection: null,selectedFurniture:[],dragCheckpoint:null }) : s),
  redo: () => set(s => s.redoStack.length ? ({ project: s.redoStack[0], history: [...s.history, s.project].slice(-40), redoStack: s.redoStack.slice(1), selection: null,selectedFurniture:[],dragCheckpoint:null }) : s),
  // Imported objects must not retain a mutable reference into the editor state.
  // A caller changing its parsed JSON later must not silently alter the plan.
  load: project => {
    // TypeScript types do not validate imported JSON at runtime. Never replace
    // a working project with malformed data passed by another caller.
    if (!isProject(project)) return;
    set({ project: migrateProject(project), history: [], redoStack: [], selection: null, selectedFurniture:[],dragCheckpoint:null,cameraLocked:false, tool: 'select' });
  },
  reset: () => {const fresh=structuredClone(demoProject);reconcileRooms(fresh);set({ project: migrateProject(fresh), history: [], redoStack: [], selection: null,selectedFurniture:[],dragCheckpoint:null, tool: 'select' });},
}));
export function saveLocal(project: Project): boolean {
  if (!isProject(project)) return false;
  try {
    const serialized = JSON.stringify(project);
    // Preserve the last known-good primary before replacing it. Mirroring the
    // new value into both keys on every save offers no protection against a
    // logically damaged (but structurally valid) edit or an interrupted write.
    let previous: string | null = null;
    try { previous = localStorage.getItem(KEY); } catch { /* primary may still be writable */ }
    let backedUpPrevious = false;
    if (previous && previous !== serialized) {
      try {
        if (isProject(JSON.parse(previous))) {
          localStorage.setItem(BACKUP_KEY, previous);
          backedUpPrevious = true;
        }
      } catch { /* invalid previous data must never replace a good backup */ }
    }
    localStorage.setItem(KEY, serialized);
    // On the first save, seed a recovery copy. Subsequent saves retain the
    // prior valid revision, unless the backup write failed.
    if (!backedUpPrevious) {
      try {
        const backup = localStorage.getItem(BACKUP_KEY);
        if (!backup || !isProject(JSON.parse(backup))) {
          localStorage.setItem(BACKUP_KEY, serialized);
        }
      } catch { /* optional recovery copy */ }
    }
    return true;
  } catch { return false; }
}
