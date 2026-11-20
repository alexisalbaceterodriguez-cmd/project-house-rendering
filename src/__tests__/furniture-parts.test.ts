import { describe, expect, it } from 'vitest';
import { FACE_GAP, tableLampParts, vaseParts, bookStackParts, supportTop, placedElevation, tabletopSpot, cornerSofaParts, poufParts, consoleTableParts, curtainParts, extendingTableParts, deskHutchParts, bunkBedParts, laundryBasketParts, floatingNightstandParts, barStoolParts, cribParts, washerParts, dresserParts, radiatorParts, shoeCabinetParts, towelRailParts, wallShelfParts, armchairParts, bathtubParts, benchParts, coatRackParts, sideTableParts, artworkParts, coffeeTableParts, furnitureElevation, mirrorParts, pendantParts, tvParts, tvUnitParts, bedParts, bookshelfParts, chairParts, cushionCount, deskParts, fridgeParts, fronts, islandParts, kitchenParts, lampParts, moduleParts, nightstandParts, partsBounds, plantPotParts, plantSoilHeight, showerParts, sideboardParts, sinkParts, sofaParts, tableParts, toiletParts, wardrobeParts } from '../lib/furnitureParts';
import { plantGeometry, seedFrom } from '../lib/plantGeometry';

const overlapArea=(a:{position:number[];size:number[]},b:{position:number[];size:number[]},axis:number)=>{
  // Faces of a and b on the same plane, perpendicular to `axis`, sharing area (z-fighting).
  const others=[0,1,2].filter(x=>x!==axis);
  const sameFace=[-1,1].some(sa=>[-1,1].some(sb=>sa===sb&&Math.abs(a.position[axis]+sa*a.size[axis]/2-(b.position[axis]+sb*b.size[axis]/2))<1e-6));
  if(!sameFace)return 0;
  return others.reduce((area,x)=>area*Math.max(0,Math.min(a.position[x]+a.size[x]/2,b.position[x]+b.size[x]/2)-Math.max(a.position[x]-a.size[x]/2,b.position[x]-b.size[x]/2)),1);
};

describe('sofaParts', () => {
  for(const [w,d] of [[2.1,.9],[1.6,.85],[3,1]] as const)it(`fits exactly the ${w} × ${d} m footprint`, () => {
    const parts=sofaParts(w,d),[min,max]=partsBounds(parts);
    expect(min[0]).toBeCloseTo(-w/2,9);expect(max[0]).toBeCloseTo(w/2,9);
    expect(min[2]).toBeCloseTo(-d/2,9);expect(max[2]).toBeCloseTo(d/2,9);
    expect(min[1]).toBeCloseTo(0,9);expect(max[1]).toBeCloseTo(.87,9);
    expect(parts.filter(p=>p.name.startsWith('Cojín de asiento'))).toHaveLength(cushionCount(w-2*Math.min(.2,Math.max(.12,w*.09))));
  });

  it('splits the seat into separate cushions with a 1 cm gap', () => {
    const seats=sofaParts(2.3,.95).filter(p=>p.name.startsWith('Cojín de asiento')).sort((a,b)=>a.position[0]-b.position[0]);
    expect(seats.length).toBe(3);
    for(let i=1;i<seats.length;i++)expect(seats[i].position[0]-seats[i].size[0]/2-(seats[i-1].position[0]+seats[i-1].size[0]/2)).toBeCloseTo(FACE_GAP,9);
    expect(seats.every(p=>p.crown?.axis==='y')).toBe(true);
  });

  it('never puts two part faces on the same plane', () => {
    for(const parts of [sofaParts(2.1,.9),bedParts(1.6,2),bedParts(.9,1.9),bedParts(1.5,2,true),bedParts(.9,1.9,true)])
      for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)for(let a=0;a<3;a++)
        expect(overlapArea(parts[i],parts[j],a),`${parts[i].name} / ${parts[j].name} axis ${a}`).toBeLessThan(1e-9);
  });
});

