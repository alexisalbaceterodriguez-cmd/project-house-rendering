import { describe,expect,it } from 'vitest';
import { blankProject,demoProject } from '../data/defaultProject';
import { objectCamera } from '../lib/studioRender';
import type { Furniture,Point,Wall } from '../types';

const cross=(o:Point,a:Point,b:Point)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
const crosses=(p:Point,q:Point,w:Wall)=>cross(p,q,w.a)*cross(p,q,w.b)<0&&cross(w.a,w.b,p)*cross(w.a,w.b,q)<0;
const distance=(p:Point,a:Point,b:Point)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};

describe('Encuadrar objeto seleccionado',()=>{
  it('nunca deja la cámara dentro de un muro ni con un muro delante en la planta de ejemplo',()=>{
    for(const item of demoProject.furniture){
      const {position,target}=objectCamera(item,demoProject);
      const camera={x:position[0],y:position[2]},subject={x:target[0],y:target[2]};
      for(const wall of demoProject.walls){
        expect(crosses(subject,camera,wall),`${item.name} mira a través de ${wall.id}`).toBe(false);
        expect(distance(camera,wall.a,wall.b),`${item.name} dentro de ${wall.id}`).toBeGreaterThan(wall.thickness/2);
      }
      expect(position[1]).toBeLessThan(demoProject.wallHeight);
    }
  });
  it('conserva el encuadre diagonal habitual cuando no hay obstáculos',()=>{
    const item:Furniture={id:'mesa',name:'Mesa',kind:'table',x:5,y:3,w:1.2,d:.8,h:.75,rotation:0,color:'#aa8866'};
    expect(objectCamera(item,blankProject()).position.map(v=>+v.toFixed(3))).toEqual(objectCamera(item).position.map(v=>+v.toFixed(3)));
  });
  it('se acerca delante del muro si ninguna dirección tiene la distancia completa libre',()=>{
    const project=blankProject(2.4,2.4);
    const item:Furniture={id:'cama',name:'Cama',kind:'bed',x:1.2,y:1.2,w:1.4,d:1.9,h:.5,rotation:0,color:'#ffffff'};
    const {position}=objectCamera(item,project);
    for(const wall of project.walls)expect(distance({x:position[0],y:position[2]},wall.a,wall.b)).toBeGreaterThan(wall.thickness/2);
  });
});
