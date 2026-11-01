"""Install all DEGEN poses from Grok AI source images — no character alteration."""
import os
import shutil
import sys

from PIL import Image, ImageOps

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
CHAR_DIR = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "degen")
POSE_DIR = os.path.join(CHAR_DIR, "poses")
SESSION = (
    r"C:\Users\franc\.grok\sessions"
    r"\C%3A%5CWINDOWS%5Csystem32\019f2fe0-fdeb-7e11-98a6-8e30b11e84a7\assets"
)

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_degen

PRIMARY_SOURCES = {
    "idle-r": os.path.join(SESSION, "image-175568d4-90f0-4b78-970a-8c2521dadb55.jpg"),
    "idle-breath-r": os.path.join(SESSION, "image-a456ed22-0552-4596-9008-8c61b07a07a0.jpg"),
    "walk-forward-1-r": os.path.join(SESSION, "image-22d33eaf-1000-4967-861b-2fa6e8363877.jpg"),
    "walk-forward-2-r": os.path.join(SESSION, "image-a456ed22-0552-4596-9008-8c61b07a07a0.jpg"),
    "jump-r": r"C:\Users\franc\Downloads\9ZNvl.jpg",
    "jump-peak-r": os.path.join(SESSION, "image-6fb64efc-7ed3-480e-b220-82ece820a586.jpg"),
    "crouch-r": os.path.join(SESSION, "image-bb99b224-bec8-46cd-a1da-84f918b00b25.jpg"),
    "block-high-r": r"C:\Users\franc\Downloads\CtUhC (1).jpg",
    "block-low-r": os.path.join(SESSION, "image-c146bb9d-040a-4bc5-82de-60af61f80722.jpg"),
    "high-punch-r": os.path.join(SESSION, "image-3a1d91c0-2283-4612-805d-0b7baee176d7.jpg"),
    "high-kick-r": os.path.join(SESSION, "image-b7463fb3-590c-4415-be8a-9fc9217bb5c6.jpg"),
    "low-punch-r": os.path.join(SESSION, "image-bb99b224-bec8-46cd-a1da-84f918b00b25.jpg"),
    "med-kick-r": os.path.join(SESSION, "image-c224b37b-7506-4b44-8d06-efc26cc47a56.jpg"),
    "special-1-r": os.path.join(SESSION, "image-069f145d-1b86-4bd9-9621-ac3d2d22e550.jpg"),
    "special-2-r": os.path.join(SESSION, "image-c224b37b-7506-4b44-8d06-efc26cc47a56.jpg"),
    "victory-r": os.path.join(SESSION, "image-6fb64efc-7ed3-480e-b220-82ece820a586.jpg"),
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

    ref_src = r"C:\Users\franc\Downloads\9ZNvl.jpg"
    ref_dst = os.path.join(CHAR_DIR, "reference.jpg")
    shutil.copy2(ref_src, ref_dst)
    print(f"Reference -> {ref_dst}")

    installed = {}
    for pose, src in PRIMARY_SOURCES.items():
        if not os.path.isfile(src):
            raise SystemExit(f"Missing source for {pose}: {src}")
        rgba = load_pose(src)
        path = save_pose(pose, rgba)
        installed[pose] = path
        print(f"Primary  {pose} <- {os.path.basename(src)} ({rgba.size[0]}x{rgba.size[1]})")

    for pose, source_pose in FALLBACK_R.items():
        src_path = os.path.join(POSE_DIR, source_pose + ".png")
        dst_path = os.path.join(POSE_DIR, pose + ".png")
        shutil.copy2(src_path, dst_path)
        installed[pose] = dst_path
        print(f"Fallback {pose} <- {source_pose}")

    all_r = sorted({p for p in read_pose_list() if p.endswith("-r")})
    for pose_r in all_r:
        pose_l = pose_r[:-2] + "-l"
        r_path = os.path.join(POSE_DIR, pose_r + ".png")
        l_path = os.path.join(POSE_DIR, pose_l + ".png")
        if not os.path.isfile(r_path):
            print(f"WARN missing {pose_r}")
            continue
        mirrored = ImageOps.mirror(Image.open(r_path).convert("RGBA"))
        mirrored.save(l_path, "PNG")
        print(f"Mirror   {pose_l} <- {pose_r}")

    count = len([f for f in os.listdir(POSE_DIR) if f.endswith(".png")])
    print(f"\nDone — {count} pose PNGs in {POSE_DIR}")


if __name__ == "__main__":
    main()