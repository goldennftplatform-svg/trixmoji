#!/usr/bin/env python3
"""Full-site Netlify deploy via file digests (avoids CLI 422 upload bugs)."""
import os, sys, json, hashlib, time, mimetypes
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

def load_netlify_token():
    token = os.environ.get("NETLIFY_AUTH_TOKEN") or ""
    if token:
        return token
    cfg_path = Path(os.environ.get("APPDATA") or "") / "netlify" / "Config" / "config.json"
    if not cfg_path.is_file():
        return ""
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        users = cfg.get("users") or {}
        for user in users.values():
            auth = (user or {}).get("auth") or {}
            t = auth.get("token") or ""
            if t:
                return t
    except Exception:
        return ""
    return ""

TOKEN = load_netlify_token()
SITE = os.environ.get("NETLIFY_SITE_ID") or "604172f8-7042-4972-8944-d5434a2ff615"
ROOT = Path(r"C:\Users\franc\Desktop\DOSWAPZ").resolve()
API = "https://api.netlify.com/api/v1"

if not TOKEN or not SITE:
    print("Missing NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID")
    sys.exit(1)

SKIP_DIRS = {
    "node_modules",
    ".git",
    ".netlify",
    "previous-versions",
    "4th test",
    "dev",
    "__pycache__",
    ".vscode",
    "ux-examples",
}
SKIP_SUFFIX = {".log", ".pyc", ".map"}


def should_skip(p: Path) -> bool:
    try:
        rel = p.relative_to(ROOT)
    except ValueError:
        return True
    parts = set(rel.parts)
    if parts & SKIP_DIRS:
        return True
    if any(part.startswith(".") and part not in (".well-known",) for part in rel.parts[:-1]):
        # skip hidden dirs except root-level files
        if any(part.startswith(".") for part in rel.parts[:-1]):
            return True
    if p.suffix.lower() in SKIP_SUFFIX:
        return True
    if p.name.lower().startswith("~$"):
        return True
    return False


def hash_file(p: Path, algo: str) -> str:
    h = hashlib.new(algo)
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha1_file(p: Path) -> str:
    return hash_file(p, "sha1")


def sha256_file(p: Path) -> str:
    return hash_file(p, "sha256")


def api(method, url, data=None, headers=None, timeout=120):
    hdrs = {
        "Authorization": f"Bearer {TOKEN}",
        "User-Agent": "doswapz-digest-deploy/1.0",
    }
    if headers:
        hdrs.update(headers)
    body = data
    if isinstance(data, (dict, list)):
        body = json.dumps(data).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return {}
            try:
                return json.loads(raw.decode())
            except Exception:
                return {"_raw": raw[:200]}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} {url}: {err[:500]}") from e


print("Scanning files...", flush=True)
paths = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [
        d
        for d in dirnames
        if d not in SKIP_DIRS and not (d.startswith(".") and d != ".well-known")
    ]
    for fn in filenames:
        p = Path(dirpath) / fn
        if should_skip(p) or not p.is_file():
            continue
        rel = "/" + p.relative_to(ROOT).as_posix()
        paths.append((rel, p))

print(f"Hashing {len(paths)} files...", flush=True)
files = {}
for i, (rel, p) in enumerate(paths, 1):
    try:
        files[rel] = sha1_file(p)
    except Exception as e:
        print("skip hash", rel, e)
    if i % 500 == 0:
        print(f"  hashed {i}/{len(paths)}", flush=True)

# Package serverless functions from zip-it-and-ship-it output
# SKIP_FUNCTIONS=1 → files-only (keeps previously published functions)
FN_DIR = ROOT / ".netlify" / "functions-zips"
functions = {}
fn_paths = {}
if str(os.environ.get("SKIP_FUNCTIONS") or "").strip() in ("1", "true", "yes"):
    print("SKIP_FUNCTIONS=1 — files only, existing functions stay live", flush=True)
elif FN_DIR.is_dir():
    for zp in FN_DIR.glob("*.zip"):
        name = zp.stem
        if name.startswith("_"):
            continue  # skip adapter helper
        sha = sha256_file(zp)
        functions[name] = sha
        fn_paths[sha] = zp
    print(f"Functions packaged: {len(functions)}", flush=True)
else:
    print("WARNING: no .netlify/functions-zips — deploy will have no functions", flush=True)

