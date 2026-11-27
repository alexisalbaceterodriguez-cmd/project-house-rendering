import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DUSK_STOPS, duskColor, nightSkyTexture } from '../lib/nightSky';

const luminance=(c:THREE.Color)=>.2126*c.r+.7152*c.g+.0722*c.b;

describe('night sky', () => {
  it('hits every stop and stays between neighbours', () => {
    for(const [elevation,hex] of DUSK_STOPS)expect(duskColor(elevation).getHexString()).toBe(hex.slice(1));
    const mid=duskColor(9),a=duskColor(4),b=duskColor(14);
    expect(mid.b).toBeLessThanOrEqual(Math.max(a.b,b.b));expect(mid.b).toBeGreaterThanOrEqual(Math.min(a.b,b.b));
  });

  it('is a dusk: bright warm horizon, deep blue zenith, dark ground', () => {
    const horizon=duskColor(0),zenith=duskColor(90),ground=duskColor(-30);
    expect(luminance(horizon)).toBeGreaterThan(4*luminance(zenith));
    expect(zenith.b).toBeGreaterThan(zenith.r*2);
    expect(horizon.r).toBeGreaterThan(horizon.b);
    expect(luminance(ground)).toBeLessThan(luminance(zenith));
  });

  it('builds one shared equirectangular texture from nadir to zenith', () => {
    const texture=nightSkyTexture();
    expect(nightSkyTexture()).toBe(texture);
    expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping);
    const data=texture.image.data as Uint8Array,rows=texture.image.height;
    expect([...data.subarray(0,3)]).toEqual([0x14,0x1a,0x26]);
    expect([...data.subarray((rows-1)*4,(rows-1)*4+3)]).toEqual([0x1a,0x2c,0x52]);
  });
});
