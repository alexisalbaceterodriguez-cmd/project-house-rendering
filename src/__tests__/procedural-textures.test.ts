import { afterEach,describe,expect,it,vi } from 'vitest';
import { createMaterialMaps } from '../lib/proceduralTextures';

afterEach(()=>vi.unstubAllGlobals());
describe('Mapas sintéticos de madera y tejido',()=>{
  it.each(['wood','fabric'] as const)('%s conserva albedo, microrrelieve y rugosidad sin hornear luces',pattern=>{
    const pixels:Uint8ClampedArray[]=[];
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,toDataURL:()=> 'data:image/jpeg;base64,map',getContext:()=>({
      createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData:(image:{data:Uint8ClampedArray})=>pixels.push(image.data),
    })})});
    createMaterialMaps(pattern,'#808080',42,64);
    const channel=(image:Uint8ClampedArray,offset:number)=>Array.from(image).filter((_,i)=>i%4===offset);
    const albedo=channel(pixels[0],0),normalX=channel(pixels[1],0),normalY=channel(pixels[1],1),roughness=channel(pixels[2],0);
    // Colour remains close to the chosen swatch; roughness modulates its scalar mildly.
    expect(Math.min(...albedo)).toBeGreaterThan(90);expect(Math.max(...albedo)).toBeLessThanOrEqual(128);
    expect(Math.max(...albedo)-Math.min(...albedo)).toBeGreaterThan(4);
    expect(Math.min(...roughness)).toBeGreaterThanOrEqual(224);
    // Microtexture must not turn a flat cloth/wood surface into corrugated geometry.
    for(const component of [...normalX,...normalY])expect(Math.abs(component-128)).toBeLessThan(6);
    expect(channel(pixels[1],2).every(value=>value>=254)).toBe(true);
    expect(channel(pixels[0],3).every(value=>value===255)).toBe(true);
  });
});
