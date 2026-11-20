import type { Crown, Profile } from './boxGeometry';

type Vec3=[number,number,number];
/**
 * One solid of a parametric piece of furniture, centred at `position` (metres, origin at the
 * footprint centre on the floor, front +z). `item` = the furniture's own colour, `wood` = the
 * project's wood palette, otherwise a hex colour. The viewer draws each part as a bevelled box,
 * or as a solid of revolution filling `size` when it has a `lathe` profile, and the render GLB
 * carries the same meshes, so Cycles sees exactly this geometry.
 */
export type FurniturePart={name:string;size:Vec3;position:Vec3;color:'item'|'wood'|string;surface?:'textile'|'woodgrain';material?:'metal'|'glass';role?:string;bevel:number;crown?:Crown;lathe?:Profile};

/** Faces that would sit on the same plane are kept at least this far apart (no z-fighting in viewer or Cycles). */
export const FACE_GAP=.01;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
/** Part from its bottom height (y0) instead of its centre: reads like the furniture drawing. */
const part=(name:string,size:Vec3,x:number,y0:number,z:number,rest:Omit<FurniturePart,'name'|'size'|'position'>):FurniturePart=>({name,size,position:[x,y0+size[1]/2,z],...rest});

/** Seat cushions across the inner width: about one per 65 cm, between one and four. */
export const cushionCount=(inner:number)=>clamp(Math.round(inner/.65),1,4);

/**
 * Parametric sofa inside its footprint `w × d` (metres, origin at the centre, front +z):
 * wooden feet, arms, back frame, a plinth and separate seat and back cushions with a 1 cm
 * gap. Overall height 0.87 m; the arms define the full width and depth.
 */
