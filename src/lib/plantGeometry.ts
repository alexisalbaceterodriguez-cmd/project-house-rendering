import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Small deterministic PRNG (mulberry32): the same seed always grows the same plant. */
function random(seed:number){
  return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
/** Stable 32-bit seed from a furniture id (FNV-1a), so each plant keeps its own shape across reloads. */
export function seedFrom(text:string){let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;}

/**
 * One leaf blade, base at the origin and length along +z: the half-width follows
 * sin(πu)^0.7 (narrow base, pointed tip), the two halves fold up along the midrib and the
 * blade droops towards the tip. A thin surface: draw it double-sided.
 */
export function leafGeometry(length:number,width:number,fold=.35,droop=.22):THREE.BufferGeometry{
  const nu=8,nv=4,positions:number[]=[],uvs:number[]=[],index:number[]=[];
  for(let i=0;i<=nu;i++){
    const u=i/nu,half=width/2*Math.pow(Math.sin(Math.PI*u),.7);
    for(let j=0;j<=nv;j++){
      const v=-1+2*j/nv;
      positions.push(v*half,fold*Math.abs(v)*half-droop*u*u*length,u*length);
      uvs.push(j/nv,u);
    }
  }
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
    const a=i*(nv+1)+j,b=a+nv+1;
    index.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(index);geometry.computeVertexNormals();
  return geometry;
}

export type PlantGeometry={stems:THREE.BufferGeometry;leaves:[THREE.BufferGeometry,THREE.BufferGeometry]};

/**
 * Foliage of an indoor plant inside `w × d × h` (origin at the footprint centre on the floor),
 * growing from soil at height `soil`: three to five stems leaning out of the pot and leaves
 * along their upper four fifths in two tones. Every leaf is shrunk (or dropped) until it stays
 * inside the footprint and under `h`, so the plan outline and the height remain true.
 */
export function plantGeometry(w:number,d:number,h:number,soil:number,seed:number):PlantGeometry{
  const rand=random(seed),reach=Math.min(w,d)/2,count=3+Math.floor(rand()*3);
  const stems:THREE.BufferGeometry[]=[],leaves:[THREE.BufferGeometry[],THREE.BufferGeometry[]]=[[],[]];
  const up=new THREE.Vector3(0,1,0),box=new THREE.Box3();
  const fits=(g:THREE.BufferGeometry)=>{g.computeBoundingBox();box.copy(g.boundingBox!);return box.min.x>=-w/2&&box.max.x<=w/2&&box.min.z>=-d/2&&box.max.z<=d/2&&box.max.y<=h&&box.min.y>=soil*.9;};
  for(let s=0;s<count;s++){
    const angle=s/count*Math.PI*2+rand()*.8,top=soil+(h-soil)*(.58+.3*rand());
    const lean=Math.min(.12+rand()*.2,Math.atan2(reach*.55,top-soil));
    const dir=new THREE.Vector3(Math.sin(lean)*Math.cos(angle),Math.cos(lean),Math.sin(lean)*Math.sin(angle));
    const base=new THREE.Vector3(dir.x*.02,soil,dir.z*.02),length=(top-soil)/Math.cos(lean);
    const stem=new THREE.CylinderGeometry(.003,.006,length,6);
    stem.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,dir));
    stem.translate(...base.clone().addScaledVector(dir,length/2).toArray());
    stems.push(stem);
    const n=18+Math.floor(rand()*8);
    for(let k=0;k<n;k++){
      const t=.18+.82*k/(n-1),at=base.clone().addScaledVector(dir,length*t);
      const yaw=rand()*Math.PI*2,rise=-.35+rand()*.8,roll=(rand()-.5)*.8;
      let size=Math.min(w,d)*(.2+.1*rand())*(1.1-.3*t);
      const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-rise,yaw,roll,'YXZ'));
      const matrix=new THREE.Matrix4().compose(at,rotation,new THREE.Vector3(1,1,1));
      for(let attempt=0;attempt<4;attempt++,size*=.7){
        const leaf=leafGeometry(size,size*.55,.22).applyMatrix4(matrix);
        if(fits(leaf)){leaves[rand()<.5?0:1].push(leaf);break;}
        leaf.dispose();
      }
    }
  }
  const merge=(list:THREE.BufferGeometry[])=>{const merged=list.length?mergeGeometries(list)!:new THREE.BufferGeometry();for(const g of list)g.dispose();merged.computeBoundingBox();merged.computeBoundingSphere();return merged;};
  return {stems:merge(stems),leaves:[merge(leaves[0]),merge(leaves[1])]};
}
