# one-off catalog scrape
import re, json, urllib.request

html = urllib.request.urlopen("https://jaifeezy.netlify.app/", timeout=30).read().decode("utf-8", "replace")
open(r"C:\Users\franc\Desktop\DOSWAPZ\dev\_jaifeezy.html", "w", encoding="utf-8").write(html)

ids = list(dict.fromkeys(re.findall(r"https://suno.com/song/([0-9a-f-]{36})", html)))
print("unique ids", len(ids))

# titles: ### Title then later suno link
blocks = re.split(r"<h3[^>]*>", html)
found = []
for b in blocks[1:]:
    tm = re.search(r"([^<]+)</h3>", b)
    if not tm:
        continue
    title = re.sub(r"\s+", " ", tm.group(1)).strip()
    sm = re.search(r"suno.com/song/([0-9a-f-]{36})", b[:2500])
    if not sm:
        continue
    genre = ""
    gm = re.search(r"([A-Za-z0-9][^<]{3,60})</", b[:800])
    # genre often just above h3
    found.append({"title": title, "id": sm.group(1)})

print("h3 pairs", len(found))
for f in found:
    print(f["id"][:8], f["title"])

# covers
covers = {}
for m in re.finditer(r'(https://cdn2\.suno\.ai/[^"\']+\.(?:jpeg|jpg|png)).{0,400}?suno.com/song/([0-9a-f-]{36})', html, re.S):
    covers[m.group(2)] = m.group(1)
print("covers", len(covers))