export function sofaParts(w:number,d:number):FurniturePart[]{
  const arm=clamp(w*.09,.12,.2),inner=w-2*arm,back=Math.min(.2,d*.22),leg=.06;
  const n=cushionCount(inner),cushion=(inner-FACE_GAP*(n+1))/n;
  const fabric={color:'item',surface:'textile'} as const;
  const parts:FurniturePart[]=[];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Pata ${x} ${z}`,[.045,leg,.045],x*(w/2-arm/2),0,z*(d/2-.07),{color:'wood',bevel:.006}));
  for(const x of [-1,1])parts.push(part(`Brazo ${x}`,[arm,.58,d],x*(w-arm)/2,leg,0,{...fabric,bevel:.05}));
  parts.push(part('Respaldo',[w-2*FACE_GAP,.8,back],0,leg+FACE_GAP,-d/2+FACE_GAP+back/2,{...fabric,bevel:.04}));
  // Plinth and seat run from the back frame to 1.5 cm behind the arms' front face.
  const front=d/2-.015,rear=-d/2+FACE_GAP+back+FACE_GAP*.5,depth=front-rear,z=(front+rear)/2;
  const backCushion=Math.min(.17,depth*.26);
  parts.push(part('Zócalo',[inner-FACE_GAP,.225,depth],0,leg+.015,z,{...fabric,bevel:.02}));
  for(let i=0;i<n;i++){
    const x=-inner/2+FACE_GAP+cushion/2+i*(cushion+FACE_GAP);
    parts.push(part(`Cojín de asiento ${i+1}`,[cushion,.16,depth],x,.3,z,{...fabric,bevel:.05,crown:{axis:'y',amount:.015}}));
    parts.push(part(`Cojín de respaldo ${i+1}`,[cushion,.36,backCushion],x,.46,rear+backCushion/2,{...fabric,bevel:.06,crown:{axis:'z',amount:.025}}));
  }
  return parts;
}

/**
 * Parametric bed inside its footprint `w × d` (front/foot +z): wooden feet, a headboard
 * inside the footprint, an upholstered base, a separate mattress, pillows and a duvet.
 */
export function bedParts(w:number,d:number):FurniturePart[]{
  const head=.09,leg=.1,baseTop=.34,mattressTop=.54;
  const rear=-d/2+head+FACE_GAP*.5,front=d/2-.005,depth=front-rear,z=(front+rear)/2;
  const pillows=w<1.25?1:2,pillow=(w-.14-.04*(pillows-1))/pillows;
  const duvet=Math.min(d*.62,depth-.05);
  const textile={surface:'textile'} as const;
  const parts:FurniturePart[]=[];
  for(const x of [-1,1])for(const zz of [-1,1])parts.push(part(`Pata ${x} ${zz}`,[.05,leg,.05],x*(w/2-.08),0,zz*(d/2-.08),{color:'wood',bevel:.006}));
  parts.push(part('Cabecero',[w,.98,head],0,.12,-d/2+head/2,{color:'#bc9c80',bevel:.02}));
  parts.push(part('Canapé',[w-2*FACE_GAP,baseTop-leg,depth],0,leg,z,{color:'#c0a489',bevel:.03}));
  parts.push(part('Colchón',[w-.06,mattressTop-baseTop,depth-.04],0,baseTop,z,{color:'item',...textile,bevel:.05,crown:{axis:'y',amount:.01}}));
  for(let i=0;i<pillows;i++){
    const x=-(pillows-1)/2*(pillow+.04)+i*(pillow+.04);
    parts.push(part(`Almohada ${i+1}`,[pillow,.13,.4],x,mattressTop-.01,rear+.04+.2,{color:'#f8f5f0',...textile,bevel:.05,crown:{axis:'y',amount:.03}}));
  }
  parts.push(part('Edredón',[w-.04,.07,duvet],0,mattressTop-.005,front+.002-duvet/2,{color:'#c7b4a0',...textile,bevel:.03,crown:{axis:'y',amount:.01}}));
  return parts;
}

const METAL='#8f8a82';
const HINGE_GAP=.003;

/** Equal fronts across `width` with a `gap` at both ends and between them: centre x and width of each. */
export function fronts(width:number,count:number,gap=HINGE_GAP){
  const size=(width-gap*(count+1))/count;
  return Array.from({length:count},(_,i)=>({x:-width/2+gap+size/2+i*(size+gap),size}));
}

/**
 * Bar handle standing off a front whose face is at `face` (z): two stand-offs reach 2 mm into
 * the front, and the bar's outer face lands on `outer`. Vertical unless `horizontal`.
 */
function barHandle(name:string,x:number,y:number,length:number,face:number,outer:number,horizontal=false):FurniturePart[]{
  const bar=.012,ends=length/2-.03,standoff=outer-bar-face+.004;
  const parts:FurniturePart[]=[{name,size:horizontal?[length,bar,bar]:[bar,length,bar],position:[x,y,outer-bar/2],color:METAL,material:'metal',bevel:.004}];
  for(const s of [-1,1])parts.push({name:`${name} soporte ${s}`,size:[.01,.01,standoff],position:[horizontal?x+s*ends:x,horizontal?y:y+s*ends,face-.002+standoff/2],color:METAL,material:'metal',bevel:.002});
  return parts;
}

/**
 * Wardrobe inside `w × d × h`: recessed plinth, carcass and ~50 cm doors with 3 mm gaps. Paired
 * doors carry their bar handles on the meeting edges; handles end exactly on the front of the
 * footprint, so the plan outline is still the outer envelope.
 */
export function wardrobeParts(w:number,d:number,h:number):FurniturePart[]{
  const plinth=.08,door=.02,face=d/2-.03;
  const n=clamp(Math.round(w/.5),1,6),body=face-door-.002+d/2;
  const parts:FurniturePart[]=[
    part('Zócalo',[w-.04,plinth,d-.08],0,0,-d/2+.01+(d-.08)/2,{color:'item',bevel:.002}),
    part('Cuerpo',[w,h-plinth,body],0,plinth,-d/2+body/2,{color:'item',bevel:.004}),
  ];
  const length=Math.min(.32,h*.15),y=Math.min(1.05,plinth+(h-plinth)/2);
  fronts(w,n).forEach(({x,size},i)=>{
    parts.push(part(`Puerta ${i+1}`,[size,h-plinth-2*HINGE_GAP,door],x,plinth+HINGE_GAP,face-door/2,{color:'item',bevel:.003}));
    const side=n===1||(i%2===0&&i+1<n)?1:-1;
    parts.push(...barHandle(`Tirador ${i+1}`,x+side*(size/2-.045),y,length,face,d/2));
  });
  return parts;
}

/**
 * Dining table or desk inside `w × d × h`: 3.5 cm wood-grain top, square legs set 4 cm in from
 * the edges and an apron of rails between them under the top.
 */
export function tableParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.035,leg=.05,inset=.04,rail=.08,under=h-top;
  const lx=w/2-inset-leg/2,lz=d/2-inset-leg/2;
  const parts:FurniturePart[]=[part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.006})];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Pata ${x} ${z}`,[leg,under,leg],x*lx,0,z*lz,{color:'wood',bevel:.006}));
  const railX=w-2*(inset+leg),railZ=d-2*(inset+leg);
  if(railX>.05)for(const z of [-1,1])parts.push(part(`Faldón ${z}`,[railX,rail,.02],0,under-rail,z*(lz-.005),{color:'wood',bevel:.003}));
  if(railZ>.05)for(const x of [-1,1])parts.push(part(`Faldón lateral ${x}`,[.02,rail,railZ],x*(lx-.005),under-rail,0,{color:'wood',bevel:.003}));
  return parts;
}

