import type { FurnitureKind, FloorFinish, Palette } from '../types';
export type CatalogItem = { kind: FurnitureKind; name: string; w: number; d: number; h: number; color: string; icon: string; category: string };
export const catalog: CatalogItem[] = [
  {kind:'sofa', name:'Sofá de 3 plazas',w:2.2,d:.9,h:.85,color:'#d4c8b8',icon:'🛋',category:'Salón'},
  {kind:'table', name:'Mesa de comedor',w:1.5,d:.85,h:.75,color:'#caa77d',icon:'▦',category:'Salón'},
  {kind:'chair', name:'Silla nórdica',w:.52,d:.55,h:.85,color:'#c4a47d',icon:'◈',category:'Salón'},
  {kind:'rug', name:'Alfombra',w:2.2,d:1.5,h:.025,color:'#ded6c7',icon:'▤',category:'Salón'},
  {kind:'bed', name:'Cama doble',w:1.6,d:2,h:.55,color:'#e2d7ca',icon:'▣',category:'Dormitorio'},
  {kind:'single-bed', name:'Cama individual',w:.9,d:1.9,h:.55,color:'#e2d7ca',icon:'▣',category:'Dormitorio'},
  {kind:'wardrobe', name:'Armario',w:1.5,d:.62,h:2.25,color:'#e4dfd4',icon:'▥',category:'Dormitorio'},
  {kind:'desk', name:'Escritorio',w:1.2,d:.6,h:.76,color:'#c5a27b',icon:'▤',category:'Dormitorio'},
  {kind:'kitchen', name:'Módulo de cocina',w:2.6,d:.65,h:.9,color:'#ede9e1',icon:'▤',category:'Cocina'},
  {kind:'island', name:'Isla de cocina',w:1.5,d:.8,h:.9,color:'#e8e4dc',icon:'▦',category:'Cocina'},
  {kind:'sink', name:'Mueble lavabo',w:.8,d:.5,h:.85,color:'#ede9e1',icon:'◍',category:'Baño'},
  {kind:'toilet', name:'Inodoro',w:.43,d:.65,h:.65,color:'#f3f2ed',icon:'◉',category:'Baño'},
  {kind:'shower', name:'Ducha',w:.9,d:.9,h:2,color:'#eae8e1',icon:'▧',category:'Baño'},
  {kind:'fridge', name:'Frigorífico',w:.65,d:.65,h:1.9,color:'#ebebe8',icon:'▣',category:'Cocina'},
  {kind:'plant', name:'Planta interior',w:.55,d:.55,h:1.1,color:'#64886c',icon:'✿',category:'Decoración'},
  {kind:'lamp', name:'Lámpara de pie',w:.4,d:.4,h:1.65,color:'#ddd3bd',icon:'✧',category:'Decoración'},
];
export const floors: Record<FloorFinish, { label: string; color: string; detail: string }> = {
  oak:{label:'Roble claro',color:'#dec29c',detail:'#b99a6e'},
  ash:{label:'Fresno natural',color:'#e6d8bb',detail:'#c6b897'},
  walnut:{label:'Nogal',color:'#927458',detail:'#624732'},
  stone:{label:'Porcelánico arena',color:'#d8d1c5',detail:'#b9b0a2'},
  terrazzo:{label:'Terrazo',color:'#d1d2cd',detail:'#a5ada3'},
  concrete:{label:'Microcemento',color:'#babbb7',detail:'#a1a5a2'},
};
export const styles: Record<string, Palette> = {
  'Nórdico':{walls:'#f7f5f0',accent:'#9aa993',wood:'#d8bc98',textile:'#d4c8b8',metal:'#575c59'},
  'Japandi':{walls:'#eeeae1',accent:'#758774',wood:'#c3a078',textile:'#cbbca8',metal:'#443e38'},
  'Mediterráneo':{walls:'#faf3e6',accent:'#a7b9bd',wood:'#d6ab79',textile:'#ece0cc',metal:'#b48b63'},
  'Industrial':{walls:'#dad9d4',accent:'#687276',wood:'#98765a',textile:'#9d9d99',metal:'#333635'},
};
