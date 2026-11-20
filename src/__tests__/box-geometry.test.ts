import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EDGE_RADIUS, bevelRadius, physicalBox } from '../lib/boxGeometry';

const extent=(g:THREE.BufferGeometry)=>{g.computeBoundingBox();const s=new THREE.Vector3();g.boundingBox!.getSize(s);return [s.x,s.y,s.z];};

describe('physicalBox', () => {
  it('keeps the exact outer size when edges are bevelled', () => {
    for(const [size,r] of [[[2.1,.48,.9],EDGE_RADIUS.upholstery],[[1.6,.11,.9],EDGE_RADIUS.wood],[[.075,.65,.075],EDGE_RADIUS.wood],[[1.2,2.1,.6],EDGE_RADIUS.carcass]] as const){
      const g=physicalBox(size,r);
      extent(g).forEach((v,i)=>expect(v).toBeCloseTo(size[i],6));
      expect(g.attributes.position.count).toBeGreaterThan(24);
    }
  });

  it('clamps the radius to 45 % of the thinnest side', () => {
    expect(bevelRadius([1,.02,1],.035)).toBeCloseTo(.009,9);
    expect(bevelRadius([1,1,1],.035)).toBe(.035);
    expect(bevelRadius([1,1,1],-1)).toBe(0);
    extent(physicalBox([1,.02,1],.035)).forEach((v,i)=>expect(v).toBeCloseTo([1,.02,1][i],6));
  });

  it('is a plain box without radius and projects UVs in metres', () => {
    const g=physicalBox([2,1,.5]);
    expect(g.attributes.position.count).toBe(24);
    const uv=g.attributes.uv;let maxU=0;
    for(let i=0;i<uv.count;i++)maxU=Math.max(maxU,Math.abs(uv.getX(i)));
    expect(maxU).toBeCloseTo(1,6); // half of the 2 m width, centred on the origin
  });

  it('has smooth normals on the rounded edges', () => {
    const n=physicalBox([1,1,1],.1).attributes.normal;let diagonal=0;
    for(let i=0;i<n.count;i++)if(Math.abs(n.getX(i))>.2&&Math.abs(n.getY(i))>.2)diagonal++;
    expect(diagonal).toBeGreaterThan(0);
  });
});
