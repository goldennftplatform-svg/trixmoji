"""Install Grok pose PNGs for every KOL Fighter character — no character alteration."""
import os
import shutil
import sys

from PIL import Image, ImageOps

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
CHAR_ROOT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")

sys.path.insert(0, os.path.dirname(__file__))
from character_sources import (
    CHARACTERS,
    DEGEN_PRIMARY,
    NAMED_REFERENCES,
    POSE_FALLBACK_R,
    REFERENCE_FILES,
    ROOT_INBOX_MAP,
    SINGLE_POSE_FALLBACK_R,
)
from degen_extract import extract_degen


def read_pose_list(char_dir):
    path = os.path.join(char_dir, "POSE-FILENAMES.txt")
    poses = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and line.endswith(".png"):
                poses.append(line[:-4])
    return poses


def load_pose(src):
    img = Image.open(src)
    if img.mode == "P":
        img = img.convert("RGBA")
    return extract_degen(img)


def save_pose(pose_dir, name, rgba):
    path = os.path.join(pose_dir, name + ".png")
    rgba.save(path, "PNG")
    return path


def ingest_inbox():
    """Move loose Grok images from characters/ root into per-character sources/."""
    ingested = []
    for fn in os.listdir(CHAR_ROOT):
        low = fn.lower()
        if not low.endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        src = os.path.join(CHAR_ROOT, fn)
        if not os.path.isfile(src):
            continue

        slug_pose = ROOT_INBOX_MAP.get(low)
        if slug_pose:
            slug, pose = slug_pose
        elif low in NAMED_REFERENCES:
            slug, pose = NAMED_REFERENCES[low], "idle-r"
        else:
            continue

        if slug == "degen" and pose == "idle-r":
            continue

        dst_dir = os.path.join(CHAR_ROOT, slug, "sources")
        os.makedirs(dst_dir, exist_ok=True)
        ext = os.path.splitext(fn)[1]
        dst = os.path.join(dst_dir, pose + ext)
        shutil.copy2(src, dst)
        ingested.append((slug, pose, fn))
        print(f"Inbox    {slug}/{pose} <- {fn}")

    for slug in CHARACTERS:
        char_dir = os.path.join(CHAR_ROOT, slug)
        if not os.path.isdir(char_dir):
            continue
        sources_dir = os.path.join(char_dir, "sources")
        os.makedirs(sources_dir, exist_ok=True)
        for fn in os.listdir(char_dir):
            low = fn.lower()
            if low in ("reference.jpg", "view-poses.html", "pose-filenames.txt"):
                continue
            if not low.endswith((".jpg", ".jpeg", ".png", ".webp")):
                continue
            if low.endswith("-r.png") or low.endswith("-l.png"):
                continue
            base = low.rsplit(".", 1)[0]
            if base.endswith("-r"):
                pass
            elif NAMED_REFERENCES.get(low) == slug:
                base = "idle-r"
            else:
                continue
            src = os.path.join(char_dir, fn)
            ext = os.path.splitext(fn)[1]
            dst = os.path.join(sources_dir, base + ext)
            if os.path.abspath(src) != os.path.abspath(dst):
                shutil.copy2(src, dst)
                ingested.append((slug, base, fn))
                print(f"Drop     {slug}/{base} <- {fn}")

    return ingested


def discover_sources(sources_dir):
    found = {}
    if not os.path.isdir(sources_dir):
        return found
    for fn in os.listdir(sources_dir):
        low = fn.lower()
        if not low.endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        base = low.rsplit(".", 1)[0]
        if base.endswith("-r"):
            found[base] = os.path.join(sources_dir, fn)
    return found


