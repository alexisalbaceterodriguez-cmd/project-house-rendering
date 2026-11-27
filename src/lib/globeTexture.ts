import * as THREE from 'three';
import { trackTextureJob } from './surfaceTextures';

/**
 * Desk globe map: oceans in the item colour with a light graticule, land in parchment tones with a
 * darker coastline, ice towards the poles.
 *
 * Land comes from `public/materials/surfaces/globe-land.png`, a 1024 × 512 equirectangular mask
 * rasterised from Natural Earth (public domain) by `scripts/derive_globe_mask.py`. The map is built
 * for the lathe's own UVs (u around from the front, v from the south pole up) with `flipY = false`,
 * the glTF convention, so the same pixels travel in the render GLB and Cycles shows the same globe.
 */
export const GLOBE_MAP = { width: 1024, height: 512 };
/** Longitude at u = 0, which the lathe puts at the front (+z): Europe and Africa face the room. */
export const FRONT_LONGITUDE = 15;

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const LAND = rgb('#e2d2a2'), TROPICS = rgb('#d3c993'), ICE = rgb('#f1eee6'), COAST = rgb('#5d4f36'), GRID = [255, 255, 255];

/**
 * RGBA pixels of the globe map. `mask` is the land mask, one byte per pixel (255 = land), in plain
 * map orientation: north at the top row, longitude -180 at the left. Output row 0 is the south pole.
 */
export function globePixels(mask: ArrayLike<number>, maskWidth: number, maskHeight: number, ocean: string, width = GLOBE_MAP.width, height = GLOBE_MAP.height) {
  const out = new Uint8Array(width * height * 4), sea = rgb(ocean);
  for (let y = 0; y < height; y++) {
    const lat = -90 + (y + .5) / height * 180;
    const polar = Math.min(1, Math.max(0, (Math.abs(lat) - 58) / 12));
    const ground = mix(mix(TROPICS, LAND, Math.min(1, Math.abs(lat) / 35)), ICE, polar);
    const my = Math.min(maskHeight - 1, Math.floor((90 - lat) / 180 * maskHeight));
    const parallel = Math.abs(lat / 30 - Math.round(lat / 30)) * 30 < .3;
    for (let x = 0; x < width; x++) {
      const lon = ((FRONT_LONGITUDE + (x + .5) / width * 360 + 540) % 360) - 180;
      const mx = Math.min(maskWidth - 1, Math.floor((lon + 180) / 360 * maskWidth));
      const land = mask[my * maskWidth + mx] / 255;
      // Constant width on the sphere: wider in degrees towards the poles, where meridians converge.
      const meridian = Math.abs(lon / 30 - Math.round(lon / 30)) * 30 < Math.min(3, .3 / Math.max(.1, Math.cos(lat * Math.PI / 180)));
      const water = parallel || meridian ? mix(sea, GRID, lat === 0 ? .3 : .22) : sea;
      // The antialiased mask edge (land ≈ 0.5) draws a thin coastline.
      const coast = 1 - Math.abs(2 * land - 1);
      const c = mix(mix(water, ground, land), COAST, coast * .55);
      out.set([Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), 255], (y * width + x) * 4);
    }
  }
  return out;
}

let mask: Promise<{ data: Uint8Array; width: number; height: number }> | undefined;
/** Load the land mask once (browser only), as one byte per pixel. */
function loadMask() {
  mask ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}materials/surfaces/globe-land.png`);
    if (!response.ok) throw new Error('No se pudo cargar el mapa del globo.');
    const image = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Sin contexto 2D para el mapa del globo.');
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, image.width, image.height).data, data = new Uint8Array(image.width * image.height);
    for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
    return { data, width: image.width, height: image.height };
  })();
  return mask;
}

const cache = new Map<string, THREE.Texture>();
/**
 * Shared globe map for an ocean colour. Until the mask loads (or if it cannot), the map is the plain
 * ocean colour, which is how the globe looked before it had continents.
 */
export function globeMap(ocean: string): THREE.Texture {
  let t = cache.get(ocean);
  if (t) return t;
  const canvas = typeof document === 'undefined' || typeof createImageBitmap !== 'function' ? null : document.createElement('canvas');
  const context = canvas?.getContext('2d');
  if (canvas && context) {
    canvas.width = canvas.height = 4;
    context.fillStyle = ocean; context.fillRect(0, 0, 4, 4);
    t = new THREE.CanvasTexture(canvas);
    const texture = t;
    trackTextureJob(loadMask().then(({ data, width, height }) => {
      const map = document.createElement('canvas');
      map.width = GLOBE_MAP.width; map.height = GLOBE_MAP.height;
      map.getContext('2d')?.putImageData(new ImageData(Uint8ClampedArray.from(globePixels(data, width, height, ocean)), map.width, map.height), 0, 0);
      // Release the 4 × 4 stand-in's GPU storage so three allocates one of the new size.
      texture.dispose();
      texture.source = new THREE.Source(map);
      texture.needsUpdate = true;
    }));
  } else {
    const c = rgb(ocean), pixels = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) pixels.set([c[0], c[1], c[2], 255], i * 4);
    t = new THREE.DataTexture(pixels, 4, 4, THREE.RGBAFormat);
  }
  t.flipY = false;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.userData.mimeType = 'image/jpeg';
  t.needsUpdate = true;
  cache.set(ocean, t);
  return t;
}