describe('bedParts', () => {
  it('keeps the headboard inside the footprint and the bed within w × d', () => {
    const [min,max]=partsBounds(bedParts(1.6,2));
    expect(min[0]).toBeCloseTo(-.8,9);expect(max[0]).toBeCloseTo(.8,9);
    expect(min[2]).toBeCloseTo(-1,9);expect(max[2]).toBeLessThanOrEqual(1);
    expect(max[1]).toBeCloseTo(1.1,9);
  });

  it('uses two pillows on a double bed and one on a single bed', () => {
    expect(bedParts(1.6,2).filter(p=>p.name.startsWith('Almohada'))).toHaveLength(2);
    expect(bedParts(.9,1.9).filter(p=>p.name.startsWith('Almohada'))).toHaveLength(1);
  });

  it('replaces the legs with a plinth and two side drawers per side on the storage bed', () => {
    const parts=bedParts(1.5,2,true),[min,max]=partsBounds(parts);
    expect(min[0]).toBeCloseTo(-.75,9);expect(max[0]).toBeCloseTo(.75,9);expect(min[1]).toBeCloseTo(0,9);expect(max[2]).toBeLessThanOrEqual(1);
    expect(parts.some(p=>p.name.startsWith('Pata'))).toBe(false);
    const drawers=parts.filter(p=>p.name.startsWith('Cajón'));
    expect(drawers).toHaveLength(4);
    for(const p of drawers)expect(Math.abs(p.position[0])+p.size[0]/2).toBeLessThan(.75);
    expect(new Set(parts.map(p=>p.name)).size).toBe(parts.length);
  });
});

