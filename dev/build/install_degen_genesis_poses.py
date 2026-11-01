"""Install DEGEN Genesis-style poses from sources-genesis/ into poses/."""
import os
import shutil
import sys

from PIL import Image, ImageOps

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
CHAR_DIR = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "degen")
SRC_DIR = os.path.join(CHAR_DIR, "sources-genesis")
POSE_DIR = os.path.join(CHAR_DIR, "poses")

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_degen

PRIMARY_SOURCES = {
    "idle-r": "idle-r.jpg",
    "idle-breath-r": "idle-breath-r.jpg",
    "walk-forward-1-r": "walk-forward-1-r.jpg",
    "walk-forward-2-r": "walk-forward-2-r.jpg",
    "jump-r": "jump-r.jpg",
    "jump-peak-r": "jump-peak-r.jpg",
    "crouch-r": "crouch-r.jpg",
    "block-high-r": "block-high-r.jpg",
    "block-low-r": "block-low-r.jpg",
    "high-punch-r": "high-punch-r.jpg",
    "high-kick-r": "high-kick-r.jpg",
    "low-punch-r": "low-punch-r.jpg",
    "med-kick-r": "med-kick-r.jpg",
    "special-1-r": "special-1-r.jpg",
    "special-2-r": "special-2-r.jpg",
    "victory-r": "victory-r.jpg",
}

FALLBACK_R = {
    "walk-backward-1-r": "walk-forward-1-r",
    "walk-backward-2-r": "walk-forward-2-r",
    "falling-r": "jump-r",
    "hit-stun-r": "idle-breath-r",
    "crouch-hit-stun-r": "crouch-r",
    "knockdown-r": "crouch-r",
    "get-up-r": "crouch-r",
    "defeat-r": "hit-stun-r",
    "low-kick-r": "high-kick-r",
    "med-punch-r": "high-punch-r",
    "throw-r": "high-punch-r",
    "thrown-r": "knockdown-r",
}


def load_pose(src):
    img = Image.open(src)
    if img.mode == "P":
        img = img.convert("RGBA")
    return extract_degen(img)


def save_pose(name, rgba):
    path = os.path.join(POSE_DIR, name + ".png")
    rgba.save(path, "PNG")
    return path


def read_pose_list():
    path = os.path.join(CHAR_DIR, "POSE-FILENAMES.txt")
    poses = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and line.endswith(".png"):
                poses.append(line[:-4])
    return poses


def main():
    os.makedirs(POSE_DIR, exist_ok=True)
    missing = [p for p, f in PRIMARY_SOURCES.items() if not os.path.isfile(os.path.join(SRC_DIR, f))]
    if missing:
        raise SystemExit(f"Missing Genesis sources for: {', '.join(missing)}")

    for pose, fname in PRIMARY_SOURCES.items():
        src = os.path.join(SRC_DIR, fname)
        rgba = load_pose(src)
        save_pose(pose, rgba)
        print(f"Primary  {pose} ({rgba.size[0]}x{rgba.size[1]})")

    for pose, source_pose in FALLBACK_R.items():
        shutil.copy2(
            os.path.join(POSE_DIR, source_pose + ".png"),
            os.path.join(POSE_DIR, pose + ".png"),
        )
        print(f"Fallback {pose} <- {source_pose}")

    all_r = sorted({p for p in read_pose_list() if p.endswith("-r")})
    for pose_r in all_r:
        pose_l = pose_r[:-2] + "-l"
        r_path = os.path.join(POSE_DIR, pose_r + ".png")
        l_path = os.path.join(POSE_DIR, pose_l + ".png")
        if not os.path.isfile(r_path):
            print(f"WARN missing {pose_r}")
            continue
        ImageOps.mirror(Image.open(r_path).convert("RGBA")).save(l_path, "PNG")
        print(f"Mirror   {pose_l} <- {pose_r}")

    count = len([f for f in os.listdir(POSE_DIR) if f.endswith(".png")])
    print(f"\nDone — {count} pose PNGs in {POSE_DIR}")


if __name__ == "__main__":
    main()