def install_character(slug):
    char_dir = os.path.join(CHAR_ROOT, slug)
    pose_dir = os.path.join(char_dir, "poses")
    sources_dir = os.path.join(char_dir, "sources")
    os.makedirs(pose_dir, exist_ok=True)
    os.makedirs(sources_dir, exist_ok=True)

    extra_sources = discover_sources(sources_dir)
    ref_src = extra_sources.get("idle-r") or REFERENCE_FILES.get(slug)
    if not ref_src or not os.path.isfile(ref_src):
        print(f"SKIP {slug}: missing reference {ref_src}")
        return 0

    ref_dst = os.path.join(char_dir, "reference.jpg")
    shutil.copy2(ref_src, ref_dst)
    print(f"\n=== {slug.upper()} ===")
    print(f"Reference -> {ref_dst}")

    primary = {}

    if slug == "degen":
        primary.update(DEGEN_PRIMARY)
    else:
        primary["idle-r"] = ref_src

    primary.update(extra_sources)

    for pose, src in sorted(primary.items()):
        if not os.path.isfile(src):
            print(f"WARN missing source for {pose}: {src}")
            continue
        rgba = load_pose(src)
        save_pose(pose_dir, pose, rgba)
        print(f"Primary  {pose} <- {os.path.basename(src)} ({rgba.size[0]}x{rgba.size[1]})")

    has_multi = slug == "degen" or len([p for p in primary if p.endswith("-r")]) > 1
    fallback_map = POSE_FALLBACK_R if has_multi else SINGLE_POSE_FALLBACK_R
    for pose, source_pose in sorted(fallback_map.items()):
        dst = os.path.join(pose_dir, pose + ".png")
        if os.path.isfile(dst):
            continue
        src = os.path.join(pose_dir, source_pose + ".png")
        if not os.path.isfile(src):
            src = os.path.join(pose_dir, "idle-r.png")
        if not os.path.isfile(src):
            print(f"WARN cannot fallback {pose}")
            continue
        shutil.copy2(src, dst)
        print(f"Fallback {pose} <- {os.path.basename(src)}")

    all_r = sorted({p for p in read_pose_list(char_dir) if p.endswith("-r")})
    for pose_r in all_r:
        pose_l = pose_r[:-2] + "-l"
        r_path = os.path.join(pose_dir, pose_r + ".png")
        l_path = os.path.join(pose_dir, pose_l + ".png")
        if not os.path.isfile(r_path):
            print(f"WARN missing {pose_r}")
            continue
        mirrored = ImageOps.mirror(Image.open(r_path).convert("RGBA"))
        mirrored.save(l_path, "PNG")

    count = len([f for f in os.listdir(pose_dir) if f.endswith(".png")])
    print(f"Done {slug}: {count} poses")
    return count


def write_master_index():
    html = os.path.join(CHAR_ROOT, "view-all-poses.html")
    titles = {
        "degen": "DEGEN",
        "pauly0x": "PAULY0X",
    }
    parts = [
        "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">",
        "<title>KOL Fighter — All Characters</title>",
        "<style>",
        "body{margin:0;padding:24px;background:#0a0a12;color:#eee;font-family:Consolas,monospace;}",
        "h1{color:#f8d878;margin-bottom:8px;}",
        "p{color:#888;font-size:13px;max-width:800px;line-height:1.5;}",
        ".grid{display:flex;flex-wrap:wrap;gap:16px;margin-top:24px;}",
        "a.card{display:block;background:#1a1a28;border:2px solid #444;padding:16px;width:200px;text-decoration:none;color:#eee;}",
        "a.card:hover{border-color:#8cf;}",
        "a.card.ready{border-color:#484;}",
        "img{image-rendering:pixelated;max-width:120px;max-height:160px;display:block;margin:0 auto 10px;}",
        "h2{font-size:14px;color:#8cf;margin:0 0 4px;}",
        "span{font-size:11px;color:#8f8;}",
        "</style></head><body>",
        "<h1>KOL Fighter '85 — All Characters</h1>",
        "<p>Each fighter has a <code>view-poses.html</code> preview. Drop Grok pose images into <code>characters/&lt;slug&gt;/sources/</code> named like <code>high-punch-r.jpg</code> then re-run the installer.</p>",
        "<div class=\"grid\">",
    ]

    for slug in CHARACTERS:
        title = titles.get(slug, slug.replace("-", " ").upper())
        ref = f"{slug}/reference.jpg"
        pose_dir = os.path.join(CHAR_ROOT, slug, "poses")
        count = len([f for f in os.listdir(pose_dir) if f.endswith(".png")]) if os.path.isdir(pose_dir) else 0
        ready = " ready" if count > 0 else ""
        parts.append(
            f'<a class="card{ready}" href="{slug}/view-poses.html">'
            f'<img src="{ref}" alt="{title}" onerror="this.style.display=\'none\'">'
            f"<h2>{title}</h2><span>{count} poses</span></a>"
        )

    parts.append("</div></body></html>")
    with open(html, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))
    print(f"\nMaster index -> {html}")


def main():
    ingest_inbox()
    only = [a.lower() for a in sys.argv[1:]] if len(sys.argv) > 1 else CHARACTERS
    total = 0
    for slug in CHARACTERS:
        if slug not in only:
            continue
        total += install_character(slug)
    write_master_index()
    print(f"\nInstalled {total} total pose PNGs across {len(only)} character(s)")


if __name__ == "__main__":
    main()