const builders={
  wardrobe:[wardrobeParts,[[1.5,.62,2.25],[.6,.6,2],[3,.65,2.4]]],
  table:[tableParts,[[1.5,.85,.75],[.9,.5,.4],[1.2,.6,.76]]],
  desk:[deskParts,[[1,.5,.75],[1.4,.7,.76],[.9,.5,.74],[1.6,.8,.6]]],
  nightstand:[nightstandParts,[[.45,.38,.52],[.6,.45,.6],[.35,.3,.4]]],
  bookshelf:[bookshelfParts,[[.8,.32,1.9],[1.2,.4,2.2],[.6,.25,.9],[.4,.3,.35]]],
  armchair:[armchairParts,[[.78,.82,.8],[.65,.7,.72],[.95,.9,.95]]],
  sideboard:[sideboardParts,[[1.6,.45,.75],[1.2,.4,.5],[2.2,.5,.85],[.9,.42,.8]]],
  island:[islandParts,[[1.5,.8,.9],[2.4,1,.9]]],
  chair:[chairParts,[[.52,.55,.85],[.45,.5,.8]]],
  kitchen:[kitchenParts,[[2.6,.65,.9],[1.2,.6,.9]]],
  fridge:[fridgeParts,[[.65,.65,1.9],[.6,.6,1.8]]],
  sink:[sinkParts,[[.8,.5,.85],[.65,.5,.84],[1.2,.46,.9]]],
  toilet:[toiletParts,[[.4,.6,.65],[.43,.65,.65],[.36,.7,.8]]],
  shower:[showerParts,[[.9,.9,2],[.72,.74,2],[1.4,.8,2.1]]],
  lamp:[lampParts,[[.4,.4,1.65],[.5,.45,1.4]]],
  'vase':[vaseParts,[[.16,.16,.55],[.12,.12,.25],[.2,.2,.8]]],
  'books':[bookStackParts,[[.26,.2,.12],[.22,.16,.06],[.32,.24,.2]]],
  'table-lamp':[tableLampParts,[[.3,.3,.48],[.25,.25,.4],[.4,.4,.6]]],
  'corner-sofa':[cornerSofaParts,[[2.6,1.6,.85],[2.2,1.5,.8],[3.2,1.8,.9]]],
  pouf:[poufParts,[[.5,.5,.42],[.4,.4,.38],[.6,.45,.45]]],
  'console-table':[consoleTableParts,[[1,.35,.8],[.8,.3,.75],[1.4,.4,.85]]],
  curtain:[curtainParts,[[1.8,.15,2.5],[1.2,.12,2.3],[3,.2,2.7]]],
  'extending-table':[extendingTableParts,[[1.6,.9,.76],[1.2,.8,.75],[2,1,.76]]],
  'desk-hutch':[deskHutchParts,[[1.2,.6,1.5],[1,.55,1.4],[1.6,.7,1.8]]],
  'bunk-bed':[bunkBedParts,[[.97,2.06,1.6],[.9,1.95,1.5],[1.1,2.1,1.75]]],
  'laundry-basket':[laundryBasketParts,[[.42,.42,.6],[.35,.35,.5],[.5,.4,.65]]],
  'floating-nightstand':[floatingNightstandParts,[[.45,.32,.25],[.4,.3,.2],[.6,.35,.3]]],
  washer:[washerParts,[[.6,.6,.85],[.6,.55,.85],[.45,.6,.85]]],
  dryer:[(w:number,d:number,h:number)=>washerParts(w,d,h,true),[[.6,.6,.85],[.6,.65,.9]]],
  crib:[cribParts,[[1.24,.66,.9],[1.04,.6,.85],[1.44,.76,.95]]],
  'bar-stool':[barStoolParts,[[.42,.42,.75],[.38,.38,.65],[.45,.45,.8]]],
  dresser:[dresserParts,[[1,.45,.8],[.6,.4,.7],[1.4,.5,1.1]]],
  'shoe-cabinet':[shoeCabinetParts,[[.8,.24,1],[.6,.2,.6],[1.2,.3,1.2]]],
  'wall-shelf':[wallShelfParts,[[.8,.22,.32],[.5,.18,.25],[1.2,.25,.4]]],
  'towel-rail':[towelRailParts,[[.5,.1,1.2],[.4,.08,.8],[.6,.12,1.6]]],
  radiator:[radiatorParts,[[.8,.1,.6],[.4,.08,.5],[1.4,.12,.9]]],
  bench:[benchParts,[[1.2,.4,.45],[.9,.35,.42],[1.6,.45,.5]]],
  'side-table':[sideTableParts,[[.45,.45,.55],[.35,.35,.5],[.6,.6,.65]]],
  'coat-rack':[coatRackParts,[[.45,.45,1.75],[.35,.35,1.6],[.55,.5,1.9]]],
  bathtub:[bathtubParts,[[1.7,.75,.58],[1.5,.7,.55],[1.9,.8,.6]]],
  'coffee-table':[coffeeTableParts,[[1,.55,.4],[.6,.6,.35],[1.4,.8,.45],[.8,.5,.22]]],
  'tv-unit':[tvUnitParts,[[1.8,.4,.45],[1.2,.38,.4],[2.4,.45,.55]]],
  tv:[tvParts,[[1.23,.05,.71],[.73,.06,.43],[1.66,.04,.95]]],
  pendant:[pendantParts,[[.42,.42,.8],[.25,.25,.5],[.6,.6,1.2]]],
  mirror:[mirrorParts,[[.6,.03,.9],[.5,.025,1.6],[1.2,.04,.8]]],
  artwork:[artworkParts,[[.7,.03,.9],[.4,.025,.5],[1.4,.035,1]]],
} as const;

