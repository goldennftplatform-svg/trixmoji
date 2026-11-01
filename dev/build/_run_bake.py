"""Bake all sprites and write verification report."""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bake_all_characters as bake
from degen_extract import extract_character

ROOT = bake.ROOT
OUT = os.path.join(ROOT, "dev", "build")
LOG = os.path.join(OUT, "bake_report.txt")


def opaque_rows(img):
    px = img.load()
    w, h = img.size
    rows = [y for y in range(h) if any(px[x, y][3] > 128 for x in range(w))]
    return rows


def main():
    lines = []
    bake.main()
    lines.append("=== BAKED SPRITE DIMENSIONS ===")
    for slug in bake.SLUGS:
        path = os.path.join(bake.OUT, slug + ".png")
        if not os.path.exists(path):
            lines.append(f"{slug}: MISSING")
            continue
        img = Image.open(path)
        rows = opaque_rows(img)
        top, bottom = (rows[0], rows[-1]) if rows else (0, 0)
        lines.append(f"{slug}: {img.size[0]}x{img.size[1]} body_rows={top}-{bottom}")

        comp = Image.new("RGBA", img.size, (26, 26, 26, 255))
        comp.paste(img, (0, 0), img)
        comp.save(os.path.join(OUT, slug + "_verify.png"))

    open(LOG, "w").write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()