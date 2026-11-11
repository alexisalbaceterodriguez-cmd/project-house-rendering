import { useEditor } from '../store';
import { budgetCsv,budgetTotal } from '../lib/budget';
import { download } from '../lib/geometry';
export default function BudgetTools(){
  const {project,selection,change}=useEditor();const item=selection?.type==='furniture'?project.furniture.find(f=>f.id===selection.id):undefined,total=budgetTotal(project.furniture);
  return <section><h4>Presupuesto orientativo</h4><p>Importes introducidos por ti. Total de objetos valorados: <strong>{total.total.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</strong>. {total.missing} objeto(s) sin precio. No se añaden gastos que no hayas indicado.</p>
    {item?<><label>Precio de {item.name} (€)<input aria-label="Precio del objeto seleccionado" type="number" min="0" max="1000000" step=".01" value={item.unitPrice??''} onChange={e=>{const value=e.target.value;change(p=>{const f=p.furniture.find(f=>f.id===item.id)!;if(value==='')delete f.unitPrice;else f.unitPrice=Number(value);});}}/></label></>:<p className="small-help">Selecciona un objeto en el plano para indicar su precio unitario.</p>}
    <button onClick={()=>download('atelier60-presupuesto.csv',budgetCsv(project.furniture),'text/csv;charset=utf-8')}>Exportar presupuesto CSV</button>
  </section>;
}
