"""Clean Fudker eye PNG for dark hubs.

Keeps black ink + white sclera (interior only).
Strips page bg + outer sticker white border.
Adds a thin uniform white rim so lashes read on black UI.
"""
from PIL import Image, ImageFilter, ImageChops
from collections import deque
import shutil

SRC = r"C:\Users\franc\Downloads\rn75h.jpg"
OUT = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\fudker-eye.png"
OUTLINE_PX = 4  # clean rim thickness


def main():
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    px = src.load()
    print("source", w, h)

    # --- masks ---
    ink = Image.new("L", (w, h), 0)      # black line art
    bright = Image.new("L", (w, h), 0)   # near-white (border OR sclera)
    ip, bp = ink.load(), bright.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3.0
            sat = max(r, g, b) - min(r, g, b)
            if sat > 40:
                continue  # ignore any tinted junk
            if lum < 100:
                ip[x, y] = 255
            elif lum > 210:
                bp[x, y] = 255
            elif lum < 145:
                # dark grey AA -> ink
                ip[x, y] = 255

    # solidify ink a touch
    ink = ink.point(lambda v: 255 if v > 128 else 0)
    ink = ink.filter(ImageFilter.MaxFilter(3))
    ink = ink.filter(ImageFilter.MinFilter(3))
    ip = ink.load()

    # --- exterior flood from image edges through NON-ink pixels ---
    # Anything reachable without crossing ink is "outside" the glyph.
    exterior = [[False] * h for _ in range(w)]
    q = deque()

    def try_seed(x, y):
        if exterior[x][y]:
            return
        if ip[x, y] > 0:
            return
        exterior[x][y] = True
        q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not exterior[nx][ny] and ip[nx, ny] == 0:
                exterior[nx][ny] = True
                q.append((nx, ny))

    # sclera = bright white that is NOT exterior (trapped inside ink)
    # outer border = bright white that IS exterior (discard)
    sclera = Image.new("L", (w, h), 0)
    sp = sclera.load()
    bp = bright.load()
    sclera_n = border_n = 0
    for y in range(h):
        for x in range(w):
            if bp[x, y] == 0:
                continue
            if exterior[x][y]:
                border_n += 1  # drop outer sticker white
            else:
                sp[x, y] = 255
                sclera_n += 1
    print("kept sclera px", sclera_n, "dropped outer white", border_n)

    # body = ink + sclera
    body = ImageChops.lighter(ink, sclera)

    # clean largest component
    bp2 = body.load()
    seen = [[False] * h for _ in range(w)]
    best = []
    for y in range(h):
        for x in range(w):
            if seen[x][y] or bp2[x, y] == 0:
                continue
            qq = deque([(x, y)])
            seen[x][y] = True
            cells = []
            while qq:
                cx, cy = qq.popleft()
                cells.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and bp2[nx, ny]:
                        seen[nx][ny] = True
                        qq.append((nx, ny))
            if len(cells) > len(best):
                best = cells
    keep = set(best)
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep:
                bp2[x, y] = 0
                ip[x, y] = 0
                sp[x, y] = 0

    # thin clean white outline around body
    dil = body
    for _ in range(OUTLINE_PX):
        dil = dil.filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(dil, body)
    # smooth ring a bit by min/max
    ring = ring.point(lambda v: 255 if v > 128 else 0)

    # composite
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    ip = ink.load()
    sp = sclera.load()
    rp = ring.load()

    for y in range(h):
        for x in range(w):
            if ip[x, y] > 0:
                op[x, y] = (0, 0, 0, 255)
            elif sp[x, y] > 0:
                op[x, y] = (255, 255, 255, 255)
            elif rp[x, y] > 0:
                op[x, y] = (255, 255, 255, 255)

    bbox = out.getbbox()
    print("bbox", bbox)
    if bbox:
        pad = 10
        out = out.crop((
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(w, bbox[2] + pad),
            min(h, bbox[3] + pad),
        ))

    out.save(OUT, "PNG", optimize=True)
    print("saved", OUT, out.size)

    dbg = Image.new("RGBA", out.size, (18, 90, 45, 255))
    dbg.alpha_composite(out)
    dbg.convert("RGB").save(
        r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\fudker-eye-debug-green.jpg",
        "JPEG",
        quality=92,
    )
    # also on pure black like the hub
    dbg2 = Image.new("RGBA", out.size, (0, 0, 0, 255))
    dbg2.alpha_composite(out)
    dbg2.convert("RGB").save(
        r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\fudker-eye-debug-black.jpg",
        "JPEG",
        quality=92,
    )

    try:
        shutil.copy2(OUT, r"C:\Users\franc\Desktop\DOSWAPZ\assets\images\fudker-eye.png")
    except Exception as e:
        print("alt skip", e)


if __name__ == "__main__":
    main()
