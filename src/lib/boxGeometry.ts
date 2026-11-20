import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Edge radii (metres) for the editor's parametric furniture. Real furniture never has
 * razor-sharp edges: the soft highlight along a rounded edge is what makes a box read as
 * an object under Cycles' path tracing. Radii stay inside the outer envelope, so plan
 * footprints, heights and clearances are unchanged.
 */
export const EDGE_RADIUS={upholstery:.035,cushion:.025,wood:.006,carcass:.004} as const;

/** Radius actually applied: never more than 45 % of the smallest side, so thin parts keep flat faces. */
export const bevelRadius=(size:readonly [number,number,number],radius:number)=>Math.max(0,Math.min(radius,...size.map(side=>side*.45)));

/**
 * Box of exactly `size` (width, height, depth) centred on the origin. With a radius the
 * edges and corners are rounded inside that envelope (smooth normals, three segments per
 * arc). UVs are projected in metres along the dominant normal so textile weave and wood
 * grain keep their real-world scale on every face, in the viewer and in the render GLB.
 */
export function physicalBox(size:readonly [number,number,number],radius=0):THREE.BufferGeometry{
  const r=bevelRadius(size,radius);
  const geometry=r>0?new RoundedBoxGeometry(size[0],size[1],size[2],3,r):new THREE.BoxGeometry(size[0],size[1],size[2]);
  const uv=geometry.attributes.uv,pos=geometry.attributes.position,normal=geometry.attributes.normal;
  for(let i=0;i<uv.count;i++){
    const x=Math.abs(normal.getX(i)),y=Math.abs(normal.getY(i)),z=Math.abs(normal.getZ(i));
    if(y>=x&&y>=z)uv.setXY(i,pos.getX(i),pos.getZ(i));
    else if(x>=z)uv.setXY(i,pos.getZ(i),pos.getY(i));
    else uv.setXY(i,pos.getX(i),pos.getY(i));
  }
  uv.needsUpdate=true;
  return geometry;
}
