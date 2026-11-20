"""Pure-Python builders for small, valid Atelier render packages (test only)."""
from __future__ import annotations

import hashlib
import io
import json
import struct
import zipfile


def _box(cx, cy, cz, sx, sy, sz):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    faces = [
        ((1, 0, 0), [(hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz), (hx, -hy, hz)]),
        ((-1, 0, 0), [(-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz), (-hx, -hy, -hz)]),
        ((0, 1, 0), [(-hx, hy, -hz), (-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz)]),
        ((0, -1, 0), [(-hx, -hy, hz), (-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz)]),
        ((0, 0, 1), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0, 0, -1), [(-hx, hy, -hz), (hx, hy, -hz), (hx, -hy, -hz), (-hx, -hy, -hz)]),
    ]
    positions, normals, indices = [], [], []
    for normal, quad in faces:
        base = len(positions)
        for x, y, z in quad:
            positions.append((x + cx, y + cy, z + cz))
            normals.append(normal)
        indices += [base, base + 1, base + 2, base, base + 2, base + 3]
    return positions, normals, indices


def build_glb(parts: list[dict]) -> bytes:
    """parts: {name, box:(cx,cy,cz,sx,sy,sz), color, material, extras}"""
    blob = bytearray()
    gltf = {"asset": {"version": "2.0", "generator": "atelier-tests"}, "scenes": [{"nodes": []}], "scene": 0,
            "nodes": [], "meshes": [], "materials": [], "accessors": [], "bufferViews": [], "buffers": []}
    material_index: dict[str, int] = {}

    def view(data: bytes, target: int) -> int:
        while len(blob) % 4:
            blob.append(0)
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target})
        blob.extend(data)
        return len(gltf["bufferViews"]) - 1

    for part in parts:
        positions, normals, indices = _box(*part["box"])
        pv = view(b"".join(struct.pack("<3f", *p) for p in positions), 34962)
        nv = view(b"".join(struct.pack("<3f", *n) for n in normals), 34962)
        iv = view(b"".join(struct.pack("<H", i) for i in indices), 34963)
        lo = [min(p[k] for p in positions) for k in range(3)]
        hi = [max(p[k] for p in positions) for k in range(3)]
        gltf["accessors"] += [
            {"bufferView": pv, "componentType": 5126, "count": len(positions), "type": "VEC3", "min": lo, "max": hi},
            {"bufferView": nv, "componentType": 5126, "count": len(normals), "type": "VEC3"},
            {"bufferView": iv, "componentType": 5123, "count": len(indices), "type": "SCALAR"},
        ]
        a = len(gltf["accessors"]) - 3
        mat_name = part.get("material", part["name"] + "-mat")
        if mat_name not in material_index:
            material_index[mat_name] = len(gltf["materials"])
            material = {"name": mat_name, "pbrMetallicRoughness": {
                "baseColorFactor": [*part.get("color", (0.8, 0.8, 0.8)), part.get("alpha", 1.0)], "metallicFactor": 0.0, "roughnessFactor": 0.8}}
            if part.get("alpha", 1.0) < 1:
                material["alphaMode"] = "BLEND"
            gltf["materials"].append(material)
        gltf["meshes"].append({"name": part["name"], "primitives": [{
            "attributes": {"POSITION": a, "NORMAL": a + 1}, "indices": a + 2, "material": material_index[mat_name]}]})
        node = {"name": part["name"], "mesh": len(gltf["meshes"]) - 1}
        if part.get("extras"):
            node["extras"] = part["extras"]
        gltf["nodes"].append(node)
        gltf["scenes"][0]["nodes"].append(len(gltf["nodes"]) - 1)
    while len(blob) % 4:
        blob.append(0)
    gltf["buffers"].append({"byteLength": len(blob)})
    js = json.dumps(gltf).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    return (struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(js), b"JSON") + js
            + struct.pack("<I4s", len(blob), b"BIN\x00") + bytes(blob))


def tag(atelier_id: str, kind_type: str, kind: str = "") -> dict:
    return {"atelierId": atelier_id, "atelierType": kind_type, "atelierKind": kind}


