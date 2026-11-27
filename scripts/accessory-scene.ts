/**
 * Writes the comparison scenes for the arc lamp, floor mirror and bar cart: the example flat with
 * the three accessories added to the living room and a fixed camera per shot. Run with vite-node;
 * scripts/accessory-compare.mjs loads each one, exports the Cycles package and renders it.
 */
import { writeFileSync } from 'node:fs';
import { demoProject } from '../src/data/defaultProject';
import type { CameraView, Furniture, Project } from '../src/types';

const out=process.argv[2]??'accessory-scenes.json';
const extra:Furniture[]=[
  // Base behind the dining end of the sofa, the arc reaching over its arm towards the window.
  {id:'arc-lamp-1',kind:'arc-lamp',name:'Lámpara de pie de arco',x:.32,y:1.9,w:1.6,d:.42,h:2,rotation:270,color:'#2f2e2c'},
  // Mirror and bar cart against the partition wall (x = 4), facing the room.
  {id:'floor-mirror-1',kind:'floor-mirror',name:'Espejo de pie apoyado',x:3.83,y:1.2,w:.6,d:.22,h:1.7,rotation:90,color:'#2b2a28'},
  {id:'bar-cart-1',kind:'bar-cart',name:'Carrito auxiliar de bar',x:3.715,y:2.2,w:.8,d:.45,h:.92,rotation:90,color:'#b08d57'},
];
const shots:{name:string;lighting:'day'|'night';preset:'afternoon'|'night';camera:CameraView}[]=[
  {name:'arc-lamp-night',lighting:'night',preset:'night',camera:{position:[3.6,1.45,3.6],target:[.7,1.05,1.6]}},
  {name:'mirror-cart-afternoon',lighting:'day',preset:'afternoon',camera:{position:[1.1,1.35,3.4],target:[3.8,1.0,1.6]}},
  {name:'mirror-cart-night',lighting:'night',preset:'night',camera:{position:[1.1,1.35,3.4],target:[3.8,1.0,1.6]}},
];
const scenes=shots.map(shot=>{
  const project:Project=structuredClone(demoProject);
  project.furniture.push(...extra);
  project.render={...(project.render??{exposure:1,quality:'high'}),lighting:shot.lighting,quality:'high',exposure:1,camera:shot.camera,walk:false} as Project['render'];
  return {...shot,project};
});
writeFileSync(out,JSON.stringify(scenes));
console.log(`${scenes.length} escenas → ${out}`);
