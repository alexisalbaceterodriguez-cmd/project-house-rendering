import type { Crown, Profile } from './boxGeometry';
import type { FurnitureKind } from '../types';

type Vec3=[number,number,number];
/**
 * One solid of a parametric piece of furniture, centred at `position` (metres, origin at the
 * footprint centre on the floor, front +z). `item` = the furniture's own colour, `wood` = the
 * project's wood palette, otherwise a hex colour. The viewer draws each part as a bevelled box,
 * or as a solid of revolution filling `size` when it has a `lathe` profile, and the render GLB
 * carries the same meshes, so Cycles sees exactly this geometry.
 */
export type FurniturePart={name:string;size:Vec3;position:Vec3;color:'item'|'wood'|string;surface?:'textile'|'woodgrain';material?:'metal'|'glass'|'mirror'|'gloss';role?:string;bevel:number;crown?:Crown;lathe?:Profile;axis?:'z'};

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
/** Bed with a headboard and an upholstered base; `drawers` swaps the legs for a recessed plinth and two drawers per side. */
export function bedParts(w:number,d:number,drawers=false):FurniturePart[]{
  const head=.09,leg=.1,baseTop=.34,mattressTop=.54;
  const rear=-d/2+head+FACE_GAP*.5,front=d/2-.005,depth=front-rear,z=(front+rear)/2;
  const pillows=w<1.25?1:2,pillow=(w-.14-.04*(pillows-1))/pillows;
  const duvet=Math.min(d*.62,depth-.05);
  const textile={surface:'textile'} as const;
  const parts:FurniturePart[]=[];
  parts.push(part('Cabecero',[w,.98,head],0,.12,-d/2+head/2,{color:'#bc9c80',bevel:.02}));
  if(drawers){
    const plinth=.06,front=.02,inset=.022,bottom=plinth+.02,top=baseTop-.02;
    parts.push(part('Zócalo',[w-.1,plinth,depth-.1],0,0,z,{color:'#2f2c29',bevel:.003}));
    parts.push(part('Canapé',[w-2*inset,baseTop-plinth,depth],0,plinth,z,{color:'#c0a489',bevel:.03}));
    for(const s of [-1,1])for(const [i,f] of fronts(depth-.12,2,.004).entries())
      parts.push(part(`Cajón ${s} ${i+1}`,[front,top-bottom,f.size],s*(w/2-inset+front/2),bottom,z+f.x,{color:'#c0a489',bevel:.006}));
  }else{
    for(const x of [-1,1])for(const zz of [-1,1])parts.push(part(`Pata ${x} ${zz}`,[.05,leg,.05],x*(w/2-.08),0,zz*(d/2-.08),{color:'wood',bevel:.006}));
    parts.push(part('Canapé',[w-2*FACE_GAP,baseTop-leg,depth],0,leg,z,{color:'#c0a489',bevel:.03}));
  }
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
 * Desk inside `w × d × h` (seat on the +z side): wood-grain top, a side panel on the left, a
 * drawer pedestal on the right (three drawers when tall enough, else two, with horizontal bar
 * handles) and a modesty panel at the back between them, under the top.
 */
export function deskParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.03,under=h-top,panel=.022,door=.018,back=-d/2+.02,face=d/2-.02;
  const pw=clamp(w*.36,.3,.42),px=w/2-pw/2,body=face-door-.002-back;
  const parts:FurniturePart[]=[
    part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.006}),
    part('Costado',[panel,under,face-back],-w/2+panel/2,0,(face+back)/2,{color:'item',bevel:.004}),
    part('Cajonera',[pw,under,body],px,0,back+body/2,{color:'item',bevel:.004}),
  ];
  const modesty=w-panel-pw;
  if(modesty>.05)parts.push(part('Faldón trasero',[modesty,Math.min(.35,under*.45),.018],(-w/2+panel+w/2-pw)/2,under-Math.min(.35,under*.45),back+.03,{color:'item',bevel:.003}));
  const y0=.04,span=under-.03-y0,count=span>.45?3:2,drawer=(span-(count-1)*HINGE_GAP)/count;
  for(let i=0;i<count;i++){
    const bottom=y0+i*(drawer+HINGE_GAP);
    parts.push(part(`Cajón ${i+1}`,[pw-2*HINGE_GAP,drawer,door],px,bottom,face-door/2,{color:'item',surface:'woodgrain',bevel:.003}));
    parts.push(...barHandle(`Tirador ${i+1}`,px,bottom+drawer-.045,Math.min(.16,pw*.5),face,d/2-.002,true));
  }
  return parts;
}

/**
 * Bedside table inside `w × d × h`: four short wooden feet, a carcass with one or two drawers
 * (two when the front is taller than 30 cm) carrying horizontal bar handles, and a wood-grain
 * top that defines the full footprint and height.
 */
