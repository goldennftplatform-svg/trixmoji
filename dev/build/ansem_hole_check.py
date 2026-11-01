"""Composite high-kick-r on dark gray 200x200; report trapped white pixels."""
import os
import sys

from PIL import Image

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
POSE = os.path.join(
    ROOT, "assets", "images", "kol-fighter", "characters", "ansem", "poses", "high-kick-r.png"
)
OUT = os.path.join(ROOT, "dev", "build", "ansem_hole_check.png")
BG = (64, 64, 64, 255)


def is_near_white(r, g, b, a=255):
    if a < 128:
        return False
    spread = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    return spread < 35 and avg >= 215


def count_trapped_white(rgba):
    px = rgba.load()
    w, h = rgba.size
    trapped = 0
    samples = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if not is_near_white(r, g, b, a):
                continue
            opaque_neighbors = 0
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nr, ng, nb, na = px[x + dx, y + dy]
                if na >= 128 and not is_near_white(nr, ng, nb, na):
                    opaque_neighbors += 1
            if opaque_neighbors >= 2:
                trapped += 1
                if len(samples) < 8:
                    samples.append((x, y, r, g, b))
    return trapped, samples


def main():
    if not os.path.isfile(POSE):
        print(f"MISSING pose: {POSE}")
        sys.exit(1)

    pose = Image.open(POSE).convert("RGBA")
    canvas = Image.new("RGBA", (200, 200), BG)
    pw, ph = pose.size
    scale = min(180 / pw, 180 / ph, 1.0)
    nw, nh = max(1, int(pw * scale)), max(1, int(ph * scale))
    if (nw, nh) != (pw, ph):
        pose = pose.resize((nw, nh), Image.Resampling.NEAREST)
    ox = (200 - nw) // 2
    oy = (200 - nh) // 2
    canvas.paste(pose, (ox, oy), pose)
    canvas.save(OUT, "PNG")

    trapped, samples = count_trapped_white(pose)
    print(f"Saved {OUT}")
    print(f"Pose size: {nw}x{nh}")
    print(f"Trapped near-white pixels (between limbs): {trapped}")
    if samples:
        print("Sample coords (pose space):", samples)
    if trapped == 0:
        print("VERDICT: No white holes detected between limbs.")
    elif trapped < 20:
        print("VERDICT: Minor white specks remain between limbs.")
    else:
        print("VERDICT: White pixels still visible between limbs.")


if __name__ == "__main__":
    main()