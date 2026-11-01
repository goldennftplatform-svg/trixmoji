"""Export TBB pixel bull head (from classic/pages/tbb/play.html drawPixelBull) to PNG."""
from PIL import Image, ImageDraw
import math
import os

SCALE = 12
W = 28 * SCALE
H = 28 * SCALE
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)


def rect(x, y, w, h, color):
    if isinstance(color, str) and color.startswith("#"):
        c = color.lstrip("#")
        if len(c) == 3:
            c = "".join(ch * 2 for ch in c)
        color = (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
    s = SCALE
    draw.rectangle([x * s, y * s, (x + w) * s - 1, (y + h) * s - 1], fill=color)


ox, oy = 2, 2
horn = "#d8c8a0"
hornTip = "#8a7a55"
fur = "#8b4513"
furD = "#5c2e0a"
furL = "#a05a2c"
skin = "#c68642"
skinD = "#8d5524"
eye = "#fff"
pupil = "#111"
hay = "#c2a33a"

for i in range(8):
    rect(ox + 2 + i, oy + 6 - (i // 2), 1, 2, hornTip if i > 5 else horn)
for i in range(8):
    rect(ox + 21 - i, oy + 6 - (i // 2), 1, 2, hornTip if i > 5 else horn)

rect(ox + 5, oy + 7, 14, 14, fur)
rect(ox + 4, oy + 9, 16, 10, furD)
rect(ox + 6, oy + 8, 12, 4, furL)
rect(ox + 8, oy + 11, 8, 9, skin)
rect(ox + 9, oy + 12, 6, 6, skinD)
rect(ox + 8, oy + 12, 3, 3, eye)
rect(ox + 13, oy + 12, 3, 3, eye)
rect(ox + 9, oy + 13, 1, 1, pupil)
rect(ox + 14, oy + 13, 1, 1, pupil)
rect(ox + 10, oy + 17, 4, 2, skinD)
rect(ox + 10, oy + 18, 4, 1, "#4a2010")
for i in range(7):
    rect(ox + 8 + i, oy + 20 + (i % 3), 1, 3 + (i % 2), hay)

# gold nose ring
s = SCALE
cx = (ox + 12) * s
cy = (oy + 20) * s
r = 2.2 * s
lw = max(2, s // 2)
for t in range(0, 360, 2):
    a1 = math.radians(t)
    a2 = math.radians(t + 3)
    x1 = cx + r * math.cos(a1)
    y1 = cy + r * math.sin(a1)
    x2 = cx + r * math.cos(a2)
    y2 = cy + r * math.sin(a2)
    draw.line([(x1, y1), (x2, y2)], fill=(255, 215, 0, 255), width=lw)

root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
out = os.path.join(root, "assets", "images", "tbb-bull-head.png")

bbox = img.getbbox()
cropped = img.crop(bbox) if bbox else img
side = max(cropped.size) + SCALE * 2
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
oxp = (side - cropped.size[0]) // 2
oyp = (side - cropped.size[1]) // 2
canvas.paste(cropped, (oxp, oyp), cropped)
canvas.save(out, "PNG")
print("saved", out, canvas.size)