export function nightstandParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.025,leg=.035,feet=clamp(h*.2,.06,.14),under=h-top,door=.018,back=-d/2+.01,face=d/2-.02;
  const bw=w-.02,body=face-door-.002-back,zc=back+body/2;
  const parts:FurniturePart[]=[
    part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.005}),
    part('Cuerpo',[bw,under-feet,body],0,feet,zc,{color:'item',bevel:.004}),
  ];
  const lx=bw/2-.02-leg/2,lz=body/2-.02-leg/2;
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Pata ${x} ${z}`,[leg,feet,leg],x*lx,0,zc+z*lz,{color:'wood',bevel:.004}));
  const span=under-feet-2*HINGE_GAP,count=span>.3?2:1,drawer=(span-(count-1)*HINGE_GAP)/count;
  for(let i=0;i<count;i++){
    const bottom=feet+HINGE_GAP+i*(drawer+HINGE_GAP);
    parts.push(part(`Cajón ${i+1}`,[bw-2*HINGE_GAP,drawer,door],0,bottom,face-door/2,{color:'item',surface:'woodgrain',bevel:.003}));
    parts.push(...barHandle(`Tirador ${i+1}`,0,bottom+drawer/2,Math.min(.12,bw*.4),face,d/2-.002,true));
  }
  return parts;
}

const BOOK_COLORS=['#7d8a7a','#b9a07a','#5e6b78','#c9bfae','#8c5e4a','#d7cfbf','#46504a'];

/**
 * Open bookshelf inside `w × d × h`: full-height side panels, a recessed plinth, top, bottom
 * and evenly spaced shelves about every 36 cm, a thin back panel and rows of books on
 * alternate shelves (deterministic sizes and colours, always clear of the shelf above).
 */
export function bookshelfParts(w:number,d:number,h:number):FurniturePart[]{
  const panel=.022,plinth=.07,back=.008,inner=w-2*panel,sd=d-.01-back,sz=-d/2+back+sd/2;
  const parts:FurniturePart[]=[
    part('Costado izquierdo',[panel,h,d],-w/2+panel/2,0,0,{color:'item',bevel:.003}),
    part('Costado derecho',[panel,h,d],w/2-panel/2,0,0,{color:'item',bevel:.003}),
    part('Zócalo',[inner,plinth,.018],0,0,d/2-.04,{color:'item',bevel:.002}),
    part('Trasera',[inner,h-plinth-panel,back],0,plinth,-d/2+back/2,{color:'item',bevel:0}),
    part('Base',[inner,panel,sd],0,plinth,sz,{color:'item',bevel:.002}),
    part('Techo',[inner,panel,sd],0,h-panel,sz,{color:'item',bevel:.002}),
  ];
  const free=Math.max(0,h-plinth-2*panel),bays=clamp(Math.round(free/.36),1,8);
  const gap=(free-(bays-1)*panel)/bays;
  for(let i=1;i<bays;i++)parts.push(part(`Balda ${i}`,[inner,panel,sd],0,plinth+panel+i*gap+(i-1)*panel,sz,{color:'item',bevel:.002}));
  let seed=0;
  for(let bay=0;bay<bays;bay+=2){
    const floor=plinth+panel+bay*(gap+panel),room=gap-.03;
    if(room<.12)continue;
    const end=-inner/2+inner*.62;
    let x=-inner/2+.02;
    while(x<end){
      const k=seed++,thick=.025+(k*7%5)*.006,tall=Math.min(room,.17+(k*5%4)*.03),deep=Math.min(sd-.02,.15+(k*3%3)*.02);
      if(x+thick>inner/2-.02)break;
      parts.push(part(`Libro ${bay+1}.${k}`,[thick,tall,deep],x+thick/2,floor,sz+sd/2-.015-deep/2,{color:BOOK_COLORS[k%BOOK_COLORS.length],bevel:.002}));
      x+=thick;
    }
  }
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
  parts.push(...mixer(sx,h,tapZ,tapH,spout));
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

export type ModuleFamily='base'|'wall'|'column'|'sink'|'hob'|'oven'|'vanity'|'hood';
/** Height of a module's underside above the floor: wall cabinets at 1.45 m, hoods 70 cm over a 90 cm worktop. */
export const moduleHangHeight=(family:ModuleFamily)=>family==='wall'?1.45:family==='hood'?1.6:0;
const VESSEL:Profile=[[0,0],[.55,0],[.62,.03],[.8,.35],[.94,.75],[1,1],[.93,1],[.88,.8],[.74,.42],[.5,.22],[0,.2]];
const HOB_RING:Profile=[[.93,0],[1,0],[1,1],[.93,1],[.93,0]];
/** Round mixer standing on `y` at (x, z) with a spout reaching `spout` towards +z. */
function mixer(x:number,y:number,z:number,height:number,spout:number):FurniturePart[]{
  const steel={color:METAL,material:'metal'} as const;
  return [
    turned('Base grifo',DISC,[.06,.012,.06],x,y,z,steel),
    turned('Grifo',[[0,0],[1,0],[.8,.05],[.8,1],[0,1]],[.042,height-.012,.042],x,y+.012,z,steel),
    part('Caño',[.022,.022,spout],x,y+height-.034,z+spout/2,{...steel,bevel:.0105}),
    part('Boquilla',[.024,.035,.024],x,y+height-.06,z+spout-.015,{...steel,bevel:.008}),
    part('Maneta',[.07,.012,.012],x+.051,y+height-.11,z,{...steel,bevel:.005}),
  ];
}

/**
 * Kitchen or bathroom module inside `w × d × h` (front +z). Floor modules stand on a recessed
 * plinth with the worktop's top at `h`; a wall cabinet's box spans 0…h and the viewer hangs it.
 * Fronts are `item` with 3 mm gaps; the worktop carries role `worktop` so the viewer applies the
 * module's worktop finish. `handles: 'none'` swaps bar handles for a recessed gola channel
 * (floor modules) or fronts that drop 2.5 cm below the box (wall cabinets); ovens keep their bar.
 * Hob glass, taps and vessel basins stand above `h`, like the linear kitchen's.
 */
export function moduleParts(family:ModuleFamily,w:number,d:number,h:number,handles:'bar'|'none'='bar'):FurniturePart[]{
  const door=.018,gap=HINGE_GAP,bar=handles==='bar',front={color:'item',bevel:.003};
  const carcass={color:'#ebe6dc',bevel:.002},steel={color:'#a6adab',material:'metal' as const,bevel:.001};
  const n=w>.65?2:1,parts:FurniturePart[]=[];
  const handle=(name:string,x:number,y:number,length:number,face:number,horizontal=true)=>{if(bar)parts.push(...barHandle(name,x,y,length,face,d/2,horizontal));};

  if(family==='hood'){
    // Chimney hood: a slim steel canopy with grease filter, two lights and a control strip,
    // and a chimney flush with the wall that reaches the top of `h`.
    const canopy=.06,filter=.006,cw=Math.min(.3,w*.5),cd=Math.min(.26,d*.55),fz0=-d/2+.03,fz1=d/2-.08;
    const steelHood={color:'#b4b9b7',material:'metal' as const,bevel:.002};
    parts.push(
      part('Campana',[w,canopy,d-.004],0,filter,-.002,steelHood),
      part('Filtro',[w-.08,filter,fz1-fz0],0,0,(fz0+fz1)/2,{color:'#8e9391',material:'metal',bevel:0}),
      part('Chimenea',[cw,h-canopy-filter,cd],0,canopy+filter,-d/2+cd/2,{...steelHood,bevel:.001}),
      part('Mandos campana',[Math.min(.16,w*.3),.02,.004],w*.25,filter+.02,d/2-.002,{color:'#1b1e1f',material:'glass',bevel:0}),
    );
    for(const s of [-1,1])parts.push(turned(`Luz ${s<0?'izquierda':'derecha'}`,DISC,[.06,.005,.06],s*w/4,0,d/2-.045,{color:'#fbf6e9'}));
    return parts;
  }

  if(family==='wall'){
    const face=bar?d/2-.022:d/2,lip=bar?0:.025,body=face-door-.002+d/2,y0=bar?gap:0;
    parts.push(part('Cuerpo',[w,h-lip,body],0,lip,-d/2+body/2,carcass));
    fronts(w,n).forEach(({x,size},i)=>{
      parts.push(part(`Puerta ${i+1}`,[size,h-gap-y0,door],x,y0,face-door/2,front));
      handle(`Tirador ${i+1}`,x,y0+.05,Math.min(.16,size*.4),face);
    });
    return parts;
  }

  const plinth=.1,face=d/2-.022,body=face-door-.002+d/2,zc=-d/2+body/2;
  parts.push(part('Zócalo',[w,plinth,.018],0,0,face-.06,{color:'#c9c3b8',bevel:.002}));
  if(family==='column'){
    const split=plinth+(h-plinth)*.4,length=Math.min(.3,(split-plinth)*.6);
    parts.push(part('Cuerpo',[w,h-plinth,body],0,plinth,zc,carcass));
    fronts(w,n).forEach(({x,size},i)=>{
      const hx=n===1||i===1?x-size/2+.04:x+size/2-.04;
      parts.push(part(`Puerta inferior ${i+1}`,[size,split-plinth-1.5*gap,door],x,plinth+gap,face-door/2,front));
      parts.push(part(`Puerta superior ${i+1}`,[size,h-gap-split-gap/2,door],x,split+gap/2,face-door/2,front));
      handle(`Tirador inferior ${i+1}`,hx,split-.04-length/2,length,face,false);
      handle(`Tirador superior ${i+1}`,hx,split+.04+length/2,length,face,false);
    });
    return parts;
  }

  // Floor modules: carcass, optional gola recess, fronts between the plinth and the worktop.
  const top=.036,gola=bar?0:.035,y0=plinth+gap,y1=h-top-gola-gap,zone=y1-y0;
  const basin=Math.min(.18,zone-.05),sw=Math.min(.5,w-.12),sd=Math.min(.4,d-.2);
  const sz=Math.min(.02,face-door-.002-sd/2-.02),worktop={color:'#c4c0b6',role:'worktop',bevel:.003};
  if(family==='sink'){
    const floor=h-basin-.004,side=.018;
    parts.push(part('Cuerpo',[w,floor-plinth,body],0,plinth,zc,carcass));
    for(const s of [-1,1])parts.push(part(`Costado ${s<0?'izquierdo':'derecho'}`,[side,h-top-floor,body],s*(w/2-side/2),floor,zc,carcass));
    const left=(w-sw)/2,back=sz-sd/2+d/2,frontStrip=d/2-sz-sd/2;
    parts.push(
      part('Encimera izquierda',[left,top,d],-w/2+left/2,h-top,0,worktop),
      part('Encimera derecha',[left,top,d],w/2-left/2,h-top,0,worktop),
      part('Encimera trasera',[sw,top,back],0,h-top,-d/2+back/2,{...worktop,bevel:0}),
      part('Encimera frontal',[sw,top,frontStrip],0,h-top,d/2-frontStrip/2,{...worktop,bevel:0}),
      part('Fondo fregadero',[sw,.004,sd],0,h-basin,sz,steel),
      part('Pared fregadero trasera',[sw,basin-.004,.008],0,h-basin+.004,sz-sd/2+.004,steel),
      part('Pared fregadero frontal',[sw,basin-.004,.008],0,h-basin+.004,sz+sd/2-.004,steel),
      part('Pared fregadero izquierda',[.008,basin-.004,sd-.016],-sw/2+.004,h-basin+.004,sz,steel),
      part('Pared fregadero derecha',[.008,basin-.004,sd-.016],sw/2-.004,h-basin+.004,sz,steel),
      turned('Desagüe fregadero',DISC,[.07,.003,.07],0,h-basin+.003,sz,{color:'#7f8583',material:'metal'}),
    );
    const tapZ=Math.max(-d/2+.035,sz-sd/2-.045);
    parts.push(...mixer(0,h,tapZ,.28,Math.min(.2,sz-tapZ+.02)));
  }else{
    parts.push(part('Cuerpo',[w,h-top-gola-plinth,body],0,plinth,zc,carcass));
    if(gola)parts.push(part('Fondo gola',[w,gola,body-.03],0,h-top-gola,-d/2+(body-.03)/2,{...carcass,bevel:0}));
    parts.push(part('Encimera',[w,top,d],0,h-top,0,worktop));
  }
  if(gola)parts.push(part('Perfil gola',[family==='sink'?w-.04:w-.004,.008,.028],0,h-top-gola,face-door-.016,{color:'#9a9d9b',material:'metal',bevel:.001}));

  const drawers=(ratios:number[],from:number,to:number)=>{
    const total=ratios.reduce((a,b)=>a+b,0),free=to-from-(ratios.length-1)*gap;let y=from;
    ratios.forEach((r,i)=>{
      const height=free*r/total;
      parts.push(part(`Cajón ${i+1}`,[w-2*gap,height,door],0,y,face-door/2,front));
      handle(`Tirador cajón ${i+1}`,0,y+height-.045,Math.min(.3,w*.45),face);
      y+=height+gap;
    });
  };
  if(family==='hob'){
    drawers([.45,.33,.22],y0,y1);
    const hob=Math.min(.58,w-.04),hobD=Math.min(.51,d-.1);
    parts.push(part('Placa',[hob,.006,hobD],0,h,0,{color:'#262829',bevel:.003}));
    [[-1,-1,.2],[-1,1,.16],[1,-1,.16],[1,1,.2]].forEach(([sx,sz2,size],i)=>{
      const r=Math.min(size,hob*.42,hobD*.42);
      parts.push(turned(`Zona ${i+1}`,HOB_RING,[r,.0012,r],sx*hob/4,h+.0055,sz2*hobD/4,{color:'#5d6163'}));
    });
  }else if(family==='oven'){
    const oven=Math.min(.6,zone-.12),panel=.075,base=y1-oven;
    drawers([1],y0,base-gap);
    parts.push(part('Frente horno',[w-2*gap,oven,door],0,base,face-door/2,{color:'#2a2d2e',bevel:.003}));
    parts.push(part('Cristal horno',[w*.72,oven-panel-.15,.004],0,base+.05,face+.002,{color:'#101416',material:'glass',bevel:0}));
    parts.push(part('Pantalla horno',[.09,.026,.003],0,y1-panel/2-.013,face+.0015,{color:'#0c0f10',material:'glass',bevel:0}));
    for(const s of [-1,1])parts.push(part(`Mando ${s<0?'izquierdo':'derecho'}`,[.036,.036,.018],s*w*.32,y1-panel/2-.018,face+.009,{color:METAL,material:'metal',bevel:.017}));
    parts.push(...barHandle('Tirador horno',0,y1-panel-.035,w*.7,face,d/2,true));
  }else if(family==='vanity'){
    drawers([1,1],y0,y1);
    const vessel=.14,basinW=Math.min(w*.7,.52),basinD=Math.min(d*.78,.4),basinZ=Math.min(.03,d/2-basinD/2-.01);
    parts.push(turned('Lavabo',VESSEL,[basinW,vessel,basinD],0,h,basinZ,{color:CERAMIC}));
    parts.push(turned('Desagüe',DISC,[.04,.004,.04],0,h+vessel*.2-.001,basinZ,{color:'#b9bcbb',material:'metal'}));
    const tapZ=Math.max(-d/2+.035,basinZ-basinD/2-.04);
    parts.push(...mixer(0,h,tapZ,vessel+.18,Math.min(.17,basinZ-tapZ)));
  }else{
    fronts(w,n).forEach(({x,size},i)=>{
      parts.push(part(`Puerta ${i+1}`,[size,zone,door],x,y0,face-door/2,front));
      handle(`Tirador ${i+1}`,x,y1-.05,Math.min(.16,size*.4),face);
    });
  }
  return parts;
}

/** Tapered leg turned from a 4 cm top to a 2.8 cm foot. */
const TAPER:Profile=[[0,0],[.7,0],[1,1],[0,1]];

/**
 * Upholstered armchair inside `w × d × h` (front +z): tapered wooden legs, arms that define the
 * width and depth, a back reaching `h`, a seat base and separate crowned seat and back cushions
 * with 1 cm gaps. The seat top stays near 44 cm whatever the leg height.
 */
export function armchairParts(w:number,d:number,h:number):FurniturePart[]{
  const leg=clamp(h*.2,.1,.18),arm=clamp(w*.12,.08,.14),inner=w-2*arm,back=Math.min(.16,d*.2);
  const armTop=Math.min(h-.12,.64),seatTop=Math.min(.44,armTop-.04),cushion=Math.min(.12,seatTop-leg-.075);
  const fabric={color:'item',surface:'textile'} as const;
  const parts:FurniturePart[]=[];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(turned(`Pata ${x} ${z}`,TAPER,[.04,leg,.04],x*(w/2-arm/2),0,z*(d/2-.06),{color:'wood'}));
  for(const x of [-1,1])parts.push(part(`Brazo ${x}`,[arm,armTop-leg,d],x*(w-arm)/2,leg,0,{...fabric,bevel:.035}));
  parts.push(part('Respaldo',[w-2*FACE_GAP,h-leg-FACE_GAP,back],0,leg+FACE_GAP,-d/2+FACE_GAP+back/2,{...fabric,bevel:.035}));
  const front=d/2-.015,rear=-d/2+FACE_GAP+back+FACE_GAP*.5,depth=front-rear,z=(front+rear)/2;
  const base=seatTop-cushion-leg-.015,backCushion=Math.min(.15,depth*.28);
  parts.push(part('Zócalo',[inner-FACE_GAP,base,depth],0,leg+.015,z,{...fabric,bevel:.02}));
  parts.push(part('Cojín de asiento',[inner-2*FACE_GAP,cushion,depth],0,seatTop-cushion,z,{...fabric,bevel:.045,crown:{axis:'y',amount:.012}}));
  parts.push(part('Cojín de respaldo',[inner-2*FACE_GAP,Math.min(.42,h-seatTop-.05),backCushion],0,seatTop,rear+backCushion/2,{...fabric,bevel:.05,crown:{axis:'z',amount:.02}}));
  return parts;
}

/**
 * Sideboard or TV unit inside `w × d × h`: tapered wooden legs, a carcass, a wood-grain top that
 * defines the full footprint and height, and two to four columns of doors (about 45 cm each),
 * topped by a drawer row when the front is taller than 45 cm. Doors carry short vertical bars
 * on their paired edges, drawers horizontal ones.
 */
export function sideboardParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.025,feet=clamp(h*.18,.08,.16),under=h-top,door=.018,back=-d/2+.01,face=d/2-.02;
  const bw=w-.02,body=face-door-.002-back,zc=back+body/2,gap=HINGE_GAP,outer=d/2-.002;
  const parts:FurniturePart[]=[
    part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.005}),
    part('Cuerpo',[bw,under-feet,body],0,feet,zc,{color:'item',bevel:.004}),
  ];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(turned(`Pata ${x} ${z}`,TAPER,[.04,feet,.04],x*(bw/2-.05),0,zc+z*(body/2-.05),{color:'wood'}));
  const span=under-feet-2*gap,drawer=span>.45?Math.min(.15,span*.25):0,doorH=span-(drawer?drawer+gap:0);
  const n=clamp(Math.round(bw/.45),2,4);
  fronts(bw,n).forEach(({x,size},i)=>{
    parts.push(part(`Puerta ${i+1}`,[size,doorH,door],x,feet+gap,face-door/2,{color:'item',surface:'woodgrain',bevel:.003}));
    const length=Math.min(.14,doorH*.35),hx=i%2===0?x+size/2-.035:x-size/2+.035;
    parts.push(...barHandle(`Tirador ${i+1}`,hx,feet+gap+doorH-.04-length/2,length,face,outer));
    if(drawer){
      const y=feet+gap+doorH+gap;
      parts.push(part(`Cajón ${i+1}`,[size,drawer,door],x,y,face-door/2,{color:'item',surface:'woodgrain',bevel:.003}));
      parts.push(...barHandle(`Tirador cajón ${i+1}`,x,y+drawer/2,Math.min(.12,size*.4),face,outer,true));
    }
  });
  return parts;
}

/**
 * Coffee table inside `w × d × h`: wood-grain top defining the footprint, four tapered legs and,
 * when there is room under the top, a lower shelf that the legs pass through.
 */
export function coffeeTableParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.03,under=h-top,inset=Math.min(.06,w*.1,d*.1),lx=w/2-inset,lz=d/2-inset;
  const parts:FurniturePart[]=[part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.006})];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(turned(`Pata ${x} ${z}`,TAPER,[.045,under,.045],x*lx,0,z*lz,{color:'wood'}));
  if(under>.25)parts.push(part('Balda',[2*lx,.018,2*lz],0,Math.min(.12,under*.3),0,{color:'item',surface:'woodgrain',bevel:.004}));
  return parts;
}

/**
 * Low TV unit inside `w × d × h`: recessed dark plinth, wood-grain top over the full footprint,
 * an open central niche (dark back, floor shelf) and two handle-less push-to-open drawers on
 * each side, set 1.5 cm behind the top's front edge.
 */
export function tvUnitParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.025,plinth=Math.min(.06,h*.15),y0=plinth,y1=h-top,span=y1-y0,back=-d/2,face=d/2-.015,door=.018;
  const bw=w-.02,niche=clamp(w*.34,.36,.8),col=(bw-niche)/2,body=face-door-.002-back,gap=HINGE_GAP;
  const parts:FurniturePart[]=[
    part('Tablero',[w,top,d],0,y1,0,{color:'item',surface:'woodgrain',bevel:.005}),
    part('Zócalo',[w-.12,plinth,d-.1],0,0,-.01,{color:'#34312d',bevel:.002}),
    part('Base hueco',[niche,.02,face-.002-back],0,y0,(face-.002+back)/2,{color:'item',surface:'woodgrain',bevel:.002}),
    part('Fondo hueco',[niche,span-.02,.012],0,y0+.02,back+.006,{color:'#2f2c29',bevel:0}),
  ];
  const drawer=(span-3*gap)/2;
  for(const s of [-1,1]){
    const x=s*(niche/2+col/2);
    parts.push(part(`Cuerpo ${s<0?'izquierdo':'derecho'}`,[col,span,body],x,y0,back+body/2,{color:'item',bevel:.003}));
    for(let i=0;i<2;i++)parts.push(part(`Cajón ${s<0?'izquierdo':'derecho'} ${i+1}`,[col-2*gap,drawer,door],x,y0+gap+i*(drawer+gap),face-door/2,{color:'item',surface:'woodgrain',bevel:.003}));
  }
  return parts;
}

/** Ceiling canopy: flat on top, rounded underneath. */
const CANOPY:Profile=[[0,0],[.85,0],[1,.45],[1,1],[0,1]];
/** Height of a pendant's bell shade (also where the night render puts its bulb). */
export const pendantShadeHeight=(w:number,h:number)=>Math.min(.3,h*.45,w*.75);

/**
 * Pendant lamp inside `w × d × h`, hung so that its top touches the ceiling
 * (furnitureElevation): a hollow bell shade (role `lampshade`) at the bottom, a bulb inside, a
 * cord and a ceiling canopy at `h`.
 */
export function pendantParts(w:number,d:number,h:number):FurniturePart[]{
  const s=pendantShadeHeight(w,h),canopy=.025;
  return [
    turned('Pantalla',[[1,0],[.94,.3],[.66,.7],[.24,1],[.2,1],[.62,.68],[.9,.3],[.96,0],[1,0]],[w,s,d],0,0,0,{color:'item',role:'lampshade'}),
    turned('Bombilla',[[0,0],[.55,.08],[1,.4],[.85,.8],[.35,1],[0,1]],[.07,.09,.07],0,s*.35,0,{color:'#fbf6e9'}),
    turned('Cable',ROD,[.006,h-s-canopy+.01,.006],0,s-.005,0,{color:'#2b2a28'}),
    turned('Florón',CANOPY,[Math.min(.12,w),canopy,Math.min(.12,d)],0,h-canopy,0,{color:'item'}),
  ];
}

/** Four frame bars around a `w × h` opening, `bar` wide and `depth` deep, back at -depth/2. */
function frameBars(w:number,h:number,bar:number,depth:number,rest:Omit<FurniturePart,'name'|'size'|'position'>):FurniturePart[]{
  return [
    part('Marco inferior',[w,bar,depth],0,0,0,rest),part('Marco superior',[w,bar,depth],0,h-bar,0,rest),
    part('Marco izquierdo',[bar,h-2*bar,depth],-(w-bar)/2,bar,0,rest),part('Marco derecho',[bar,h-2*bar,depth],(w-bar)/2,bar,0,rest),
  ];
}

/**
 * Wall mirror inside `w × d × h` (d is the depth off the wall): a metal frame of the item colour,
 * a silvered glass (material `mirror`) set 8 mm into it and a backboard flush with the wall side.
 */
export function mirrorParts(w:number,d:number,h:number):FurniturePart[]{
  const bar=clamp(Math.min(w,h)*.05,.02,.05),iw=w-2*bar,ih=h-2*bar;
  return [
    ...frameBars(w,h,bar,d,{color:'item',material:'metal',bevel:.003}),
    part('Luna',[iw,ih,.005],0,bar,d/2-.008-.0025,{color:'#dfe4e3',material:'mirror',bevel:0}),
    part('Trasera',[iw,ih,.006],0,bar,-d/2+.003,{color:'#6d675f',bevel:0}),
  ];
}

/**
 * Framed print inside `w × d × h`: a frame in the project's wood, a passe-partout and an abstract
 * composition of three colour fields (the middle one takes the item colour). It is a parametric
 * pattern, not a reproduction of any artwork.
 */
export function artworkParts(w:number,d:number,h:number):FurniturePart[]{
  const bar=clamp(Math.min(w,h)*.04,.02,.04),iw=w-2*bar,ih=h-2*bar,mat=Math.min(iw,ih)*.12,pw=iw-2*mat,ph=ih-2*mat;
  const pz=d/2-.012,field=.002,between=ph*.04,fh=(ph-2*between)/3;
  const parts:FurniturePart[]=[
    ...frameBars(w,h,bar,d,{color:'wood',surface:'woodgrain',bevel:.003}),
    part('Paspartú',[iw,ih,.004],0,bar,pz-.002,{color:'#f3efe7',bevel:0}),
    part('Trasera',[iw,ih,.006],0,bar,-d/2+.003,{color:'#8a8177',bevel:0}),
  ];
  ['#3f4a4f','item','#d9b48f'].forEach((color,i)=>parts.push(part(`Campo ${i+1}`,[pw,fh,field],0,bar+mat+i*(fh+between),pz+field/2,{color,bevel:0})));
  return parts;
}

/**
 * Wall-mounted flat TV inside `w × d × h`: a slim bezel, a glossy black screen (material `gloss`)
 * and a thicker rear housing that stays inside the depth off the wall.
 */
export function tvParts(w:number,d:number,h:number):FurniturePart[]{
  return [
    part('Bisel',[w,h,.01],0,0,d/2-.002-.005,{color:'#1d1f20',bevel:.002}),
    part('Pantalla',[w-.012,h-.012,.002],0,.006,d/2-.001,{color:'#07090a',material:'gloss',bevel:0}),
    part('Carcasa',[w*.62,h*.6,d-.012],0,h*.15,-d/2+(d-.012)/2,{color:'#2a2c2d',bevel:.006}),
  ];
}

/**
 * Height of an item's underside above the floor. Wall modules hang (moduleHangHeight), pendants
 * touch the ceiling, mirrors and prints centre at 1.5 m (or stand on the floor from 1.4 m tall)
 * and TVs centre at 1.2 m; everything else stands on the floor. Derived only from kind, size and
 * wall height, so the plan, the viewer and the render GLB agree without a stored offset.
 */
export function furnitureElevation(item:{kind:string;h:number;module?:{family:ModuleFamily}},wallHeight:number):number{
  if(item.module)return moduleHangHeight(item.module.family);
  switch(item.kind){
    case 'pendant':return Math.max(0,wallHeight-item.h);
    case 'mirror':case 'artwork':return item.h>=1.4?0:Math.max(0,1.5-item.h/2);
    case 'tv':return Math.max(0,1.2-item.h/2);
    case 'wall-shelf':return item.h>=1.4?0:Math.max(0,Math.min(1.2,wallHeight-item.h));
    case 'towel-rail':return Math.max(0,Math.min(.15,wallHeight-item.h));
    case 'radiator':return Math.max(0,Math.min(.12,wallHeight-item.h));
    case 'floating-nightstand':return Math.max(0,Math.min(.35,wallHeight-item.h));
    default:return 0;
  }
}

/**
 * Upholstered bench inside `w × d × h`: four tapered legs, a wooden frame rail under the seat and
 * a crowned textile cushion whose top reaches `h`.
 */
export function benchParts(w:number,d:number,h:number):FurniturePart[]{
  const cushion=Math.min(.09,h*.25),frame=.05,leg=h-cushion-frame;
  const parts:FurniturePart[]=[
    part('Bastidor',[w,frame,d],0,leg,0,{color:'wood',surface:'woodgrain',bevel:.006}),
    part('Cojín',[w-2*FACE_GAP,cushion,d-2*FACE_GAP],0,leg+frame,0,{color:'item',surface:'textile',bevel:.03,crown:{axis:'y',amount:.01}}),
  ];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(turned(`Pata ${x} ${z}`,TAPER,[.04,leg,.04],x*(w/2-.05),0,z*(d/2-.05),{color:'wood'}));
  return parts;
}

/** Round side table inside `w × d × h`: turned top, a slim pedestal and a weighted disc foot. */
export function sideTableParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.025,foot=.02;
  return [
    turned('Tablero',[[0,0],[.97,0],[1,.4],[1,1],[0,1]],[w,top,d],0,h-top,0,{color:'item',surface:'woodgrain'}),
    turned('Pie',[[0,0],[.6,0],[.45,.5],[1,1],[0,1]],[.07,h-top-foot,.07],0,foot,0,{color:'wood'}),
    turned('Base',DISC,[w*.6,foot,d*.6],0,0,0,{color:'#4a4743',material:'metal'}),
  ];
}

/**
 * Coat stand inside `w × d × h`: turned metal foot, a wooden pole and two crossed rows of
 * rounded pegs near the top whose ends define the footprint.
 */
export function coatRackParts(w:number,d:number,h:number):FurniturePart[]{
  const pole=.035,peg=.022,parts:FurniturePart[]=[
    turned('Base',DISC,[w*.8,.025,d*.8],0,0,0,{color:'#3d3b38',material:'metal'}),
    turned('Mástil',ROD,[pole,h-.025,pole],0,.025,0,{color:'wood'}),
  ];
  for(const [i,y] of [h-.12,h-.3].entries()){
    const along=i===0;
    for(const s of [-1,1]){
      const length=(along?w:d)/2-pole/2+.003;
      const centre=s*(pole/2-.003+length/2);
      parts.push(part(`Colgador ${i+1} ${s}`,along?[length,peg,peg]:[peg,peg,length],along?centre:0,y,along?0:centre,{color:'wood',bevel:.01}));
    }
  }
  return parts;
}

/**
 * Built-in bathtub inside `w × d × h` (front apron at +z): ceramic walls with a 7 cm rim, a
 * basin floor 10 cm up, a chrome drain at the foot end (-x) and an overflow plate above it.
 */
export function bathtubParts(w:number,d:number,h:number):FurniturePart[]{
  const t=.07,base=.1,iw=w-2*t,id=d-2*t,ceramic={color:CERAMIC,bevel:.008} as const;
  return [
    part('Pared izquierda',[t,h,d],-(w-t)/2,0,0,ceramic),
    part('Pared derecha',[t,h,d],(w-t)/2,0,0,ceramic),
    part('Pared trasera',[iw,h,t],0,0,-(d-t)/2,ceramic),
    part('Faldón',[iw,h,t],0,0,(d-t)/2,ceramic),
    part('Fondo',[iw,base,id],0,0,0,{color:CERAMIC,bevel:0}),
    turned('Desagüe',DISC,[.05,.004,.05],-iw/2+.12,base,0,{color:METAL,material:'metal'}),
    part('Rebosadero',[.006,.07,.07],-w/2+t+.003,h-.16,0,{color:METAL,material:'metal',bevel:.003}),
  ];
}

/**
 * Chest of drawers inside `w × d × h`: wooden top, carcass on four short legs and 3–5 full-width
 * drawers about 20 cm tall, each with one centred bar handle or two on fronts wider than 80 cm.
 */
export function dresserParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.025,leg=.04,feet=clamp(h*.12,.06,.12),under=h-top,door=.018,back=-d/2+.01,face=d/2-.02;
  const bw=w-.02,body=face-door-.002-back,zc=back+body/2;
  const parts:FurniturePart[]=[
    part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.005}),
    part('Cuerpo',[bw,under-feet,body],0,feet,zc,{color:'item',bevel:.004}),
  ];
  const lx=bw/2-.03-leg/2,lz=body/2-.02-leg/2;
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Pata ${x} ${z}`,[leg,feet,leg],x*lx,0,zc+z*lz,{color:'wood',bevel:.004}));
  const span=under-feet-2*HINGE_GAP,count=clamp(Math.round(span/.2),2,5),drawer=(span-(count-1)*HINGE_GAP)/count;
  const handles=bw>.8?[-bw/4,bw/4]:[0];
  for(let i=0;i<count;i++){
    const bottom=feet+HINGE_GAP+i*(drawer+HINGE_GAP);
    parts.push(part(`Cajón ${i+1}`,[bw-2*HINGE_GAP,drawer,door],0,bottom,face-door/2,{color:'item',bevel:.003}));
    handles.forEach((x,j)=>parts.push(...barHandle(`Tirador ${i+1}.${j+1}`,x,bottom+drawer/2,Math.min(.14,bw*.3),face,d/2-.002,true)));
  }
  return parts;
}

