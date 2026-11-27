# Captura de Blender para MANUAL.md: importa un scene.glb y guarda la ventana en Vista previa de material.
# Uso: blender --factory-startup --python scripts/blender-manual-screenshot.py -- <scene.glb> <salida.png>
import sys
import bpy

glb, out = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.context.preferences.view.show_splash = False

for obj in list(bpy.data.objects):  # escena vacía, como tras borrar el cubo inicial
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=glb)
for obj in bpy.context.selected_objects:
    obj.select_set(False)


def area_3d():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                return window, area
    return None, None


def prepare():
    window, area = area_3d()
    region = next(r for r in area.regions if r.type == 'WINDOW')
    space = area.spaces.active
    space.shading.type = 'MATERIAL'
    space.overlay.show_floor = True
    space.overlay.show_extras = False  # sin líneas de luces y cámaras
    r3d = space.region_3d
    r3d.view_perspective = 'PERSP'
    # Vista desde arriba en diagonal, centrada en la vivienda
    from mathutils import Vector
    pts = [o.matrix_world @ Vector(c) for o in bpy.context.scene.objects if o.type == 'MESH' and max(o.dimensions) < 40 for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (lo + hi) / 2
    size = max(hi.x - lo.x, hi.y - lo.y)
    eye = center + Vector((-0.55, -0.9, 1.0)) * size * 0.75
    r3d.view_location = center
    r3d.view_rotation = (eye - center).to_track_quat('Z', 'Y')
    r3d.view_distance = (eye - center).length * 1.25
    return None


def capture():
    window, area = area_3d()
    with bpy.context.temp_override(window=window):
        bpy.ops.screen.screenshot(filepath=out)
    bpy.ops.wm.quit_blender()
    return None


bpy.app.timers.register(prepare, first_interval=2.0)
bpy.app.timers.register(capture, first_interval=25.0)
