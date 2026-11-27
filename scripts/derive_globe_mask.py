"""Rasterise Natural Earth land polygons (public domain) into the globe's land mask.

Usage: python scripts/derive_globe_mask.py ne_50m_land.geojson public/materials/surfaces/globe-land.png

Output: 1024 x 512 greyscale PNG, equirectangular (longitude -180..180 left to right, latitude 90..-90
top to bottom), 255 = land, antialiased by drawing at 4x and downsampling. Source:
https://github.com/nvkelso/natural-earth-vector (geojson/ne_50m_land.geojson).
"""
import json
import sys

from PIL import Image, ImageDraw

WIDTH, HEIGHT, SCALE = 1024, 512, 4


def main(source: str, target: str) -> None:
    with open(source, encoding="utf-8") as f:
        features = json.load(f)["features"]
    w, h = WIDTH * SCALE, HEIGHT * SCALE
    image = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(image)
    point = lambda lon, lat: ((lon + 180) / 360 * w, (90 - lat) / 180 * h)
    for feature in features:
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for rings in polygons:
            for i, ring in enumerate(rings):
                draw.polygon([point(lon, lat) for lon, lat, *_ in ring], fill=0 if i else 255)
    image.resize((WIDTH, HEIGHT), Image.LANCZOS).save(target, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
