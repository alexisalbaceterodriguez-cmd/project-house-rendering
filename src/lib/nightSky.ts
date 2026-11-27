import * as THREE from 'three';

/**
 * Dusk sky behind the viewer at night, matching what Cycles shows through the windows
 * (Nishita sky with the sun just below the horizon): a pale warm band on the horizon,
 * a steel blue a few degrees up and a deep blue zenith. Below the horizon, a dark
 * blue ground. Stops are elevation in degrees → sRGB colour.
 */
export const DUSK_STOPS:readonly (readonly [number,string])[]=[
  [-90,'#141a26'],[-2,'#1c2638'],[0,'#c4bea8'],[5,'#b8b6aa'],[16,'#98a6b0'],[40,'#52709a'],[90,'#1a2c52'],
];

/** Colour of the dusk sky at an elevation (degrees), interpolated in linear light. */
export function duskColor(elevation:number):THREE.Color{
  const e=THREE.MathUtils.clamp(elevation,-90,90);
  let i=0;while(i<DUSK_STOPS.length-2&&e>DUSK_STOPS[i+1][0])i++;
  const [e0,c0]=DUSK_STOPS[i],[e1,c1]=DUSK_STOPS[i+1];
  return new THREE.Color(c0).lerp(new THREE.Color(c1),(e-e0)/(e1-e0));
}

let texture:THREE.DataTexture|null=null;
/** Equirectangular background (one column, 256 rows from nadir to zenith); shared and built once. */
export function nightSkyTexture():THREE.DataTexture{
  if(texture)return texture;
  const rows=256,data=new Uint8Array(rows*4);
  for(let row=0;row<rows;row++){
    // Equirect v grows upwards: row 0 looks straight down, the last row straight up.
    const rgb=duskColor(row/(rows-1)*180-90).getRGB(new THREE.Color(),THREE.SRGBColorSpace);
    data.set([Math.round(rgb.r*255),Math.round(rgb.g*255),Math.round(rgb.b*255),255],row*4);
  }
  texture=new THREE.DataTexture(data,1,rows,THREE.RGBAFormat);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  return texture;
}
