import * as THREE from 'three';
import { floors } from '../data/catalog';
import type { FloorFinish } from '../types';

/**
 * Synthetic surface maps scaled in metres.
 *
 * The viewer uses them directly as image textures (not shader tricks), so the
 * same pixels travel inside the render package GLB and reach Cycles with the
 * same scale: Box and floor UVs are already in metres, and `repeat = 1 / tile`
 * is exported as KHR_texture_transform.
 *
 * Generators are pure and deterministic so they can be tested without WebGL.
 */
export type SurfaceKind = `floor:${FloorFinish}` | 'textile' | 'woodgrain';
export interface SurfacePixels {
  size: number;
  /** Real-world side of one texture tile in metres. */
  tile: number;
  /** sRGB colour (RGBA). Floors carry their finish colour; textile/woodgrain are greyscale multipliers. */
  color: Uint8Array;
  /** Tangent-space normal map (RGBA, +Y green). */
  normal: Uint8Array;
  /** glTF metallic-roughness layout (G = roughness, B = metalness = 0). */
  orm: Uint8Array;
}

function hash(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Bilinear value noise that tiles with integer periods (in cells). */
function noise(x: number, y: number, px: number, py: number, seed: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const w = (v: number, p: number) => ((v % p) + p) % p;
  const a = hash(w(x0, px), w(y0, py), seed), b = hash(w(x0 + 1, px), w(y0, py), seed);
  const c = hash(w(x0, px), w(y0 + 1, py), seed), d = hash(w(x0 + 1, px), w(y0 + 1, py), seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
/** Fractal noise over a square texture of `size` px whose base cell is `cellX`×`cellY` px. */
function fbm(x: number, y: number, size: number, cellX: number, cellY: number, octaves: number, seed: number) {
  let total = 0, amplitude = .5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = Math.max(1, cellX / 2 ** o), cy = Math.max(1, cellY / 2 ** o);
    total += amplitude * noise(x / cx, y / cy, Math.round(size / cx), Math.round(size / cy), seed + o * 31);
    norm += amplitude; amplitude *= .5;
  }
  return total / norm;
}
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Wrap-around central differences: height (0..1) to an 8-bit tangent-space normal map. */
export function heightToNormal(height: Float32Array, size: number, strength: number) {
  const out = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    out.set([Math.round((-dx / len * .5 + .5) * 255), Math.round((-dy / len * .5 + .5) * 255), Math.round((1 / len * .5 + .5) * 255), 255], (y * size + x) * 4);
  }
  return out;
}

function build(size: number, tile: number, strength: number, sample: (x: number, y: number) => { c: number[]; h: number; r: number }): SurfacePixels {
  const color = new Uint8Array(size * size * 4), orm = new Uint8Array(size * size * 4), height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const { c, h, r } = sample(x, y), i = y * size + x;
    color.set([Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), 255], i * 4);
    orm.set([255, Math.round(clamp01(r) * 255), 0, 255], i * 4);
    height[i] = h;
  }
  return { size, tile, color, orm, normal: heightToNormal(height, size, strength) };
}