/**
 * Kitchen island inside `w × d × h`: worktop over the whole footprint, a carcass that leaves a
 * knee space for stools on the +z side, door fronts on the -z (kitchen) side and a recessed plinth.
 */
export function islandParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.04,plinth=.1,knee=Math.min(.25,d*.35),door=.018;
  const back=-d/2+.03,frontFace=d/2-knee,body=frontFace-(back+door+.002);
  const n=clamp(Math.round((w-.06)/.6),1,5),height=h-top-plinth;
  const parts:FurniturePart[]=[
    part('Encimera',[w,top,d],0,h-top,0,{color:'#d8d2c8',bevel:.004}),
    part('Cuerpo',[w-.06,height,body],0,plinth,frontFace-body/2,{color:'#e5e0d8',bevel:.004}),
    part('Zócalo',[w-.14,plinth,body-.12],0,0,frontFace-body/2,{color:'#c9c3b8',bevel:.002}),
  ];
  fronts(w-.06,n).forEach(({x,size},i)=>parts.push(part(`Frente ${i+1}`,[size,height-2*HINGE_GAP,door],x,plinth+HINGE_GAP,back+door/2,{color:'item',bevel:.003})));
  return parts;
}

/**
 * Dining chair inside `w × d`, total height `h`: rear legs run up as back posts, a wooden seat
 * with an upholstered pad, a back board, a lower back rail and side stretchers.
 */
export function chairParts(w:number,d:number,h:number):FurniturePart[]{
  const leg=.035,seat=.45,frame=.03,x=w/2-.025-leg/2;
  const rearZ=-d/2+leg/2,frontZ=d/2-.025-leg/2,seatRear=-d/2+leg+.004,seatDepth=d/2-seatRear;
  const parts:FurniturePart[]=[];
  for(const s of [-1,1]){
    parts.push(part(`Pata delantera ${s}`,[leg,seat-frame,leg],s*x,0,frontZ,{color:'item',bevel:.005}));
    parts.push(part(`Poste trasero ${s}`,[leg,h,leg],s*x,0,rearZ,{color:'item',bevel:.005}));
    parts.push(part(`Travesaño ${s}`,[.018,.022,frontZ-rearZ-leg],s*x,.14,(frontZ+rearZ)/2,{color:'item',bevel:.003}));
  }
  parts.push(part('Asiento',[w,frame,seatDepth],0,seat-frame,seatRear+seatDepth/2,{color:'item',surface:'woodgrain',bevel:.005}));
  parts.push(part('Cojín',[w-.05,.035,seatDepth-.05],0,seat-.002,seatRear+seatDepth/2+.005,{color:'#d8cfc1',surface:'textile',bevel:.015,crown:{axis:'y',amount:.008}}));
  const between=2*x-leg;
  parts.push(part('Respaldo',[between,.13,.02],0,h-.16,rearZ,{color:'item',surface:'woodgrain',bevel:.004}));
  parts.push(part('Travesaño respaldo',[between,.035,.018],0,seat+.12,rearZ,{color:'item',bevel:.003}));
  return parts;
}