/**
 * Slim shoe cabinet inside `w × d × h`: thin top, recessed dark plinth and two or three full-width
 * tilt-out flaps, each with a horizontal bar handle near its top edge.
 */
export function shoeCabinetParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.02,plinth=.06,under=h-top,door=.018,back=-d/2+.01,face=d/2-.02;
  const bw=w-.01,body=face-door-.002-back,zc=back+body/2;
  const parts:FurniturePart[]=[
    part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.004}),
    part('Cuerpo',[bw,under-plinth,body],0,plinth,zc,{color:'item',bevel:.003}),
    part('Zócalo',[bw-.04,plinth,body-.04],0,0,zc-.02,{color:'#2f2c29',bevel:.002}),
  ];
  const span=under-plinth-2*HINGE_GAP,count=span>.75?3:2,flap=(span-(count-1)*HINGE_GAP)/count;
  for(let i=0;i<count;i++){
    const bottom=plinth+HINGE_GAP+i*(flap+HINGE_GAP);
    parts.push(part(`Abatible ${i+1}`,[bw-2*HINGE_GAP,flap,door],0,bottom,face-door/2,{color:'item',bevel:.003}));
    parts.push(...barHandle(`Tirador ${i+1}`,0,bottom+flap-.045,Math.min(.2,bw*.35),face,d/2-.002,true));
  }
  return parts;
}