describe('parametric furniture', () => {
  for(const [kind,[build,sizes]] of Object.entries(builders))for(const [w,d,h] of sizes)it(`${kind} ${w} × ${d} × ${h} stays in its footprint without coplanar faces`, () => {
    const parts=build(w,d,h),[min,max]=partsBounds(parts);
    expect(min[0]).toBeCloseTo(-w/2,9);expect(max[0]).toBeCloseTo(w/2,9);
    expect(min[2]).toBeGreaterThanOrEqual(-d/2-1e-9);expect(max[2]).toBeLessThanOrEqual(d/2+1e-9);
    // The washbasin unit hangs 30 cm above the floor; its mixer, like the kitchen's hob, sink and
    // tap, stands above `h`. The shower's glass and head stay just under `h`.
    expect(min[1]).toBeCloseTo(kind==='sink'?.3:0,9);
    if(kind==='kitchen'||kind==='sink')expect(max[1]).toBeLessThan(h+.3);
    else if(kind==='shower')expect(max[1]).toBeLessThanOrEqual(h);
    else expect(max[1]).toBeCloseTo(h,9);
    expect(new Set(parts.map(p=>p.name)).size).toBe(parts.length);
    for(const p of parts)expect(Math.min(...p.size)).toBeGreaterThan(0);
    const boxes=parts.filter(p=>!p.lathe);
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)for(let a=0;a<3;a++)
      expect(overlapArea(boxes[i],boxes[j],a),`${boxes[i].name} / ${boxes[j].name} axis ${a}`).toBeLessThan(1e-9);
    // Turned parts fill their size exactly: the profile spans radius 1 and heights 0 to 1.
    for(const p of parts.filter(p=>p.lathe)){
      expect(Math.max(...p.lathe!.map(([r])=>r)),p.name).toBe(1);
      expect(Math.min(...p.lathe!.map(([,y])=>y)),p.name).toBe(0);expect(Math.max(...p.lathe!.map(([,y])=>y)),p.name).toBe(1);
    }
  });

  const moduleSizes={base:[.6,.6,.88],sink:[.8,.6,.88],hob:[.6,.6,.88],oven:[.6,.6,.88],vanity:[.6,.46,.85],wall:[.8,.35,.72],column:[.6,.6,2.1],hood:[.6,.5,.8]} as const;
  for(const [family,[w,d,h]] of Object.entries(moduleSizes))for(const handles of ['bar','none'] as const)for(const scale of [1,.75,1.5])it(`${family} module ${handles} handles at ${scale} × width stays in its footprint`, () => {
    const width=w*scale,parts=moduleParts(family as keyof typeof moduleSizes,width,d,h,handles),[min,max]=partsBounds(parts);
    expect(min[0]).toBeCloseTo(-width/2,9);expect(max[0]).toBeCloseTo(width/2,9);
    expect(min[2]).toBeGreaterThanOrEqual(-d/2-1e-9);expect(max[2]).toBeLessThanOrEqual(d/2+1e-9);
    expect(min[1]).toBeCloseTo(0,9);
    // Hob glass, taps and vessel basins stand on the worktop, above `h`.
    if(['sink','hob','vanity'].includes(family))expect(max[1]).toBeLessThan(h+.35);else expect(max[1]).toBeCloseTo(h,9);
    expect(new Set(parts.map(p=>p.name)).size).toBe(parts.length);
    for(const p of parts)expect(Math.min(...p.size)).toBeGreaterThan(0);
    const boxes=parts.filter(p=>!p.lathe);
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)for(let a=0;a<3;a++)
      expect(overlapArea(boxes[i],boxes[j],a),`${boxes[i].name} / ${boxes[j].name} axis ${a}`).toBeLessThan(1e-9);
    // Floor modules keep the worktop at h with its finish role; bar handles only when asked for (ovens always have one).
    if(family!=='wall'&&family!=='column'&&family!=='hood'){
      const top=parts.filter(p=>p.role==='worktop');
      expect(top.length).toBeGreaterThan(0);
      for(const t of top)expect(t.position[1]+t.size[1]/2).toBeCloseTo(h,9);
    }
    const bars=parts.filter(p=>p.name.startsWith('Tirador')&&!p.name.includes('soporte')).map(p=>p.name);
    if(handles==='none'||family==='hood')expect(bars).toEqual(family==='oven'?['Tirador horno']:[]);
    else expect(bars.length).toBeGreaterThan(0);
  });

  it('gives a wardrobe ~50 cm doors with 3 mm gaps and handles on the meeting edges', () => {
    const parts=wardrobeParts(1.5,.62,2.25),doors=parts.filter(p=>/^Puerta \d$/.test(p.name));
    expect(doors).toHaveLength(3);
    const gaps=doors.slice(1).map((door,i)=>door.position[0]-door.size[0]/2-(doors[i].position[0]+doors[i].size[0]/2));
    gaps.forEach(gap=>expect(gap).toBeCloseTo(.003,9));
    const bars=parts.filter(p=>/^Tirador \d$/.test(p.name)).map(p=>p.position[0]);
    // Doors 1 and 2 are a pair (handles face each other); door 3 opens on its own.
    expect(bars[0]).toBeGreaterThan(doors[0].position[0]);expect(bars[1]).toBeLessThan(doors[1].position[0]);
    expect(bars[0]).toBeLessThan(bars[1]);
    expect(parts.filter(p=>p.material==='metal').every(p=>p.position[2]+p.size[2]/2<=.31+1e-9)).toBe(true);
  });

  it('splits fronts evenly with equal gaps at both ends', () => {
    const f=fronts(1.2,2,.003);
    expect(f[0].size).toBeCloseTo((1.2-.009)/2,9);
    expect(f[0].x-f[0].size/2).toBeCloseTo(-.6+.003,9);expect(f[1].x+f[1].size/2).toBeCloseTo(.6-.003,9);
  });
});

