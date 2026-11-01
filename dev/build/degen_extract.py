"""Character cutout — edge flood + distance from body colors."""
from collections import deque

from PIL import Image

MAX_DIST = 28


def is_saturated(r, g, b):
    return max(r, g, b) - min(r, g, b) > 28 or (r + g + b) / 3 < 200


def is_edge_bg(r, g, b):
    spread = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    # gray checkerboard + warm cream matte (e.g. dogedesigner)
    if spread < 35 and avg >= 185:
        return True
    if spread < 15 and 115 <= avg < 185:
        return True
    return False


def is_matte_bg(r, g, b):
    """Gray/cream matte bleed — keep pure white details (e.g. skull)."""
    if not is_edge_bg(r, g, b):
        return False
    return (r + g + b) / 3 < 245


def _dist_to_saturated(px, w, h):
    dist = [[10**9] * w for _ in range(h)]
    q = deque()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a >= 128 and is_saturated(r, g, b):
                dist[y][x] = 0
                q.append((x, y))
    while q:
        x, y = q.popleft()
        d = dist[y][x]
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and dist[ny][nx] > d + 1:
                dist[ny][nx] = d + 1
                q.append((nx, ny))
    return dist


def is_removable_bg(r, g, b, a=255):
    """Near-white / gray matte safe to strip (exterior + limb gaps)."""
    if a < 128:
        return True
    spread = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    if is_edge_bg(r, g, b):
        return True
    # AI export white fill trapped between arms/legs
    return spread < 35 and avg >= 215


def peel_bg_holes(rgba):
    """Remove background reachable from transparent areas (incl. pure white gaps)."""
    px = rgba.load()
    w, h = rgba.size
    dist = _dist_to_saturated(px, w, h)
    remove = set()
    q = deque()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 128:
                remove.add((x, y))
                q.append((x, y))
    neighbors = (
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1),
    )
    while q:
        x, y = q.popleft()
        for dx, dy in neighbors:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            if (nx, ny) in remove:
                continue
            r, g, b, a = px[nx, ny]
            if a < 128:
                remove.add((nx, ny))
                q.append((nx, ny))
                continue
            if not is_removable_bg(r, g, b, a):
                continue
            avg = (r + g + b) / 3
            # Keep near-white pixels glued to saturated body (e.g. hoodie highlights)
            if avg < 248 and dist[ny][nx] < 2:
                continue
            remove.add((nx, ny))
            q.append((nx, ny))
    for x, y in remove:
        px[x, y] = (0, 0, 0, 0)
    return rgba


def peel_enclosed_background(rgba):
    """Remove small enclosed near-white islands between limbs (not touching image edge)."""
    px = rgba.load()
    w, h = rgba.size
    visited = set()

    for sy in range(h):
        for sx in range(w):
            if (sx, sy) in visited:
                continue
            r, g, b, a = px[sx, sy]
            if not is_removable_bg(r, g, b, a) or a < 128:
                continue

            comp = []
            touches_edge = False
            q = deque([(sx, sy)])
            while q:
                x, y = q.popleft()
                if (x, y) in visited:
                    continue
                visited.add((x, y))
                cr, cg, cb, ca = px[x, y]
                if ca < 128:
                    comp.append((x, y))
                    continue
                if not is_removable_bg(cr, cg, cb, ca):
                    continue
                comp.append((x, y))
                if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                    touches_edge = True
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                        q.append((nx, ny))

            if touches_edge:
                continue
            for x, y in comp:
                if px[x, y][3] >= 128:
                    px[x, y] = (0, 0, 0, 0)
    return rgba


def flood_edges(rgba):
    px = rgba.load()
    w, h = rgba.size
    seen = set()
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if not is_edge_bg(r, g, b):
            continue
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                q.append((nx, ny))
    return rgba


def extract_character(img):
    rgba = flood_edges(img.convert("RGBA"))
    px = rgba.load()
    w, h = rgba.size
    dist = [[10**9] * w for _ in range(h)]
    q = deque()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if is_saturated(r, g, b):
                dist[y][x] = 0
                q.append((x, y))

    while q:
        x, y = q.popleft()
        d = dist[y][x]
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and dist[ny][nx] > d + 1:
                _, _, _, a = px[nx, ny]
                if a < 128:
                    continue
                dist[ny][nx] = d + 1
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if dist[y][x] <= MAX_DIST:
                r, g, b, a = px[x, y]
                if a > 20 and not is_matte_bg(r, g, b):
                    opx[x, y] = (r, g, b, 255)
    return peel_enclosed_background(peel_bg_holes(out))


def _build_character_mask(rgba):
    px = rgba.load()
    w, h = rgba.size
    dist = [[10**9] * w for _ in range(h)]
    q = deque()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if is_saturated(r, g, b):
                dist[y][x] = 0
                q.append((x, y))
    while q:
        x, y = q.popleft()
        d = dist[y][x]
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and dist[ny][nx] > d + 1:
                if px[nx, ny][3] < 128:
                    continue
                dist[ny][nx] = d + 1
                q.append((nx, ny))
    return dist


def extract_degen(img):
    """DEGEN — finished pixel art; strip white matte only, keep colors as-is."""
    rgba = flood_edges(img.convert("RGBA"))
    px = rgba.load()
    w, h = rgba.size
    dist = _build_character_mask(rgba)

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if dist[y][x] <= MAX_DIST and px[x, y][3] > 20:
                r, g, b, a = px[x, y]
                opx[x, y] = (r, g, b, 255)

    out = peel_enclosed_background(peel_bg_holes(out))
    bbox = out.getbbox()
    if not bbox:
        return out
    return out.crop(bbox)


def stylize_degen_hoodie(img):
    """White hoodie, blue jeans, black shoes with white soles."""
    white = (252, 252, 248, 255)
    jean = (62, 92, 172, 255)
    jean_hi = (88, 118, 198, 255)
    jean_lo = (38, 58, 128, 255)
    belt_c = (42, 30, 22, 255)
    buckle = (210, 170, 65, 255)
    shoe = (22, 22, 28, 255)
    sole = (228, 228, 222, 255)
    px = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 128:
                continue
            ry = y / h
            avg = sum(px[x, y][:3]) / 3

            # shoes — black upper, white sole strip
            if ry >= 0.87:
                if ry >= 0.945:
                    px[x, y] = sole
                else:
                    px[x, y] = shoe
                continue

            # belt band
            if 0.56 <= ry < 0.62:
                if 0.48 < x / w < 0.58:
                    px[x, y] = buckle
                else:
                    px[x, y] = belt_c
                continue

            # jeans — force blue
            if 0.62 <= ry < 0.87:
                if avg < 55:
                    px[x, y] = jean_lo
                elif avg > 140:
                    px[x, y] = jean_hi
                else:
                    px[x, y] = jean
                continue

            # face skin / hands — keep warm tones
            if 150 < px[x, y][0] < 250 and px[x, y][0] > px[x, y][1] > px[x, y][2]:
                continue

            # very dark — DEGEN text, shades, outlines
            if avg < 72:
                continue

            # hoodie + hood + sleeves
            if ry < 0.78:
                px[x, y] = white

    return img