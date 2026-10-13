"""
Headless Blender cut of the KTM 450 EXC GLB.

Always reads ktm-450-exc.src.glb. Separates named controls, deletes Glass,
builds a flat MX number board, and removes rear mud flap / kickstand /
peg-return by linked-face growth — never AABB-gouges shrouds or fenders.
"""

from __future__ import annotations

import os
import shutil
import sys
import time

import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, "public", "models")
SRC = os.path.join(MODELS, "ktm-450-exc.src.glb")
DST = os.path.join(MODELS, "ktm-450-exc.glb")

# Nardo grey (matches lib/mxb/finish.ts NARDO)
NARDO = (0x6E / 255.0, 0x71 / 255.0, 0x6C / 255.0, 1.0)

CONTROLS = ("clutch_lever", "brake_lever", "shift_lever", "rear_brake_pedal")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)


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
    return (mn + mx) * 0.5, mx - mn, mn, mx


def face_world_center(mw, face):
    return mw @ (sum((v.co for v in face.verts), Vector()) / len(face.verts))


def edit_faces(obj, drop_face):
    """Delete faces matching a predicate (used only for tiny peg-return clips)."""
    mw = obj.matrix_world
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    doomed = [f for f in bm.faces if drop_face(face_world_center(mw, f), f)]
    n = len(doomed)
    if n:
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bm.to_mesh(me)
        me.update()
    bm.free()
    return n


def delete_linked_from_seeds(obj, seed_face, max_faces=8000):
    """
    Grow from seed faces over shared edges and delete the connected shell.
    Avoids AABB boxes that gouge welded shrouds/fenders.
    """
    mw = obj.matrix_world
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bm.edges.ensure_lookup_table()

    seeds = [f for f in bm.faces if seed_face(face_world_center(mw, f), f)]
    if not seeds:
        bm.free()
        return 0

    seen = set()
    stack = list(seeds)
    for f in seeds:
        seen.add(f.index)

    while stack:
        face = stack.pop()
        for edge in face.edges:
            for link in edge.link_faces:
                if link.index in seen:
                    continue
                seen.add(link.index)
                stack.append(link)
                if len(seen) > max_faces:
                    break
            if len(seen) > max_faces:
                break
        if len(seen) > max_faces:
            print(f"WARNING: linked grow hit {max_faces} on {obj.name}; aborting delete")
            bm.free()
            return 0

    doomed = [bm.faces[i] for i in seen]
    n = len(doomed)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(me)
    me.update()
    bm.free()
    return n


def separate_by_ops(obj, select_face, new_name):
    if obj.name == new_name:
        return obj
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")

    mw = obj.matrix_world
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    count = 0
    for f in bm.faces:
        c = face_world_center(mw, f)
        f.select = bool(select_face(c, f))
        if f.select:
            count += 1
    if count == 0:
        bm.free()
        return None
    bm.to_mesh(me)
    bm.free()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    created = next((o for o in bpy.context.selected_objects if o != obj and o.type == "MESH"), None)
    if created:
        created.name = new_name
        created.data.name = new_name
        print(f"Separated {new_name}: {count} faces")
    return created


def ensure_controls():
    """Peel levers off shared shells. Abort if any named control is missing."""
    for obj in list(bpy.data.objects):
        if mat_name(obj) == "Dark_Metal" and obj.name != "clutch_lever":
            if separate_by_ops(
                obj,
                lambda w, f: w.z > 0.88 and w.x < -0.15 and -0.5 < w.y < -0.25 and f.calc_area() < 0.002,
                "clutch_lever",
            ):
                break
    for obj in list(bpy.data.objects):
        if mat_name(obj) == "Dark_Plastics" and obj.name != "brake_lever":
            if separate_by_ops(
                obj,
                lambda w, f: w.z > 0.85 and w.x > 0.15 and -0.45 < w.y < -0.2 and f.calc_area() < 0.0015,
                "brake_lever",
            ):
                break
    for obj in list(bpy.data.objects):
        if mat_name(obj) == "Dark_Metal" and obj.name not in ("clutch_lever", "shift_lever"):
            if separate_by_ops(
                obj,
                lambda w, f: 0.08 < w.z < 0.22 and w.x < -0.12 and 0.05 < w.y < 0.28 and f.calc_area() < 0.0012,
                "shift_lever",
            ):
                break
    for obj in list(bpy.data.objects):
        if mat_name(obj) == "Dull_Aluminium" and obj.name != "rear_brake_pedal":
            if separate_by_ops(
                obj,
                lambda w, f: 0.08 < w.z < 0.25 and w.x > 0.08 and 0.05 < w.y < 0.28 and f.calc_area() < 0.0008,
                "rear_brake_pedal",
            ):
                break

    missing = [n for n in CONTROLS if not bpy.data.objects.get(n)]
    if missing:
        print("ERROR: failed to separate controls:", ", ".join(missing))
        sys.exit(2)


