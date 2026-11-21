import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { floors } from '../data/catalog';
import { heightToNormal, SURFACE_SCANS, surfaceMaps, surfacePixels, surfaceTexturesReady, type SurfaceKind } from '../lib/surfaceTextures';

const channel = (data: Uint8Array, offset: number) => Array.from(data).filter((_, i) => i % 4 === offset);
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const min = (values: number[]) => values.reduce((a, b) => Math.min(a, b), Infinity);
const max = (values: number[]) => values.reduce((a, b) => Math.max(a, b), -Infinity);

describe('Texturas de superficie horneadas para el GLB del render', () => {
  it('genera mapas deterministas con escala real por acabado', () => {
    const a = surfacePixels('floor:oak'), b = surfacePixels('floor:oak');
    expect(Buffer.from(a.color).equals(Buffer.from(b.color))).toBe(true);
    expect(a.tile).toBeCloseTo(1.52); // 8 tablas de 19 cm
    expect(surfacePixels('floor:stone').tile).toBeCloseTo(1.2); // 2 × 2 losas de 60 cm
    expect(surfacePixels('textile').tile).toBeCloseTo(.08);
    for (const p of [a, surfacePixels('textile')]) {
      expect(p.color.length).toBe(p.size * p.size * 4);
      expect(p.normal.length).toBe(p.color.length);
      expect(p.orm.length).toBe(p.color.length);
    }
  });

  it.each(Object.keys(floors))('el suelo %s conserva el tono del acabado y lleva relieve y rugosidad', finish => {
    const p = surfacePixels(`floor:${finish}` as SurfaceKind);
    const swatch = [1, 3, 5].map(i => parseInt(floors[finish as keyof typeof floors].color.slice(i, i + 2), 16));
    const detail = [1, 3, 5].map(i => parseInt(floors[finish as keyof typeof floors].detail.slice(i, i + 2), 16));
    for (let c = 0; c < 3; c++) {
      const m = mean(channel(p.color, c));
      // The average stays between the finish colour and its darker detail tone.
      expect(m).toBeGreaterThan(Math.min(swatch[c], detail[c]) - 20);
      expect(m).toBeLessThan(Math.max(swatch[c], detail[c]) + 12);
    }
    const roughness = channel(p.orm, 1);
    expect(min(roughness)).toBeGreaterThan(50);
    expect(max(roughness)).toBeLessThan(240);
    expect(channel(p.orm, 2).every(v => v === 0)).toBe(true); // dieléctrico
    const nx = channel(p.normal, 0);
    expect(max(nx) - min(nx)).toBeGreaterThan(10); // juntas, vetas o áridos con relieve (el terrazo pulido es casi plano)
  });

  it('los tejidos y vetas son multiplicadores claros del color del mueble', () => {
    for (const kind of ['textile', 'woodgrain'] as const) {
      const shades = channel(surfacePixels(kind).color, 0);
      expect(min(shades)).toBeGreaterThan(190);
      expect(mean(shades)).toBeGreaterThan(215);
    }
  });

  it('convierte altura en normal tangente que se repite sin costuras', () => {
    const flat = heightToNormal(new Float32Array(16).fill(.5), 4, 3);
    expect(Array.from(flat.subarray(0, 4))).toEqual([128, 128, 255, 255]);
    // A ramp that wraps: the last column must see the first as its neighbour.
    const ramp = new Float32Array(16).map((_, i) => (i % 4) / 4);
    const normal = heightToNormal(ramp, 4, 1);
    expect(normal[0]).toBeGreaterThan(128); // x=0 neighbours x=3 (high) on the left
    expect(normal[4]).toBeLessThan(128);
  });

  it('crea texturas three cacheadas listas para exportarse en glTF', () => {
    const maps = surfaceMaps('floor:walnut');
    expect(surfaceMaps('floor:walnut')).toBe(maps);
    expect(maps.map).toBeInstanceOf(THREE.DataTexture);
    expect(maps.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(maps.map.userData.mimeType).toBe('image/jpeg');
    expect(maps.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    // glTF packs roughness (G) and metalness (B) in one image; sharing it avoids a canvas merge.
    expect(maps.metalnessMap).toBe(maps.roughnessMap);
    expect(maps.map.repeat.x).toBeCloseTo(1 / maps.tile);
    expect(maps.map.wrapS).toBe(THREE.RepeatWrapping);
  });

  it('declara mapas escaneados CC0 para cada superficie, en JPEG y con su anchura real', async () => {
    const { existsSync, statSync } = await import('node:fs');
    for (const [kind, scan] of Object.entries(SURFACE_SCANS)) {
      expect(scan.tile, kind).toBeGreaterThan(kind === 'textile' ? .1 : 1);
      for (const name of [scan.color, scan.normal, scan.orm]) {
        const file = `public/materials/surfaces/${name}.jpg`;
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeLessThan(2.5e6);
      }
    }
    // Normal and roughness are shared between wood finishes that only differ in tint.
    expect(SURFACE_SCANS['floor:ash'].normal).toBe(SURFACE_SCANS['floor:walnut'].normal);
    // Without a DOM the procedural fallback stays (and every map is marked for JPEG in the GLB).
    const maps = surfaceMaps('textile');
    expect(maps.scanned).toBe(false);
    expect(maps.normalMap.userData.mimeType).toBe('image/jpeg');
    await expect(surfaceTexturesReady()).resolves.toBeUndefined();
  });
});