const VASE:Profile=[[0,0],[.6,0],[.95,.25],[1,.5],[.7,.82],[.42,.9],[.5,1],[0,1]];

/**
 * Floating wall shelf inside `w × d × h`: a woodgrain board (brackets hidden in the wall), a row
 * of upright books on the left and a turned vase on the right whose top reaches `h`.
 */
export function wallShelfParts(w:number,d:number,h:number):FurniturePart[]{
  const board=Math.min(.04,h*.2),room=h-board;
  const parts:FurniturePart[]=[part('Balda',[w,board,d],0,0,0,{color:'item',surface:'woodgrain',bevel:.004})];
  const deep=Math.min(d-.03,.17),end=-w/2+w*.45;
  let x=-w/2+.03;
  for(let k=0;x<end;k++){
    const thick=.022+(k*7%5)*.006,tall=Math.min(room*.95,.15+(k*5%4)*.025);
    if(tall<.08||x+thick>w/2-.03)break;
    parts.push(part(`Libro ${k+1}`,[thick,tall,deep],x+thick/2,board,d/2-.015-deep/2,{color:BOOK_COLORS[k%BOOK_COLORS.length],bevel:.002}));
    x+=thick+.002;
  }
  const vase=Math.min(.14,d*.75,room*.6);
  parts.push(turned('Jarrón',VASE,[vase,room,vase],w/2-.05-vase/2,board,0,{color:'#d8d2c6'}));
  return parts;
}

/**
 * Wall-hung heated towel rail inside `w × d × h`: two round uprights with wall brackets, horizontal
 * bars about every 7 cm and a towel folded over the bar at about two thirds of the height.
 */
export function towelRailParts(w:number,d:number,h:number):FurniturePart[]{
  const tube=.03,bar=.022,barZ=-d/2+.035;
  const parts:FurniturePart[]=[];
  for(const s of [-1,1]){
    parts.push(turned(`Larguero ${s}`,ROD,[tube,h,tube],s*(w/2-tube/2),0,barZ,{color:'item'}));
    for(const [i,y] of [.12,h-.14].entries())parts.push(part(`Soporte ${s} ${i+1}`,[.02,.02,barZ-tube/2+.002+d/2],s*(w/2-tube/2),y,(-d/2+barZ-tube/2+.002)/2,{color:'item',bevel:.004}));
  }
  const count=Math.max(3,Math.floor((h-.08)/.07)),pitch=(h-.08-bar)/(count-1);
  const bars=Array.from({length:count},(_,i)=>.04+i*pitch);
  bars.forEach((y,i)=>parts.push(part(`Barra ${i+1}`,[w-tube,bar,bar],0,y,barZ,{color:'item',bevel:.008})));
  const hang=bars.reduce((best,y)=>Math.abs(y-h*.68)<Math.abs(best-h*.68)?y:best,bars[0]),barTop=hang+bar;
  const tw=w*.62,towel=.014,back=barZ+bar/2+.001,front=back+towel,tall=Math.min(.45,h*.4,barTop+.008-.02);
  const textile={surface:'textile'} as const;
  parts.push(part('Toalla',[tw,tall,towel],0,barTop+.008-tall,back+towel/2,{color:'#e9e2d6',...textile,bevel:.005}));
  parts.push(part('Toalla pliegue',[tw+.006,.016,front+.003-(barZ-bar/2-.002)],0,barTop,(front+.003+barZ-bar/2-.002)/2,{color:'#e9e2d6',...textile,bevel:.006}));
  return parts;
}

/**
 * Column radiator inside `w × d × h`: rounded vertical elements about 8 cm apart with 8 mm gaps,
 * joined by top and bottom headers set back towards the wall that span the full width.
 */
export function radiatorParts(w:number,d:number,h:number):FurniturePart[]{
  const n=Math.max(3,Math.round(w/.08)),pitch=w/n,header=Math.min(.04,d*.4);
  const parts:FurniturePart[]=[];
  for(let i=0;i<n;i++)parts.push(part(`Elemento ${i+1}`,[pitch-.008,h,d-.01],-w/2+pitch/2+i*pitch,0,.005,{color:'item',bevel:Math.min(.012,(pitch-.008)/3)}));
  for(const [name,y] of [['Colector inferior',.03],['Colector superior',h-.03-header]] as const)
    parts.push(part(name,[w,header,header],0,y,-d/2+header/2+.002,{color:'item',bevel:.004}));
  return parts;
}

const PORTHOLE:Profile=[[0,0],[1,0],[1,.7],[.9,1],[.72,1],[.7,.45],[0,.45]];
const PORTHOLE_GLASS:Profile=[[0,0],[1,0],[1,.5],[.6,1],[0,1]];
const KNOB:Profile=[[0,0],[1,0],[1,.8],[.85,1],[0,1]];
const turnedFront=(name:string,profile:Profile,size:Vec3,x:number,y0:number,z:number,rest:Omit<FurniturePart,'name'|'size'|'position'|'lathe'|'bevel'|'axis'>):FurniturePart=>({...turned(name,profile,size,x,y0,z,rest),axis:'z'});

/**
 * Front-loading washing machine (or tumble dryer) inside `w × d × h`: rounded carcass, control
 * strip with a detergent drawer (water tank on the dryer), dark display and turned knob, and a
 * round chrome-rimmed door with a glass porthole. Knob and door end exactly on the front.
 */
export function washerParts(w:number,d:number,h:number,dryer=false):FurniturePart[]{
  const face=d/2-.03,strip=.1,stripFace=face+.012,door=Math.min(w*.75,(h-strip)*.72),cy=(h-strip)*.48;
  const drawer=Math.min(.2,w*.32),front=d/2-.002;
  return [
    part('Cuerpo',[w,h,d-.03],0,0,-.015,{color:'item',bevel:.015}),
    part('Panel de mandos',[w-.02,strip,.012],0,h-strip-.012,face+.006,{color:'item',bevel:.004}),
    part(dryer?'Depósito':'Cajetín',[drawer,.06,.006],-w/2+.03+drawer/2,h-strip+.008,stripFace+.003,{color:'item',bevel:.003}),
    part('Pantalla',[Math.min(.12,w*.2),.035,.004],w*.08,h-strip+.02,stripFace+.002,{color:'#1d1f20',material:'gloss',bevel:.001}),
    turnedFront('Mando',KNOB,[.055,.055,front-(stripFace-.002)],w/2-.075,h-strip+.01,(stripFace-.002+front)/2,{color:'#d9dad8',material:'metal'}),
    turnedFront('Puerta',PORTHOLE,[door,door,front-(face-.002)],0,cy-door/2,(face-.002+front)/2,{color:'#c9cac8',material:'metal'}),
    turnedFront('Ojo de buey',PORTHOLE_GLASS,[door*.7,door*.7,.02],0,cy-door*.35,face+.014,{color:dryer?'#59605f':'#3a4044',material:'glass'}),
  ];
}

/**
 * Cot inside `w × d × h`: four corner posts, top and bottom rails on every side, vertical slats
 * about every 7 cm, a slatted base and a textile mattress about 30 cm above the floor.
 */
export function cribParts(w:number,d:number,h:number):FurniturePart[]{
  const post=.04,rail=.03,slat=.02,low=.22,top=h-.01-rail,base=.28,span=top-low-rail;
  const along=Math.max(2,Math.floor((w-2*post)/.07)),across=Math.max(2,Math.floor((d-2*post)/.07));
  const parts:FurniturePart[]=[];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Poste ${x} ${z}`,[post,h,post],x*(w/2-post/2),0,z*(d/2-post/2),{color:'item',bevel:.006}));
  for(const s of [-1,1]){
    for(const [k,y] of [['inferior',low],['superior',top]] as const){
      parts.push(part(`Larguero ${k} ${s}`,[w-2*post,rail,rail],0,y,s*(d/2-post/2),{color:'item',bevel:.006}));
      parts.push(part(`Testero ${k} ${s}`,[rail,rail,d-2*post],s*(w/2-post/2),y,0,{color:'item',bevel:.006}));
    }
    for(let i=0;i<along;i++)parts.push(part(`Barrote ${s} ${i+1}`,[slat,span,slat],-w/2+post+(i+.5)*(w-2*post)/along,low+rail,s*(d/2-post/2),{color:'item',bevel:.004}));
    for(let i=0;i<across;i++)parts.push(part(`Barrote lateral ${s} ${i+1}`,[slat,span,slat],s*(w/2-post/2),low+rail,-d/2+post+(i+.5)*(d-2*post)/across,{color:'item',bevel:.004}));
  }
  parts.push(part('Somier',[w-2*post,.02,d-2*post-.002],0,base,0,{color:'wood',bevel:.003}));
  parts.push(part('Colchón',[w-2*post-.02,.11,d-2*post-.02],0,base+.02,0,{color:'#f4f1ec',surface:'textile',bevel:.03,crown:{axis:'y',amount:.008}}));
  return parts;
}

const FOOT_RING:Profile=[[.9,0],[1,0],[1,1],[.9,1],[.9,0]];

/**
 * Bar stool inside `w × d × h`: weighted metal base, column, a footrest ring reaching the full
 * footprint on two cross spokes and a round upholstered seat whose top is `h`.
 */
export function barStoolParts(w:number,d:number,h:number):FurniturePart[]{
  const seat=.07,ring=.015,ringY=clamp(h*.38,.2,.34),base=.02,round=Math.min(w,d)*.92;
  return [
    turned('Base',DISC,[w*.8,base,d*.8],0,0,0,{color:'#3d3b38',material:'metal'}),
    turned('Columna',ROD,[.05,h-seat-base,.05],0,base,0,{color:METAL,material:'metal'}),
    turned('Reposapiés',FOOT_RING,[w,ring,d],0,ringY,0,{color:METAL,material:'metal'}),
    part('Radio 1',[w-.02,.012,.012],0,ringY+.0015,0,{color:METAL,material:'metal',bevel:.004}),
    part('Radio 2',[.012,.012,d-.02],0,ringY+.0025,0,{color:METAL,material:'metal',bevel:.004}),
    turned('Asiento',DISC,[round,seat,round],0,h-seat,0,{color:'item',surface:'textile'}),
  ];
}

/**
 * Extending dining table inside `w × d × h`: a woodgrain top split into two halves at a 3 mm
 * centre seam, square legs, aprons and two metal slides under the seam. With `leaf` (m, the
 * item's `leaf` field) the halves part and a centre leaf of that width fills the gap; `w` is the
 * extended overall width, so the plan footprint grows with the table.
 */
export const EXTENSION_LEAF=.5;
export function extendingTableParts(w:number,d:number,h:number,leaf=0):FurniturePart[]{
  const top=.03,leg=.06,inset=.03,rail=.08,under=h-top,seam=.003,open=leaf>.05&&leaf<=w-.4?leaf:0;
  const half=(w-(open?open+2*seam:seam))/2;
  const lx=w/2-inset-leg/2,lz=d/2-inset-leg/2,inner=w-2*(inset+leg);
  const parts:FurniturePart[]=[];
  for(const s of [-1,1])parts.push(part(`Tablero ${s}`,[half,top,d],s*(w-half)/2,under,0,{color:'item',surface:'woodgrain',bevel:.006}));
  if(open)parts.push(part('Hoja central',[open,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.006}));
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Pata ${x} ${z}`,[leg,under,leg],x*lx,0,z*lz,{color:'wood',bevel:.008}));
  for(const z of [-1,1])parts.push(part(`Faldón ${z}`,[inner,rail,.02],0,under-rail,z*(lz-.005),{color:'wood',bevel:.003}));
  for(const x of [-1,1])parts.push(part(`Faldón lateral ${x}`,[.02,rail,d-2*(inset+leg)],x*(lx-.005),under-rail,0,{color:'wood',bevel:.003}));
  for(const z of [-1,1])parts.push(part(`Guía ${z}`,[inner-.06,.02,.03],0,under-.022,z*d*.22,{color:METAL,material:'metal',bevel:.003}));
  return parts;
}

/**
 * Desk with a hutch inside `w × d × h` (seat on +z): a woodgrain worktop about 75 cm high on two
 * side panels, a modesty panel, a centred drawer, and on the back a shallow open shelf unit up to
 * `h` (uprights, back panel, top and a middle shelf with a row of books).
 */
