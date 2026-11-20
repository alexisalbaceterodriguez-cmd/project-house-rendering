"""Atelier 60 -> Blender Cycles render job.

Run headless, never with the UI and never with auto-run scripts:

  blender -b --factory-startup --disable-autoexec -noaudio --python-exit-code 1 \
          -P atelier_render.py -- --job-dir <dir>

<dir> must contain a validated ``scene.json`` + ``scene.glb``. Outputs written
to the same directory: ``beauty.png``, optional ``passes.exr`` (multilayer,
32-bit float), ``ids.json`` (pass index -> Atelier ids) and ``result.json``.
On failure ``error.json`` is written and Blender exits with code 1.

Progress is reported on stdout as ``ATELIER_PROGRESS stage=<name>`` lines; the
server additionally parses Cycles' own ``Sample n/m`` lines.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
import traceback

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE_ROOT = os.path.dirname(HERE)
if ENGINE_ROOT not in sys.path:
    sys.path.insert(0, ENGINE_ROOT)

from atelier_engine import contract  # noqa: E402

HDRI_LIBRARY = {
    # Whitelisted environments only: clients choose a name, never a path.
    "studio": os.path.join(os.path.dirname(ENGINE_ROOT), "public", "environment", "studio.hdr"),
}
QUALITY_THRESHOLDS = {"draft": 0.05, "standard": 0.02, "high": 0.01, "custom": 0.02}


class RenderFailure(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def progress(stage: str, **extra) -> None:
    details = " ".join(f"{k}={v}" for k, v in extra.items())
    print(f"ATELIER_PROGRESS stage={stage} {details}".rstrip(), flush=True)


def parse_args() -> dict:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = {"job_dir": None, "device": os.environ.get("ATELIER_DEVICE", "AUTO").upper()}
    i = 0
    while i < len(argv):
        if argv[i] == "--job-dir" and i + 1 < len(argv):
            args["job_dir"] = argv[i + 1]
            i += 2
        elif argv[i] == "--device" and i + 1 < len(argv):
            args["device"] = argv[i + 1].upper()
            i += 2
        else:
            i += 1
    if not args["job_dir"]:
        raise RenderFailure("bad_invocation", "Falta --job-dir.")
    return args


# --------------------------------------------------------------------------- colour helpers

def kelvin_to_rgb(kelvin: float) -> tuple[float, float, float]:
    """Approximate black-body colour (Tanner Helland fit), returned in linear RGB."""
    t = max(1000.0, min(40000.0, kelvin)) / 100.0
    if t <= 66:
        r = 255.0
        g = 99.4708025861 * math.log(t) - 161.1195681661
        b = 0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        r = 329.698727446 * ((t - 60) ** -0.1332047592)
        g = 288.1221695283 * ((t - 60) ** -0.0755148492)
        b = 255.0
    def lin(c: float) -> float:
        c = max(0.0, min(255.0, c)) / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    rgb = (lin(r), lin(g), lin(b))
    peak = max(rgb)
    return tuple(c / peak for c in rgb)  # type: ignore[return-value]


# --------------------------------------------------------------------------- scene setup

def import_geometry(job_dir: str) -> list[bpy.types.Object]:
    progress("import")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(job_dir, "scene.glb")
    before = set(bpy.data.objects)
    try:
        result = bpy.ops.import_scene.gltf(filepath=path, import_shading="NORMALS")
    except Exception as exc:  # importer raises RuntimeError with its own message
        raise RenderFailure("import_failed", f"Blender no pudo importar scene.glb: {exc}") from exc
    if "FINISHED" not in result:
        raise RenderFailure("import_failed", "Blender no pudo importar scene.glb.")
    objects = [o for o in bpy.data.objects if o not in before]
    for obj in objects:
        # Lights or cameras inside the GLB are ignored: the manifest drives them.
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    objects = [o for o in bpy.data.objects if o.type == "MESH"]
    if not objects:
        raise RenderFailure("empty_scene", "scene.glb no contiene geometría.")
    return objects


def atelier_tag(obj: bpy.types.Object) -> tuple[str, str, str] | None:
    node = obj
    while node is not None:
        if "atelierId" in node.keys():
            return str(node["atelierId"]), str(node.get("atelierType", "")), str(node.get("atelierKind", ""))
        node = node.parent
    return None


def material_role(material: bpy.types.Material) -> str:
    name = material.name.split(".")[0] if material.name.startswith("atelier:") else material.name
    if name.startswith("atelier:"):
        return name.split(":", 1)[1]
    return ""


def principled(material: bpy.types.Material):
    if not material.use_nodes:
        return None
    for node in material.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            return node
    return None


def set_input(node, names: tuple[str, ...], value) -> None:
    for name in names:
        if name in node.inputs:
            socket = node.inputs[name]
            for link in list(socket.links):
                node.id_data.links.remove(link)
            socket.default_value = value
            return


def make_architectural_glass(material: bpy.types.Material) -> None:
    """Thin window glass: refractive for camera rays, transparent for shadow
    and diffuse rays so sunlight and sky reach the interior without caustic noise."""
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    glass = tree.nodes.new("ShaderNodeBsdfPrincipled")
    set_input(glass, ("Base Color",), (0.92, 0.96, 0.95, 1.0))
    set_input(glass, ("Roughness",), 0.0)
    set_input(glass, ("IOR",), 1.5)
    set_input(glass, ("Transmission Weight", "Transmission"), 1.0)
    transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
    transparent.inputs["Color"].default_value = (0.94, 0.97, 0.96, 1.0)
    path = tree.nodes.new("ShaderNodeLightPath")
    add = tree.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    add.use_clamp = True
    mix = tree.nodes.new("ShaderNodeMixShader")
    tree.links.new(path.outputs["Is Shadow Ray"], add.inputs[0])
    tree.links.new(path.outputs["Is Diffuse Ray"], add.inputs[1])
    tree.links.new(add.outputs[0], mix.inputs[0])
    tree.links.new(glass.outputs[0], mix.inputs[1])
    tree.links.new(transparent.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], out.inputs["Surface"])


def make_glowing_shade(material: bpy.types.Material, temperature: float) -> None:
    node = principled(material)
    if node is None:
        return
    warm = kelvin_to_rgb(temperature)
    set_input(node, ("Emission Color", "Emission"), (*warm, 1.0))
    set_input(node, ("Emission Strength",), 2.5)


# Thin surfaces that pass light to their back face. A leaf transmits on top of
# what it reflects (green leaves reflect and transmit roughly alike, both low),
# so its transmission is added at 60 % of the base colour; a fabric shade trades
# 40 % of its reflection for transmission, which keeps a white shade below 1.
TRANSLUCENCY = {"leaf": ("add", 0.6), "lampshade": ("mix", 0.4)}


def add_translucency(material: bpy.types.Material, mode: str, amount: float) -> bool:
    """Combine the imported Principled surface with a Translucent BSDF of its
    base colour (texture links included). Geometry and colour stay as exported."""
    node = principled(material)
    if node is None:
        return False
    tree = material.node_tree
    output = next((n for n in tree.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
    if output is None or not output.inputs["Surface"].is_linked:
        return False
    surface = output.inputs["Surface"].links[0].from_socket
    translucent = tree.nodes.new("ShaderNodeBsdfTranslucent")
    base = node.inputs["Base Color"]
    weight = amount if mode == "add" else 1.0
    if base.is_linked:
        scale = tree.nodes.new("ShaderNodeVectorMath")
        scale.operation = "SCALE"
        scale.inputs["Scale"].default_value = weight
        tree.links.new(base.links[0].from_socket, scale.inputs[0])
        tree.links.new(scale.outputs["Vector"], translucent.inputs["Color"])
    else:
        r, g, b, alpha = base.default_value
        translucent.inputs["Color"].default_value = (r * weight, g * weight, b * weight, alpha)
    if mode == "add":
        combine = tree.nodes.new("ShaderNodeAddShader")
        tree.links.new(surface, combine.inputs[0])
        tree.links.new(translucent.outputs[0], combine.inputs[1])
    else:
        combine = tree.nodes.new("ShaderNodeMixShader")
        combine.inputs[0].default_value = amount
        tree.links.new(surface, combine.inputs[1])
        tree.links.new(translucent.outputs[0], combine.inputs[2])
    tree.links.new(combine.outputs[0], output.inputs["Surface"])
    return True


def prepare_materials(manifest: dict) -> dict:
    stats = {"glass": 0, "doors": 0, "shades": 0, "translucent": 0}
    night = manifest["lighting"]["preset"] == "night"
    for material in bpy.data.materials:
        role = material_role(material)
        if role == "glass":
            make_architectural_glass(material)
            stats["glass"] += 1
        elif role == "door":
            node = principled(material)
            if node is not None:
                set_input(node, ("Alpha",), 1.0)
            if hasattr(material, "surface_render_method"):
                material.surface_render_method = "DITHERED"
            stats["doors"] += 1
        elif role == "lampshade" and night:
            make_glowing_shade(material, 2700)
            stats["shades"] += 1
        if role in TRANSLUCENCY and add_translucency(material, *TRANSLUCENCY[role]):
            stats["translucent"] += 1
    return stats


def assign_pass_indices() -> dict:
    ids: dict[str, int] = {}
    objects: dict[int, dict] = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        tag = atelier_tag(obj)
        if tag is None:
            continue
        atelier_id, kind_type, kind = tag
        if atelier_id not in ids:
            ids[atelier_id] = len(ids) + 1
            objects[ids[atelier_id]] = {"id": atelier_id, "type": kind_type, "kind": kind}
        obj.pass_index = ids[atelier_id]
    materials: dict[int, str] = {}
    for index, material in enumerate(bpy.data.materials, start=1):
        material.pass_index = index
        materials[index] = material.name
    return {"objects": objects, "materials": materials}


def world_bbox(objects) -> tuple[Vector, Vector] | None:
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    found = False
    for obj in objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
            found = True
    return (lo, hi) if found else None


def add_ceiling(manifest: dict, camera_z: float) -> bool:
    mode = manifest["lighting"]["ceiling"]
    height = manifest["project"]["wallHeight"]
    if mode == "off" or (mode == "auto" and camera_z >= height - 0.02):
        return False
    walls = [o for o in bpy.data.objects if o.type == "MESH" and (atelier_tag(o) or ("", "", ""))[1] == "wall"]
    box = world_bbox(walls)
    if box is None:
        return False
    lo, hi = box
    mesh = bpy.data.meshes.new("atelier_ceiling")
    thickness = 0.2
    x0, y0, x1, y1 = lo.x, lo.y, hi.x, hi.y
    z0, z1 = height, height + thickness
    verts = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("atelier_ceiling", mesh)
    bpy.context.scene.collection.objects.link(obj)
    material = bpy.data.materials.new("atelier:ceiling")
    material.use_nodes = True
    node = principled(material)
    set_input(node, ("Base Color",), (0.84, 0.83, 0.80, 1.0))
    set_input(node, ("Roughness",), 0.92)
    mesh.materials.append(material)
    return True


def setup_camera(manifest: dict) -> bpy.types.Object:
    progress("camera")
    cam_spec = manifest["camera"]
    render = manifest["render"]
    width, height = render["width"], render["height"]
    position = Vector(contract.to_blender(cam_spec["position"]))
    target = Vector(contract.to_blender(cam_spec["target"]))
    data = bpy.data.cameras.new("atelier_camera")
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 24.0
    fov_y = math.radians(cam_spec["fovY"])
    data.lens = data.sensor_height / (2.0 * math.tan(fov_y / 2.0))
    data.clip_start = cam_spec["near"]
    data.clip_end = cam_spec["far"]
    camera = bpy.data.objects.new("atelier_camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = position
    direction = target - position
    if cam_spec["verticals"] and abs(direction.normalized().z) < 0.95:
        # Two-point perspective: keep the camera level and shift the lens so the
        # target stays where the editor framed it. Vertical lines stay vertical.
        level = Vector((direction.x, direction.y, 0.0))
        camera.rotation_euler = level.to_track_quat("-Z", "Y").to_euler()
        pitch = math.atan2(direction.z, level.length)
        data.shift_y = math.tan(pitch) / math.tan(fov_y / 2.0) * 0.5 * (height / max(width, height))
        bpy.context.view_layer.update()
        from bpy_extras.object_utils import world_to_camera_view
        scene = bpy.context.scene
        scene.render.resolution_x, scene.render.resolution_y = width, height
        v = world_to_camera_view(scene, camera, target).y
        if abs(v - 0.5) > 1e-3 and abs(data.shift_y) > 1e-6:
            s1 = data.shift_y
            data.shift_y = 0.0
            bpy.context.view_layer.update()
            v0 = world_to_camera_view(scene, camera, target).y
            if abs(v - v0) > 1e-9:
                data.shift_y = s1 * (0.5 - v0) / (v - v0)
        data.shift_y = max(-2.0, min(2.0, data.shift_y))
    else:
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera
    return camera


def add_window_pull(tree, background, strength: float, ev: float) -> None:
    """Darken the sky only where it is *seen* (camera rays, also through glass or
    in a mirror-like reflection), never where it *lights* the room.

    A path that has not bounced off a diffuse surface and is not a shadow ray is a
    view of the exterior; diffuse bounces and light-sampling shadow rays keep the
    full sky, so interior illumination is identical to the unpulled render.
    """
    path = tree.nodes.new("ShaderNodeLightPath")
    lit = tree.nodes.new("ShaderNodeMath")  # max(shadow, diffuse ray)
    lit.operation = "MAXIMUM"
    tree.links.new(path.outputs["Is Shadow Ray"], lit.inputs[0])
    tree.links.new(path.outputs["Is Diffuse Ray"], lit.inputs[1])
    bounced = tree.nodes.new("ShaderNodeMath")  # diffuse depth > 0
    bounced.operation = "GREATER_THAN"
    tree.links.new(path.outputs["Diffuse Depth"], bounced.inputs[0])
    bounced.inputs[1].default_value = 0.5
    lighting = tree.nodes.new("ShaderNodeMath")
    lighting.operation = "MAXIMUM"
    tree.links.new(lit.outputs[0], lighting.inputs[0])
    tree.links.new(bounced.outputs[0], lighting.inputs[1])
    factor = tree.nodes.new("ShaderNodeMapRange")  # 0 → pulled strength, 1 → full strength
    factor.clamp = True
    tree.links.new(lighting.outputs[0], factor.inputs["Value"])
    factor.inputs["To Min"].default_value = strength * 2.0 ** -ev
    factor.inputs["To Max"].default_value = strength
    tree.links.new(factor.outputs["Result"], background.inputs["Strength"])


def setup_world(manifest: dict) -> dict:
    progress("lighting")
    lighting = manifest["lighting"]
    scene = bpy.context.scene
    world = bpy.data.worlds.new("atelier_world")
    scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputWorld")
    background = tree.nodes.new("ShaderNodeBackground")
    tree.links.new(background.outputs[0], out.inputs[0])
    sun_dir = Vector(contract.to_blender(lighting["sun"]["direction"])).normalized()
    info = {"world": "sky"}
    hdri = lighting.get("hdri")
    if hdri:
        path = HDRI_LIBRARY.get(hdri)
        if not path or not os.path.isfile(path):
            raise RenderFailure("missing_asset", f"El entorno HDRI '{hdri}' no está instalado en el motor.")
        env = tree.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(path, check_existing=True)
        tree.links.new(env.outputs[0], background.inputs["Color"])
        background.inputs["Strength"].default_value = lighting["sky"]["strength"]
        info["world"] = f"hdri:{hdri}"
    else:
        sky = tree.nodes.new("ShaderNodeTexSky")
        sky.sky_type = "NISHITA"
        sky.sun_disc = False  # the sun is a lamp so its shadows are controllable
        sky.sun_elevation = max(math.radians(1.0), math.asin(max(-1.0, min(1.0, sun_dir.z))))
        sky.sun_rotation = math.atan2(-sun_dir.x, sun_dir.y)
        sky.altitude = 100.0
        sky.air_density = 1.0
        sky.dust_density = 1.5
        sky.ozone_density = 1.0
        tree.links.new(sky.outputs[0], background.inputs["Color"])
        background.inputs["Strength"].default_value = lighting["sky"]["strength"]
        info["sunElevationDeg"] = round(math.degrees(sky.sun_elevation), 2)
        pull = lighting.get("windowPull", 0)
        if pull > 0:
            add_window_pull(tree, background, lighting["sky"]["strength"], pull)
            info["windowPullEV"] = pull
    if lighting["sun"]["strength"] > 0 and sun_dir.z > -0.05:
        lamp = bpy.data.lights.new("atelier_sun", type="SUN")
        lamp.energy = lighting["sun"]["strength"]
        lamp.angle = math.radians(lighting["sun"]["angle"])
        lamp.color = kelvin_to_rgb(lighting["sun"]["temperature"])
        sun = bpy.data.objects.new("atelier_sun", lamp)
        sun.rotation_euler = (-sun_dir).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(sun)
        info["sun"] = True
    return info


def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def inside_rooms(point: Vector, rooms: list[dict]) -> bool:
    # Blender (x, y) -> plan (x, -y)
    return any(point_in_polygon(point.x, -point.y, room["polygon"]) for room in rooms)


def add_window_portals(manifest: dict) -> int:
    """Light portals in window openings: guide sky sampling into the interior."""
    if manifest["lighting"].get("hdri") or not manifest["rooms"]:
        return 0
    groups: dict[str, list] = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        tag = atelier_tag(obj)
        if tag and tag[1] == "opening" and tag[2] == "window":
            groups.setdefault(tag[0], []).append(obj)
    count = 0
    for window_id, parts in groups.items():
        box = world_bbox(parts)
        if box is None:
            continue
        lo, hi = box
        size = hi - lo
        center = (lo + hi) / 2
        horizontal = Vector((size.x, size.y, 0.0))
        if horizontal.length < 0.2 or size.z < 0.2:
            continue
        along_x = size.x >= size.y
        normal = Vector((0.0, 1.0, 0.0)) if along_x else Vector((1.0, 0.0, 0.0))
        if not inside_rooms(center + normal * 0.5, manifest["rooms"]):
            normal = -normal
            if not inside_rooms(center + normal * 0.5, manifest["rooms"]):
                continue
        lamp = bpy.data.lights.new(f"atelier_portal_{count}", type="AREA")
        lamp.shape = "RECTANGLE"
        lamp.size = size.x if along_x else size.y
        lamp.size_y = size.z
        lamp.cycles.is_portal = True
        portal = bpy.data.objects.new(lamp.name, lamp)
        portal.location = center + normal * 0.06
        # Area lights emit along local -Z; the portal must face the interior.
        portal.rotation_euler = normal.to_track_quat("-Z", "Z").to_euler()
        bpy.context.scene.collection.objects.link(portal)
        count += 1
    return count


def add_interior_lights(manifest: dict) -> int:
    lighting = manifest["lighting"]
    count = 0
    for spec in lighting["interior"]:
        lamp = bpy.data.lights.new(f"atelier_lamp_{spec['id']}", type="POINT")
        lamp.energy = spec["power"]
        lamp.shadow_soft_size = spec["radius"]
        lamp.color = kelvin_to_rgb(spec["temperature"])
        obj = bpy.data.objects.new(lamp.name, lamp)
        obj.location = Vector(contract.to_blender(spec["position"]))
        bpy.context.scene.collection.objects.link(obj)
        count += 1
    # Day presets switch on the ceiling light of rooms without a window of their own (a bathroom
    # or hall would otherwise render black); at night every room gets a dim fill.
    lit = {spec["id"]: spec["power"] for spec in lighting.get("litRooms", [])}
    if lighting["roomLights"] or lit:
        height = manifest["project"]["wallHeight"]
        for room in manifest["rooms"]:
            if not lighting["roomLights"] and room["id"] not in lit:
                continue
            xs = [p[0] for p in room["polygon"]]
            ys = [p[1] for p in room["polygon"]]
            w, d = max(xs) - min(xs), max(ys) - min(ys)
            if w < 0.5 or d < 0.5:
                continue
            lamp = bpy.data.lights.new(f"atelier_room_{room['id']}", type="AREA")
            lamp.shape = "RECTANGLE"
            lamp.size, lamp.size_y = w * 0.35, d * 0.35
            # Dim ambient fill (≈1.5 W/m²): the floor lamps stay the key light at night.
            lamp.energy = lit.get(room["id"], 1.5 * w * d)
            lamp.color = kelvin_to_rgb(3200 if room["id"] not in lit else 5000)
            obj = bpy.data.objects.new(lamp.name, lamp)
            obj.location = Vector(((min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, height - 0.03))
            bpy.context.scene.collection.objects.link(obj)
            count += 1
    return count


def choose_device(requested: str) -> str:
    scene = bpy.context.scene
    scene.cycles.device = "CPU"
    if requested == "CPU":
        return "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except KeyError:
        return "CPU"
    order = [requested] if requested in {"OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"} else ["OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"]
    for backend in order:
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if not gpus:
            continue
        for device in prefs.devices:
            device.use = device.type == backend
        scene.cycles.device = "GPU"
        return f"{backend}:{gpus[0].name}"
    return "CPU"


def configure_render(manifest: dict, device: str) -> None:
    progress("configure")
    render_spec = manifest["render"]
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = render_spec["width"]
    scene.render.resolution_y = render_spec["height"]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    cycles = scene.cycles
    cycles.samples = render_spec["samples"]
    cycles.use_adaptive_sampling = True
    cycles.adaptive_threshold = QUALITY_THRESHOLDS.get(render_spec["quality"], 0.02)
    cycles.time_limit = render_spec["timeLimit"]
    cycles.use_denoising = render_spec["denoise"]
    if render_spec["denoise"]:
        cycles.denoiser = "OPENIMAGEDENOISE"
        cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
        if hasattr(cycles, "denoising_use_gpu"):
            cycles.denoising_use_gpu = device != "CPU"
    cycles.max_bounces = 12
    cycles.diffuse_bounces = 5
    cycles.glossy_bounces = 4
    cycles.transmission_bounces = 12
    cycles.transparent_max_bounces = 16
    cycles.caustics_reflective = False
    cycles.caustics_refractive = False
    cycles.blur_glossy = 1.0
    cycles.sample_clamp_indirect = 10.0
    if hasattr(cycles, "use_light_tree"):
        cycles.use_light_tree = True
    cycles.seed = 0  # reproducible noise pattern for comparable renders
    view = scene.view_settings
    try:
        view.view_transform = "AgX"
        view.look = "AgX - Medium High Contrast"
    except TypeError:
        try:
            view.look = "None"
        except TypeError:
            pass
    view.exposure = manifest["lighting"]["exposure"]
    if hasattr(view, "use_white_balance"):
        # Like a photographer at night: balance for warm tungsten so lamps read warm, not orange.
        night = manifest["lighting"]["preset"] == "night"
        view.use_white_balance = night
        if night:
            view.white_balance_temperature = 3800.0
            view.white_balance_tint = 0.0
    view.gamma = 1.0
    scene.display_settings.display_device = "sRGB"

    layer = scene.view_layers[0]
    passes = set(render_spec["passes"])
    layer.use_pass_z = "depth" in passes
    layer.use_pass_normal = "normal" in passes
    layer.use_pass_object_index = "object_id" in passes
    layer.use_pass_material_index = "material_id" in passes
    layer.use_pass_diffuse_color = "albedo" in passes


def image_stats(path: str) -> dict:
    image = bpy.data.images.load(path, check_existing=False)
    try:
        import numpy as np
        pixels = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(pixels)
        rgba = pixels.reshape(-1, 4)
        luminance = rgba[:, 0] * 0.2126 + rgba[:, 1] * 0.7152 + rgba[:, 2] * 0.0722
        return {
            "meanLuminance": round(float(luminance.mean()), 4),
            "clippedRatio": round(float((luminance > 0.995).mean()), 4),
            "blackRatio": round(float((luminance < 0.01).mean()), 4),
        }
    except Exception as exc:  # stats are diagnostic only
        return {"error": str(exc)}
    finally:
        bpy.data.images.remove(image)


def zone_stats(job_dir: str, ids: dict) -> dict | None:
    """Clipping split into the exterior seen through windows and the room itself.

    Uses the object-ID pass of passes.exr: a pixel belongs to the window zone when
    its first hit is a window opening (glass, frame). Returns None without that pass.
    """
    exr_path = os.path.join(job_dir, "passes.exr")
    if not os.path.isfile(exr_path):
        return None
    try:
        import numpy as np
        import OpenImageIO as oiio

        def read(path):
            handle = oiio.ImageInput.open(path)
            if handle is None:
                raise RuntimeError(oiio.geterror())
            try:
                return list(handle.spec().channelnames), np.asarray(handle.read_image(format="float"))
            finally:
                handle.close()

        names, exr = read(exr_path)
        channel = next((i for i, n in enumerate(names) if n.endswith("IndexOB.X")), None)
        if channel is None:
            return None
        index = np.rint(exr[:, :, channel]).astype(int)
        _, png = read(os.path.join(job_dir, "beauty.png"))
        luminance = png[:, :, 0] * 0.2126 + png[:, :, 1] * 0.7152 + png[:, :, 2] * 0.0722
        windows = [int(k) for k, v in ids["objects"].items() if v["type"] == "opening" and v["kind"] == "window"]
        mask = np.isin(index, windows)
        clipped = luminance > 0.995
        room = ~mask
        return {
            "windowRatio": round(float(mask.mean()), 4),
            "clippedWindow": round(float(clipped[mask].mean()), 4) if mask.any() else 0.0,
            "clippedInterior": round(float(clipped[room].mean()), 4) if room.any() else 0.0,
            "meanInterior": round(float(luminance[room].mean()), 4) if room.any() else 0.0,
            "meanWindow": round(float(luminance[mask].mean()), 4) if mask.any() else None,
        }
    except Exception as exc:  # diagnostic only
        return {"error": str(exc)}


def render(job_dir: str, manifest: dict) -> dict:
    scene = bpy.context.scene
    passes = set(manifest["render"]["passes"]) - {"beauty"}
    beauty = os.path.join(job_dir, "beauty.png")
    progress("render", samples=manifest["render"]["samples"])
    started = time.time()
    if passes:
        settings = scene.render.image_settings
        settings.file_format = "OPEN_EXR_MULTILAYER"
        settings.color_depth = "32"
        settings.exr_codec = "ZIP"
        scene.render.filepath = os.path.join(job_dir, "passes.exr")
        scene.render.use_file_extension = False
        bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(write_still=False)
    elapsed = time.time() - started
    progress("save")
    settings = scene.render.image_settings
    settings.file_format = "PNG"
    settings.color_mode = "RGB"
    settings.color_depth = "8"
    settings.compression = 15
    bpy.data.images["Render Result"].save_render(beauty, scene=scene)
    if not os.path.isfile(beauty):
        raise RenderFailure("render_failed", "Cycles no generó la imagen final.")
    return {"renderSeconds": round(elapsed, 2), "passesFile": "passes.exr" if passes else None}


def main() -> None:
    started = time.time()
    args = parse_args()
    job_dir = os.path.abspath(args["job_dir"])
    try:
        with open(os.path.join(job_dir, "scene.json"), "r", encoding="utf-8") as handle:
            manifest = contract.validate_manifest(json.load(handle))
        with open(os.path.join(job_dir, "scene.glb"), "rb") as handle:
            contract.check_glb(handle.read())
        import_geometry(job_dir)
        material_stats = prepare_materials(manifest)
        ids = assign_pass_indices()
        camera = setup_camera(manifest)
        ceiling = add_ceiling(manifest, camera.location.z)
        world = setup_world(manifest)
        portals = add_window_portals(manifest)
        interior = add_interior_lights(manifest)
        device = choose_device(args["device"])
        configure_render(manifest, device)
        with open(os.path.join(job_dir, "ids.json"), "w", encoding="utf-8") as handle:
            json.dump(ids, handle, ensure_ascii=False, indent=1)
        timings = render(job_dir, manifest)
        stats = image_stats(os.path.join(job_dir, "beauty.png"))
        zones = zone_stats(job_dir, ids)
        if zones:
            stats["zones"] = zones
        result = {
            "status": "succeeded",
            "blender": bpy.app.version_string,
            "device": device,
            "width": manifest["render"]["width"],
            "height": manifest["render"]["height"],
            "samples": manifest["render"]["samples"],
            "quality": manifest["render"]["quality"],
            "lighting": manifest["lighting"]["preset"],
            "world": world,
            "ceiling": ceiling,
            "portals": portals,
            "interiorLights": interior,
            "materials": material_stats,
            "objects": len(ids["objects"]),
            "outputs": ["beauty.png"] + ([timings["passesFile"]] if timings["passesFile"] else []),
            "renderSeconds": timings["renderSeconds"],
            "totalSeconds": round(time.time() - started, 2),
            "image": stats,
        }
        with open(os.path.join(job_dir, "result.json"), "w", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=1)
        progress("done", seconds=result["totalSeconds"])
    except (RenderFailure, contract.PackageError) as exc:
        write_error(job_dir, exc.code, exc.message)
        sys.exit(1)
    except Exception as exc:  # unexpected: keep the traceback for the logs
        write_error(job_dir, "internal_error", f"Error interno del motor: {exc}", traceback.format_exc())
        sys.exit(1)


def write_error(job_dir: str, code: str, message: str, trace: str | None = None) -> None:
    payload = {"status": "failed", "code": code, "message": message}
    if trace:
        payload["traceback"] = trace[-4000:]
    try:
        with open(os.path.join(job_dir, "error.json"), "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=1)
    finally:
        print(f"ATELIER_ERROR code={code} {message}", flush=True)


if __name__ == "__main__":
    main()
