import { create } from 'zustand';
import type { Project, Selection, Tool, Mode } from './types';
import { demoProject } from './data/defaultProject';
const KEY = 'atelier-60-project-v1';
export const readProject = (): Project => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (isProject(data)) return data;
    }
  } catch { /* private browsing or invalid file: start with template */ }
  return structuredClone(demoProject);
};
export function isProject(data: unknown): data is Project {
  if (!data || typeof data !== 'object') return false;
  const p = data as Record<string, unknown>;
  if (p.version !== 1 || typeof p.name !== 'string' || typeof p.width !== 'number' || typeof p.depth !== 'number' ||
      !Number.isFinite(p.width) || !Number.isFinite(p.depth) || p.width < 2 || p.width > 100 || p.depth < 2 || p.depth > 100 ||
      typeof p.wallHeight !== 'number' || p.wallHeight < 1.8 || p.wallHeight > 6 ||
      !Array.isArray(p.rooms) || !Array.isArray(p.walls) || !Array.isArray(p.openings) || !Array.isArray(p.furniture) ||
      !p.palette || typeof p.palette !== 'object') return false;
  return p.rooms.every((r: Record<string, unknown>) => typeof r?.id === 'string' && typeof r?.x === 'number' && typeof r?.w === 'number') &&
    p.walls.every((w: Record<string, unknown>) => typeof w?.id === 'string' && !!w?.a && !!w?.b) &&
    p.furniture.every((f: Record<string, unknown>) => typeof f?.id === 'string' && typeof f?.x === 'number' && typeof f?.kind === 'string');
}
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
  reset: () => set({ project: structuredClone(demoProject), history: [], redoStack: [], selection: null, tool: 'select' }),
}));
export function saveLocal(project: Project): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(project)); return true; } catch { return false; }
}