/**
 * Linear kitchen inside `w × d × h` (hob, sink and tap stand on the worktop): recessed plinth,
 * carcass, ~60 cm doors with bar handles, a worktop cut around an undermounted steel basin,
 * an induction hob with four marked zones and a round mixer whose spout reaches the basin.
 */
export function kitchenParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.04,plinth=.1,door=.018,face=d/2-.022;
  const body=face-door-.002+d/2,height=h-top-plinth,n=Math.max(1,Math.round(w/.6));
  const sw=Math.min(.5,w*.25),sd=Math.min(.4,d-.2),sx=w*.24,sz=Math.min(.02,face-door-.002-sd/2-.02),basin=Math.min(.18,height-.05),wall=.008;
  const left=sx-sw/2+w/2,right=w/2-sx-sw/2,back=sz-sd/2+d/2,front=d/2-sz-sd/2,steel={color:'#a6adab',material:'metal' as const};
  const worktop={color:'#b2aa9e',bevel:.004},carcass={color:'#ebe6dc',bevel:.003};
  const parts:FurniturePart[]=[
    part('Encimera izquierda',[left,top,d],-w/2+left/2,h-top,0,worktop),
    part('Encimera derecha',[right,top,d],w/2-right/2,h-top,0,worktop),
    part('Encimera trasera',[sw,top,back],sx,h-top,-d/2+back/2,{...worktop,bevel:0}),
    part('Encimera frontal',[sw,top,front],sx,h-top,d/2-front/2,{...worktop,bevel:0}),
    part('Cuerpo',[left,height,body],-w/2+left/2,plinth,-d/2+body/2,carcass),
    part('Cuerpo derecho',[right,height,body],w/2-right/2,plinth,-d/2+body/2,carcass),
    part('Cuerpo bajo fregadero',[sw,height-basin-.004,body],sx,plinth,-d/2+body/2,{...carcass,bevel:0}),
    part('Zócalo',[w-.02,plinth,body-.06],0,0,-d/2+(body-.06)/2,{color:'#c9c3b8',bevel:.002}),
    part('Fondo fregadero',[sw,.004,sd],sx,h-basin,sz,{...steel,bevel:.001}),
    part('Pared fregadero trasera',[sw,basin-.004,wall],sx,h-basin+.004,sz-sd/2+wall/2,{...steel,bevel:.001}),
    part('Pared fregadero frontal',[sw,basin-.004,wall],sx,h-basin+.004,sz+sd/2-wall/2,{...steel,bevel:.001}),
    part('Pared fregadero izquierda',[wall,basin-.004,sd-2*wall],sx-sw/2+wall/2,h-basin+.004,sz,{...steel,bevel:.001}),
    part('Pared fregadero derecha',[wall,basin-.004,sd-2*wall],sx+sw/2-wall/2,h-basin+.004,sz,{...steel,bevel:.001}),
    turned('Desagüe fregadero',DISC,[.07,.003,.07],sx,h-basin+.003,sz,{color:'#7f8583',material:'metal'}),
  ];
  fronts(w,n).forEach(({x,size},i)=>{
    parts.push(part(`Puerta ${i+1}`,[size,height-2*HINGE_GAP,door],x,plinth+HINGE_GAP,face-door/2,{color:'item',bevel:.003}));
    parts.push(...barHandle(`Tirador ${i+1}`,x,h-top-.06,Math.min(.16,size*.4),face,d/2,true));
  });
  const hob=Math.min(.58,w*.3),hobD=Math.min(.51,d-.12),hx=-w*.24,glass=.006;
  parts.push(part('Placa',[hob,glass,hobD],hx,h,0,{color:'#262829',bevel:.003}));
  const ring:Profile=[[.93,0],[1,0],[1,1],[.93,1],[.93,0]];
  [[-1,-1,.2],[-1,1,.16],[1,-1,.16],[1,1,.2]].forEach(([sx2,sz2,size],i)=>{
    const r=Math.min(size,hob*.42,hobD*.42);
    parts.push(turned(`Zona ${i+1}`,ring,[r,.0012,r],hx+sx2*hob/4,h+glass-.0005,sz2*hobD/4,{color:'#5d6163'}));
  });
  const tapZ=Math.max(-d/2+.035,sz-sd/2-.045),tapH=.28,spout=Math.min(.2,sz-tapZ+.02);
  parts.push(turned('Base grifo',DISC,[.06,.012,.06],sx,h,tapZ,{color:METAL,material:'metal'}));
  parts.push(turned('Grifo',[[0,0],[1,0],[.8,.05],[.8,1],[0,1]],[.042,tapH-.012,.042],sx,h+.012,tapZ,{color:METAL,material:'metal'}));
  parts.push(part('Caño',[.022,.022,spout],sx,h+tapH-.034,tapZ+spout/2,{color:METAL,material:'metal',bevel:.0105}));
  parts.push(part('Boquilla',[.024,.035,.024],sx,h+tapH-.06,tapZ+spout-.015,{color:METAL,material:'metal',bevel:.008}));
  parts.push(part('Maneta',[.07,.012,.012],sx+.016+.035,h+tapH-.11,tapZ,{color:METAL,material:'metal',bevel:.005}));
  return parts;
}

