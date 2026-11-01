"""
Create Tier A pose Action stubs on base_fighter.blend (keyframe scaffolds).

Does NOT invent full anim polish — sets readable key poses on the rig so
you can refine in Blender Pose Mode.

Run:
  blender --background models/base_fighter.blend --python blender/create_tier_a_pose_stubs.py

Or from project root with absolute paths (see launch note at bottom).
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Euler

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
BLEND = ROOT / "models" / "base_fighter.blend"
OUT_BLEND = ROOT / "models" / "base_fighter.blend"
OUT_GLB = ROOT / "models" / "base_fighter_poses.glb"

# Tier A pose ids (match poses/pose-registry.js)
TIER_A = [
    "idle",
    "idleBreath",
    "walkForward1",
    "walkForward2",
    "walkBackward1",
    "walkBackward2",
    "crouch",
    "jump",
    "jumpPeak",
    "falling",
    "blockHigh",
    "blockLow",
    "hitStun",
    "crouchHitStun",
    "knockdown",
    "getUp",
    "jab",
    "medPunch",
    "lowKick",
    "medKick",
    "special1",
    "throw",
    "thrown",
    "victory",
    "defeat",
]

# Bone rotation offsets (radians) relative to rest — approximate VF-style keys
# Format: pose_id -> { bone_name: (x, y, z) euler }
POSE_OFFSETS: dict[str, dict[str, tuple[float, float, float]]] = {
    "idle": {},
    "idleBreath": {
        "chest": (0.03, 0.0, 0.0),
        "spine": (0.02, 0.0, 0.0),
    },
    "walkForward1": {
        "upper_leg_l": (-0.45, 0.0, 0.0),
        "lower_leg_l": (0.35, 0.0, 0.0),
        "upper_leg_r": (0.35, 0.0, 0.0),
        "lower_leg_r": (0.15, 0.0, 0.0),
        "upper_arm_l": (0.0, 0.0, -0.25),
        "upper_arm_r": (0.0, 0.0, 0.25),
    },
    "walkForward2": {
        "upper_leg_l": (0.35, 0.0, 0.0),
        "lower_leg_l": (0.15, 0.0, 0.0),
        "upper_leg_r": (-0.45, 0.0, 0.0),
        "lower_leg_r": (0.35, 0.0, 0.0),
        "upper_arm_l": (0.0, 0.0, 0.25),
        "upper_arm_r": (0.0, 0.0, -0.25),
    },
    "walkBackward1": {
        "upper_leg_l": (0.25, 0.0, 0.0),
        "upper_leg_r": (-0.3, 0.0, 0.0),
        "upper_arm_l": (0.0, 0.0, 0.15),
        "upper_arm_r": (0.0, 0.0, -0.15),
        "chest": (0.05, 0.0, 0.0),
    },
    "walkBackward2": {
        "upper_leg_l": (-0.3, 0.0, 0.0),
        "upper_leg_r": (0.25, 0.0, 0.0),
        "upper_arm_l": (0.0, 0.0, -0.15),
        "upper_arm_r": (0.0, 0.0, 0.15),
        "chest": (0.05, 0.0, 0.0),
    },
    "crouch": {
        "hips": (0.15, 0.0, 0.0),
        "upper_leg_l": (-0.9, 0.0, 0.08),
        "upper_leg_r": (-0.9, 0.0, -0.08),
        "lower_leg_l": (1.2, 0.0, 0.0),
        "lower_leg_r": (1.2, 0.0, 0.0),
        "spine": (0.2, 0.0, 0.0),
        "upper_arm_l": (0.0, 0.0, -0.4),
        "upper_arm_r": (0.0, 0.0, 0.4),
    },
    "jump": {
        "upper_leg_l": (-0.6, 0.0, 0.1),
        "upper_leg_r": (-0.6, 0.0, -0.1),
        "lower_leg_l": (0.8, 0.0, 0.0),
        "lower_leg_r": (0.8, 0.0, 0.0),
        "upper_arm_l": (-0.8, 0.0, -0.3),
        "upper_arm_r": (-0.8, 0.0, 0.3),
    },
    "jumpPeak": {
        "upper_leg_l": (-0.4, 0.0, 0.15),
        "upper_leg_r": (-0.4, 0.0, -0.15),
        "lower_leg_l": (0.5, 0.0, 0.0),
        "lower_leg_r": (0.5, 0.0, 0.0),
        "upper_arm_l": (-0.5, 0.0, -0.5),
        "upper_arm_r": (-0.5, 0.0, 0.5),
    },
    "falling": {
        "upper_leg_l": (-0.2, 0.0, 0.0),
        "upper_leg_r": (-0.25, 0.0, 0.0),
        "lower_leg_l": (0.35, 0.0, 0.0),
        "lower_leg_r": (0.4, 0.0, 0.0),
        "upper_arm_l": (0.3, 0.0, -0.2),
        "upper_arm_r": (0.3, 0.0, 0.2),
        "spine": (0.1, 0.0, 0.0),
    },
    "blockHigh": {
        "upper_arm_l": (-1.1, 0.0, -0.6),
        "lower_arm_l": (0.0, 1.2, 0.0),
        "upper_arm_r": (-1.1, 0.0, 0.6),
        "lower_arm_r": (0.0, -1.2, 0.0),
        "chest": (0.08, 0.0, 0.0),
    },
    "blockLow": {
        "hips": (0.12, 0.0, 0.0),
        "upper_leg_l": (-0.7, 0.0, 0.05),
        "upper_leg_r": (-0.7, 0.0, -0.05),
        "lower_leg_l": (1.0, 0.0, 0.0),
        "lower_leg_r": (1.0, 0.0, 0.0),
        "upper_arm_l": (-0.4, 0.0, -0.5),
        "upper_arm_r": (-0.4, 0.0, 0.5),
        "lower_arm_l": (0.0, 0.9, 0.0),
        "lower_arm_r": (0.0, -0.9, 0.0),
    },
    "hitStun": {
        "spine": (-0.15, 0.0, 0.2),
        "chest": (-0.1, 0.0, 0.15),
        "head": (-0.2, 0.0, 0.25),
        "upper_arm_l": (0.3, 0.0, -0.2),
        "upper_arm_r": (0.4, 0.0, 0.3),
    },
    "crouchHitStun": {
        "hips": (0.12, 0.0, 0.0),
        "upper_leg_l": (-0.85, 0.0, 0.0),
        "upper_leg_r": (-0.85, 0.0, 0.0),
        "lower_leg_l": (1.1, 0.0, 0.0),
        "lower_leg_r": (1.1, 0.0, 0.0),
        "spine": (-0.1, 0.0, 0.15),
        "head": (-0.15, 0.0, 0.2),
    },
    "knockdown": {
        "hips": (1.4, 0.0, 0.0),
        "spine": (0.3, 0.0, 0.0),
        "upper_leg_l": (-0.3, 0.0, 0.2),
        "upper_leg_r": (-0.3, 0.0, -0.2),
        "upper_arm_l": (-0.5, 0.0, -0.8),
        "upper_arm_r": (-0.5, 0.0, 0.8),
    },
    "getUp": {
        "hips": (0.4, 0.0, 0.0),
        "spine": (0.35, 0.0, 0.0),
        "upper_leg_l": (-0.9, 0.0, 0.0),
        "upper_leg_r": (-0.5, 0.0, 0.0),
        "lower_leg_l": (1.0, 0.0, 0.0),
        "upper_arm_l": (-0.6, 0.0, -0.4),
        "upper_arm_r": (0.2, 0.0, 0.3),
    },
    "jab": {
        "upper_arm_r": (-0.2, 0.0, 1.3),
        "lower_arm_r": (0.0, -0.2, 0.0),
        "chest": (0.0, 0.0, -0.15),
        "spine": (0.0, 0.0, -0.08),
        "upper_arm_l": (0.0, 0.0, -0.35),
    },
    "medPunch": {
        "upper_arm_r": (-0.35, 0.0, 1.5),
        "lower_arm_r": (0.0, -0.1, 0.0),
        "chest": (0.05, 0.0, -0.25),
        "hips": (0.0, 0.0, -0.1),
        "upper_arm_l": (0.1, 0.0, -0.45),
    },
    "lowKick": {
        "upper_leg_r": (-0.2, 0.0, -1.1),
        "lower_leg_r": (0.3, 0.0, 0.0),
        "hips": (0.0, 0.0, -0.15),
        "upper_arm_l": (0.0, 0.0, -0.3),
        "upper_arm_r": (0.0, 0.0, 0.25),
    },
    "medKick": {
        "upper_leg_r": (-0.5, 0.0, -1.35),
        "lower_leg_r": (0.2, 0.0, 0.0),
        "hips": (0.0, 0.0, -0.2),
        "spine": (0.0, 0.0, -0.1),
        "upper_arm_l": (-0.3, 0.0, -0.4),
    },
    "special1": {
        "upper_arm_r": (-0.6, 0.0, 1.6),
        "lower_arm_r": (0.0, -0.3, 0.0),
        "upper_arm_l": (-0.4, 0.0, -0.9),
        "chest": (0.1, 0.0, -0.35),
        "hips": (0.0, 0.0, -0.2),
        "upper_leg_l": (-0.2, 0.0, 0.0),
        "upper_leg_r": (0.15, 0.0, 0.0),
    },
    "throw": {
        "upper_arm_l": (-0.9, 0.0, -0.7),
        "upper_arm_r": (-0.9, 0.0, 0.7),
        "spine": (0.15, 0.0, 0.0),
        "hips": (0.0, 0.0, 0.25),
    },
    "thrown": {
        "hips": (0.8, 0.0, 0.4),
        "spine": (0.5, 0.0, 0.3),
        "head": (0.3, 0.0, 0.2),
        "upper_arm_l": (-1.0, 0.0, -0.5),
        "upper_arm_r": (-1.0, 0.0, 0.5),
        "upper_leg_l": (-0.4, 0.0, 0.2),
        "upper_leg_r": (-0.3, 0.0, -0.2),
    },
    "victory": {
        "upper_arm_r": (-2.2, 0.0, 0.3),
        "upper_arm_l": (0.2, 0.0, -0.3),
        "chest": (-0.05, 0.0, 0.0),
        "head": (-0.1, 0.0, 0.0),
    },
    "defeat": {
        "spine": (0.45, 0.0, 0.0),
        "chest": (0.25, 0.0, 0.0),
        "head": (0.35, 0.0, 0.0),
        "upper_arm_l": (0.4, 0.0, -0.2),
        "upper_arm_r": (0.4, 0.0, 0.2),
        "upper_leg_l": (-0.15, 0.0, 0.0),
        "upper_leg_r": (-0.15, 0.0, 0.0),
    },
}


def clear_pose(arm_obj: bpy.types.Object) -> None:
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = Euler((0.0, 0.0, 0.0))
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def apply_offsets(arm_obj: bpy.types.Object, offsets: dict[str, tuple[float, float, float]]) -> None:
    clear_pose(arm_obj)
    for name, eul in offsets.items():
        if name not in arm_obj.pose.bones:
            print("  skip missing bone:", name)
            continue
        pb = arm_obj.pose.bones[name]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = Euler(eul)


def ensure_action(name: str) -> bpy.types.Action:
    act = bpy.data.actions.get(name)
    if act:
        # wipe old fcurves for clean stub
        bpy.data.actions.remove(act)
    act = bpy.data.actions.new(name=name)
    return act


def key_pose(arm_obj: bpy.types.Object, action: bpy.types.Action, frame: int = 1) -> None:
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    bpy.context.scene.frame_set(frame)
    for pb in arm_obj.pose.bones:
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
        pb.keyframe_insert(data_path="location", frame=frame)


def main() -> None:
    if BLEND.exists():
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    else:
        raise SystemExit("Missing " + str(BLEND))

    arm_obj = bpy.data.objects.get("BaseFighter_Rig")
    if not arm_obj or arm_obj.type != "ARMATURE":
        # fallback: first armature
        arm_obj = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if not arm_obj:
        raise SystemExit("No armature found")

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")

    created = []
    for pose_id in TIER_A:
        offsets = POSE_OFFSETS.get(pose_id, {})
        action_name = "PF_" + pose_id
        print("Pose stub:", action_name)
        apply_offsets(arm_obj, offsets)
        act = ensure_action(action_name)
        key_pose(arm_obj, act, frame=1)
        # hold 10 frames for visibility in timeline
        bpy.context.scene.frame_set(10)
        for pb in arm_obj.pose.bones:
            pb.keyframe_insert(data_path="rotation_euler", frame=10)
            pb.keyframe_insert(data_path="location", frame=10)
        created.append(action_name)

    # leave on idle
    idle = bpy.data.actions.get("PF_idle")
    if idle:
        arm_obj.animation_data.action = idle
        apply_offsets(arm_obj, POSE_OFFSETS.get("idle", {}))

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 10

    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))

    # Export glb with actions (NLA push optional — glTF exports active + actions if enabled)
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(OUT_GLB),
            export_format="GLB",
            export_animations=True,
            export_nla_strips=False,
            export_force_sampling=True,
            export_anim_single_armature=True,
            export_apply=False,
        )
        print("Saved GLB:", OUT_GLB)
    except Exception as e:
        print("GLB export warning:", e)

    print("Saved blend:", OUT_BLEND)
    print("Created actions:", len(created))
    for n in created:
        print(" ", n)


if __name__ == "__main__":
    main()
