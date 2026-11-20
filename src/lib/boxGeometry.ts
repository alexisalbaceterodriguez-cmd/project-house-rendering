import * as THREE from 'three';

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
 * Pillow dome: the face on the positive side of `axis` keeps its centre and drops by
 * `amount` towards its edges (the opposite face stays flat), so the part never leaves its box.
 */
export type Crown={axis:'y'|'z';amount:number};

const ARC_SEGMENTS=3;
const CROWN_STEP=.08;

/**
 * Box of exactly `size` (width, height, depth) centred on the origin. With a radius the
 * edges and corners are rounded inside that envelope (smooth normals, three segments per
 * 45° on each face). A crown subdivides the flat faces and domes one face. UVs are
 * projected in metres along the dominant normal so textile weave and wood grain keep their
 * real-world scale on every face, in the viewer and in the render GLB.
 */
export function physicalBox(size:readonly [number,number,number],radius=0,crown?:Crown):THREE.BufferGeometry{
  const r=bevelRadius(size,radius),half=size.map(side=>side/2);
  const arc=r>0?ARC_SEGMENTS:0;
  const flat=size.map(side=>crown?Math.max(2,Math.min(14,Math.round((side-2*r)/CROWN_STEP))):1);
  const segments=flat.map(count=>count+2*arc);
  const geometry=new THREE.BoxGeometry(1,1,1,segments[0],segments[1],segments[2]);
  const pos=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
  // Grid coordinate -> metres: `arc` steps cover each rounded band, `flat` steps the face between them.
  const place=(value:number,axis:number)=>{
    const n=segments[axis],i=Math.round((value+.5)*n),h=half[axis];
    if(i<=arc&&arc)return -h+r*i/arc;
    if(i>=n-arc&&arc)return h-r*(n-i)/arc;
    return -(h-r)+2*(h-r)*(i-arc)/flat[axis];
  };
  const p=[0,0,0],n=[0,0,0];
  for(let v=0;v<pos.count;v++){
    for(let a=0;a<3;a++){p[a]=place(pos.getComponent(v,a),a);n[a]=normal.getComponent(v,a);}
    if(r>0){
      const inner=p.map((c,a)=>Math.max(-(half[a]-r),Math.min(half[a]-r,c)));
      const offset=p.map((c,a)=>c-inner[a]),length=Math.hypot(...offset);
      if(length>1e-12)for(let a=0;a<3;a++){n[a]=offset[a]/length;p[a]=inner[a]+n[a]*r;}
    }
    if(crown)applyCrown(p,n,half,crown);
    pos.setXYZ(v,p[0],p[1],p[2]);normal.setXYZ(v,n[0],n[1],n[2]);
    const x=Math.abs(n[0]),y=Math.abs(n[1]),z=Math.abs(n[2]);
    if(y>=x&&y>=z)uv.setXY(v,p[0],p[2]);
    else if(x>=z)uv.setXY(v,p[2],p[1]);
    else uv.setXY(v,p[0],p[1]);
  }
  pos.needsUpdate=normal.needsUpdate=uv.needsUpdate=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Maps the box through p_k' = p_k - L(p_i, p_j)·t with t = (p_k + h_k) / 2h_k and
 * L = amount·(1 - (1 - u²)(1 - v²)): flat back face, domed front face. Normals follow the
 * inverse transpose of that map's Jacobian, so shading matches the new surface exactly.
 */
function applyCrown(p:number[],n:number[],half:number[],crown:Crown){
  const k=crown.axis==='y'?1:2,[i,j]=k===1?[0,2]:[0,1];
  const amount=Math.min(crown.amount,half[k]*.8);
  if(amount<=0)return;
  const u=p[i]/half[i],v=p[j]/half[j],t=(p[k]+half[k])/(2*half[k]);
  const drop=amount*(1-(1-u*u)*(1-v*v));
  const di=amount*2*u*(1-v*v)/half[i],dj=amount*2*v*(1-u*u)/half[j],b=1-drop/(2*half[k]);
  p[k]-=drop*t;
  const ni=n[i]+t*di/b*n[k],nj=n[j]+t*dj/b*n[k],nk=n[k]/b,length=Math.hypot(ni,nj,nk);
  n[i]=ni/length;n[j]=nj/length;n[k]=nk/length;
}

/** Lathe profile normalised to its envelope: [radius 0..1, height 0..1] pairs, listed from the bottom up. */
export type Profile=readonly (readonly [number,number])[];
const LATHE_SEGMENTS=48;

/**
 * Solid of revolution that fills exactly `size` (width, height, depth) centred on the origin:
 * the profile's unit radius maps to half the width along x and half the depth along z, so a
 * non-square envelope gives an oval (toilet bowl, washbasin). Faces wind outward for a profile
 * listed from the bottom up on the outside; normals are smooth and pass through the scale's
 * inverse transpose, so the oval shades correctly.
 */
export function latheGeometry(profile:Profile,size:readonly [number,number,number],segments=LATHE_SEGMENTS):THREE.BufferGeometry{
  const geometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(Math.max(r,1e-5),y-.5)),segments);
  geometry.scale(size[0]/2,size[1],size[2]/2);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
