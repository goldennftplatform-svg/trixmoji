import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_character, is_edge_bg

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
SRC = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")

open(os.path.join(os.path.dirname(__file__), "diag_out.txt"), "w").close()
for slug in ["ansem", "jimmy-edgar", "michael-saylor", "crypto-bitlord", "donalt"]:
    jpg = Image.open(os.path.join(SRC, slug + ".jpg"))
    cut = extract_character(jpg)
    bbox = cut.getbbox()
    cropped = cut.crop(bbox)
    px = cropped.load()
    w, h = cropped.size
    white = total = 0
    arm_white = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            total += 1
            if r > 240 and g > 240 and b > 240:
                white += 1
                rx, ry = x / w, y / h
                if slug == "ansem" and 0.55 < rx < 0.75 and 0.25 < ry < 0.55:
                    arm_white += 1
    bot = sum(1 for y in range(int(h * 0.9), h) for x in range(w) if px[x, y][3] > 128)
    line = f"{slug}: cut={w}x{h} white={white}/{total} arm_zone_white={arm_white} bottom10%={bot}"
    print(line)
    open(os.path.join(os.path.dirname(__file__), "diag_out.txt"), "a").write(line + "\n")