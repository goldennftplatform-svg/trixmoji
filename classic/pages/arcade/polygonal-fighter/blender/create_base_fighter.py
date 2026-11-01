"""
Blender script: build the VF '93 style base fighter with armature.

Run (once Blender is installed):
  blender --background --python create_base_fighter.py

Or open Blender → Scripting → Open this file → Run Script.

Outputs:
  ../models/base_fighter.blend
  ../models/base_fighter.glb
  ../models/base_fighter.obj  (also regenerated)
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
MODELS = ROOT / "models"
MODELS.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Reset scene
# ---------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
# Blender 3/4: clear default cube if present
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mat(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    # Blender 5+: prefer node tree without deprecated flag when possible
    if not mat.use_nodes:
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    # Principled, fully rough — flat VF-era look
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.0
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mat.diffuse_color = (*color, 1.0)
    return mat


def add_box(
    name: str,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    rot_euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rot_euler
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    # Flat shading
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


# Colors
SKIN = (0.78, 0.62, 0.48)
CLOTH_DARK = (0.22, 0.24, 0.30)
CLOTH_MID = (0.35, 0.38, 0.45)
CLOTH_LIGHT = (0.55, 0.58, 0.65)
ACCENT = (0.70, 0.18, 0.16)
HAIR = (0.12, 0.10, 0.10)

mats = {
    "skin": make_mat("skin", SKIN),
    "cloth_dark": make_mat("cloth_dark", CLOTH_DARK),
    "cloth_mid": make_mat("cloth_mid", CLOTH_MID),
    "cloth_light": make_mat("cloth_light", CLOTH_LIGHT),
    "accent": make_mat("accent", ACCENT),
    "hair": make_mat("hair", HAIR),
}

parts: list[bpy.types.Object] = []

# Body
parts.append(add_box("pelvis", (0, 0, 0.98), (0.30, 0.18, 0.16), mats["cloth_dark"]))
parts.append(add_box("torso", (0, 0, 1.24), (0.32, 0.17, 0.36), mats["cloth_mid"]))
parts.append(add_box("chest", (0, 0, 1.48), (0.44, 0.20, 0.16), mats["cloth_light"]))
parts.append(add_box("belt", (0, 0, 1.06), (0.32, 0.19, 0.05), mats["accent"]))
parts.append(add_box("neck", (0, 0, 1.58), (0.10, 0.10, 0.08), mats["skin"]))
parts.append(add_box("head", (0, 0.02, 1.70), (0.18, 0.18, 0.22), mats["skin"]))
parts.append(add_box("hair", (0, 0, 1.80), (0.19, 0.19, 0.06), mats["hair"]))
parts.append(add_box("jaw", (0, 0.06, 1.60), (0.12, 0.10, 0.06), mats["skin"]))

# Arms A-pose (~28 deg)
tilt = math.radians(28.0)
for side, sign in (("l", 1.0), ("r", -1.0)):
    parts.append(
        add_box(
            f"shoulder_{side}",
            (sign * 0.26, 0, 1.48),
            (0.12, 0.12, 0.12),
            mats["skin"],
        )
    )
    # upper arm
    parts.append(
        add_box(
            f"upper_arm_{side}",
            (sign * 0.42, 0, 1.40),
            (0.28, 0.09, 0.09),
            mats["skin"],
            rot_euler=(0, 0, -tilt if side == "l" else tilt),
        )
    )
    parts.append(
        add_box(
            f"lower_arm_{side}",
            (sign * 0.60, 0, 1.26),
            (0.26, 0.08, 0.08),
            mats["skin"],
            rot_euler=(0, 0, -tilt if side == "l" else tilt),
        )
    )
    parts.append(
        add_box(
            f"hand_{side}",
            (sign * 0.74, 0, 1.16),
            (0.10, 0.08, 0.06),
            mats["skin"],
            rot_euler=(0, 0, -tilt if side == "l" else tilt),
        )
    )

# Legs
for side, sign in (("l", 1.0), ("r", -1.0)):
    x = sign * 0.10
    parts.append(add_box(f"upper_leg_{side}", (x, 0, 0.76), (0.12, 0.14, 0.36), mats["cloth_dark"]))
    parts.append(add_box(f"knee_{side}", (x, 0.02, 0.54), (0.11, 0.12, 0.10), mats["cloth_mid"]))
    parts.append(add_box(f"lower_leg_{side}", (x, 0, 0.32), (0.10, 0.12, 0.34), mats["cloth_mid"]))
    parts.append(add_box(f"foot_{side}", (x, 0.06, 0.06), (0.11, 0.24, 0.08), mats["cloth_dark"]))

# ---------------------------------------------------------------------------
# Join into single mesh "BaseFighter"
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.active_object
body.name = "BaseFighter"
body.data.name = "BaseFighter_Mesh"

# Clean mesh for valid glTF export
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.0001)
try:
    bpy.ops.mesh.dissolve_degenerate(threshold=0.0001)
except Exception:
    pass
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
bpy.ops.object.mode_set(mode="OBJECT")
body.data.validate(verbose=False)
body.data.update()

# Flat shade whole mesh
for poly in body.data.polygons:
    poly.use_smooth = False

# Origin at world ground center (feet)
bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
body.location = (0.0, 0.0, 0.0)

# ---------------------------------------------------------------------------
# Simple fighting-game armature (stick figure bones)
# ---------------------------------------------------------------------------

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.active_object
arm_obj.name = "BaseFighter_Rig"
arm = arm_obj.data
arm.name = "BaseFighter_Armature"

# Remove default bone
edit_bones = arm.edit_bones
for b in list(edit_bones):
    edit_bones.remove(b)


def bone(name: str, head: tuple, tail: tuple, parent: str | None = None):
    b = edit_bones.new(name)
    b.head = Vector(head)
    b.tail = Vector(tail)
    if parent:
        b.parent = edit_bones[parent]
        b.use_connect = False
    return b


# Blender default is Z-up in newer, but Y-forward Z-up is Blender standard.
# Our mesh was built Y-up in the pure Python exporter; in Blender cubes we used
# Z-up (Blender native). Bones match the Blender mesh (Z-up).

bone("root", (0, 0, 0), (0, 0, 0.1))
bone("hips", (0, 0, 0.98), (0, 0, 1.10), "root")
bone("spine", (0, 0, 1.10), (0, 0, 1.36), "hips")
bone("chest", (0, 0, 1.36), (0, 0, 1.52), "spine")
bone("neck", (0, 0, 1.52), (0, 0, 1.62), "chest")
bone("head", (0, 0, 1.62), (0, 0, 1.82), "neck")

bone("shoulder_l", (0.12, 0, 1.48), (0.26, 0, 1.48), "chest")
bone("upper_arm_l", (0.26, 0, 1.48), (0.50, 0, 1.34), "shoulder_l")
bone("lower_arm_l", (0.50, 0, 1.34), (0.70, 0, 1.18), "upper_arm_l")
bone("hand_l", (0.70, 0, 1.18), (0.80, 0, 1.12), "lower_arm_l")

bone("shoulder_r", (-0.12, 0, 1.48), (-0.26, 0, 1.48), "chest")
bone("upper_arm_r", (-0.26, 0, 1.48), (-0.50, 0, 1.34), "shoulder_r")
bone("lower_arm_r", (-0.50, 0, 1.34), (-0.70, 0, 1.18), "upper_arm_r")
bone("hand_r", (-0.70, 0, 1.18), (-0.80, 0, 1.12), "lower_arm_r")

bone("upper_leg_l", (0.10, 0, 0.98), (0.10, 0, 0.54), "hips")
bone("lower_leg_l", (0.10, 0, 0.54), (0.10, 0, 0.10), "upper_leg_l")
bone("foot_l", (0.10, 0, 0.10), (0.10, 0.12, 0.02), "lower_leg_l")

bone("upper_leg_r", (-0.10, 0, 0.98), (-0.10, 0, 0.54), "hips")
bone("lower_leg_r", (-0.10, 0, 0.54), (-0.10, 0, 0.10), "upper_leg_r")
bone("foot_r", (-0.10, 0, 0.10), (-0.10, 0.12, 0.02), "lower_leg_r")

bpy.ops.object.mode_set(mode="OBJECT")

# Parent mesh to armature with automatic weights
body.select_set(True)
arm_obj.select_set(True)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

# ---------------------------------------------------------------------------
# Collection hygiene
# ---------------------------------------------------------------------------

col = bpy.data.collections.new("BaseFighter_Collection")
bpy.context.scene.collection.children.link(col)
for obj in (body, arm_obj):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)

# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

blend_path = MODELS / "base_fighter.blend"
glb_path = MODELS / "base_fighter.glb"
obj_path = MODELS / "base_fighter_blender.obj"

bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

# glTF
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    use_selection=False,
    export_apply=True,
)

# OBJ
if hasattr(bpy.ops.wm, "obj_export"):
    bpy.ops.wm.obj_export(filepath=str(obj_path), export_selected_objects=False)
else:
    bpy.ops.export_scene.obj(filepath=str(obj_path), use_selection=False)

print("Saved:", blend_path)
print("Saved:", glb_path)
print("Saved:", obj_path)
print("Base fighter ready — low-poly A-pose + armature.")
