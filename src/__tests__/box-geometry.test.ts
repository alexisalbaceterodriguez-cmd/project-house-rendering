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

describe('cushion crown', () => {
  it('domes the top inside the box and keeps the bottom flat', () => {
    const size=[.6,.16,.7] as const,g=physicalBox(size,.05,{axis:'y',amount:.015});
    const [x,y,z]=extent(g);
    expect(x).toBeCloseTo(.6,6);expect(z).toBeCloseTo(.7,6);
    expect(y).toBeLessThanOrEqual(.16+1e-9);expect(y).toBeGreaterThan(.16-.002);
    g.computeBoundingBox();expect(g.boundingBox!.min.y).toBeCloseTo(-.08,6);
  });

  it('domes both faces of a scatter cushion towards its mid-plane, inside the box', () => {
    const size=[.45,.45,.16] as const,g=physicalBox(size,.03,{axis:'z',amount:.05,both:true}),pos=g.attributes.position,n=g.attributes.normal;
    const [x,y,z]=extent(g);
    expect(x).toBeCloseTo(.45,6);expect(y).toBeCloseTo(.45,6);expect(z).toBeLessThanOrEqual(.16+1e-9);expect(z).toBeGreaterThan(.16-.006);
    let front=0,back=0;
    for(let i=0;i<pos.count;i++){
      // Near the corners both faces have moved in by about the full amount; normals stay outward.
      if(Math.abs(pos.getX(i))>.2&&Math.abs(pos.getY(i))>.2&&Math.abs(n.getZ(i))>.5){
        expect(Math.abs(pos.getZ(i))).toBeLessThan(.08-.03);
        expect(Math.sign(n.getZ(i))).toBe(Math.sign(pos.getZ(i)));
        if(pos.getZ(i)>0)front++;else back++;
      }
      expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,6);
    }
    expect(front).toBeGreaterThan(0);expect(back).toBeGreaterThan(0);
  });

  it('tilts top normals outward towards the edges, matching the surface', () => {
    const g=physicalBox([.6,.16,.7],.05,{axis:'y',amount:.015}),pos=g.attributes.position,n=g.attributes.normal;
    let checked=0;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      // Expected slope dL/dx = amount·2u(1 - v²)/hx, so n.x ≈ slope on the dome (≈ 3° here).
      if(n.getY(i)>.9&&Math.abs(z)<.01&&x>.1&&x<.2&&y>0){
        expect(n.getX(i)/n.getY(i)).toBeCloseTo(.015*2*(x/.3)/.3,3);checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    for(let i=0;i<n.count;i++)expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,6);
  });

  it('bulges a back cushion forward (+z) without passing its front plane', () => {
    const g=physicalBox([.6,.36,.17],.06,{axis:'z',amount:.025});g.computeBoundingBox();
    expect(g.boundingBox!.max.z).toBeLessThanOrEqual(.085+1e-9);
    expect(g.boundingBox!.min.z).toBeCloseTo(-.085,6);
  });
});

describe('latheGeometry', () => {
  it('turns about z for front-facing parts and still fills the size exactly', async () => {
    const { latheGeometry } = await import('../lib/boxGeometry');
    const box=latheGeometry([[0,0],[1,0],[1,1],[0,1]],[.4,.3,.06],undefined,'z').boundingBox!;
    expect(box.min.x).toBeCloseTo(-.2,6);expect(box.max.x).toBeCloseTo(.2,6);
    expect(box.min.y).toBeCloseTo(-.15,6);expect(box.max.y).toBeCloseTo(.15,6);
    expect(box.min.z).toBeCloseTo(-.03,6);expect(box.max.z).toBeCloseTo(.03,6);
  });

  it('fills an oval envelope exactly and winds its faces outward', async () => {
    const { latheGeometry } = await import('../lib/boxGeometry');
    const THREE = await import('three');
    const g=latheGeometry([[0,0],[1,0],[1,1],[0,1]],[.4,.3,.6]),box=g.boundingBox!;
    expect(box.min.x).toBeCloseTo(-.2,6);expect(box.max.x).toBeCloseTo(.2,6);
    expect(box.min.z).toBeCloseTo(-.3,6);expect(box.max.z).toBeCloseTo(.3,6);
    expect(box.min.y).toBeCloseTo(-.15,6);expect(box.max.y).toBeCloseTo(.15,6);
    const p=g.attributes.position,index=g.index!,side=new THREE.Vector3(),n=new THREE.Vector3();
    let inward=0;
    for(let t=0;t<index.count;t+=3){
      const [a,b,c]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(t+k)));
      n.subVectors(b,a).cross(side.subVectors(c,a));
      const centre=a.add(b).add(c).multiplyScalar(1/3);
      if(n.lengthSq()<1e-14||Math.abs(centre.y)>.149)continue;
      if(n.x*centre.x+n.z*centre.z<0)inward++;
    }
    expect(inward).toBe(0);
  });
});