/** Combi fridge inside `w × d × h`: body, fridge door over a freezer door with a 4 mm gap, bar handles. */
export function fridgeParts(w:number,d:number,h:number):FurniturePart[]{
  const door=.04,face=d/2-.03,body=face-door-.002+d/2,split=h*.36,gap=.004;
  return [
    part('Cuerpo',[w,h,body],0,0,-d/2+body/2,{color:'item',bevel:.01}),
    part('Puerta congelador',[w-.006,split-gap*1.5,door],0,.01+gap,face-door/2,{color:'item',bevel:.008}),
    part('Puerta frigorífico',[w-.006,h-.01-split-gap*1.5,door],0,.01+split+gap/2,face-door/2,{color:'item',bevel:.008}),
    ...barHandle('Tirador frigorífico',w/2-.06,split+.35,.4,face,d/2),
    ...barHandle('Tirador congelador',w/2-.06,split-.18,.24,face,d/2),
  ];
}

const CERAMIC='#f4f3ef';
/** Flat turned disc with a softened top edge (buttons, drains, shower heads, lamp bases). */
const DISC:Profile=[[0,0],[1,0],[1,.55],[.9,1],[0,1]];
/** Straight round bar (taps, lamp stem). */
const ROD:Profile=[[0,0],[1,0],[1,1],[0,1]];
const turned=(name:string,profile:Profile,size:Vec3,x:number,y0:number,z:number,rest:Omit<FurniturePart,'name'|'size'|'position'|'lathe'|'bevel'>)=>({...part(name,size,x,y0,z,{...rest,bevel:0}),lathe:profile});

/**
 * Close-coupled toilet inside `w × d × h` (h = top of the cistern, front +z): a turned oval
 * bowl on a narrow foot, a rear plinth tying it to the cistern, seat and closed lid, and a
 * chrome flush button flush with the top.
 */