describe('bathroom, lamp and plant', () => {
  it('closes the toilet lid over the bowl and keeps the flush button on the cistern top', () => {
    const parts=toiletParts(.4,.6,.65),get=(name:string)=>parts.find(p=>p.name===name)!;
    const bowl=get('Taza'),lid=get('Tapa'),cistern=get('Tapa cisterna'),button=get('Pulsador');
    expect(lid.position[1]-lid.size[1]/2).toBeGreaterThan(bowl.position[1]+bowl.size[1]/2);
    expect(lid.position[2]+lid.size[2]/2).toBeLessThanOrEqual(.3);
    expect(button.position[1]-button.size[1]/2).toBeCloseTo(cistern.position[1]+cistern.size[1]/2,9);
    expect(cistern.position[2]).toBeLessThan(bowl.position[2]);
  });

  it('puts the washbasin on the top with the mixer spout over the basin', () => {
    const parts=sinkParts(.65,.5,.84),get=(name:string)=>parts.find(p=>p.name===name)!;
    const basin=get('Lavabo'),top=get('Encimera'),spout=get('Boquilla');
    expect(basin.position[1]-basin.size[1]/2).toBeCloseTo(top.position[1]+top.size[1]/2,9);
    expect(basin.position[1]+basin.size[1]/2).toBeCloseTo(.84,9);
    expect(Math.abs(spout.position[2]-basin.position[2])).toBeLessThan(basin.size[2]/2);
    expect(spout.position[1]-spout.size[1]/2).toBeGreaterThan(.84);
  });

  it('marks the lamp shade so the night render can light it', () => {
    expect(lampParts(.4,.4,1.65).find(p=>p.name==='Pantalla')?.role).toBe('lampshade');
  });

  for(const [w,d,h] of [[.5,.5,1.2],[.55,.55,1.1],[.9,.6,1.8]] as const)it(`grows a ${w} × ${d} × ${h} m plant inside its footprint`, () => {
    const plant=plantGeometry(w,d,h,plantSoilHeight(h),seedFrom('plant-1'));
    const pot=partsBounds(plantPotParts(w,d,h));
    expect(plant.leaves[0].attributes.position.count+plant.leaves[1].attributes.position.count).toBeGreaterThan(400);
    for(const g of [plant.stems,...plant.leaves]){
      const box=g.boundingBox!;
      expect(box.min.x).toBeGreaterThanOrEqual(-w/2);expect(box.max.x).toBeLessThanOrEqual(w/2);
      expect(box.min.z).toBeGreaterThanOrEqual(-d/2);expect(box.max.z).toBeLessThanOrEqual(d/2);
      expect(box.max.y).toBeLessThanOrEqual(h);expect(box.min.y).toBeGreaterThan(pot[1][1]*.8);
    }
  });

  it('grows the same plant from the same id and a different one from another id', () => {
    const a=plantGeometry(.5,.5,1.2,.45,seedFrom('plant-1')),b=plantGeometry(.5,.5,1.2,.45,seedFrom('plant-1')),c=plantGeometry(.5,.5,1.2,.45,seedFrom('plant-2'));
    expect(Array.from(a.leaves[0].attributes.position.array)).toEqual(Array.from(b.leaves[0].attributes.position.array));
    expect(Array.from(a.leaves[0].attributes.position.array)).not.toEqual(Array.from(c.leaves[0].attributes.position.array));
  });
});