def room_glb() -> bytes:
    """A 4 x 3 m room (plan x 0..4, plan y 0..3), 2.5 m high, window in the north wall (plan y = 0)."""
    h, t = 2.5, 0.15
    wall = (0.93, 0.92, 0.88)
    return build_glb([
        {"name": "ground", "box": (2, -0.06, 1.5, 30, 0.1, 30), "color": (0.55, 0.55, 0.5), "extras": tag("ground", "ground")},
        {"name": "floor", "box": (2, 0.005, 1.5, 4, 0.01, 3), "color": (0.55, 0.38, 0.22), "extras": tag("room-1", "room", "living")},
        # north wall with a 2 m x 1.3 m opening (sill 0.9) between x = 1 and x = 3
        {"name": "n-left", "box": (0.5, h / 2, 0, 1.0 + t, h, t), "color": wall, "material": "wall", "extras": tag("wall-n", "wall")},
        {"name": "n-right", "box": (3.5, h / 2, 0, 1.0 + t, h, t), "color": wall, "material": "wall", "extras": tag("wall-n", "wall")},
        {"name": "n-sill", "box": (2, 0.45, 0, 2, 0.9, t), "color": wall, "material": "wall", "extras": tag("wall-n", "wall")},
        {"name": "n-head", "box": (2, 2.35, 0, 2, 0.3, t), "color": wall, "material": "wall", "extras": tag("wall-n", "wall")},
        {"name": "glass", "box": (2, 1.55, 0, 2, 1.3, 0.02), "material": "atelier:glass", "extras": tag("window-1", "opening", "window")},
        {"name": "s", "box": (2, h / 2, 3, 4 + t, h, t), "color": wall, "material": "wall", "extras": tag("wall-s", "wall")},
        {"name": "w", "box": (0, h / 2, 1.5, t, h, 3), "color": wall, "material": "wall", "extras": tag("wall-w", "wall")},
        {"name": "e", "box": (4, h / 2, 1.5, t, h, 3), "color": wall, "material": "wall", "extras": tag("wall-e", "wall")},
        {"name": "sofa", "box": (2, 0.4, 2.4, 2.0, 0.8, 0.8), "color": (0.62, 0.55, 0.46), "extras": tag("sofa-1", "furniture", "sofa")},
        {"name": "flame", "box": (2.0, 0.8, 2.0, 0.012, 0.026, 0.012), "color": (1.0, 0.81, 0.48), "material": "atelier:flame", "extras": tag("candles-1", "furniture", "candles")},
        {"name": "voile", "box": (1.2, 1.3, 0.12, 0.6, 2.3, 0.02), "color": (0.95, 0.94, 0.9), "alpha": 0.55, "material": "atelier:sheer", "extras": tag("curtain-1", "furniture", "sheer-curtain")},
        {"name": "leaves", "box": (3.6, 0.8, 2.6, 0.3, 0.3, 0.3), "color": (0.2, 0.4, 0.15), "material": "atelier:leaf", "extras": tag("plant-1", "furniture", "plant")},
    ])


def manifest(glb: bytes, **overrides) -> dict:
    data = {
        "format": "atelier-render-package", "schemaVersion": 1,
        "generator": {"app": "atelier-tests", "version": "1"}, "createdAt": "2026-11-20T00:00:00Z",
        "units": "m", "upAxis": "Y", "handedness": "right",
        "project": {"id": "test-room", "name": "Sala de prueba", "contentHash": "x", "wallHeight": 2.5, "width": 4, "depth": 3},
        "geometry": {"file": "scene.glb", "sha256": hashlib.sha256(glb).hexdigest(), "bytes": len(glb)},
        "rooms": [{"id": "room-1", "name": "Salón", "kind": "living", "polygon": [[0, 0], [4, 0], [4, 3], [0, 3]]}],
        "objects": [{"id": "sofa-1", "type": "furniture", "kind": "sofa", "name": "Sofá"}],
        "camera": {"position": [3.6, 1.5, 2.8], "target": [1.2, 1.1, 0.6], "fovY": 55, "near": 0.05, "far": 200, "verticals": True},
        "lighting": {"preset": "afternoon", "exposure": 0, "sun": {"direction": [0.25, 0.4, -0.88], "strength": 4, "angle": 1.5, "temperature": 4600},
                     "sky": {"strength": 0.35}, "hdri": None, "ceiling": "auto", "roomLights": False, "interior": []},
        "render": {"engine": "cycles", "width": 320, "height": 200, "samples": 16, "quality": "draft", "denoise": True, "passes": ["beauty", "depth", "object_id"]},
        "assets": [], "materials": [],
    }
    for key, value in overrides.items():
        data[key] = value
    return data


def package(glb: bytes | None = None, scene: dict | None = None, extra: dict[str, bytes] | None = None) -> bytes:
    glb = glb if glb is not None else room_glb()
    scene = scene if scene is not None else manifest(glb)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as archive:
        archive.writestr("scene.json", json.dumps(scene))
        archive.writestr("scene.glb", glb)
        for name, data in (extra or {}).items():
            archive.writestr(name, data)
    return buffer.getvalue()
