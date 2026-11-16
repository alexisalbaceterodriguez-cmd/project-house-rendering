export type TexturePattern='wood'|'marble'|'fabric'|'terrazzo'|'concrete';

/** Tileable synthetic maps. Relief is authored, not inferred as measured PBR from a photo. */
export function createMaterialMaps(pattern:TexturePattern,color:string,seed=42,size=256):{color:string;normal:string;roughness:string} {
  const canvases=Array.from({length:3},()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=size;return canvas;});
  const contexts=canvases.map(canvas=>canvas.getContext('2d')!);
  const images=contexts.map(context=>context.createImageData(size,size));
  const rgb=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
  const heights=new Float32Array(size*size);
  const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453;return n-Math.floor(n);};
  const noise=(x:number,y:number,frequency:number)=>{
    const px=x*frequency,py=y*frequency,ix=Math.floor(px),iy=Math.floor(py);
    const sx=(px-ix)**2*(3-2*(px-ix)),sy=(py-iy)**2*(3-2*(py-iy));
    const a=hash(ix%frequency,iy%frequency),b=hash((ix+1)%frequency,iy%frequency);
    const c=hash(ix%frequency,(iy+1)%frequency),d=hash((ix+1)%frequency,(iy+1)%frequency);
    return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,n=noise(u,v,16)*.6+noise(u,v,64)*.4;
    let value=n,relief=n*.05,roughness=.65;
    if(pattern==='wood') {const grain=Math.sin(u*Math.PI*48+noise(u,v,4)*3);value=.8+.07*grain+n*.1;relief=value*.008;roughness=.88+n*.12;}
    if(pattern==='marble') {const vein=Math.pow(Math.abs(Math.sin((u*3+v*2)*Math.PI*2+noise(u,v,8)*4)),.15);value=.28+vein*.72;relief=n*.005;roughness=.12+n*.12;}
    if(pattern==='fabric') {value=.88+.035*Math.sin(u*Math.PI*128)*Math.sin(v*Math.PI*128)+n*.06;relief=value*.018;roughness=.94+n*.06;}
    if(pattern==='terrazzo') {const chip=hash(Math.floor(u*48),Math.floor(v*48));value=chip>.74?.45+chip*.7:.83+n*.1;relief=n*.008;roughness=.32+n*.25;}
    if(pattern==='concrete') {value=.7+n*.3;relief=n*.12;roughness=.8+n*.2;}
    heights[y*size+x]=relief;
    const offset=(y*size+x)*4;
    for(let channel=0;channel<3;channel++)images[0].data[offset+channel]=Math.min(255,rgb[channel]*value);
    for(let channel=0;channel<3;channel++)images[2].data[offset+channel]=Math.round(roughness*255);
    images[0].data[offset+3]=images[2].data[offset+3]=255;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const height=(dx:number,dy:number)=>heights[((y+dy+size)%size)*size+(x+dx+size)%size];
    const dx=(height(-1,0)-height(1,0))*4,dy=(height(0,-1)-height(0,1))*4,length=Math.hypot(dx,dy,1),offset=(y*size+x)*4;
    images[1].data[offset]=(dx/length*.5+.5)*255;images[1].data[offset+1]=(dy/length*.5+.5)*255;
    images[1].data[offset+2]=(1/length*.5+.5)*255;images[1].data[offset+3]=255;
  }
  images.forEach((image,index)=>contexts[index].putImageData(image,0,0));
  return {color:canvases[0].toDataURL('image/jpeg',.9),normal:canvases[1].toDataURL('image/jpeg',.95),roughness:canvases[2].toDataURL('image/jpeg',.9)};
}