export function toiletParts(w:number,d:number,h:number):FurniturePart[]{
  const cistern=Math.min(.18,d*.3),tank=Math.min(.38,h*.55),rim=Math.min(.4,h-.2),lid=.006;
  const bowlW=Math.min(w,.38)*.95,bowlL=d-cistern+.02,bowlZ=d/2-bowlL/2;
  const ceramic={color:'item'};
  return [
    part('Cisterna',[w-.01,tank-lid-.01,cistern-.01],0,h-tank,-d/2+.005+(cistern-.01)/2,{...ceramic,bevel:.025}),
    part('Tapa cisterna',[w,.02,cistern],0,h-lid-.02,-d/2+cistern/2,{...ceramic,bevel:.008}),
    turned('Pulsador',DISC,[.055,lid,.055],0,h-lid,-d/2+cistern/2,{color:'#b9bcbb',material:'metal'}),
    turned('Taza',[[0,0],[.6,0],[.63,.02],[.58,.14],[.54,.36],[.6,.56],[.78,.76],[.93,.9],[1,.97],[.97,1],[0,1]],[bowlW,rim,bowlL],0,0,bowlZ,ceramic),
    part('Pie trasero',[bowlW*.5,rim*.72,bowlL*.32],0,0,-d/2+cistern+bowlL*.16-.01,{...ceramic,bevel:.03}),
    turned('Asiento',[[0,0],[1,0],[1,.6],[.96,1],[0,1]],[bowlW*1.02,.026,bowlL*.96],0,rim,bowlZ+.005,{color:CERAMIC}),
    turned('Tapa',[[0,0],[.99,0],[1,.45],[.92,1],[0,1]],[bowlW*1.02*.97,.022,bowlL*.96*.97],0,rim+.026,bowlZ+.005,{color:CERAMIC}),
  ];
}

/**
 * Wall-hung washbasin unit inside `w × d × h` (h = rim of the basin, front +z): a 30 cm high
 * gap under the cabinet, two drawer fronts with bar handles, a slim top and a turned vessel
 * basin with a chrome drain. The tall mixer behind the basin stands above `h`.
 */
export function sinkParts(w:number,d:number,h:number):FurniturePart[]{
  const vessel=Math.min(.14,h*.17),top=.025,counter=h-vessel,cabinet=counter-top-.3,face=d/2-.03,door=.018;
  const body=face-door-.002+d/2,drawer=(cabinet-3*HINGE_GAP)/2;
  const basinW=Math.min(w*.7,.52),basinD=Math.min(d*.78,.4),basinZ=Math.min(.03,d/2-basinD/2-.01);
  const parts:FurniturePart[]=[
    part('Mueble',[w,cabinet,body],0,.3,-d/2+body/2,{color:'wood',bevel:.003}),
    part('Encimera',[w,top,d],0,counter-top,0,{color:'item',bevel:.004}),
  ];
  for(let i=0;i<2;i++){
    parts.push(part(`Cajón ${i+1}`,[w-2*HINGE_GAP,drawer,door],0,.3+HINGE_GAP+i*(drawer+HINGE_GAP),face-door/2,{color:'wood',surface:'woodgrain',bevel:.003}));
    parts.push(...barHandle(`Tirador ${i+1}`,0,.3+HINGE_GAP+i*(drawer+HINGE_GAP)+drawer-.05,Math.min(.2,w*.3),face,d/2-.004,true));
  }
  parts.push(turned('Lavabo',[[0,0],[.55,0],[.62,.03],[.8,.35],[.94,.75],[1,1],[.93,1],[.88,.8],[.74,.42],[.5,.22],[0,.2]],[basinW,vessel,basinD],0,counter,basinZ,{color:CERAMIC}));
  parts.push(turned('Desagüe',DISC,[.04,.004,.04],0,counter+vessel*.2-.001,basinZ,{color:'#b9bcbb',material:'metal'}));
  const tapZ=Math.max(-d/2+.03,basinZ-basinD/2-.035),tapH=vessel+.16;
  parts.push(turned('Grifo',[[0,0],[1,0],[1,.03],[.7,.07],[.7,1],[0,1]],[.04,tapH,.04],0,counter,tapZ,{color:METAL,material:'metal'}));
  parts.push(part('Caño',[.022,.022,.15],0,counter+tapH-.03,tapZ+.075+.01,{color:METAL,material:'metal',bevel:.008}));
  parts.push(part('Boquilla',[.018,.03,.018],0,counter+tapH-.055,tapZ+.15-.001,{color:METAL,material:'metal',bevel:.008}));
  return parts;
}

