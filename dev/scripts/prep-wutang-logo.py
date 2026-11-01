from PIL import Image

src = r"C:\Users\franc\Desktop\DOSWAPZ\assets\images\geoffwatch\wutang-official.png"
dst = r"C:\Users\franc\Desktop\DOSWAPZ\assets\images\geoffwatch\wutang-official.png"

im = Image.open(src)
rgba = im.convert("RGBA")
px = rgba.load()
w, h = rgba.size
# Knock out olive/green background so the official yellow W sits on black.
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
opx = out.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        # background is dark olive/green; keep yellow/gold mark
        if g > r + 20 and g > b + 10 and r < 90:
            continue
        if r < 40 and g < 50 and b < 40:
            continue
        opx[x, y] = (r, g, b, 255)
out.save(dst)
print("saved", dst, out.size)
