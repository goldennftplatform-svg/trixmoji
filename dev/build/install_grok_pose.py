"""Install one Grok AI image into the game as a named pose PNG."""
import os
import shutil
import sys

from PIL import Image

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
CHAR_ROOT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_degen, flood_edges


def strip_white(img):
    """Remove white/near-white background for Grok exports."""
    return extract_degen(img) if img.mode != "RGBA" else extract_degen(img.convert("RGB"))


def main():
    if len(sys.argv) < 4:
        print("Usage: python install_grok_pose.py <character> <pose-name> <source-image>")
        print("Example: python install_grok_pose.py degen high-punch-r C:\\Users\\franc\\Downloads\\grok.png")
        print("Pose name must match POSE-FILENAMES.txt (e.g. idle-r, high-kick-l)")
        sys.exit(1)

    slug = sys.argv[1].lower()
    pose = sys.argv[2].lower().replace(".png", "")
    src = sys.argv[3]

    if not os.path.isfile(src):
        raise SystemExit(f"Source not found: {src}")

    out_dir = os.path.join(CHAR_ROOT, slug, "poses")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, pose + ".png")

    img = Image.open(src)
    if img.mode == "P":
        img = img.convert("RGBA")
    rgba = strip_white(img)
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    rgba.save(out_path, "PNG")
    print(f"Installed {out_path} ({rgba.size[0]}x{rgba.size[1]})")


if __name__ == "__main__":
    main()