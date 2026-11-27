import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { FRONT_LONGITUDE, globeMap, globePixels } from '../lib/globeTexture';
import { deskGlobeParts } from '../lib/furnitureParts';

// Synthetic 360 × 180 mask (1° per pixel): land only between longitudes 0° and 40° south of 60° N.
const W = 360, H = 180;
const mask = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const lon = x - 180 + .5, lat = 90 - y - .5;
  mask[y * W + x] = lon > 0 && lon < 40 && lat < 60 ? 255 : 0;
}
const width = 3600, height = 1800;
const pixels = globePixels(mask, W, H, '#3f6f94', width, height);
/** Colour at a latitude/longitude, using the map's own layout (row 0 = south, column 0 = FRONT_LONGITUDE). */
const at = (lat: number, lon: number) => {
  const y = Math.floor((lat + 90) / 180 * height), x = Math.floor((((lon - FRONT_LONGITUDE) % 360 + 360) % 360) / 360 * width);
  return Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3));
};

describe('Mapa del globo terráqueo', () => {
  it('pinta los océanos en el color del objeto y la tierra en tonos de pergamino', () => {
    expect(at(15, -40)).toEqual([0x3f, 0x6f, 0x94]);
    const land = at(15, 20);
    expect(land[0]).toBeGreaterThan(190);
    expect(land[0]).toBeGreaterThan(land[2]); // cálido, no azul
    // Hacia los polos la tierra se aclara (hielo).
    expect(at(-80, 20)[2]).toBeGreaterThan(land[2] + 40);
  });

  it('orienta el mapa para las UV del torno: fila 0 al sur y la columna 0 en la longitud frontal', () => {
    // Fila 0 es el polo sur: a 50° S hay tierra en la franja de 0-40° y al norte de 60° N solo mar.
    expect(at(-50, 20)).not.toEqual([0x3f, 0x6f, 0x94]);
    expect(at(70, 20)).toEqual([0x3f, 0x6f, 0x94]); // norte de 60° N es mar
    // La columna 0 cae en la franja de tierra (0-40°) y la del lado opuesto, en el mar.
    const row = Math.floor((15 + 90) / 180 * height) * width * 4;
    expect(Array.from(pixels.slice(row, row + 3))).toEqual(at(15, 20));
    expect(Array.from(pixels.slice(row + width * 2, row + width * 2 + 3))).toEqual([0x3f, 0x6f, 0x94]);
    expect(FRONT_LONGITUDE).toBeGreaterThan(0); // Europa y África miran al frente
  });

  it('dibuja la retícula cada 30° sobre el mar y una costa más oscura', () => {
    const sea = at(15, -40), meridian = at(15, -60);
    expect(meridian[0]).toBeGreaterThan(sea[0]);
    const coast = globePixels(new Uint8Array([128]), 1, 1, '#3f6f94', 4, 2);
    const land = globePixels(new Uint8Array([255]), 1, 1, '#3f6f94', 4, 2);
    expect(coast[0]).toBeLessThan(land[0]);
  });

  it('el globo usa el mapa y la máscara de tierra se distribuye con la app', () => {
    const globe = deskGlobeParts(.3, .3, .42).find(p => p.name === 'Globo');
    expect(globe?.role).toBe('globe');
    expect(existsSync('public/materials/surfaces/globe-land.png')).toBe(true);
    const t = globeMap('#3f6f94');
    expect(t).toBe(globeMap('#3f6f94'));
    expect(t.flipY).toBe(false);
    expect(t.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(t.userData.mimeType).toBe('image/jpeg');
  });
});
