import { useEditor } from '../store';
import { budgetTotal } from '../lib/budget';
export default function PrintSheet(){
  const project=useEditor(s=>s.project),budget=budgetTotal(project.furniture);
  return <section className="print-sheet"><h1>{project.name}</h1><p>Atelier 60 · {project.width.toFixed(2)} × {project.depth.toFixed(2)} m · {(project.width*project.depth).toFixed(2)} m² · altura {project.wallHeight.toFixed(2)} m</p><p>Diseño conceptual. Las cotas y superficies no sustituyen una medición ni un proyecto técnico.</p>{budget.priced>0&&<p>Objetos valorados: {budget.total.toLocaleString('es-ES',{style:'currency',currency:'EUR'})} · {budget.missing} sin precio.</p>}</section>;
}
