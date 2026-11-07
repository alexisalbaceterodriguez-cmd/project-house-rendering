import type { Project, Furniture, FurnitureKind } from '../types';
import { styles } from './catalog';
const furniture = (id: string, kind: FurnitureKind, name: string, x: number, y: number, w: number, d: number, h: number, rotation = 0, color = '#d5c3ac'): Furniture => ({ id, kind, name, x, y, w, d, h, rotation, color });
/** A conceptual 10 × 6 m scheme. Rectangular rooms add up to exactly 60 m². */
export const demoProject: Project = {
  version: 1, id: 'atelier-60-demo', name: 'Mi piso nórdico', width: 10, depth: 6, wallHeight: 2.55,
  palette: { ...styles['Nórdico'] },
  rooms: [
    {id:'living',name:'Salón · cocina',kind:'living',x:0,y:0,w:4,d:6,floor:'oak'},
    {id:'bed2',name:'Dormitorio 2',kind:'bedroom',x:4,y:0,w:2.8,d:3,floor:'oak'},
    {id:'master',name:'Dormitorio principal',kind:'bedroom',x:6.8,y:0,w:3.2,d:3,floor:'oak'},
    {id:'hall',name:'Distribuidor',kind:'hall',x:4,y:3,w:6,d:1,floor:'oak'},
    {id:'bed3',name:'Dormitorio 3',kind:'bedroom',x:4,y:4,w:2.8,d:2,floor:'oak'},
    {id:'bath1',name:'Baño 1',kind:'bathroom',x:6.8,y:4,w:1.6,d:2,floor:'stone'},
    {id:'bath2',name:'Baño 2',kind:'bathroom',x:8.4,y:4,w:1.6,d:2,floor:'stone'},
  ],
  walls: [
    {id:'n',a:{x:0,y:0},b:{x:10,y:0},thickness:.18,outer:true},
    {id:'e',a:{x:10,y:0},b:{x:10,y:6},thickness:.18,outer:true},
    {id:'s',a:{x:0,y:6},b:{x:10,y:6},thickness:.18,outer:true},
    {id:'w',a:{x:0,y:0},b:{x:0,y:6},thickness:.18,outer:true},
    {id:'living-top',a:{x:4,y:0},b:{x:4,y:6},thickness:.11},
    {id:'bed-top',a:{x:6.8,y:0},b:{x:6.8,y:3},thickness:.11},
    {id:'bed-bottom',a:{x:6.8,y:4},b:{x:6.8,y:6},thickness:.11},
    {id:'bath-divider',a:{x:8.4,y:4},b:{x:8.4,y:6},thickness:.11},
    {id:'hall-top',a:{x:4,y:3},b:{x:10,y:3},thickness:.11},
    {id:'hall-bottom',a:{x:4,y:4},b:{x:10,y:4},thickness:.11},
  ],
  openings: [
    {id:'entry',wallId:'s',kind:'door',offset:.25,width:.85,height:2.15,sill:0},
    {id:'living-entry',wallId:'living-top',kind:'door',offset:.59,width:.85,height:2.1,sill:0},
    {id:'door-bed2',wallId:'hall-top',kind:'door',offset:.25,width:.8,height:2.1,sill:0},
    {id:'door-master',wallId:'hall-top',kind:'door',offset:.72,width:.8,height:2.1,sill:0},
    {id:'door-bed3',wallId:'hall-bottom',kind:'door',offset:.22,width:.76,height:2.1,sill:0},
    {id:'door-bath1',wallId:'hall-bottom',kind:'door',offset:.6,width:.67,height:2.1,sill:0},
    {id:'door-bath2',wallId:'hall-bottom',kind:'door',offset:.88,width:.67,height:2.1,sill:0},
    {id:'living-window',wallId:'n',kind:'window',offset:.20,width:2,height:1.3,sill:.9},
    {id:'bed2-window',wallId:'n',kind:'window',offset:.54,width:1.2,height:1.25,sill:.9},
    {id:'master-window',wallId:'n',kind:'window',offset:.83,width:1.5,height:1.25,sill:.9},
    {id:'bed3-window',wallId:'s',kind:'window',offset:.53,width:1.1,height:1.25,sill:.9},
  ],
  furniture: [
    furniture('sofa-1','sofa','Sofá',1.15,1.2,2.2,.85,.85,90,'#d9d1c5'),
    furniture('rug-1','rug','Alfombra',2.25,1.65,1.7,1.35,.025,0,'#e6ddd0'),
    furniture('table-1','table','Mesa de comedor',2.1,3.75,1.3,.8,.76,0,'#c9a578'),
    furniture('kitchen-1','kitchen','Cocina lineal',1.43,5.62,2.7,.65,.9,0,'#ece7dd'),
    furniture('fridge-1','fridge','Frigorífico',3.38,5.61,.65,.65,1.9,0,'#eeeae4'),
    furniture('bed-main','bed','Cama doble',8.42,1.42,1.6,2,.55,0,'#e0d5c4'),
    furniture('ward-main','wardrobe','Armario principal',7.38,2.6,1,.6,2.15,0,'#e5e0d6'),
    furniture('bed-2','single-bed','Cama individual',5.14,1.36,.9,1.9,.55,0,'#e3d8cb'),
    furniture('desk-2','desk','Escritorio',6.15,.45,1,.5,.75,0,'#c8a781'),
    furniture('bed-3','single-bed','Cama individual',5.05,5.1,.9,1.75,.55,90,'#e1d6c8'),
    furniture('sink-1','sink','Lavabo 1',7.18,5.35,.65,.5,.84,0,'#ecece8'),
    furniture('toilet-1','toilet','Inodoro 1',7.75,5.32,.4,.6,.65,0,'#f7f6f3'),
    furniture('shower-1','shower','Ducha 1',7.60,4.55,.72,.74,2,0,'#f0eeeb'),
    furniture('sink-2','sink','Lavabo 2',8.8,5.35,.65,.5,.84,0,'#ecece8'),
    furniture('toilet-2','toilet','Inodoro 2',9.52,5.32,.4,.6,.65,0,'#f7f6f3'),
    furniture('shower-2','shower','Ducha 2',9.55,4.55,.72,.74,2,0,'#f0eeeb'),
    furniture('plant-1','plant','Ficus',.6,.6,.5,.5,1.2,0,'#5f8261'),
  ],
};

/** A new empty plan with an editable outer envelope. */
export function blankProject(width=10,depth=6):Project {
  const p:Project={
    version:1,id:`blank-${Date.now()}`,name:'Nuevo proyecto',width,depth,wallHeight:2.55,
    palette:{...styles['Nórdico']},
    rooms:[{id:'room-1',name:'Espacio principal',kind:'living',x:0,y:0,w:width,d:depth,floor:'oak'}],
    walls:[
      {id:'north',a:{x:0,y:0},b:{x:width,y:0},thickness:.18,outer:true},
      {id:'east',a:{x:width,y:0},b:{x:width,y:depth},thickness:.18,outer:true},
      {id:'south',a:{x:width,y:depth},b:{x:0,y:depth},thickness:.18,outer:true},
      {id:'west',a:{x:0,y:depth},b:{x:0,y:0},thickness:.18,outer:true}
    ],openings:[],furniture:[]
  };
  return p;
}