export function deskHutchParts(w:number,d:number,h:number):FurniturePart[]{
  const panel=.022,top=.025,desk=Math.min(.76,h-.45),under=desk-top,face=d/2-.02,hd=Math.min(.26,d*.45),inner=w-2*panel;
  const parts:FurniturePart[]=[
    part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.005}),
    part('Faldón trasero',[inner,Math.min(.3,under*.4),.018],0,under-Math.min(.3,under*.4),-d/2+.03,{color:'item',bevel:.003}),
    part('Sombrerete',[inner,.025,hd],0,h-.025,-d/2+hd/2,{color:'item',surface:'woodgrain',bevel:.004}),
    part('Trasera',[inner,h-desk-.025,.012],0,desk,-d/2+.006,{color:'item',bevel:.002}),
  ];
  for(const s of [-1,1]){
    parts.push(part(`Costado ${s}`,[panel,under,face+d/2],s*(w/2-panel/2),0,(face-d/2)/2,{color:'item',bevel:.004}));
    parts.push(part(`Montante ${s}`,[panel,h-desk,hd],s*(w/2-panel/2),desk,-d/2+hd/2,{color:'item',bevel:.004}));
  }
  const drawer=Math.min(.5,inner*.45),dh=.09,box=face-(-d/2+.04);
  parts.push(part('Cajón',[drawer,dh,box],0,under-dh-HINGE_GAP,(face+(-d/2+.04))/2,{color:'item',bevel:.003}));
  parts.push(...barHandle('Tirador',0,under-HINGE_GAP-dh/2,Math.min(.14,drawer*.5),face,d/2-.002,true));
  const shelf=.02,shelfY=desk+(h-desk-.025)*.48,shelfD=hd-.012-.006;
  parts.push(part('Balda',[inner,shelf,shelfD],0,shelfY,-d/2+.012+shelfD/2,{color:'item',surface:'woodgrain',bevel:.003}));
  const room=h-.025-(shelfY+shelf),deep=Math.min(.17,shelfD-.03);
  let x=-inner/2+.03;
  for(let k=0;x<-inner/2+inner*.4;k++){
    const thick=.022+(k*7%5)*.006,tall=Math.min(room*.9,.17+(k*5%4)*.02);
    if(tall<.08)break;
    parts.push(part(`Libro ${k+1}`,[thick,tall,deep],x+thick/2,shelfY+shelf,-d/2+.012+.008+deep/2,{color:BOOK_COLORS[k%BOOK_COLORS.length],bevel:.002}));
    x+=thick+.002;
  }
  return parts;
}

/**
 * Bunk bed inside `w × d × h` (foot +z): four full-height posts, rails and end boards around two
 * slatted bases with textile mattresses and pillows, guard rails along the top bunk and a ladder
 * of rungs between the foot posts.
 */
