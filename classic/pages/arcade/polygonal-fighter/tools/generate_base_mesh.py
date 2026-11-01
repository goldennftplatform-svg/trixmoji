#!/usr/bin/env python3
"""
Generate a Virtua Fighter '93 style low-poly base humanoid.

- Height ~1.80 m
- Flat-shaded polygonal look (no smooth groups)
- Named body parts for character variants
- Neutral A-pose (good fighting-game base)
- Outputs OBJ + MTL

Usage:
  python generate_base_mesh.py
  python generate_base_mesh.py --out ../models/base_fighter
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field
from pathlib import Path


# ---------------------------------------------------------------------------
# Mesh builder
# ---------------------------------------------------------------------------

@dataclass
class Mesh:
    vertices: list[tuple[float, float, float]] = field(default_factory=list)
    # faces: list of (part_name, vertex_indices_1based, color_rgb)
    faces: list[tuple[str, tuple[int, ...], tuple[float, float, float]]] = field(
        default_factory=list
    )

    def add_vert(self, x: float, y: float, z: float) -> int:
        self.vertices.append((x, y, z))
        return len(self.vertices)  # 1-based OBJ index

    def add_box(
        self,
        part: str,
        color: tuple[float, float, float],
        cx: float,
        cy: float,
        cz: float,
        sx: float,
        sy: float,
        sz: float,
        *,
        rot_z: float = 0.0,
    ) -> None:
        """Axis-aligned box centered at (cx,cy,cz). Optional yaw around local Y? 

        We use Y-up, X right, Z forward (Blender/Godot-ish).
        rot_z: rotation around Z (for arm A-pose tilt in degrees) applied in XZ... 
        Actually for A-pose we tilt arms in the X-Y plane (around Z).
        """
        hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
        # Local corners: x,y,z relative to center
        local = [
            (-hx, -hy, -hz),
            (hx, -hy, -hz),
            (hx, hy, -hz),
            (-hx, hy, -hz),
            (-hx, -hy, hz),
            (hx, -hy, hz),
            (hx, hy, hz),
            (-hx, hy, hz),
        ]
        rad = math.radians(rot_z)
        c, s = math.cos(rad), math.sin(rad)
        idxs: list[int] = []
        for lx, ly, lz in local:
            # rotate around Z: (x,y) -> 
            rx = lx * c - ly * s
            ry = lx * s + ly * c
            rz = lz
            idxs.append(self.add_vert(cx + rx, cy + ry, cz + rz))

        # Face indices into idxs (0-based local)
        quads = [
            (0, 1, 2, 3),  # back  -z
            (5, 4, 7, 6),  # front +z
            (4, 0, 3, 7),  # left  -x
            (1, 5, 6, 2),  # right +x
            (3, 2, 6, 7),  # top   +y
            (4, 5, 1, 0),  # bottom -y
        ]
        for a, b, c_, d in quads:
            self.faces.append(
                (part, (idxs[a], idxs[b], idxs[c_], idxs[d]), color)
            )

    def add_tapered_box(
        self,
        part: str,
        color: tuple[float, float, float],
        cx: float,
        y_bottom: float,
        y_top: float,
        cz: float,
        bottom_sx: float,
        bottom_sz: float,
        top_sx: float,
        top_sz: float,
    ) -> None:
        """Vertical tapered box (torso-like)."""
        hy0, hy1 = y_bottom, y_top
        bx, bz = bottom_sx * 0.5, bottom_sz * 0.5
        tx, tz = top_sx * 0.5, top_sz * 0.5
        corners = [
            (cx - bx, hy0, cz - bz),
            (cx + bx, hy0, cz - bz),
            (cx + bx, hy0, cz + bz),
            (cx - bx, hy0, cz + bz),
            (cx - tx, hy1, cz - tz),
            (cx + tx, hy1, cz - tz),
            (cx + tx, hy1, cz + tz),
            (cx - tx, hy1, cz + tz),
        ]
        idxs = [self.add_vert(*p) for p in corners]
        quads = [
            (0, 1, 5, 4),  # back
            (2, 3, 7, 6),  # front
            (3, 0, 4, 7),  # left
            (1, 2, 6, 5),  # right
            (4, 5, 6, 7),  # top
            (3, 2, 1, 0),  # bottom
        ]
        for a, b, c_, d in quads:
            self.faces.append(
                (part, (idxs[a], idxs[b], idxs[c_], idxs[d]), color)
            )


# ---------------------------------------------------------------------------
# Colors — flat VF-era palette (neutral gray base for recoloring)
# ---------------------------------------------------------------------------

SKIN = (0.78, 0.62, 0.48)
CLOTH_DARK = (0.22, 0.24, 0.30)
CLOTH_MID = (0.35, 0.38, 0.45)
CLOTH_LIGHT = (0.55, 0.58, 0.65)
ACCENT = (0.70, 0.18, 0.16)
HAIR = (0.12, 0.10, 0.10)


def build_base_fighter() -> Mesh:
    """
    Low-poly base fighter, ~1.80 m tall, A-pose.

    Coordinate system: Y-up, X-right, Z-forward.
    Origin at ground between feet.
    """
    m = Mesh()

    # --- Proportions (meters) ---
    # Head
    head_c_y = 1.68
    # Neck
    # Shoulders ~1.48, hips ~0.98, knees ~0.52, ankles ~0.10

    # PELVIS
    m.add_box("pelvis", CLOTH_DARK, 0.0, 0.98, 0.0, 0.30, 0.16, 0.18)

    # TORSO (tapered)
    m.add_tapered_box(
        "torso",
        CLOTH_MID,
        cx=0.0,
        y_bottom=1.06,
        y_top=1.42,
        cz=0.0,
        bottom_sx=0.28,
        bottom_sz=0.16,
        top_sx=0.38,
        top_sz=0.18,
    )

    # CHEST / shoulders block
    m.add_box("chest", CLOTH_LIGHT, 0.0, 1.48, 0.0, 0.44, 0.16, 0.20)

    # NECK
    m.add_box("neck", SKIN, 0.0, 1.58, 0.0, 0.10, 0.08, 0.10)

    # HEAD (blocky VF1 face mass)
    m.add_box("head", SKIN, 0.0, 1.70, 0.02, 0.18, 0.22, 0.18)
    # simple hair cap
    m.add_box("hair", HAIR, 0.0, 1.80, 0.0, 0.19, 0.06, 0.19)
    # jaw / chin hint
    m.add_box("jaw", SKIN, 0.0, 1.60, 0.06, 0.12, 0.06, 0.10)

    # --- ARMS (A-pose: angled ~28° down from horizontal) ---
    for side, sx in (("l", 1.0), ("r", -1.0)):
        m.add_box(f"shoulder_{side}", SKIN, sx * 0.26, 1.48, 0.0, 0.12, 0.12, 0.12)

        if side == "l":
            ua_cx, ua_cy = 0.42, 1.40
            la_cx, la_cy = 0.60, 1.26
            hand_cx, hand_cy = 0.74, 1.16
            tilt = -28.0
        else:
            ua_cx, ua_cy = -0.42, 1.40
            la_cx, la_cy = -0.60, 1.26
            hand_cx, hand_cy = -0.74, 1.16
            tilt = 28.0

        m.add_box(f"upper_arm_{side}", SKIN, ua_cx, ua_cy, 0.0, 0.28, 0.09, 0.09, rot_z=tilt)
        m.add_box(f"lower_arm_{side}", SKIN, la_cx, la_cy, 0.0, 0.26, 0.08, 0.08, rot_z=tilt)
        m.add_box(f"hand_{side}", SKIN, hand_cx, hand_cy, 0.0, 0.10, 0.06, 0.08, rot_z=tilt)

    # --- LEGS ---
    for side, sx in (("l", 1.0), ("r", -1.0)):
        hip_x = sx * 0.10
        # upper leg
        m.add_box(f"upper_leg_{side}", CLOTH_DARK, hip_x, 0.76, 0.0, 0.12, 0.36, 0.14)
        # knee block
        m.add_box(f"knee_{side}", CLOTH_MID, hip_x, 0.54, 0.02, 0.11, 0.10, 0.12)
        # lower leg
        m.add_box(f"lower_leg_{side}", CLOTH_MID, hip_x, 0.32, 0.0, 0.10, 0.34, 0.12)
        # foot
        m.add_box(f"foot_{side}", CLOTH_DARK, hip_x, 0.06, 0.06, 0.11, 0.08, 0.24)

    # Belt / waistband accent (identity hook for variants)
    m.add_box("belt", ACCENT, 0.0, 1.06, 0.0, 0.32, 0.05, 0.19)

    return m


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def write_obj_mtl(mesh: Mesh, out_stem: Path) -> None:
    out_stem = out_stem.resolve()
    out_stem.parent.mkdir(parents=True, exist_ok=True)
    obj_path = out_stem.with_suffix(".obj")
    mtl_path = out_stem.with_suffix(".mtl")
    mtl_name = mtl_path.name

    # Unique materials by part (each part gets its color)
    parts: dict[str, tuple[float, float, float]] = {}
    for part, _idx, color in mesh.faces:
        parts[part] = color

    with mtl_path.open("w", encoding="utf-8") as f:
        f.write("# Base fighter materials — flat shaded VF-era palette\n")
        for part, (r, g, b) in sorted(parts.items()):
            f.write(f"newmtl {part}\n")
            f.write(f"Kd {r:.4f} {g:.4f} {b:.4f}\n")
            f.write("Ka 0.05 0.05 0.05\n")
            f.write("Ks 0.0 0.0 0.0\n")  # no specular — flat 1993 look
            f.write("Ns 1.0\n")
            f.write("illum 1\n\n")

    with obj_path.open("w", encoding="utf-8") as f:
        f.write("# polygonal-fighter base model\n")
        f.write("# Y-up, meters, origin at ground center\n")
        f.write("# A-pose low-poly humanoid for Virtua Fighter '93 style\n")
        f.write(f"mtllib {mtl_name}\n\n")

        for x, y, z in mesh.vertices:
            f.write(f"v {x:.6f} {y:.6f} {z:.6f}\n")
        f.write("\n")

        current_part = None
        for part, idxs, _color in mesh.faces:
            if part != current_part:
                f.write(f"o {part}\n")
                f.write(f"g {part}\n")
                f.write(f"usemtl {part}\n")
                current_part = part
            # Split quads into triangles for maximum engine friendliness
            if len(idxs) == 4:
                a, b, c, d = idxs
                f.write(f"f {a} {b} {c}\n")
                f.write(f"f {a} {c} {d}\n")
            else:
                f.write("f " + " ".join(str(i) for i in idxs) + "\n")

    # Stats
    tri_count = sum(2 if len(idx) == 4 else 1 for _, idx, _ in mesh.faces)
    print(f"Wrote {obj_path}")
    print(f"Wrote {mtl_path}")
    print(f"Vertices: {len(mesh.vertices)}")
    print(f"Triangles: {tri_count}")
    print(f"Parts: {len(parts)} → {', '.join(sorted(parts))}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate VF-style base fighter mesh")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "models" / "base_fighter",
        help="Output path stem (without extension)",
    )
    args = parser.parse_args()
    mesh = build_base_fighter()
    write_obj_mtl(mesh, args.out)


if __name__ == "__main__":
    main()