print(f"Creating deploy with {len(files)} files + {len(functions)} functions...", flush=True)
payload = {
    "files": files,
    "draft": False,
    "title": os.environ.get("DEPLOY_TITLE") or "DOSWAPZ production deploy",
}
if functions:
    payload["functions"] = functions

deploy = api(
    "POST",
    f"{API}/sites/{SITE}/deploys",
    payload,
    timeout=180,
)

deploy_id = deploy["id"]
required = deploy.get("required") or []
required_fns = deploy.get("required_functions") or []
print(f"Deploy id: {deploy_id}", flush=True)
print(f"Required file uploads: {len(required)}", flush=True)
print(f"Required function uploads: {len(required_fns)}", flush=True)
if required_fns:
    print(f"Required fn sample: {required_fns[:3]}", flush=True)

by_sha = {}
for rel, sha in files.items():
    by_sha.setdefault(sha, []).append(rel)


def upload_file(sha):
    rels = by_sha.get(sha) or []
    if not rels:
        return sha, "missing-path"
    rel = rels[0]
    p = ROOT / rel.lstrip("/")
    data = p.read_bytes()
    ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    url = f"{API}/deploys/{deploy_id}/files{rel}"
    req = urllib.request.Request(
        url,
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": ctype,
            "Content-Length": str(len(data)),
            "User-Agent": "doswapz-digest-deploy/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            resp.read()
        return sha, "ok"
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")[:200]
        return sha, f"HTTP {e.code} {err}"
    except Exception as e:
        return sha, str(e)


def upload_fn(sha):
    # required_functions may be names or shas depending on API version
    zp = fn_paths.get(sha)
    name = None
    if zp is None:
        # try treat as function name
        name = sha
        for s, path in fn_paths.items():
            if path.stem == name:
                zp = path
                sha = s
                break
    if zp is None:
        return sha, "missing-fn-zip"
    if name is None:
        name = zp.stem
    data = zp.read_bytes()
    # Netlify expects runtime (maps to Language) as query param + octet-stream body
    url = (
        f"{API}/deploys/{deploy_id}/functions/{name}"
        f"?runtime=js&size={len(data)}"
    )
    last = "unknown"
    for attempt in range(4):
        req = urllib.request.Request(
            url,
            data=data,
            method="PUT",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(data)),
                "User-Agent": "doswapz-digest-deploy/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                resp.read()
            return name, "ok"
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")[:200]
            last = f"HTTP {e.code} {err}"
            if e.code in (400, 404, 422):
                break
            time.sleep(1.5 * (attempt + 1))
        except Exception as e:
            last = str(e)
            time.sleep(1.5 * (attempt + 1))
    return name or sha, last


ok = 0
fail = []
with ThreadPoolExecutor(max_workers=4) as ex:
    futs = {ex.submit(upload_file, sha): ("file", sha) for sha in required}
    futs.update({ex.submit(upload_fn, item): ("fn", item) for item in required_fns})
    total = len(futs) or 1
    for i, fut in enumerate(as_completed(futs), 1):
        key, status = fut.result()
        if status == "ok":
            ok += 1
        else:
            fail.append((key, status))
        if i % 10 == 0 or i == total:
            print(f"  uploaded {i}/{total} (ok={ok} fail={len(fail)})", flush=True)

print(f"Upload done ok={ok} fail={len(fail)}", flush=True)
if fail[:8]:
    print("Failures sample:", fail[:8], flush=True)

if fail and len(fail) > max(3, (len(required) + len(required_fns)) * 0.1 + 1):
    print("Too many failures; aborting", flush=True)
    sys.exit(2)

for attempt in range(90):
    d = api("GET", f"{API}/deploys/{deploy_id}", timeout=60)
    state = d.get("state")
    print(f"State: {state}", flush=True)
    if state in ("ready", "current"):
        url = d.get("ssl_url") or d.get("deploy_ssl_url") or d.get("url")
        print("SUCCESS", url, flush=True)
        print("DEPLOY_ID", deploy_id, flush=True)
        sys.exit(0)
    if state in ("error", "failed"):
        print("FAILED", d.get("error_message") or d, flush=True)
        sys.exit(2)
    time.sleep(3)

print("TIMEOUT waiting for ready", flush=True)
sys.exit(3)
