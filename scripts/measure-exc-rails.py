"""Measure Orange_Metal rail underside in prepareExcBike space. Blender Z-up → Y-up."""

from __future__ import annotations

import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "public", "models", "ktm-450-exc.glb")


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def mat_name(obj):
    if not obj.data or not obj.data.materials:
        return ""
    m = obj.data.materials[0]
    return m.name if m else ""


def world_center(obj):
    mw = obj.matrix_world
    bb = [mw @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    return (mn + mx) * 0.5


def main():
    if not os.path.isfile(GLB):
        print("missing", GLB)
        sys.exit(1)
    clear()
    bpy.ops.import_scene.gltf(filepath=GLB)

    # glTF import is Z-up. App uses Y-up (+Z forward). Match prepareExcBike on the
    # Three.js scene after loader converts Z-up→Y-up: (x,y,z)_app = (x,z,-y)_blender
    # Apply the same lean/yaw/ground in blender after converting vertices.

    seat = next((o for o in bpy.data.objects if o.type == "MESH" and mat_name(o) == "Black_Seat"), None)
    tank = next((o for o in bpy.data.objects if o.type == "MESH" and mat_name(o) == "Fuel_Tank"), None)
    frame = next((o for o in bpy.data.objects if o.type == "MESH" and mat_name(o) == "Orange_Metal"), None)
    if not frame:
        print("no Orange_Metal")
        sys.exit(1)

    # Collect frame verts in app space (Y-up, +Z forward).
    verts = []
    mw = frame.matrix_world
    for v in frame.data.vertices:
        w = mw @ v.co
        # Blender Z-up/−Y forward → app Y-up/+Z forward
        app = Vector((w.x, w.z, -w.y))
        verts.append(app)

    # Lean undo: rotate +0.11 about Z (app).
    lean = Matrix.Rotation(0.11, 4, "Z")
    verts = [lean @ v.to_4d() for v in verts]
    verts = [Vector(v.xyz) for v in verts]

    if seat and tank:
        def app_center(obj):
            c = world_center(obj)
            return lean @ Vector((c.x, c.z, -c.y))

        g = app_center(tank)
        s = app_center(seat)
        dir_x = g.x - s.x
        dir_z = g.z - s.z
        if dir_x * dir_x + dir_z * dir_z > 1e-6:
            yaw = -math.atan2(dir_x, dir_z)
            ry = Matrix.Rotation(yaw, 4, "Y")
            verts = [Vector((ry @ v.to_4d()).xyz) for v in verts]
            print(f"yaw {yaw:.4f}")

    min_y = min(v.y for v in verts)
    cx = sum(v.x for v in verts) / len(verts)
    cz = sum(v.z for v in verts) / len(verts)
    # Ground + center like prepareExcBike (uses full root center; approximate with frame).
    verts = [Vector((v.x - cx, v.y - min_y, v.z - cz)) for v in verts]
    print(f"grounded min_y was {min_y:.4f}, n={len(verts)}")

    zs = [-0.2, -0.15, -0.1, 0.05, 0.08, 0.1]
    for z in zs:
        slice_v = [v for v in verts if abs(v.z - z) <= 0.025 and abs(v.x) >= 0.08]
        if not slice_v:
            print(f"{{ z: {z}, x: null, y: null }}")
            continue
        min_rail_y = min(v.y for v in slice_v)
        max_abs_x = max(abs(v.x) for v in slice_v if abs(v.y - min_rail_y) < 0.02)
        print(f"{{ z: {z}, x: {max_abs_x:.3f}, y: {min_rail_y:.3f} }}")

    for name in ("front_plate", "clutch_lever", "brake_lever", "shift_lever", "rear_brake_pedal", "Glass"):
        print(("OK" if bpy.data.objects.get(name) else "GONE"), name)


if __name__ == "__main__":
    main()