export function bunkBedParts(w:number,d:number,h:number):FurniturePart[]{
  const post=.05,rail=.03,board=.12,upper=h-.55,iw=w-2*post,id=d-2*post;
  const parts:FurniturePart[]=[];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Poste ${x} ${z}`,[post,h,post],x*(w/2-post/2),0,z*(d/2-post/2),{color:'item',bevel:.008}));
  const textile={surface:'textile'} as const;
  for(const [k,y] of [['inferior',.2],['superior',upper]] as const){
    for(const s of [-1,1]){
      parts.push(part(`Larguero ${k} ${s}`,[rail,board,id],s*(w/2-post/2),y,0,{color:'item',bevel:.006}));
      parts.push(part(`Testero ${k} ${s}`,[iw,board,rail],0,y,s*(d/2-post/2),{color:'item',bevel:.006}));
    }
    parts.push(part(`Somier ${k}`,[iw,.02,id-.002],0,y+.02,0,{color:'wood',bevel:.003}));
    parts.push(part(`Colchón ${k}`,[iw-.02,.15,id-.02],0,y+.04,0,{color:'#f4f1ec',...textile,bevel:.04,crown:{axis:'y',amount:.008}}));
    parts.push(part(`Almohada ${k}`,[Math.min(.6,iw-.12),.1,.34],0,y+.185,-id/2+.03+.17,{color:'#f8f5f0',...textile,bevel:.04,crown:{axis:'y',amount:.025}}));
    parts.push(part(`Manta ${k}`,[iw-.04,.04,id*.55],0,y+.185,id/2-.005-id*.275,{color:'item',...textile,bevel:.02,crown:{axis:'y',amount:.006}}));
  }
  const guard=upper+.25;
  for(const s of [-1,1])parts.push(part(`Barandilla ${s}`,[rail,.1,id],s*(w/2-post/2),guard,0,{color:'item',bevel:.006}));
  parts.push(part('Testero cabecero',[iw,.1,rail],0,guard,-(d/2-post/2),{color:'item',bevel:.006}));
  const first=.45,last=upper-.06,n=Math.max(2,Math.round((last-first)/.25)+1),pitch=(last-first)/(n-1);
  for(let i=0;i<n;i++)parts.push(part(`Peldaño ${i+1}`,[iw,.03,rail],0,first+i*pitch,d/2-post/2,{color:'item',bevel:.006}));
  return parts;
}

const BASKET:Profile=[[0,0],[.84,0],[.9,.06],[1,1],[0,1]];
const BASKET_LID:Profile=[[0,0],[1,0],[1,.45],[.3,.6],[.22,.7],[.22,1],[0,1]];

/** Round laundry hamper inside `w × d × h`: a woven body widening to the top and a lid with a turned knob. */
export function laundryBasketParts(w:number,d:number,h:number):FurniturePart[]{
  const lid=.06;
  return [
    turned('Cesto',BASKET,[w*.96,h-lid,d*.96],0,0,0,{color:'item',surface:'textile'}),
    turned('Tapa',BASKET_LID,[w,lid,d],0,h-lid,0,{color:'item',surface:'textile'}),
  ];
}

/**
 * Wall-hung bedside shelf inside `w × d × h`: top, bottom, sides and back around a drawer in the
 * upper part with a turned knob, and an open niche below holding two stacked books.
 */
export function floatingNightstandParts(w:number,d:number,h:number):FurniturePart[]{
  const t=.018,front=d/2-.025,depth=front+d/2,zc=(front-d/2)/2,inner=w-2*t,span=h-2*t;
  const dh=span*.55,bottom=h-t-HINGE_GAP-dh;
  const parts:FurniturePart[]=[
    part('Tapa',[w,t,d],0,h-t,0,{color:'item',surface:'woodgrain',bevel:.004}),
    part('Base',[w,t,depth],0,0,zc,{color:'item',bevel:.003}),
    part('Trasera',[inner,span,.008],0,t,-d/2+.004,{color:'item',bevel:.002}),
    part('Cajón',[inner-2*HINGE_GAP,dh,t],0,bottom,front-t/2,{color:'item',surface:'woodgrain',bevel:.003}),
    turnedFront('Pomo',KNOB,[.03,.03,d/2-.002-(front-.002)],0,bottom+dh/2-.015,(d/2-.002+front-.002)/2,{color:'wood'}),
  ];
  for(const s of [-1,1])parts.push(part(`Costado ${s}`,[t,span,depth],s*(w/2-t/2),t,zc,{color:'item',bevel:.003}));
  const bw=Math.min(.22,inner*.6),bd=Math.min(.15,depth-.06),niche=bottom-t;
  const bz=-d/2+.008+.01+bd/2;
  if(niche>.04){
    parts.push(part('Libro 1',[bw,Math.min(.03,niche*.35),bd],-inner/2+.02+bw/2,t,bz,{color:BOOK_COLORS[2],bevel:.002}));
    parts.push(part('Libro 2',[bw*.88,Math.min(.025,niche*.3),bd*.9],-inner/2+.03+bw*.44,t+Math.min(.03,niche*.35),bz,{color:BOOK_COLORS[3],bevel:.002}));
  }
  return parts;
}

/**
 * Corner (chaise) sofa inside `w × d × h` (back on −z, chaise on +x): wooden feet, one arm on −x,
 * a full-width back, an upholstered plinth for the seat run and a deeper one for the chaise, seat
 * cushions, a long chaise cushion and a row of back cushions.
 */
/** Seat-run depth and chaise width of a `w × d` corner sofa (shared by its parts and its plan symbol). */
export const cornerSofaLayout=(w:number,d:number)=>({seatD:Math.min(.95,d*.6),chaise:clamp(w*.3,.7,.95)});

export function cornerSofaParts(w:number,d:number,h:number):FurniturePart[]{
  const arm=clamp(w*.07,.12,.2),back=Math.min(.2,d*.14),leg=.06,{seatD,chaise}=cornerSofaLayout(w,d);
  const fabric={color:'item',surface:'textile'} as const;
  const rear=-d/2+FACE_GAP+back+FACE_GAP*.5,front=-d/2+seatD-.015,cFront=d/2-.015;
  const left=-w/2+arm,split=w/2-chaise,run=split-left;
  const parts:FurniturePart[]=[];
  for(const [x,z] of [[-w/2+arm/2,-d/2+.07],[-w/2+arm/2,-d/2+seatD-.07],[w/2-.07,-d/2+.07],[w/2-.07,d/2-.07],[split+.07,d/2-.07]])
    parts.push(part(`Pata ${parts.length+1}`,[.045,leg,.045],x,0,z,{color:'wood',bevel:.006}));
  parts.push(part('Brazo',[arm,.58,seatD],-w/2+arm/2,leg,-d/2+seatD/2,{...fabric,bevel:.05}));
  parts.push(part('Respaldo',[w-2*FACE_GAP,h-leg-FACE_GAP,back],0,leg+FACE_GAP,-d/2+FACE_GAP+back/2,{...fabric,bevel:.04}));
  parts.push(part('Zócalo',[run-FACE_GAP,.225,front-rear],(left+split)/2-FACE_GAP/2,leg+.015,(front+rear)/2,{...fabric,bevel:.02}));
  parts.push(part('Zócalo chaise',[chaise,.225,cFront-rear],w/2-chaise/2,leg+.015,(cFront+rear)/2,{...fabric,bevel:.02}));
  const n=Math.max(1,Math.round(run/.7)),cushion=(run-FACE_GAP*(n+1))/n;
  for(let i=0;i<n;i++)parts.push(part(`Cojín de asiento ${i+1}`,[cushion,.16,front-rear],left+FACE_GAP+cushion/2+i*(cushion+FACE_GAP),.3,(front+rear)/2,{...fabric,bevel:.05,crown:{axis:'y',amount:.015}}));
  parts.push(part('Cojín chaise',[chaise-2*FACE_GAP,.16,cFront-rear],w/2-chaise/2,.3,(cFront+rear)/2,{...fabric,bevel:.05,crown:{axis:'y',amount:.015}}));
  const inner=w-arm,m=Math.max(2,Math.round(inner/.75)),bc=(inner-FACE_GAP*(m+1))/m,bd=Math.min(.17,(front-rear)*.26);
  for(let i=0;i<m;i++)parts.push(part(`Cojín de respaldo ${i+1}`,[bc,Math.min(.36,h-.5),bd],left+FACE_GAP+bc/2+i*(bc+FACE_GAP),.46,rear+bd/2,{...fabric,bevel:.06,crown:{axis:'z',amount:.025}}));
  return parts;
}

/** Corner sofa with the chaise on −x and the arm on +x: `cornerSofaParts` mirrored across x = 0. */
/** Kinds that come in a right- and a left-hand version, by side; the properties panel swaps between them. */
export const HANDED_KINDS:Readonly<Record<string,{right:FurnitureKind;left:FurnitureKind}>>=(()=>{
  const pair={right:'corner-sofa',left:'corner-sofa-left'} as const;
  return {'corner-sofa':pair,'corner-sofa-left':pair};
})();
/** Side (`right` or `left`) of a handed kind, or undefined for kinds with a single hand. */
export const handOf=(kind:string)=>{const pair=HANDED_KINDS[kind];return pair?(pair.right===kind?'right':'left'):undefined;};
export const cornerSofaLeftParts=(w:number,d:number,h:number):FurniturePart[]=>
  cornerSofaParts(w,d,h).map(p=>({...p,position:[-p.position[0],p.position[1],p.position[2]]}));

const POUF:Profile=[[0,0],[.9,0],[.97,.04],[1,.15],[1,.85],[.95,.97],[.85,1],[0,1]];

/** Round upholstered pouf inside `w × d × h`: a recessed dark plinth ring and a padded drum. */
export function poufParts(w:number,d:number,h:number):FurniturePart[]{
  const base=.025;
  return [
    turned('Zócalo',ROD,[w*.82,base,d*.82],0,0,0,{color:'#3b3631'}),
    turned('Cuerpo',POUF,[w,h-base,d],0,base,0,{color:'item',surface:'textile'}),
  ];
}

/**
 * Hall console inside `w × d × h`: a woodgrain top over a shallow apron with two drawers and
 * turned knobs, slim metal legs and a lower shelf.
 */
export function consoleTableParts(w:number,d:number,h:number):FurniturePart[]{
  const top=.025,leg=.025,apron=.12,under=h-top,lx=w/2-leg/2,lz=d/2-leg/2,inner=w-2*leg,face=d/2-.012;
  const parts:FurniturePart[]=[part('Tablero',[w,top,d],0,under,0,{color:'item',surface:'woodgrain',bevel:.005})];
  for(const x of [-1,1])for(const z of [-1,1])parts.push(part(`Pata ${x} ${z}`,[leg,under,leg],x*lx,0,z*lz,{color:METAL,material:'metal',bevel:.004}));
  parts.push(part('Caja',[inner,apron,face-.018-(-lz)],0,under-apron,(face-.018-lz)/2,{color:'item',bevel:.003}));
  const dw=(inner-3*HINGE_GAP)/2;
  for(const s of [-1,1]){
    const x=s*(HINGE_GAP+dw)/2;
    parts.push(part(`Cajón ${s}`,[dw,apron-2*HINGE_GAP,.018],x,under-apron+HINGE_GAP,face-.009,{color:'item',surface:'woodgrain',bevel:.003}));
    parts.push(turnedFront(`Pomo ${s}`,KNOB,[.028,.028,d/2-.002-face],x,under-apron/2-.014,(d/2-.002+face)/2,{color:METAL,material:'metal'}));
  }
  parts.push(part('Balda',[inner,.02,d-2*leg],0,.16,0,{color:'item',surface:'woodgrain',bevel:.003}));
  return parts;
}

/**
 * Pair of curtain panels inside `w × d × h` (wall on −z): a metal rod on two brackets across `w`
 * and, gathered at each side, a textile panel made of overlapping vertical folds down to the floor.
 */
export function curtainParts(w:number,d:number,h:number,sheer=false):FurniturePart[]{
  const rod=.025,rz=-d/2+Math.min(.07,d*.55),panel=Math.min(w*.3,.9),fw=.075;
  const parts:FurniturePart[]=[part('Barra',[w,rod,rod],0,h-rod,rz,{color:METAL,material:'metal',bevel:.008})];
  for(const s of [-1,1])parts.push(part(`Soporte ${s}`,[.02,.02,rz-rod/2-(-d/2)],s*(w/2-.12),h-rod*.8,(rz-rod/2-d/2)/2,{color:METAL,material:'metal',bevel:.003}));
  const n=Math.max(3,Math.round(panel/(fw*.8))),pitch=(panel-fw)/(n-1),depth=Math.min(.06,d/2-rz),len=h-rod-.02;
  for(const s of [-1,1])for(let i=0;i<n;i++){
    const x=s*(w/2-fw/2-i*pitch),z=rz+(i%2?depth*.18:-depth*.18);
    parts.push(turned(`Pliegue ${s} ${i+1}`,ROD,[fw,len,Math.min(depth,2*(d/2-Math.abs(z)))],x,0,z,sheer?{color:'item',role:'sheer'}:{color:'item',surface:'textile'}));
  }
  return parts;
}

/** Voile curtains: the same folds as `curtainParts` in a see-through `sheer` fabric (Scene3D, Cycles). */
export const sheerCurtainParts=(w:number,d:number,h:number)=>curtainParts(w,d,h,true);

/** Height of a table lamp's shade (the night light sits inside it, see renderPackage.ts). */
export const tableLampShadeHeight=(h:number)=>Math.min(.24,h*.42);

/** Table lamp inside `w × d × h`: a turned ceramic body, a brass neck and a drum shade lit at night. */
export function tableLampParts(w:number,d:number,h:number):FurniturePart[]{
  const shade=tableLampShadeHeight(h),body=Math.min(h-shade-.02,h*.5),neck=h-shade*.6-body;
  return [
    turned('Cuerpo',VASE,[w*.55,body,d*.55],0,0,0,{color:CERAMIC}),
    turned('Cuello',ROD,[.018,neck,.018],0,body,0,{color:'#b08d57',material:'metal'}),
    turned('Pantalla',[[1,0],[.86,1],[.84,1],[.98,0],[1,0]],[w,shade,d],0,h-shade,0,{color:'item',role:'lampshade'}),
  ];
}

/** Kinds that stand on whatever furniture lies under their centre instead of on the floor. */
export const TABLETOP_KINDS:ReadonlySet<string>=new Set(['table-lamp','vase','books','fruit-bowl','candles','photo-frame','table-plant','table-clock','decor-bowl','shelf-basket','throw-pillow','folded-blanket','bath-tray','cutting-board','kettle','utensil-jar','soap-dispenser','toothbrush-cup','towel-stack']);
// Wall-only or soft items that never carry a tabletop object.
const NO_SUPPORT=new Set(['rug','lamp','pendant','curtain','sheer-curtain','mirror','artwork','tv','towel-rail','radiator','plant','coat-rack','doormat','umbrella-stand','bath-mat']);
/** Flat floor coverings: lie on the floor finish, never collide with furniture and cast no contact shadow. */
export const FLOOR_COVER_KINDS:ReadonlySet<string>=new Set(['rug','doormat','bath-mat']);

type Placed={id:string;kind:string;x:number;y:number;w:number;d:number;h:number;rotation:number;module?:{family:ModuleFamily}};

/** Loose soft furnishings: tabletop kinds that lean on a seat back or lie on a bed (see `tabletopSpot`). */
export const SOFT_KINDS:ReadonlySet<string>=new Set(['throw-pillow','folded-blanket']);
const BEDS=new Set(['bed','single-bed','storage-bed']);
const sofaRear=(d:number,back:number)=>-d/2+FACE_GAP*1.5+back;

/**
 * Height above its base at which `f` carries an object over its local point (u, v) (front +z,
 * as its parts): seats give their arm top, their back top behind the seat or their seat top
 * (the cushions' flat top, as built by `sofaParts`, `armchairParts` and `cornerSofaParts`),
 * beds their headboard, duvet or mattress top (`bedParts`), and a corner sofa nothing in the
 * notch of its L. Everything else carries on its overall height `h`.
 */
export function restHeight(f:{kind:string;w:number;d:number;h:number},u:number,v:number):number{
  const {w,d,h}=f;
  switch(f.kind){
    case 'sofa':{
      const arm=clamp(w*.09,.12,.2),rear=sofaRear(d,Math.min(.2,d*.22));
      return Math.abs(u)>w/2-arm?.64:v<rear?h:.46;
    }
    case 'armchair':{
      const arm=clamp(w*.12,.08,.14),armTop=Math.min(h-.12,.64),rear=sofaRear(d,Math.min(.16,d*.2));
      return Math.abs(u)>w/2-arm?armTop:v<rear?h:Math.min(.44,armTop-.04);
    }
    case 'corner-sofa':case 'corner-sofa-left':{
      const x=f.kind==='corner-sofa'?u:-u,arm=clamp(w*.07,.12,.2),{seatD,chaise}=cornerSofaLayout(w,d);
      if(v>-d/2+seatD&&x<w/2-chaise)return 0;
      return x<-w/2+arm?.64:v<sofaRear(d,Math.min(.2,d*.14))?h:.46;
    }
  }
  if(BEDS.has(f.kind)){
    const duvet=Math.min(d*.62,d-.09-FACE_GAP*.5-.055);
    return v<-d/2+.09?1.1:v>d/2-.003-duvet?.605:.54;
  }
  return h;
}

/**
 * Where loose soft furnishings go on a seat or bed `f`: the centre and half width of its seat
 * run (or sleeping area) along u and the v of the back cushions' or pillows' front face they
 * lean on. Undefined for anything else.
 */
export function softRest(f:{kind:string;w:number;d:number;h:number}):{center:number;half:number;back:number}|undefined{
  const {w,d,h}=f;
  switch(f.kind){
    case 'sofa':{
      const arm=clamp(w*.09,.12,.2),rear=sofaRear(d,Math.min(.2,d*.22));
      return {center:0,half:w/2-arm,back:rear+Math.min(.17,(d/2-.015-rear)*.26)};
    }
    case 'armchair':{
      const arm=clamp(w*.12,.08,.14),rear=sofaRear(d,Math.min(.16,d*.2));
      return {center:0,half:w/2-arm,back:rear+Math.min(.15,(d/2-.015-rear)*.28)};
    }
    case 'corner-sofa':case 'corner-sofa-left':{
      const arm=clamp(w*.07,.12,.2),{seatD,chaise}=cornerSofaLayout(w,d),rear=sofaRear(d,Math.min(.2,d*.14));
      const left=-w/2+arm,split=w/2-chaise,side=f.kind==='corner-sofa'?1:-1;
      return {center:side*(left+split)/2,half:(split-left)/2,back:rear+Math.min(.17,(-d/2+seatD-.015-rear)*.26)};
    }
  }
  return BEDS.has(f.kind)?{center:0,half:w/2-.07,back:-d/2+.09+FACE_GAP*.5+.44}:undefined;
}

/**
 * Top height of the furniture under `item`'s centre (its elevation plus `restHeight` there,
 * usually its overall height `h`), or 0 when it stands on the floor. Uses each support's full
 * bounding height, so a desk with a hutch carries the lamp on its hutch top, not on the worktop;
 * seats and beds carry it on their seat, arm, mattress or duvet instead.
 */
export function supportTop(item:Placed,furniture:readonly Placed[],wallHeight:number):number{
  let top=0;
  for(const f of furniture){
    if(f.id===item.id||NO_SUPPORT.has(f.kind)||TABLETOP_KINDS.has(f.kind))continue;
    const a=-f.rotation*Math.PI/180,dx=item.x-f.x,dy=item.y-f.y;
    const u=dx*Math.cos(a)-dy*Math.sin(a),v=dx*Math.sin(a)+dy*Math.cos(a);
    if(Math.abs(u)>f.w/2+1e-9||Math.abs(v)>f.d/2+1e-9)continue;
    const rest=restHeight(f,u,v);
    if(rest>0)top=Math.max(top,furnitureElevation(f,wallHeight)+rest);
  }
  return top;
}

/** Height of `item`'s base above the floor: hung kinds by `furnitureElevation`, tabletop kinds on their support. */
export function placedElevation(item:Placed,furniture:readonly Placed[],wallHeight:number):number{
  return TABLETOP_KINDS.has(item.kind)?supportTop(item,furniture,wallHeight):furnitureElevation(item,wallHeight);
}

/** The support whose top `item` stands on (see `supportTop`), or undefined on the floor. */
export function supportUnder<T extends Placed>(item:Placed,furniture:readonly T[]):T|undefined{
  let best:T|undefined,top=0;
  for(const f of furniture){const t=supportTop(item,[f],0);if(t>top){top=t;best=f;}}
  return best;
}

/** Whether furniture of `kind` can carry a tabletop object (see `supportTop`). */
export const canSupport=(kind:string)=>!NO_SUPPORT.has(kind)&&!TABLETOP_KINDS.has(kind);

/**
 * Plan spot for a tabletop object of footprint `size` added while `selected` is selected, turned
 * like the support. Tries the support's centre, then points along its width towards each end, and
 * takes the first one clear of the tabletop objects already standing on it (footprints as circles);
 * when none is clear, the one farthest from them. A selected tabletop object counts as its
 * support. Undefined when the new kind is not a tabletop
 * kind or the selection cannot carry one, so the caller falls back to its usual placement.
 */
export function tabletopSpot(kind:string,selected:Placed|undefined,furniture:readonly Placed[]=[],size:{w:number;d:number}={w:0,d:0}):{x:number;y:number;rotation:number}|undefined{
  // A selected tabletop object stands for the support under it, so several can be added in a row.
  if(selected&&TABLETOP_KINDS.has(selected.kind))selected=supportUnder(selected,furniture);
  if(!TABLETOP_KINDS.has(kind)||!selected||!canSupport(selected.kind))return undefined;
  const r=selected.rotation*Math.PI/180,radius=(f:{w:number;d:number})=>Math.max(f.w,f.d)/2;
  // Soft furnishings lean on a seat's back cushions or a bed's pillows (a blanket lies at the
  // foot of a bed), along the seat run; a bath tray lies across the tub, from rim to rim.
  const soft=SOFT_KINDS.has(kind)?softRest(selected):undefined;
  const across=kind==='bath-tray'&&selected.kind==='bathtub';
  const center=soft?.center??0,v=!soft?0:kind==='folded-blanket'&&BEDS.has(selected.kind)?selected.d/2-size.d/2-.08:soft.back+size.d/2+.005;
  const toWorld=(u:number)=>({x:selected.x+u*Math.cos(r)-v*Math.sin(r),y:selected.y+u*Math.sin(r)+v*Math.cos(r)});
  const rotation=across?(selected.rotation+90)%360:selected.rotation;
  const on=furniture.filter(f=>TABLETOP_KINDS.has(f.kind)&&f.id!==selected.id&&supportTop(f,[selected],0)>0);
  const reach=Math.max(0,(soft?soft.half:selected.w/2)-(across?size.d:size.w)/2);
  const steps=kind==='folded-blanket'&&soft&&!BEDS.has(selected.kind)?[1,-1,.55,-.55,0]:[0,.55,-.55,1,-1];
  let best={...toWorld(center),gap:-Infinity};
  for(const k of steps){
    const p=toWorld(center+k*reach);
    const gap=Math.min(Infinity,...on.map(f=>Math.hypot(f.x-p.x,f.y-p.y)-radius(f)-radius(size)));
    if(gap>=0)return {...p,rotation};
    if(gap>best.gap)best={...p,gap};
  }
  return {x:best.x,y:best.y,rotation};
}

/** Tabletop vase inside `w × d × h`: a turned ceramic body holding three dried stems up to `h`. */
export function vaseParts(w:number,d:number,h:number):FurniturePart[]{
  const body=Math.min(h,Math.max(h*.55,.12)),stem=.007;
  const parts:FurniturePart[]=[turned('Jarrón',VASE,[w,body,d],0,0,0,{color:'item'})];
  if(h-body>.03)for(const [i,x,z] of [[1,-w*.08,0],[2,w*.06,d*.05],[3,0,-d*.06]] as const)
    parts.push(turned(`Tallo ${i}`,ROD,[stem,h-body*.85-(i===2?0:(h-body)*.12*i),stem],x,body*.85,z,{color:'#9c8462'}));
  return parts;
}

/**
 * Stack of books lying flat inside `w × d × h`: from the bottom, three books of decreasing size
 * and alternating offsets, each with two cover boards, a spine on −x and a recessed page block.
 */
export function bookStackParts(w:number,d:number,h:number):FurniturePart[]{
  const covers=['item','#3f4d5a','#a5553f'],share=[.38,.28,.34],board=Math.min(.003,h*.05),spine=.004,inset=.003;
  const parts:FurniturePart[]=[];
  let y=0;
  for(let i=0;i<3;i++){
    const t=h*share[i],bw=w*(1-.1*i),bd=d*(1-.08*i),x=i===1?-(w-bw)/2:(w-bw)/2*(i?.4:0),z=i===2?-(d-bd)/2:(d-bd)/2*(i?1:0);
    const left=x-bw/2,cover={color:covers[i],bevel:.001};
    parts.push(part(`Lomo ${i+1}`,[spine,t,bd],left+spine/2,y,z,cover));
    parts.push(part(`Tapa inferior ${i+1}`,[bw-spine,board,bd],x+spine/2,y,z,cover));
    parts.push(part(`Páginas ${i+1}`,[bw-spine-inset,t-2*board,bd-2*inset],x+(spine-inset)/2,y+board,z,{color:'#f1ece0',bevel:0}));
    parts.push(part(`Tapa superior ${i+1}`,[bw-spine,board,bd],x+spine/2,y+t-board,z,cover));
    y+=t;
  }
  return parts;
}

const BALL:Profile=[[0,0],[.5,.067],[.866,.25],[1,.5],[.866,.75],[.5,.933],[0,1]];

/**
 * Fruit bowl inside `w × d × h`: a turned ceramic bowl holding a ring of three pieces of fruit on its
 * floor and a fourth resting on them, whose top is `h`.
 */
export function fruitBowlParts(w:number,d:number,h:number):FurniturePart[]{
  const f=clamp(Math.min(w,d)*.3,.04,.09),bowl=Math.min(h*.6,Math.max(h-f*.5,.03)),r=Math.min(w,d)*.19,floor=bowl*.22;
  const fruit=[['Manzana','#b8432f'],['Naranja','#e08a2c'],['Limón','#e6c84a'],['Pera','#a9b54a']] as const;
  const parts:FurniturePart[]=[turned('Cuenco',VESSEL,[w,bowl,d],0,0,0,{color:'item'})];
  for(let i=0;i<3;i++){
    const a=Math.PI/2+i*2*Math.PI/3;
    parts.push(turned(fruit[i][0],BALL,[f,f,f],r*Math.cos(a),floor,r*Math.sin(a),{color:fruit[i][1]}));
  }
  parts.push(turned(fruit[3][0],BALL,[f,f,f],0,h-f,0,{color:fruit[3][1]}));
  return parts;
}

const TRAY:Profile=[[0,0],[1,0],[1,1],[.92,1],[.9,.4],[0,.4]];

/** Candle tray inside `w × d × h`: a turned metal tray with a rim and three pillar candles of falling heights with their wicks and a
 * turned flame (role `flame`, emissive in the viewer and in Cycles) whose tip reaches `h`. */
const FLAME:Profile=[[0,0],[.55,.08],[1,.3],[.85,.6],[.4,.88],[0,1]];
const CANDLE={tray:.012,wick:.01,flame:.026};
/** Candle layout inside `w × d × h`: local x and z of each candle and its height relative to the tallest. */
const candleLayout=(w:number,d:number)=>[[1,-w*.2,-d*.12,1],[2,w*.18,-d*.08,.72],[3,w*.02,d*.18,.5]] as const;
const candleTall=(h:number)=>h-CANDLE.tray*.4-CANDLE.wick*.6-CANDLE.flame;
/** Local centre `[x, y, z]` of every flame of a candle tray (one night light each, see renderPackage.ts and Scene3D.tsx). */
export function candleFlames(w:number,d:number,h:number):[number,number,number][]{
  const {tray,wick,flame}=CANDLE,tall=candleTall(h);
  return candleLayout(w,d).map(([,x,z,k])=>[x,tray*.4+tall*k+wick*.6+flame/2,z]);
}
export function candleParts(w:number,d:number,h:number):FurniturePart[]{
  const {tray,wick,flame}=CANDLE,base=tray*.4,c=clamp(Math.min(w,d)*.3,.035,.07),tall=candleTall(h);
  const parts:FurniturePart[]=[turned('Bandeja',TRAY,[w,tray,d],0,0,0,{color:'item',material:'metal'})];
  for(const [i,x,z,k] of candleLayout(w,d)){
    const ch=tall*k;
    parts.push(turned(`Vela ${i}`,ROD,[c,ch,c],x,base,z,{color:'#f2ecdf'}));
    parts.push(turned(`Mecha ${i}`,ROD,[.003,wick,.003],x,base+ch,z,{color:'#2b2723'}));
    parts.push(turned(`Llama ${i}`,FLAME,[.012,flame,.012],x,base+ch+wick*.6,z,{color:'#ffcf7a',role:'flame'}));
  }
  return parts;
}

/**
 * Standing photo frame inside `w × d × h` (picture facing +z): a low wooden foot across the depth,
 * a frame of four bars across `w`, a recessed mat and a print set into it.
 */
export function photoFrameParts(w:number,d:number,h:number):FurniturePart[]{
  const base=.012,t=Math.min(.018,w*.1),fd=Math.min(.018,d*.3),H=h-base,m=Math.min(.02,w*.08),frame={color:'item',bevel:.002};
  return [
    part('Peana',[w*.7,base,d],0,0,0,{color:'item',surface:'woodgrain',bevel:.002}),
    part('Marco inferior',[w,t,fd],0,base,0,frame),
    part('Marco superior',[w,t,fd],0,h-t,0,frame),
    part('Marco izquierdo',[t,H-2*t,fd],-w/2+t/2,base+t,0,frame),
    part('Marco derecho',[t,H-2*t,fd],w/2-t/2,base+t,0,frame),
    part('Paspartú',[w-2*t,H-2*t,fd*.4],0,base+t,-fd*.1,{color:'#f5f2ea',bevel:0}),
    part('Fotografía',[w-2*t-2*m,H-2*t-2*m,fd*.4],0,base+t+m,fd*.05,{color:'#7f949a',bevel:0}),
  ];
}

/** Round clock case lathed along +z: a rounded rim around a recessed face (y of the profile runs back → front). */
const CLOCK_CASE:Profile=[[0,0],[1,0],[1,.8],[.94,1],[.86,1],[.84,.45],[0,.45]];
/**
 * Mantel clock inside `w × d × h` (dial facing +z): a wooden plinth across the footprint, a round case of diameter
 * `min(w, h − 1.5 cm)` standing on it, a recessed ivory dial with four hour marks and hands set at three o'clock.
 */
export function tableClockParts(w:number,d:number,h:number):FurniturePart[]{
  const D=Math.min(w,h-.015),hb=h-D,dc=d*.8,cy=hb+D/2,face=-dc/2+dc*.45,dark={color:'#24201c',bevel:0},mark=Math.max(.004,D*.035);
  const parts:FurniturePart[]=[
    part('Peana',[w,hb,d],0,0,0,{color:'item',surface:'woodgrain',bevel:.002}),
    turnedFront('Caja',CLOCK_CASE,[D,D,dc],0,hb,0,{color:'item'}),
    turnedFront('Esfera',DISC,[D*.8,D*.8,.002],0,cy-D*.4,face+.001,{color:'#f3efe6'}),
  ];
  for(const [n,x,y,horizontal] of [['12',0,1,false],['3',1,0,true],['6',0,-1,false],['9',-1,0,true]] as const)
    parts.push(part(`Marca ${n}`,horizontal?[mark*2.2,mark*.6,.001]:[mark*.6,mark*2.2,.001],x*D*.32,cy+y*D*.32-(horizontal?mark*.3:mark*1.1),face+.0025,dark));
  parts.push(part('Aguja horaria',[D*.2,.004,.0015],D*.08,cy-.002,face+.0038,dark));
  parts.push(part('Minutero',[.003,D*.32,.0015],0,cy-D*.03,face+.0056,dark));
  parts.push(turnedFront('Eje',DISC,[.008,.008,.003],0,cy-.004,face+.0078,{color:'#b08d57',material:'metal'}));
  return parts;
}

/** Low glazed bowl: a narrow foot, a wide flaring wall and a hollow inside down to 12 % of its height. */
const DECOR_BOWL:Profile=[[0,0],[.42,0],[.44,.07],[.7,.3],[.92,.7],[1,1],[.95,1],[.87,.72],[.66,.38],[.38,.14],[0,.12]];
/** Decorative bowl inside `w × d × h`: a glazed ceramic bowl holding three decorative spheres (rattan, stone and linen tones). */
export function decorBowlParts(w:number,d:number,h:number):FurniturePart[]{
  const m=Math.min(w,d),f=Math.min(h*.55,m*.22),floor=h*.12,r=m*.15;
  const balls=[['Esfera de ratán','#a8814f'],['Esfera de piedra','#9a958c'],['Esfera de lino','#ddd5c6']] as const;
  return [turned('Cuenco',DECOR_BOWL,[w,h,d],0,0,0,{color:'item',material:'gloss'}),
    ...balls.map(([name,color],i)=>{const a=Math.PI/6+i*2*Math.PI/3;return turned(name,BALL,[f,f,f],r*Math.cos(a),floor,r*Math.sin(a),{color});})];
}

/**
 * Woven shelf basket inside `w × d × h`: a bottom, front and back walls across `w` and side walls between them, each side
 * with a handle hole near the top (lower wall, two posts and a bar over the hole). Fibre texture (surface `textile`).
 */
export function shelfBasketParts(w:number,d:number,h:number):FurniturePart[]{
  const t=Math.min(.012,w*.05),b=.01,top=Math.min(.015,h*.08),hole=Math.min(.03,h*.18),hw=Math.min(.05,d*.2),low=h-top-hole,inner=d-2*t;
  const weave={color:'item',surface:'textile',bevel:.002} as const;
  const parts:FurniturePart[]=[
    part('Fondo',[w-2*t,b,inner],0,0,0,weave),
    part('Pared frontal',[w,h,t],0,0,d/2-t/2,weave),
    part('Pared trasera',[w,h,t],0,0,-d/2+t/2,weave),
  ];
  for(const [s,side] of [[-1,'izquierda'],[1,'derecha']] as const){
    const x=s*(w/2-t/2),post=inner/2-hw;
    parts.push(part(`Lateral ${side}`,[t,low,inner],x,0,0,weave));
    parts.push(part(`Montante trasero ${side}`,[t,hole,post],x,low,-hw-post/2,weave));
    parts.push(part(`Montante delantero ${side}`,[t,hole,post],x,low,hw+post/2,weave));
    parts.push(part(`Asa ${side}`,[t,top,2*hw],x,low+hole,0,weave));
  }
  return parts;
}

/**
 * Loose scatter cushion standing upright inside `w × d × h` (`d` is its thickness, front +z): one
 * textile cover with rounded edges whose front and back faces both dome towards the seam, so its
 * corners are thinner than its middle. Rests against a seat back or bed pillows (see `tabletopSpot`).
 */
export function throwPillowParts(w:number,d:number,h:number):FurniturePart[]{
  return [part('Cojín',[w,h,d],0,0,0,{color:'item',surface:'textile',bevel:Math.min(.035,d*.3,w*.15,h*.15),crown:{axis:'z',amount:d*.22,both:true}})];
}

/**
 * Folded throw blanket inside `w × d × h`: two to four stacked folds about 3 cm thick with fully
 * rounded, slightly puffed edges, alternately 2 cm narrower and shifted 1.2 cm front and back so
 * each fold edge reads.
 */
export function foldedBlanketParts(w:number,d:number,h:number):FurniturePart[]{
  const n=clamp(Math.round(h/.03),2,4),t=h/n,parts:FurniturePart[]=[];
  for(let i=0;i<n;i++){
    const odd=i%2===1;
    parts.push(part(`Pliegue ${i+1}`,[odd?w-.02:w,t,d-.024],0,i*t,odd?-.012:.012,{color:'item',surface:'textile',bevel:t*.49,crown:{axis:'y',amount:t*.22,both:true}}));
  }
  return parts;
}

/**
 * Slatted wooden bath tray inside `w × d × h` that spans a tub from rim to rim: front and back
 * rails of the full width, slats between them on two cross cleats, a bar of soap and a pillar
 * candle (unlit) whose top reaches `h`.
 */
export function bathTrayParts(w:number,d:number,h:number):FurniturePart[]{
  const rail=Math.min(.035,h*.4),rt=.02,low=rail*.3,slat=.012,gap=.008,top=low+slat;
  const wood={color:'item',surface:'woodgrain'} as const;
  const inner=d-2*rt,n=Math.max(3,Math.round(inner/.03)),s=(inner-gap*(n+1))/n;
  const parts:FurniturePart[]=[];
  for(const z of [-1,1])parts.push(part(z<0?'Larguero trasero':'Larguero delantero',[w,rail,rt],0,0,z*(d/2-rt/2),{...wood,bevel:.004}));
  for(const x of [-1,1])parts.push(part(`Travesaño ${x}`,[.02,low,inner],x*(w/2-.08),0,0,{...wood,bevel:.002}));
  for(let i=0;i<n;i++)parts.push(part(`Lama ${i+1}`,[w-.05,slat,s],0,low,-inner/2+gap+s/2+i*(s+gap),{...wood,bevel:.003}));
  const soap=Math.min(.03,h-top),candle=Math.min(.065,d*.4);
  parts.push(part('Jabón',[.085,soap,Math.min(.055,d*.3)],w*.16,top,0,{color:'#ece3d2',bevel:Math.min(.008,soap*.4),crown:{axis:'y',amount:.004}}));
  parts.push(turned('Vela',ROD,[candle,h-top,candle],-w*.2,top,0,{color:'#f1ebdf'}));
  return parts;
}

/**
 * Wooden chopping board inside `w × d × h` lying flat: a board with a handle tab on +x pierced by
 * a hanging hole, and a kitchen knife (steel blade, dark grip) lying on it when `h` leaves room.
 */
export function cuttingBoardParts(w:number,d:number,h:number):FurniturePart[]{
  const knife=h>=.03?.016:0,t=clamp(h-knife,.008,.03),grip=Math.min(.09,w*.22),board=w-grip;
  const tab=Math.min(d*.4,.07),hole=Math.min(.022,tab*.4),hx=grip*.55,bar=(tab-hole)/2,wood={color:'item',surface:'woodgrain'} as const;
  const parts:FurniturePart[]=[
    part('Tabla',[board,t,d],-grip/2,0,0,{...wood,bevel:Math.min(.005,t*.3)}),
    part('Asa trasera',[grip,t,bar],w/2-grip/2,0,-hole/2-bar/2,{...wood,bevel:.003}),
    part('Asa delantera',[grip,t,bar],w/2-grip/2,0,hole/2+bar/2,{...wood,bevel:.003}),
    part('Asa extremo',[grip-hx,t,hole],w/2-(grip-hx)/2,0,0,{...wood,bevel:.002}),
  ];
  if(knife){
    const L=Math.min(.26,board*.8),x0=-grip/2-L/2,z=Math.min(d*.22,d/2-.02);
    parts.push(part('Mango del cuchillo',[L*.36,knife,.02],x0+L*.18,t,z,{color:'#2b2723',bevel:.004}));
    parts.push(part('Hoja del cuchillo',[L*.64,.0025,.028],x0+L*.36+L*.32,t,z,{color:'#c9ccd0',material:'metal',bevel:0}));
  }
  return parts;
}

/** Electric kettle body: a flat bottom, walls tapering in towards a domed shoulder (lathe profile). */
const KETTLE:Profile=[[0,0],[1,0],[1,.05],[.97,.6],[.86,.93],[.78,1],[0,1]];
/**
 * Electric kettle inside `w × d × h` (spout on +x, handle on −x): a dark power base, a turned
 * steel body, a lid with a knob, a spout and a handle made of a grip and two arms.
 */
export function kettleParts(w:number,d:number,h:number):FurniturePart[]{
  const D=Math.min(d,w*.66),base=Math.min(.018,h*.08),knob=Math.min(.02,h*.08),lid=.01,body=h-base-lid-knob;
  const dark={color:'#2b2723',bevel:.004},steel={color:'item',material:'metal'} as const;
  const g=.022,arm=w/2-g-D*.42,spout=w/2-D*.42;
  return [
    turned('Base',DISC,[D*1.04,base,D*1.04],0,0,0,{color:'#2b2723'}),
    turned('Cuerpo',KETTLE,[D,body,D],0,base,0,steel),
    turned('Tapa',DISC,[D*.62,lid,D*.62],0,base+body,0,steel),
    turned('Pomo',KNOB,[.03,knob,.03],0,base+body+lid,0,{color:'#2b2723'}),
    part('Asidero',[g,body*.62,.026],-w/2+g/2,base+body*.25,0,dark),
    part('Brazo superior',[arm,.02,.024],-D*.42-arm/2,base+body*.87-.02,0,dark),
    part('Brazo inferior',[arm,.02,.024],-D*.42-arm/2,base+body*.25,0,dark),
    part('Pico',[spout,.028,.032],D*.42+spout/2,base+body*.68,0,{...steel,bevel:.008}),
  ];
}

/** Open stoneware crock: straight walls with a thick floor (lathe profile). */
const CROCK:Profile=[[0,0],[.96,0],[1,.04],[1,1],[.9,1],[.9,.07],[0,.07]];
/**
 * Utensil crock inside `w × d × h`: a glazed jar of diameter `min(w, d)` holding a wooden spoon
 * whose bowl reaches `h`, a dark spatula and a pair of steel tongs, all standing on its floor.
 */
export function utensilJarParts(w:number,d:number,h:number):FurniturePart[]{
  const D=Math.min(w,d),jar=Math.min(h*.55,.16),floor=jar*.07,r=D*.22;
  const parts:FurniturePart[]=[turned('Bote',CROCK,[D,jar,D],0,0,0,{color:'item',material:'gloss'})];
  if(h-jar<.06)return parts;
  const head=Math.min(.065,(h-jar)*.8),spoon=-r,top=h-head;
  parts.push(turned('Mango de la cuchara',ROD,[.012,top+.01-floor,.012],spoon,floor,-r*.3,{color:'#b58a5c'}));
  parts.push(turned('Cuchara',BALL,[.045,head,.02],spoon,top,-r*.3,{color:'#b58a5c'}));
  const blade=Math.min(.075,(h-jar)*.8),sTop=h-.02;
  parts.push(turned('Mango de la espátula',ROD,[.014,sTop-blade+.005-floor,.014],r*.8,floor,-r*.4,{color:'#2b2723'}));
  parts.push(part('Pala de la espátula',[.055,blade,.004],r*.8,sTop-blade,-r*.4,{color:'#2b2723',bevel:.0015}));
  const tTop=h-.04;
  for(const s of [-1,1])parts.push(part(`Brazo de pinza ${s<0?'trasero':'delantero'}`,[.012,tTop-.012-floor,.003],0,floor,r*.8+s*.009,{color:'#c9ccd0',material:'metal',bevel:0}));
  parts.push(part('Anilla de pinza',[.016,.012,.022],0,tTop-.012,r*.8,{color:'#c9ccd0',material:'metal',bevel:.003}));
  return parts;
}

/** Folded umbrella canopy from the ferrule (bottom) to the top notch (lathe profile). */
const FOLDED_UMBRELLA:Profile=[[0,0],[.12,0],[.5,.3],[.85,.62],[1,.82],[.6,.96],[.2,1],[0,1]];
/** Round umbrella stand: a thick floor and straight walls (lathe profile). */
const STAND:Profile=[[0,0],[1,0],[1,1],[.93,1],[.93,.04],[0,.04]];
/**
 * Umbrella stand inside `w × d × h`: an open round stand of diameter `min(w, d)` and two folded
 * umbrellas (navy and red) standing in it, each with its canopy, shaft and wooden handle; the
 * taller handle reaches `h`.
 */
export function umbrellaStandParts(w:number,d:number,h:number):FurniturePart[]{
  const D=Math.min(w,d),stand=Math.min(h*.5,.45),floor=stand*.04+.002;
  const parts:FurniturePart[]=[turned('Paragüero',STAND,[D,stand,D],0,0,0,{color:'item',material:'gloss'})];
  const umbrellas=[[1,'#2f3e4f',-D*.17,-D*.06,h],[2,'#8a3b32',D*.17,D*.07,h-.06]] as const;
  for(const [i,color,x,z,top] of umbrellas){
    const handle=Math.min(.11,(top-floor)*.15),canopy=(top-handle-floor)*.9,shaft=top-handle-floor-canopy+.01;
    if(canopy<=.05)continue;
    parts.push(turned(`Paraguas ${i}`,FOLDED_UMBRELLA,[.06,canopy,.06],x,floor,z,{color,surface:'textile'}));
    parts.push(turned(`Varilla ${i}`,ROD,[.01,shaft,.01],x,floor+canopy-.01,z,{color:'#c9ccd0',material:'metal'}));
    parts.push(turned(`Puño ${i}`,ROD,[.03,handle,.03],x,top-handle,z,{color:'#6b4a33'}));
  }
  return parts;
}

/** Height of the top of a room's floor finish, where the viewer draws room floors (rugs and mats lie on it). */
export const FLOOR_FINISH=.021;
/**
 * Coir doormat of thickness `h` lying on the floor finish (`FLOOR_FINISH`) over `w × d`: a dark
 * rubber backing and a coir pile inset 1.5 cm from its edges (surface `textile`).
 */
export function doormatParts(w:number,d:number,h:number):FurniturePart[]{
  const back=Math.max(.003,h*.4),inset=Math.min(.015,w*.05,d*.05),y=FLOOR_FINISH;
  return [
    part('Base de goma',[w,back,d],0,y,0,{color:'#2b2723',bevel:Math.min(.002,back*.4)}),
    part('Fibra de coco',[w-2*inset,h-back*.5,d-2*inset],0,y+back*.5,0,{color:'item',surface:'textile',bevel:Math.min(.004,h*.3)}),
  ];
}

/** Soap bottle: straight body, rounded shoulder and a short neck (lathe profile). */
const SOAP_BOTTLE:Profile=[[0,0],[.96,0],[1,.04],[1,.74],[.9,.86],[.38,.92],[.36,1],[0,1]];
/**
 * Soap dispenser inside `w × d × h` (nozzle towards +z): a glazed bottle of diameter `min(w, d)`,
 * a steel collar and stem and a pump head whose nozzle points forward; the head's top is `h`.
 */
export function soapDispenserParts(w:number,d:number,h:number):FurniturePart[]{
  const D=Math.min(w,d),body=h*.68,collar=.012,head=Math.min(.018,h*.1),steel={color:'#c9ccd0',material:'metal'} as const;
  const nozzle=clamp(D/2-.012,.01,.03);
  return [
    turned('Frasco',SOAP_BOTTLE,[D,body,D],0,0,0,{color:'item',material:'gloss'}),
    turned('Collarín',ROD,[D*.38,collar,D*.38],0,body-.002,0,steel),
    turned('Vástago',ROD,[.008,h-head-body-collar+.004,.008],0,body+collar-.002,0,steel),
    part('Cabezal',[.024,head,.024],0,h-head,0,{...steel,bevel:.004}),
    part('Boquilla',[.008,.008,nozzle],0,h-head+.004,.012+nozzle/2,{...steel,bevel:.002}),
  ];
}

/**
 * Toothbrush cup inside `w × d × h`: a glazed cup of diameter `min(w, d)` holding two toothbrushes
 * (flat handles, white bristle heads facing +z); the taller one reaches `h`.
 */
export function toothbrushCupParts(w:number,d:number,h:number):FurniturePart[]{
  const D=Math.min(w,d),cup=Math.min(h*.52,.11),floor=cup*.07;
  const parts:FurniturePart[]=[turned('Vaso',CROCK,[D,cup,D],0,0,0,{color:'item',material:'gloss'})];
  if(h-cup<.04)return parts;
  for(const [i,color,x,top] of [[1,'#7fa9b8',-D*.15,h],[2,'#e7e2d8',D*.15,h-.015]] as const){
    const bristle=.024;
    parts.push(part(`Mango ${i}`,[.012,top-floor,.007],x,floor,0,{color,bevel:.003}));
    parts.push(part(`Cerdas ${i}`,[.01,bristle,.01],x,top-bristle-.004,.0085,{color:'#f6f6f3',bevel:.002}));
  }
  return parts;
}

/**
 * Cotton bath mat of thickness `h` lying on the floor finish (`FLOOR_FINISH`) over `w × d`:
 * one soft textile pad with rounded edges and a slightly domed top.
 */
export function bathMatParts(w:number,d:number,h:number):FurniturePart[]{
  return [part('Alfombrilla',[w,h,d],0,FLOOR_FINISH,0,{color:'item',surface:'textile',bevel:Math.min(.006,h*.45),crown:{axis:'y',amount:h*.2}})];
}

/**
 * Stack of folded towels inside `w × d × h`: three towels with fully rounded, slightly puffed folds,
 * the middle one in an ivory contrast tone and each shifted a little so every fold edge reads.
 */
export function towelStackParts(w:number,d:number,h:number):FurniturePart[]{
  const t=h/3,colors=['item','#ece7dd','item'],shift=[.006,-.008,.004];
  return colors.map((color,i)=>part(`Toalla ${i+1}`,[w-(i%2)*.012,t,d-.012],shift[i],i*t,shift[2-i],{color,surface:'textile',bevel:t*.45,crown:{axis:'y',amount:t*.18,both:true}}));
}
