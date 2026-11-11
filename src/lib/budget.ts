import type { Furniture } from '../types';
export function budgetTotal(items:Furniture[]){
  const priced=items.filter(f=>f.unitPrice!==undefined);
  return {total:priced.reduce((sum,f)=>sum+Math.round(f.unitPrice!*100),0)/100,priced:priced.length,missing:items.length-priced.length};
}
export function budgetCsv(items:Furniture[]):string{
  const cell=(value:unknown)=>{let text=String(value??'');if(/^[=+\-@\t\r]/.test(text.trimStart()))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const rows=[['Objeto','Fabricante','Referencia','Ancho m','Fondo m','Alto m','Precio EUR'],...items.map(f=>[f.name,f.productSource?.manufacturer??'Atelier 60 / importación propia',f.productSource?.reference??f.productId??f.kind,f.w,f.d,f.h,f.unitPrice?.toFixed(2)??'Sin precio']),['Total introducido','','','','','',budgetTotal(items).total.toFixed(2)]];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