/** Engineered planks: 8 boards of 19 cm across a 1.52 m tile, staggered joints, per-board tone and grain. */
function planks(base: number[], detail: number[], seed: number): SurfacePixels {
  const size = 512, rows = 8, row = size / rows;
  const joints = Array.from({ length: rows }, (_, r) => {
    const first = Math.floor(hash(r, 1, seed) * size);
    return hash(r, 2, seed) < .5 ? [first] : [first, (first + size / 2) % size];
  });
  return build(size, 1.52, 2.2, (x, y) => {
    const r = Math.floor(y / row), j = joints[r];
    const board = j.filter(v => v <= x).length % j.length;
    const tone = hash(r, 10 + board, seed);
    const grain = .65 * fbm(x + tone * 200, y, size, 128, 4, 3, seed + 7) + .35 * fbm(x, y + r * 13, size, 32, 2, 2, seed + 3);
    const edgeY = Math.min(y % row, row - 1 - (y % row)), edgeX = Math.min(...j.map(v => Math.min(Math.abs(x - v), size - Math.abs(x - v))));
    const seam = edgeY < 1 || edgeX < 1;
    const c = mix(base, detail, clamp01(.12 + .38 * tone + .6 * (grain - .5)));
    return { c: seam ? c.map(v => v * .72) : c, h: seam ? 0 : .55 + .25 * grain, r: seam ? .85 : .52 + .14 * grain };
  });
}
/** 60 × 60 cm stone tiles with 5 mm grout over a 1.2 m tile. */
function stone(base: number[], detail: number[], seed: number): SurfacePixels {
  const size = 512, cell = size / 2;
  return build(size, 1.2, 3, (x, y) => {
    const tx = Math.floor(x / cell), ty = Math.floor(y / cell);
    const edge = Math.min(x % cell, cell - 1 - (x % cell), y % cell, cell - 1 - (y % cell));
    if (edge < 1) return { c: mix(base, [168, 162, 152], .7), h: 0, r: .88 };
    const tone = hash(tx, ty, seed), cloud = fbm(x, y, size, 64, 64, 4, seed + tx * 5 + ty);
    return { c: mix(base, detail, clamp01(.1 + .3 * tone + .55 * (cloud - .4))), h: .8 + .05 * cloud, r: .4 + .1 * cloud };
  });
}
/** Polished terrazzo: scattered chips (one per 3 cm cell) on a mottled binder, 1 m tile. */
function terrazzo(base: number[], detail: number[], seed: number): SurfacePixels {
  const size = 512, cells = 32, cell = size / cells;
  const chipColors = [detail, mix(detail, [70, 72, 70], .5), [246, 244, 238], mix(base, [150, 120, 100], .4)];
  return build(size, 1, 1.2, (x, y) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let chip = -1;
    for (let oy = -1; oy <= 1 && chip < 0; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = (cx + ox + cells) % cells, ny = (cy + oy + cells) % cells;
      const px = (cx + ox + hash(nx, ny, seed)) * cell, py = (cy + oy + hash(ny, nx, seed + 1)) * cell;
      const radius = cell * (.18 + .3 * hash(nx, ny, seed + 2));
      if (Math.hypot(x - px, y - py) < radius) { chip = Math.floor(hash(nx, ny, seed + 3) * chipColors.length); break; }
    }
    const mottle = fbm(x, y, size, 32, 32, 3, seed + 9);
    const c = chip >= 0 ? chipColors[chip] : mix(base, detail, .25 * mottle);
    return { c, h: chip >= 0 ? .55 : .5, r: chip >= 0 ? .28 : .36 + .08 * mottle };
  });
}
/** Microcement / concrete: broad trowel clouds and fine pores over a 2 m tile. */
function concrete(base: number[], detail: number[], seed: number): SurfacePixels {
  const size = 512;
  return build(size, 2, 1.5, (x, y) => {
    const cloud = fbm(x, y, size, 128, 128, 5, seed), pore = hash(x, y, seed + 5) > .996;
    const c = mix(base, detail, clamp01(.15 + .9 * (cloud - .45)));
    return { c: pore ? c.map(v => v * .8) : c, h: pore ? .2 : .6 + .1 * cloud, r: .62 + .14 * cloud };
  });
}
/** Plain-weave upholstery, 2.5 mm threads, 8 cm tile. Greyscale: multiplied by the furniture colour. */
function textile(seed: number): SurfacePixels {
  const size = 256, thread = 8;
  return build(size, .08, 3, (x, y) => {
    const warp = (Math.floor(x / thread) + Math.floor(y / thread)) % 2 === 0;
    const along = warp ? x : y, across = warp ? y : x;
    const yarn = Math.sin(Math.PI * ((across % thread) + .5) / thread);
    const fibre = fbm(x, y, size, warp ? 32 : 1, warp ? 1 : 32, 2, seed);
    const shade = 228 + 22 * yarn - 10 * fibre + 4 * Math.sin(along * Math.PI / 2);
    return { c: [shade, shade, shade], h: .4 + .5 * yarn + .1 * fibre, r: .86 + .1 * (1 - yarn) };
  });
}
/** Long wood grain for furniture tops, 1 m tile. Greyscale multiplier of the item colour. */
function woodgrain(seed: number): SurfacePixels {
  const size = 512;
  return build(size, 1, 1.4, (x, y) => {
    const warpY = y + 24 * fbm(x, y, size, 256, 64, 2, seed + 4);
    const rings = .5 + .5 * Math.sin(warpY / size * Math.PI * 2 * 22);
    const streak = fbm(x, y, size, 128, 3, 3, seed);
    const g = .55 * streak + .45 * rings * rings;
    const shade = 255 - 44 * g;
    return { c: [shade, shade * .985, shade * .97], h: .5 + .2 * g, r: .5 + .16 * g };
  });
}

export function surfacePixels(kind: SurfaceKind, seed = 17): SurfacePixels {
  if (kind === 'textile') return textile(seed);
  if (kind === 'woodgrain') return woodgrain(seed);
  const finish = kind.slice('floor:'.length) as FloorFinish;
  const swatch = floors[finish] ?? floors.oak;
  const base = rgb(swatch.color), detail = rgb(swatch.detail);
  if (finish === 'stone') return stone(base, detail, seed);
  if (finish === 'terrazzo') return terrazzo(base, detail, seed);
  if (finish === 'concrete') return concrete(base, detail, seed);
  return planks(base, detail, seed + finish.length);
}

export interface SurfaceMaps {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  /** Same texture as metalnessMap: glTF packs both in one image, so the exporter keeps it unchanged. */
  roughnessMap: THREE.DataTexture;
  metalnessMap: THREE.DataTexture;
  tile: number;
}
const cache = new Map<SurfaceKind, SurfaceMaps>();
function texture(pixels: Uint8Array, size: number, tile: number, colorSpace: THREE.ColorSpace, jpeg = false) {
  const t = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.colorSpace = colorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  if (jpeg) t.userData.mimeType = 'image/jpeg';
  t.needsUpdate = true;
  return t;
}
/** Shared, cached textures (never disposed: a handful of small images reused by every mesh). */
export function surfaceMaps(kind: SurfaceKind): SurfaceMaps {
  let maps = cache.get(kind);
  if (!maps) {
    const p = surfacePixels(kind);
    const orm = texture(p.orm, p.size, p.tile, THREE.NoColorSpace);
    maps = { map: texture(p.color, p.size, p.tile, THREE.SRGBColorSpace, true), normalMap: texture(p.normal, p.size, p.tile, THREE.NoColorSpace), roughnessMap: orm, metalnessMap: orm, tile: p.tile };
    cache.set(kind, maps);
  }
  return maps;
}