def add_front_plate(glass_c, glass_size):
    """Flat MX number board in the former lens opening. Faces −Y (bike forward)."""
    for o in list(bpy.data.objects):
        if o.name.startswith("front_plate"):
            bpy.data.objects.remove(o, do_unlink=True)

    # Board large enough to cover the street scoop mouth; thick enough to read
    # as a plate from the garage camera (not a paper-thin sliver).
    width = max(0.22, min(0.32, glass_size.x * 1.6 if glass_size.x > 0.01 else 0.26))
    height = max(0.24, min(0.38, glass_size.z * 1.7 if glass_size.z > 0.01 else 0.3))
    depth = 0.018
    # Nudge slightly forward (−Y) so it sits in front of the scoop recess.
    loc = Vector((glass_c.x * 0.15, glass_c.y - 0.02, glass_c.z + 0.01))

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    plate = bpy.context.active_object
    plate.name = "front_plate"
    plate.data.name = "front_plate"
    plate.scale = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    plate.name = "front_plate"
    plate.data.name = "front_plate"

    mat = bpy.data.materials.new(name="Front_Plate")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = NARDO
        bsdf.inputs["Roughness"].default_value = 0.9
        bsdf.inputs["Metallic"].default_value = 0.04
    if plate.data.materials:
        plate.data.materials[0] = mat
    else:
        plate.data.materials.append(mat)

    print(f"front_plate at {glass_c} size {width:.3f}x{height:.3f}")
    return plate


def write_dst():
    tmp = DST + ".tmp.glb"
    if os.path.isfile(tmp):
        os.remove(tmp)
    bpy.ops.export_scene.gltf(filepath=tmp, export_format="GLB", use_selection=False, export_apply=True)
    for _ in range(10):
        try:
            if os.path.isfile(DST):
                os.remove(DST)
            shutil.move(tmp, DST)
            print("Wrote", DST)
            return
        except OSError as err:
            print("Retry:", err)
            time.sleep(0.5)
    print("WARNING: left", tmp)


def main():
    if not os.path.isfile(SRC):
        print("ERROR: missing", SRC)
        sys.exit(1)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=SRC)

    # Drop any leftover board from a previous edit of the source (should not exist).
    for o in list(bpy.data.objects):
        if o.name.startswith("front_plate"):
            bpy.data.objects.remove(o, do_unlink=True)

    # Orient check: seat should be rear (+Y), tank forward (−Y) on this import.
    seat = next((o for o in bpy.data.objects if o.type == "MESH" and mat_name(o) == "Black_Seat"), None)
    tank = next((o for o in bpy.data.objects if o.type == "MESH" and mat_name(o) == "Fuel_Tank"), None)
    if seat and tank:
        sc, _, _, _ = world_center(seat)
        tc, _, _, _ = world_center(tank)
        print(f"Seat center {sc}, tank center {tc} (rear should be +Y vs tank)")
        if not (sc.y > tc.y):
            print("WARNING: unexpected forward axis — mud-flap seeds may miss")

    ensure_controls()

    glass = next((o for o in bpy.data.objects if o.type == "MESH" and mat_name(o) == "Glass"), None)
    glass_c = Vector((0.09, -0.47, 0.70))
    glass_size = Vector((0.16, 0.05, 0.2))
    if glass:
        glass_c, glass_size, _, _ = world_center(glass)
        print("Glass", glass_c, "size", glass_size)
        bpy.data.objects.remove(glass, do_unlink=True)
    else:
        print("WARNING: no Glass object; using default plate placement")

    add_front_plate(glass_c, glass_size)

    protected = set(CONTROLS) | {"front_plate"}

    for obj in list(bpy.data.objects):
        if obj.type != "MESH" or obj.name in protected:
            continue
        name = mat_name(obj)

        if name == "Dark_Plastics":
            # Rear mud flap is welded into Dark_Plastics — linked grow eats the
            # whole shell. Delete only the thin rear (+Y) vertical strip.
            print(
                "mud flap",
                edit_faces(
                    obj,
                    lambda w, f: (
                        w.y > 0.58
                        and 0.42 < w.z < 0.82
                        and abs(w.x) < 0.055
                        and f.calc_area() < 0.015
                    ),
                ),
            )

            # Peg-return rubber strap near left peg — tiny faces only.
            print(
                "peg return",
                edit_faces(
                    obj,
                    lambda w, f: (
                        0.05 < w.y < 0.2
                        and 0.12 < w.z < 0.2
                        and -0.2 < w.x < -0.13
                        and f.calc_area() < 0.00035
                    ),
                ),
            )

        if name == "Steel":
            # Kickstand is welded into Steel — linked grow eats the engine.
            # Delete only left-low dangling faces in a tight volume.
            print(
                "steel kickstand",
                edit_faces(
                    obj,
                    lambda w, f: (
                        w.x < -0.1
                        and w.z < 0.1
                        and 0.0 < w.y < 0.32
                        and f.calc_area() < 0.0035
                    ),
                ),
            )

        if name == "Dark_Metal":
            n_dm = delete_linked_from_seeds(
                obj,
                lambda w, f: (
                    w.x < -0.12
                    and w.z < 0.12
                    and 0.0 < w.y < 0.22
                    and f.calc_area() < 0.0012
                ),
                max_faces=120,
            )
            print("dark kickstand linked", n_dm)

    for name in (*CONTROLS, "Glass", "front_plate"):
        print(("OK" if bpy.data.objects.get(name) else "GONE"), name)

    if not bpy.data.objects.get("front_plate"):
        print("ERROR: front_plate missing after build")
        sys.exit(3)
    for name in CONTROLS:
        if not bpy.data.objects.get(name):
            print("ERROR: control missing after cut:", name)
            sys.exit(2)

    write_dst()


if __name__ == "__main__":
    main()
