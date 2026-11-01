#!/usr/bin/env python3
"""Orthographic SVG preview of base_fighter.obj (no deps)."""

from __future__ import annotations

import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OBJ = ROOT / "models" / "base_fighter.obj"
MTL = ROOT / "models" / "base_fighter.mtl"
OUT = ROOT / "models" / "base_fighter_preview.svg"


def main() -> None:
    obj_text = OBJ.read_text(encoding="utf-8")
    mtl_text = MTL.read_text(encoding="utf-8")

    parts_colors: dict[str, tuple[float, float, float]] = {}
    cur = None
    for line in mtl_text.splitlines():
        if line.startswith("newmtl "):
            cur = line.split()[1]
        elif line.startswith("Kd ") and cur:
            r, g, b = map(float, line.split()[1:4])
            parts_colors[cur] = (r, g, b)

    verts: list[tuple[float, float, float]] = []
    faces_m: list[tuple[str, list[int]]] = []
    cur_mtl = "default"
    for line in obj_text.splitlines():
        if line.startswith("v "):
            _, x, y, z = line.split()[:4]
            verts.append((float(x), float(y), float(z)))
        elif line.startswith("usemtl "):
            cur_mtl = line.split()[1]
        elif line.startswith("f "):
            idx = [int(p.split("/")[0]) - 1 for p in line.split()[1:]]
            faces_m.append((cur_mtl, idx))

    w, h = 640, 900
    margin = 40
    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    minx, maxx = min(xs) - 0.2, max(xs) + 0.2
    miny, maxy = min(ys) - 0.05, max(ys) + 0.15
    span = max(maxx - minx, maxy - miny)

    def project(x: float, y: float, z: float) -> tuple[float, float]:
        px = x + 0.55 * z
        py = y
        sx = margin + (px - minx) / span * (w - 2 * margin)
        sy = h - (margin + (py - miny) / span * (h - 2 * margin))
        return sx, sy

    def face_shade(f: list[int]) -> float:
        a, b, c = verts[f[0]], verts[f[1]], verts[f[2]]
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        nz = ux * vy - uy * vx
        length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        nx, ny, nz = nx / length, ny / length, nz / length
        lx, ly, lz = 0.4, 0.7, 0.5
        ll = math.sqrt(lx * lx + ly * ly + lz * lz)
        lx, ly, lz = lx / ll, ly / ll, lz / ll
        d = max(0.0, nx * lx + ny * ly + nz * lz)
        return 0.28 + 0.72 * d

    faces_m.sort(
        key=lambda t: sum(verts[i][2] + verts[i][0] * 0.3 for i in t[1]) / len(t[1])
    )

    svg: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
        '<rect width="100%" height="100%" fill="#1a1c22"/>',
    ]

    cx = margin + (0 - minx) / span * (w - 2 * margin)
    cy = h - (margin + (0 - miny) / span * (h - 2 * margin))
    rx = 1.15 / span * (w - 2 * margin)
    svg.append(
        f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{rx * 0.22:.1f}" '
        f'fill="#2a2e38" stroke="#8a3040" stroke-width="3"/>'
    )
    svg.append(
        '<text x="24" y="36" fill="#ff6b5a" font-family="Segoe UI,sans-serif" '
        'font-size="18" font-weight="700">BaseFighter</text>'
    )
    svg.append(
        '<text x="24" y="58" fill="#9aa0a8" font-family="Segoe UI,sans-serif" '
        'font-size="13">VF 93 polygonal base · 288 tris · A-pose · Y-up meters</text>'
    )

    for mtl_name, face in faces_m:
        base = parts_colors.get(mtl_name, (0.6, 0.6, 0.6))
        sh = face_shade(face)
        r = int(min(255, base[0] * 255 * sh))
        g = int(min(255, base[1] * 255 * sh))
        b = int(min(255, base[2] * 255 * sh))
        pts = " ".join(
            f"{project(*verts[i])[0]:.1f},{project(*verts[i])[1]:.1f}" for i in face
        )
        svg.append(
            f'<polygon points="{pts}" fill="rgb({r},{g},{b})" '
            f'stroke="#0d0e12" stroke-width="0.8" stroke-linejoin="round"/>'
        )

    svg.append("</svg>")
    OUT.write_text("\n".join(svg), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