describe('hung furniture', () => {
  it('pendants touch the ceiling, mirrors and prints centre at 1.5 m and TVs at 1.2 m', () => {
    expect(furnitureElevation({kind:'pendant',h:.8},2.55)).toBeCloseTo(1.75);
    expect(furnitureElevation({kind:'mirror',h:.9},2.55)).toBeCloseTo(1.05);
    expect(furnitureElevation({kind:'mirror',h:1.6},2.55)).toBe(0);
    expect(furnitureElevation({kind:'artwork',h:.5},2.55)).toBeCloseTo(1.25);
    expect(furnitureElevation({kind:'tv',h:.71},2.55)).toBeCloseTo(.845);
    expect(furnitureElevation({kind:'sofa',h:.85},2.55)).toBe(0);
    expect(furnitureElevation({kind:'kitchen',h:.72,module:{family:'wall'}},2.55)).toBeCloseTo(1.45);
  });

  it('hangs shelves at 1.2 m, towel rails at 15 cm and radiators at 12 cm, never through the ceiling', () => {
    expect(furnitureElevation({kind:'wall-shelf',h:.32},2.55)).toBeCloseTo(1.2);
    expect(furnitureElevation({kind:'wall-shelf',h:1.6},2.55)).toBe(0);
    expect(furnitureElevation({kind:'towel-rail',h:1.2},2.55)).toBeCloseTo(.15);
    expect(furnitureElevation({kind:'towel-rail',h:2.5},2.55)).toBeCloseTo(.05);
    expect(furnitureElevation({kind:'radiator',h:.6},2.55)).toBeCloseTo(.12);
    expect(furnitureElevation({kind:'floating-nightstand',h:.25},2.55)).toBeCloseTo(.35);
    expect(furnitureElevation({kind:'dresser',h:.8},2.55)).toBe(0);
  });
});

describe('tabletop objects', () => {
  const lamp={id:'l',kind:'table-lamp',x:1,y:1,w:.3,d:.3,h:.48,rotation:0};
  const night={id:'n',kind:'nightstand',x:1.1,y:1,w:.45,d:.38,h:.52,rotation:0};
  it('stand on the tallest furniture under their centre, or on the floor', () => {
    expect(supportTop(lamp,[lamp],2.55)).toBe(0);
    expect(supportTop(lamp,[lamp,night],2.55)).toBeCloseTo(.52);
    expect(supportTop(lamp,[lamp,night,{...night,id:'d',kind:'dresser',h:.8,w:1,d:.5}],2.55)).toBeCloseTo(.8);
    expect(supportTop({...lamp,x:1.5},[lamp,night],2.55)).toBe(0);
    // Hung supports add their hang height; rugs and other lamps never carry one.
    expect(supportTop(lamp,[{...night,kind:'floating-nightstand',h:.25}],2.55)).toBeCloseTo(.6);
    expect(supportTop(lamp,[{...night,kind:'rug',h:.02},{...lamp,id:'o'}],2.55)).toBe(0);
  });
  it('follow the support rotation', () => {
    const long={id:'s',kind:'sideboard',x:1,y:1,w:1.6,d:.4,h:.75,rotation:0};
    const off={...lamp,x:1,y:1.6};
    expect(supportTop(off,[long],2.55)).toBe(0);
    expect(supportTop(off,[{...long,rotation:90}],2.55)).toBeCloseTo(.75);
    expect(placedElevation(off,[{...long,rotation:270}],2.55)).toBeCloseTo(.75);
    expect(placedElevation({...night,kind:'floating-nightstand',h:.25},[long],2.55)).toBeCloseTo(.35);
  });
  it('are added onto the selected support, turned like it', () => {
    const turnedNight={...night,rotation:90};
    const spot=tabletopSpot('table-lamp',turnedNight);
    expect(spot).toEqual({x:1.1,y:1,rotation:90});
    expect(supportTop({...lamp,...spot!},[turnedNight],2.55)).toBeCloseTo(.52);
    expect(tabletopSpot('table-lamp',undefined)).toBeUndefined();
    expect(tabletopSpot('table-lamp',{...night,kind:'rug'})).toBeUndefined();
    expect(tabletopSpot('table-lamp',lamp)).toBeUndefined();
    expect(tabletopSpot('chair',night)).toBeUndefined();
  });
});
