import { describe, expect, it } from 'vitest';
import { demoProject } from '../data/defaultProject';

/** Plan footprint of a piece turned by a multiple of 90°. */
function footprint(f:typeof demoProject.furniture[number]){
  const turned=Math.round(f.rotation/90)%2!==0,w=turned?f.d:f.w,d=turned?f.w:f.d;
  return {x0:f.x-w/2,x1:f.x+w/2,y0:f.y-d/2,y1:f.y+d/2};
}

describe('demo project', () => {
  it('keeps 45 cm clear on both sides of every door', () => {
    for(const o of demoProject.openings.filter(o=>o.kind==='door')){
      const wall=demoProject.walls.find(w=>w.id===o.wallId)!;
      const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
      const cx=wall.a.x+ux*o.offset*length,cy=wall.a.y+uy*o.offset*length,along=o.width/2,across=wall.thickness/2+.45;
      const zone={x0:cx-Math.abs(ux)*along-Math.abs(uy)*across,x1:cx+Math.abs(ux)*along+Math.abs(uy)*across,y0:cy-Math.abs(uy)*along-Math.abs(ux)*across,y1:cy+Math.abs(uy)*along+Math.abs(ux)*across};
      for(const f of demoProject.furniture.filter(f=>f.kind!=='rug')){
        const b=footprint(f),hit=b.x0<zone.x1&&b.x1>zone.x0&&b.y0<zone.y1&&b.y1>zone.y0;
        expect(hit,`${f.id} blocks ${o.id}`).toBe(false);
      }
    }
  });

  it('keeps furniture inside the plan and apart, except chairs tucked under a table', () => {
    const boxes=demoProject.furniture.filter(f=>f.kind!=='rug').map(f=>({id:f.id,kind:f.kind,...footprint(f)}));
    const tucked=(a:{kind:string},b:{kind:string})=>a.kind==='chair'&&['table','desk','island'].includes(b.kind);
    for(const b of boxes){
      expect(b.x0,b.id).toBeGreaterThanOrEqual(0);expect(b.y0,b.id).toBeGreaterThanOrEqual(0);
      expect(b.x1,b.id).toBeLessThanOrEqual(demoProject.width);expect(b.y1,b.id).toBeLessThanOrEqual(demoProject.depth);
    }
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      if(tucked(a,b)||tucked(b,a))continue;
      const overlap=a.x0<b.x1-1e-9&&a.x1>b.x0+1e-9&&a.y0<b.y1-1e-9&&a.y1>b.y0+1e-9;
      expect(overlap,`${a.id} overlaps ${b.id}`).toBe(false);
    }
  });
});
