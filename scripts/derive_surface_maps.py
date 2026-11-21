"""Derive the scanned surface maps of Atelier 60 from Poly Haven CC0 2K downloads.
Usage: python scripts/derive_surface_maps.py <folder with Poly Haven *_2k.jpg downloads> public/materials/surfaces

Floors are tinted (per channel, in linear light) so their mean matches the finish swatch the editor shows;
textile and woodgrain become light greyscale multipliers of the furniture colour, like the procedural maps.
Maps whose grain runs along v are turned 90° so boards and grain run along x (normal xy rotated with them).
"""
import sys, json
import numpy as np
from PIL import Image

DL = sys.argv[1]
OUT = sys.argv[2]

def srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055) * 255.0
def hexrgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
def load(asset, kind):
    im = Image.open(f'{DL}/{asset}_{kind}_2k.jpg').convert('RGB')
    if im.size != (2048, 2048): im = im.resize((2048, 2048), Image.LANCZOS)
    return np.asarray(im).astype(np.float64)
def rot(a, normal=False):
    a = np.rot90(a, 1).copy()  # counter-clockwise: image +x becomes +y
    if normal:  # rotate the tangent-space vector with the image: (x, y) -> (-y, x)
        r, g = a[..., 0].copy(), a[..., 1].copy()
        a[..., 0] = 255 - g; a[..., 1] = r
    return a
def save(a, name, size, quality=86):
    im = Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8))
    if im.size[0] != size: im = im.resize((size, size), Image.LANCZOS)
    im.save(f'{OUT}/{name}.jpg', quality=quality, optimize=True, progressive=False, subsampling=0 if 'normal' in name else 2)

FLOORS = {  # finish: (asset, rotate, contrast, swatch colour, detail)
    'oak': ('laminate_floor_02', False, (1.0, 1), '#dec29c', '#b99a6e'),
    'ash': ('wood_floor', True, (1.0, 1), '#e6d8bb', '#c6b897'),
    'walnut': ('wood_floor', True, (1.0, 1), '#927458', '#624732'),
    'stone': ('grey_tiles', False, (.8, .3), '#d8d1c5', '#b9b0a2'),
    'terrazzo': ('terrazzo_tiles', False, (.9, .6), '#d1d2cd', '#a5ada3'),
    'concrete': ('smooth_concrete_floor', False, (.55, 0), '#babbb7', '#a1a5a2'),
}
report = {}
for finish, (asset, turn, k, c, d) in FLOORS.items():
    diff, nor, rough = load(asset, 'diff'), load(asset, 'nor_gl'), load(asset, 'rough')
    if turn: diff, nor, rough = rot(diff), rot(nor, True), rot(rough)
    target = srgb_to_lin(hexrgb(c) * .7 + hexrgb(d) * .3)
    lin = srgb_to_lin(diff)
    mean = lin.reshape(-1, 3).mean(0)
    # k = contrast, chroma = share of the scan's own hue variation kept (0 = luminance only, no colour cast).
    k, chroma = k
    lum = lin @ np.array([.2126, .7152, .0722]); rel = (lum / lum.mean())[..., None]
    out = target * (1 + k * (chroma * (lin / mean - 1) + (1 - chroma) * (rel - 1)))
    color = lin_to_srgb(out)
    orm = np.zeros_like(rough); orm[..., 0] = 255; orm[..., 1] = rough[..., 0]
    save(color, f'floor-{finish}-color', 2048); save(nor, f'floor-{finish}-normal', 2048, 90); save(orm, f'floor-{finish}-orm', 1024)
    report[finish] = {'mean': color.reshape(-1, 3).mean(0).round(1).tolist(), 'target': (hexrgb(c) * .7 + hexrgb(d) * .3).round(1).tolist(), 'rough': round(rough[..., 0].mean() / 255, 3)}

for kind, asset, turn, size, spread, warm in (('textile', 'rough_linen', False, 1024, 11, (1, 1, 1)), ('woodgrain', 'oak_veneer_01', True, 2048, 10, (1, .985, .97))):
    diff, nor, rough = load(asset, 'diff'), load(asset, 'nor_gl'), load(asset, 'rough')
    if turn: diff, nor, rough = rot(diff), rot(nor, True), rot(rough)
    lum = diff @ np.array([.2126, .7152, .0722])
    shade = np.clip(236 + (lum - lum.mean()) / lum.std() * spread, 170, 255)
    color = np.stack([shade * w for w in warm], -1)
    orm = np.zeros_like(rough); orm[..., 0] = 255; orm[..., 1] = rough[..., 0]
    save(color, f'{kind}-color', size); save(nor, f'{kind}-normal', size, 90); save(orm, f'{kind}-orm', 1024)
    report[kind] = {'min': float(shade.min()), 'mean': float(shade.mean()), 'rough': round(rough[..., 0].mean() / 255, 3)}
print(json.dumps(report, indent=1))

# Ash and walnut are the same scan with different tints: keep one shared normal/roughness pair.
import os
for kind in ('normal', 'orm'):
    os.replace(f'{OUT}/floor-ash-{kind}.jpg', f'{OUT}/floor-wood-{kind}.jpg')
    os.remove(f'{OUT}/floor-walnut-{kind}.jpg')
