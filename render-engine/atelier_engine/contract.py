"""Atelier render package contract (schema v1).

Pure Python (stdlib only) so it runs both in the API server and inside
Blender's bundled interpreter. Every value coming from a package is untrusted:
validate types, ranges and sizes before any renderer touches it.

Coordinate system of the package (same as the Atelier/Three.js editor):
  * units: metres
  * right-handed, Y up
  * x = plan X (left -> right), z = plan Y (top -> bottom of the 2D plan)
Blender is Z up: (x, y, z)_package -> (x, -z, y)_blender, which is exactly the
conversion applied by Blender's glTF importer to ``scene.glb``.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import re
import struct
import zipfile
from dataclasses import dataclass

FORMAT = "atelier-render-package"
SCHEMA_VERSION = 1

# Members a package may contain. Anything else is rejected, so clients can
# never smuggle paths, scripts or extra files into the worker.
REQUIRED_MEMBERS = {"scene.json", "scene.glb"}
OPTIONAL_MEMBERS = {"preview.png"}

MAX_PACKAGE_BYTES = 512 * 1024 * 1024
MAX_MEMBER_BYTES = {"scene.json": 8 * 1024 * 1024, "scene.glb": 768 * 1024 * 1024, "preview.png": 64 * 1024 * 1024}
MAX_COMPRESSION_RATIO = 200
MAX_PIXELS = 3840 * 2160
MAX_SIDE = 3840
MIN_SIDE = 64
MAX_SAMPLES = 4096
MAX_INTERIOR_LIGHTS = 64
MAX_OBJECTS = 20000
LIGHTING_PRESETS = {"day", "afternoon", "night", "studio"}
QUALITIES = {"draft", "standard", "high", "custom"}
PASSES = {"beauty", "depth", "normal", "object_id", "material_id", "albedo"}
HDRI_WHITELIST = {"studio"}
ID_PATTERN = re.compile(r"^[\w.:@\- ]{1,200}$", re.UNICODE)


class PackageError(ValueError):
    """Structured, user-presentable validation error."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    def as_dict(self) -> dict:
        return {"code": self.code, "message": self.message}


def _fail(code: str, message: str):
    raise PackageError(code, message)


