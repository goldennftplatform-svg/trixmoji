import re, json, urllib.request

UA = {"User-Agent": "DoswapzDailyWatch/1.0", "Accept": "application/json"}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read()
            return r.status, body
    except Exception as e:
        return getattr(e, "code", None), str(e).encode()

# bundle APIs
t = open(r"C:\Users\franc\Desktop\DOSWAPZ\dev\buildz-staging\trix-main.js", encoding="utf-8", errors="replace").read()
apis = sorted(set(re.findall(r"/api/[a-zA-Z0-9_./?-]{2,90}", t)))
print("BUNDLE APIS", len(apis))
for a in apis:
    print(a)

print("\n==== PROBE ====")
extra = [
    "https://www.trix.market/api/mkt/g",
    "https://www.trix.market/api/mkt/shop",
    "https://www.trix.market/api/mkt/inventory",
    "https://www.trix.market/api/mkt/packs",
    "https://www.trix.market/api/mkt/boxes",
    "https://www.trix.market/api/mkt/round",
    "https://www.trix.market/api/mkt/public",
    "https://www.trix.market/api/shop/packs",
    "https://www.trix.market/api/genesis",
    "https://www.trix.market/api/preorders",
    "https://www.trix.market/api/preorder/state",
    "https://www.trix.market/api/meme-image/recent?limit=1",
    "https://www.trix.market/api/meme-image/count",
    "https://www.trix.market/api/stats/public",
    "https://www.trix.market/api/void/stats",
    "https://www.trix.market/api/rewards",
    "https://www.trix.market/api/frontpage",
]
for u in extra:
    st, body = get(u)
    s = body[:220].decode("utf-8", "replace")
    print(st, u, s.replace("\n", " ")[:220])