/**
 * Walk-in shower inside `w × d × h` (h = top of the head, front +z, column on the -z wall):
 * low tray with a drain, a side glass on +x and a fixed front glass leaving the entry open,
 * a stabiliser bar to the back wall, a column with mixer, arm and a turned rain head.
 */
export function showerParts(w:number,d:number,h:number):FurniturePart[]{
  const tray=.035,glass=.008,glassH=Math.min(1.95,h-.05),frontW=w*.55,back=-d/2;
  return [
    part('Plato',[w,tray,d],0,0,0,{color:'item',bevel:.008}),
    turned('Desagüe',DISC,[.1,.004,.1],0,tray-.001,0,{color:'#9fa4a2',material:'metal'}),
    part('Mampara lateral',[glass,glassH,d-.02],w/2-.012,tray,.0,{color:'#dfeeee',material:'glass',bevel:0}),
    part('Mampara frontal',[frontW,glassH,glass],w/2-.02-frontW/2,tray,d/2-.012,{color:'#dfeeee',material:'glass',bevel:0}),
    part('Perfil',[.012,.012,d-.04],w/2-.012,tray+glassH,-.01,{color:METAL,material:'metal',bevel:.003}),
    part('Columna',[.022,h-.9-.06,.022],0,.9,back+.04,{color:METAL,material:'metal',bevel:.008}),
    part('Mezclador',[.15,.06,.05],0,1.02,back+.025,{color:METAL,material:'metal',bevel:.012}),
    part('Brazo',[.018,.02,.28],0,h-.06-.022,back+.04+.14,{color:METAL,material:'metal',bevel:.008}),
    turned('Rociador',[[0,0],[.95,0],[1,.4],[1,.7],[.3,1],[0,1]],[.25,.03,.25],0,h-.082-.03,back+.21,{color:METAL,material:'metal'}),
  ];
}

/**
 * Floor lamp inside `w × d × h`: turned metal base, stem and a hollow fabric shade (role
 * `lampshade`, so the night render makes it glow) whose rim reaches `h`.
 */
export function lampParts(w:number,d:number,h:number):FurniturePart[]{
  const shade=Math.min(.34,h*.22);
  return [
    turned('Base',DISC,[w*.65,.03,d*.65],0,0,0,{color:'#5a5853',material:'metal'}),
    turned('Pie',ROD,[.022,h-shade*.5-.03,.022],0,.03,0,{color:'#6d6b66',material:'metal'}),
    turned('Pantalla',[[1,0],[.72,1],[.69,1],[.97,0],[1,0]],[w,shade,d],0,h-shade,0,{color:'item',role:'lampshade'}),
  ];
}

/** Height of a plant's pot and of the soil surface the foliage grows from (src/lib/plantGeometry.ts). */
export const plantPotHeight=(h:number)=>Math.min(.45,h*.38);
export const plantSoilHeight=(h:number)=>plantPotHeight(h)*.93+.005;

/** Plant pot inside the plant's footprint: tapered ceramic pot with a rim and a disc of soil. */
export function plantPotParts(w:number,d:number,h:number):FurniturePart[]{
  const pot=plantPotHeight(h),pw=w*.55,pd=d*.55;
  return [
    turned('Maceta',[[0,0],[.78,0],[.8,.03],[.97,.9],[1,.93],[1,1],[.92,1],[.9,.95],[0,.95]],[pw,pot,pd],0,0,0,{color:'#d9d1c4'}),
    turned('Tierra',DISC,[pw*.9,.01,pd*.9],0,pot*.93,0,{color:'#4a3b2c'}),
  ];
}

/** Axis-aligned extent of a part list: [min, max] per axis. */
export function partsBounds(parts:FurniturePart[]):[Vec3,Vec3]{
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const p of parts)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p.position[a]-p.size[a]/2);max[a]=Math.max(max[a],p.position[a]+p.size[a]/2);}
  return [min,max];
}