def _num(value, name: str, lo: float, hi: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        _fail("invalid_manifest", f"{name} debe ser un número finito.")
    if value < lo or value > hi:
        _fail("invalid_manifest", f"{name} fuera de rango ({lo} – {hi}).")
    return float(value)


def _vec3(value, name: str, limit: float = 10000.0) -> list[float]:
    if not isinstance(value, list) or len(value) != 3:
        _fail("invalid_manifest", f"{name} debe ser un vector de 3 números.")
    return [_num(v, name, -limit, limit) for v in value]


def _text(value, name: str, max_len: int = 200, required: bool = True) -> str:
    if value is None and not required:
        return ""
    if not isinstance(value, str) or len(value) > max_len:
        _fail("invalid_manifest", f"{name} debe ser un texto de hasta {max_len} caracteres.")
    return value


def _ident(value, name: str) -> str:
    text = _text(value, name)
    if not ID_PATTERN.match(text):
        _fail("invalid_manifest", f"{name} contiene caracteres no permitidos.")
    return text


def validate_manifest(manifest) -> dict:
    """Validate and normalise a scene.json manifest. Returns a clean copy."""
    if not isinstance(manifest, dict):
        _fail("invalid_manifest", "scene.json debe ser un objeto JSON.")
    if manifest.get("format") != FORMAT:
        _fail("invalid_manifest", "scene.json no es un paquete de render de Atelier.")
    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        _fail("unsupported_version", f"Versión de esquema no admitida: {manifest.get('schemaVersion')!r}.")
    if manifest.get("units") != "m" or manifest.get("upAxis") != "Y":
        _fail("invalid_manifest", "El paquete debe usar metros y eje Y vertical.")

    project = manifest.get("project")
    if not isinstance(project, dict):
        _fail("invalid_manifest", "Falta project.")
    clean_project = {
        "id": _ident(project.get("id"), "project.id"),
        "name": _text(project.get("name"), "project.name"),
        "contentHash": _text(project.get("contentHash"), "project.contentHash", 128),
        "wallHeight": _num(project.get("wallHeight"), "project.wallHeight", 1.8, 12),
        "width": _num(project.get("width"), "project.width", 0.5, 500),
        "depth": _num(project.get("depth"), "project.depth", 0.5, 500),
    }

    geometry = manifest.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("file") != "scene.glb":
        _fail("invalid_manifest", "geometry.file debe ser scene.glb.")
    sha = _text(geometry.get("sha256"), "geometry.sha256", 64)
    if not re.fullmatch(r"[0-9a-f]{64}", sha):
        _fail("invalid_manifest", "geometry.sha256 no es un SHA-256 válido.")

    rooms = manifest.get("rooms", [])
    if not isinstance(rooms, list) or len(rooms) > 500:
        _fail("invalid_manifest", "rooms debe ser una lista de hasta 500 recintos.")
    clean_rooms = []
    for i, room in enumerate(rooms):
        if not isinstance(room, dict):
            _fail("invalid_manifest", f"rooms[{i}] no es válido.")
        polygon = room.get("polygon")
        if not isinstance(polygon, list) or not 3 <= len(polygon) <= 2000:
            _fail("invalid_manifest", f"rooms[{i}].polygon necesita entre 3 y 2000 vértices.")
        clean_rooms.append({
            "id": _ident(room.get("id"), f"rooms[{i}].id"),
            "name": _text(room.get("name"), f"rooms[{i}].name"),
            "polygon": [[_num(p[0], "vértice", -1e4, 1e4), _num(p[1], "vértice", -1e4, 1e4)] if isinstance(p, list) and len(p) == 2 else _fail("invalid_manifest", f"rooms[{i}].polygon mal formado.") for p in polygon],
        })

    objects = manifest.get("objects", [])
    if not isinstance(objects, list) or len(objects) > MAX_OBJECTS:
        _fail("invalid_manifest", "objects no es válido.")
    clean_objects = []
    for i, obj in enumerate(objects):
        if not isinstance(obj, dict):
            _fail("invalid_manifest", f"objects[{i}] no es válido.")
        clean_objects.append({
            "id": _ident(obj.get("id"), f"objects[{i}].id"),
            "type": _text(obj.get("type"), f"objects[{i}].type", 40),
            "kind": _text(obj.get("kind"), f"objects[{i}].kind", 40, required=False),
            "name": _text(obj.get("name"), f"objects[{i}].name", required=False),
        })

    camera = manifest.get("camera")
    if not isinstance(camera, dict):
        _fail("invalid_manifest", "Falta camera.")
    clean_camera = {
        "position": _vec3(camera.get("position"), "camera.position"),
        "target": _vec3(camera.get("target"), "camera.target"),
        "fovY": _num(camera.get("fovY"), "camera.fovY", 5, 120),
        "near": _num(camera.get("near", 0.05), "camera.near", 0.001, 10),
        "far": _num(camera.get("far", 1000), "camera.far", 1, 100000),
        "verticals": bool(camera.get("verticals", False)),
    }
    dx = [t - p for t, p in zip(clean_camera["target"], clean_camera["position"])]
    if math.sqrt(sum(d * d for d in dx)) < 1e-4:
        _fail("invalid_manifest", "La cámara y su objetivo coinciden.")

    lighting = manifest.get("lighting")
    if not isinstance(lighting, dict):
        _fail("invalid_manifest", "Falta lighting.")
    preset = lighting.get("preset")
    if preset not in LIGHTING_PRESETS:
        _fail("invalid_manifest", f"Preset de iluminación desconocido: {preset!r}.")
    sun = lighting.get("sun") or {}
    sky = lighting.get("sky") or {}
    hdri = lighting.get("hdri")
    if hdri is not None and hdri not in HDRI_WHITELIST:
        _fail("invalid_manifest", "HDRI no permitido. Usa un entorno de la biblioteca del motor.")
    sun_dir = _vec3(sun.get("direction", [0.3, 0.8, 0.5]), "lighting.sun.direction", 2)
    norm = math.sqrt(sum(v * v for v in sun_dir))
    if norm < 1e-6:
        _fail("invalid_manifest", "La dirección del sol no puede ser nula.")
    interior = lighting.get("interior", [])
    if not isinstance(interior, list) or len(interior) > MAX_INTERIOR_LIGHTS:
        _fail("invalid_manifest", f"Se admiten hasta {MAX_INTERIOR_LIGHTS} luces interiores.")
    clean_lighting = {
        "preset": preset,
        "exposure": _num(lighting.get("exposure", 0), "lighting.exposure", -10, 10),
        "sun": {
            "direction": [v / norm for v in sun_dir],
            "strength": _num(sun.get("strength", 3), "lighting.sun.strength", 0, 100),
            "angle": _num(sun.get("angle", 1.5), "lighting.sun.angle", 0, 30),
            "temperature": _num(sun.get("temperature", 5600), "lighting.sun.temperature", 1500, 12000),
        },
        "sky": {"strength": _num(sky.get("strength", 1), "lighting.sky.strength", 0, 20)},
        "hdri": hdri,
        "ceiling": lighting.get("ceiling", "auto") if lighting.get("ceiling", "auto") in {"auto", "on", "off"} else _fail("invalid_manifest", "lighting.ceiling no es válido."),
        "roomLights": bool(lighting.get("roomLights", False)),
        "interior": [],
    }
    for i, light in enumerate(interior):
        if not isinstance(light, dict):
            _fail("invalid_manifest", f"lighting.interior[{i}] no es válido.")
        clean_lighting["interior"].append({
            "id": _ident(light.get("id"), f"lighting.interior[{i}].id"),
            "position": _vec3(light.get("position"), f"lighting.interior[{i}].position"),
            "power": _num(light.get("power", 60), f"lighting.interior[{i}].power", 0, 5000),
            "temperature": _num(light.get("temperature", 2700), f"lighting.interior[{i}].temperature", 1500, 12000),
            "radius": _num(light.get("radius", 0.05), f"lighting.interior[{i}].radius", 0, 2),
        })

    render = manifest.get("render")
    if not isinstance(render, dict):
        _fail("invalid_manifest", "Falta render.")
    width = int(_num(render.get("width"), "render.width", MIN_SIDE, MAX_SIDE))
    height = int(_num(render.get("height"), "render.height", MIN_SIDE, MAX_SIDE))
    if width * height > MAX_PIXELS:
        _fail("limit_exceeded", "La resolución supera 3840 × 2160 píxeles.")
    quality = render.get("quality", "standard")
    if quality not in QUALITIES:
        _fail("invalid_manifest", "render.quality no es válido.")
    passes = render.get("passes", ["beauty"])
    if not isinstance(passes, list) or any(p not in PASSES for p in passes):
        _fail("invalid_manifest", "render.passes contiene pases desconocidos.")
    clean_render = {
        "engine": "cycles",
        "width": width,
        "height": height,
        "samples": int(_num(render.get("samples", 256), "render.samples", 1, MAX_SAMPLES)),
        "quality": quality,
        "denoise": bool(render.get("denoise", True)),
        "passes": sorted(set(passes) | {"beauty"}),
        "timeLimit": _num(render.get("timeLimit", 0), "render.timeLimit", 0, 7200),
    }

    def _records(key: str) -> list[dict]:
        records = manifest.get(key, [])
        if not isinstance(records, list) or len(records) > 5000:
            _fail("invalid_manifest", f"{key} no es válido.")
        out = []
        for i, record in enumerate(records):
            if not isinstance(record, dict):
                _fail("invalid_manifest", f"{key}[{i}] no es válido.")
            out.append({k: _text(record.get(k), f"{key}[{i}].{k}", 2000, required=False) for k in ("id", "name", "kind", "source", "license", "attribution")})
        return out

    return {
        "format": FORMAT,
        "schemaVersion": SCHEMA_VERSION,
        "generator": manifest.get("generator") if isinstance(manifest.get("generator"), dict) else {},
        "createdAt": _text(manifest.get("createdAt", ""), "createdAt", 64, required=False),
        "units": "m",
        "upAxis": "Y",
        "project": clean_project,
        "geometry": {"file": "scene.glb", "sha256": sha},
        "rooms": clean_rooms,
        "objects": clean_objects,
        "camera": clean_camera,
        "lighting": clean_lighting,
        "render": clean_render,
        "assets": _records("assets"),
        "materials": _records("materials"),
    }


def check_glb(data: bytes) -> None:
    """Minimal structural check of a binary glTF 2.0 container."""
    if len(data) < 20:
        _fail("invalid_geometry", "scene.glb está vacío o truncado.")
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        _fail("invalid_geometry", "scene.glb no es un glTF binario 2.0.")
    if length != len(data):
        _fail("invalid_geometry", "La longitud declarada de scene.glb no coincide.")
    chunk_len, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON" or 20 + chunk_len > len(data):
        _fail("invalid_geometry", "scene.glb no empieza por un bloque JSON válido.")
    try:
        gltf = json.loads(data[20:20 + chunk_len].decode("utf-8"))
    except Exception:
        _fail("invalid_geometry", "El bloque JSON de scene.glb no se puede leer.")
    for buffer in gltf.get("buffers", []):
        if "uri" in buffer:
            _fail("invalid_geometry", "scene.glb no puede referenciar ficheros externos.")
    for image in gltf.get("images", []):
        if "uri" in image and not str(image["uri"]).startswith("data:"):
            _fail("invalid_geometry", "scene.glb no puede referenciar imágenes externas.")


@dataclass
class Package:
    manifest: dict
    files: dict[str, bytes]
    sha256: str


def read_package(data: bytes) -> Package:
    """Validate an uploaded zip package fully in memory; never touches disk."""
    if len(data) > MAX_PACKAGE_BYTES:
        _fail("limit_exceeded", "El paquete supera el tamaño máximo admitido.")
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        _fail("invalid_package", "El paquete no es un ZIP válido.")
    files: dict[str, bytes] = {}
    for info in archive.infolist():
        name = info.filename
        if name not in REQUIRED_MEMBERS | OPTIONAL_MEMBERS:
            _fail("invalid_package", f"Fichero no permitido en el paquete: {name[:80]!r}.")
        if name in files:
            _fail("invalid_package", f"Fichero duplicado: {name}.")
        if info.file_size > MAX_MEMBER_BYTES[name]:
            _fail("limit_exceeded", f"{name} es demasiado grande.")
        if info.compress_size and info.file_size / max(info.compress_size, 1) > MAX_COMPRESSION_RATIO:
            _fail("invalid_package", f"{name} tiene una compresión sospechosa.")
        with archive.open(info) as handle:
            content = handle.read(MAX_MEMBER_BYTES[name] + 1)
        if len(content) != info.file_size:
            _fail("invalid_package", f"{name} no coincide con su tamaño declarado.")
        files[name] = content
    missing = REQUIRED_MEMBERS - files.keys()
    if missing:
        _fail("invalid_package", f"Faltan ficheros: {', '.join(sorted(missing))}.")
    try:
        raw = json.loads(files["scene.json"].decode("utf-8"))
    except Exception:
        _fail("invalid_manifest", "scene.json no es JSON UTF-8 válido.")
    manifest = validate_manifest(raw)
    check_glb(files["scene.glb"])
    if hashlib.sha256(files["scene.glb"]).hexdigest() != manifest["geometry"]["sha256"]:
        _fail("invalid_package", "scene.glb no coincide con el SHA-256 declarado.")
    if "preview.png" in files and not files["preview.png"].startswith(b"\x89PNG\r\n\x1a\n"):
        _fail("invalid_package", "preview.png no es una imagen PNG.")
    return Package(manifest=manifest, files=files, sha256=hashlib.sha256(data).hexdigest())


def to_blender(v: list[float]) -> tuple[float, float, float]:
    """Package (Y-up) to Blender (Z-up) coordinates."""
    return (v[0], -v[2], v[1])
