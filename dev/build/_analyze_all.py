"""Full analysis of all character extractions."""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_character, is_edge_bg, is_matte_bg, flood_edges

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
SRC = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")
OUT = os.path.join(ROOT, "dev", "build")

SLUGS = [
    "degen", "ansem", "jason-williams", "dogedesigner", "roger-ver", "bitboy",
    "jimmy-edgar", "michael-saylor", "crypto-bitlord", "donalt", "vitalik-buterin", "pauly0x",
]


def bottom_opaque_row(cut, bbox):
    px = cut.load()
    minx, miny, maxx, maxy = bbox
    for y in range(maxy, miny - 1, -1):
        for x in range(minx, maxx + 1):
            if px[x, y][3] >= 128:
                return y, maxy
    return None, maxy


def top_opaque_row(cut, bbox):
    px = cut.load()
    minx, miny, maxx, maxy = bbox
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            if px[x, y][3] >= 128:
                return y, miny
    return None, miny


def count_matte_in_bbox(cut, bbox):
    px = cut.load()
    minx, miny, maxx, maxy = bbox
    matte = bright = total = 0
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            total += 1
            if is_matte_bg(r, g, b):
                matte += 1
            if r > 200 and g > 200 and b > 200:
                bright += 1
    return total, matte, bright


def sample_bottom_pixels(jpg, n=5):
    px = jpg.load()
    w, h = jpg.size
    samples = []
    for x in range(0, w, max(1, w // n)):
        samples.append(px[x, h - 1][:3])
    return samples


def main():
    print(f"{'slug':<20} {'src':>12} {'cut':>12} {'h%':>6} {'png':>10} {'matte':>6} {'bright':>6} {'bot_y':>6}")
    print("-" * 90)
    for slug in SLUGS:
        jpg_path = os.path.join(SRC, slug + ".jpg")
        png_path = os.path.join(SRC, "sprites", slug + ".png")
        jpg = Image.open(jpg_path)
        cut = extract_character(jpg)
        bbox = cut.getbbox()
        png = Image.open(png_path) if os.path.exists(png_path) else None

        if not bbox:
            print(f"{slug}: EMPTY")
            continue

        ch = bbox[3] - bbox[1] + 1
        cw = bbox[2] - bbox[0] + 1
        h_ratio = ch / jpg.size[1]
        total, matte, bright = count_matte_in_bbox(cut, bbox)
        bot, maxy = bottom_opaque_row(cut, bbox)
        bot_gap = maxy - bot if bot else 0

        print(
            f"{slug:<20} {str(jpg.size):>12} {f'{cw}x{ch}':>12} {h_ratio:>5.0%} "
            f"{str(png.size if png else '-'):>10} {matte:>6} {bright:>6} {bot_gap:>6}"
        )

        cropped = cut.crop(bbox)
        comp = Image.new("RGBA", cropped.size, (26, 26, 26, 255))
        comp.paste(cropped, (0, 0), cropped)
        comp.save(os.path.join(OUT, f"{slug}_check.png"))

        # Also save source bottom strip for problem chars
        if slug in ("crypto-bitlord", "michael-saylor", "donalt", "ansem", "jimmy-edgar"):
            w, h = jpg.size
            strip = jpg.crop((0, int(h * 0.85), w, h))
            strip.save(os.path.join(OUT, f"{slug}_src_bottom.png"))


if __name__ == "__main__":
    main()