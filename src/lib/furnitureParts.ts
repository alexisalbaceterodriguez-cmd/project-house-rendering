import type { Crown, Profile } from './boxGeometry';

type Vec3=[number,number,number];
/**
 * One solid of a parametric piece of furniture, centred at `position` (metres, origin at the
 * footprint centre on the floor, front +z). `item` = the furniture's own colour, `wood` = the
 * project's wood palette, otherwise a hex colour. The viewer draws each part as a bevelled box,
 * or as a solid of revolution filling `size` when it has a `lathe` profile, and the render GLB
 * carries the same meshes, so Cycles sees exactly this geometry.
 */
export type FurniturePart={name:string;size:Vec3;position:Vec3;color:'item'|'wood'|string;surface?:'textile'|'woodgrain';material?:'metal'|'glass'|'mirror'|'gloss';role?:string;bevel:number;crown?:Crown;lathe?:Profile};

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
