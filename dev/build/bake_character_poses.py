"""Export each pose as individual PNG — one folder per character."""
import math
import os
import shutil
import sys

from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_degen
from pose_compose import compose_pose

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
CHAR_ROOT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")

CHARACTERS = [
    "degen", "ansem", "jason-williams", "dogedesigner", "roger-ver", "bitboy",
    "jimmy-edgar", "michael-saylor", "crypto-bitlord", "donalt", "vitalik-buterin", "pauly0x"
]

POSES = [
    ("idle", "Idle"),
    ("idle-breath", "Idle (breath)"),
    ("walk-forward-1", "Walk Forward 1"),
    ("walk-forward-2", "Walk Forward 2"),
    ("walk-backward-1", "Walk Backward 1"),
    ("walk-backward-2", "Walk Backward 2"),
    ("crouch", "Crouch / Kneel"),
    ("jump", "Jump"),
    ("jump-peak", "Jump Peak"),
    ("falling", "Falling"),
    ("block-high", "Block High"),
    ("block-low", "Block Low"),
    ("hit-stun", "Hit Stun"),
    ("crouch-hit-stun", "Crouch Hit Stun"),
    ("knockdown", "Knockdown"),
    ("get-up", "Get Up"),
    ("victory", "Victory"),
    ("defeat", "Defeat"),
    ("high-punch", "High Punch"),
    ("high-kick", "High Kick"),
    ("low-punch", "Low Punch"),
    ("low-kick", "Low Kick"),
    ("med-punch", "Med Punch"),
    ("med-kick", "Med Kick"),
    ("special-1", "Special 1"),
    ("special-2", "Special 2"),
    ("throw", "Throw"),
    ("thrown", "Thrown"),
]

BOSS_POSES = [
    ("phase-2", "Phase 2"),
    ("phase-3", "Phase 3"),
    ("taunt", "Taunt"),
    ("summon", "Summon"),
    ("heavy-special-windup", "Heavy Special Wind-up"),
]

TARGET_H = 120


def base_sprite(img):
    stripped = extract_degen(img)
    bbox = stripped.getbbox()
    cropped = stripped.crop(bbox) if bbox else stripped
    scale = TARGET_H / cropped.height
    tw = max(1, int(cropped.width * scale))
    return cropped.resize((tw, TARGET_H), Image.NEAREST)


def make_pose(sprite, kind):
    return compose_pose(sprite, kind)


def ensure_folders():
    for slug in CHARACTERS:
        poses_dir = os.path.join(CHAR_ROOT, slug, "poses")
        os.makedirs(poses_dir, exist_ok=True)


def bake_degen():
    src_jpg = os.path.join(CHAR_ROOT, "degen.jpg")
    ref_dst = os.path.join(CHAR_ROOT, "degen", "reference.jpg")
    if os.path.isfile(src_jpg):
        shutil.copy2(src_jpg, ref_dst)
    elif not os.path.isfile(ref_dst):
        raise SystemExit("Missing degen reference — put reference.jpg in characters/degen/")

    ref = Image.open(ref_dst)
    sprite = base_sprite(ref)
    poses_dir = os.path.join(CHAR_ROOT, "degen", "poses")
    os.makedirs(poses_dir, exist_ok=True)

    pose_list = POSES + (BOSS_POSES if False else [])
    count = 0
    for slug, _label in pose_list:
        r_img = make_pose(sprite, slug)
        l_img = ImageOps.mirror(r_img)
        r_path = os.path.join(poses_dir, slug + "-r.png")
        l_path = os.path.join(poses_dir, slug + "-l.png")
        r_img.save(r_path, "PNG")
        l_img.save(l_path, "PNG")
        count += 2

    # idle alias for game loader
    shutil.copy2(os.path.join(poses_dir, "idle-r.png"), os.path.join(poses_dir, "idle.png"))
    print(f"degen: {count} pose files in {poses_dir}")


def write_degen_html():
    html_path = os.path.join(CHAR_ROOT, "degen", "view-poses.html")
    sections = [
        ("Idle", ["idle", "idle-breath"]),
        ("Walk", ["walk-forward-1", "walk-forward-2", "walk-backward-1", "walk-backward-2"]),
        ("Air", ["jump", "jump-peak", "falling"]),
        ("Defense", ["crouch", "block-high", "block-low"]),
        ("Hit", ["hit-stun", "crouch-hit-stun", "knockdown", "get-up"]),
        ("Result", ["victory", "defeat"]),
        ("Attacks", [
            "high-punch", "high-kick", "low-punch", "low-kick",
            "med-punch", "med-kick", "special-1", "special-2", "throw", "thrown"
        ]),
    ]
    labels = {s: lbl for s, lbl in POSES}

    lines = [
        "<!DOCTYPE html>",
        "<html lang=\"en\"><head><meta charset=\"UTF-8\">",
        "<title>DEGEN Poses</title>",
        "<style>",
        "body{margin:0;padding:20px;background:#111;color:#eee;font-family:Consolas,monospace;}",
        "h1{color:#f8d878;} h2{color:#8cf;margin:24px 0 10px;font-size:14px;}",
        "p{color:#888;font-size:13px;}",
        ".ref{margin:16px 0;padding:12px;background:#222;border:2px solid #444;display:inline-block;}",
        ".grid{display:flex;flex-wrap:wrap;gap:12px;}",
        ".card{background:#222;border:2px solid #444;padding:8px;text-align:center;width:110px;}",
        "img{image-rendering:pixelated;max-width:90px;max-height:140px;display:block;margin:0 auto 6px;}",
        "span{font-size:9px;color:#8f8;display:block;line-height:1.3;}",
        "</style></head><body>",
        "<h1>DEGEN</h1>",
        "<p>Double-click this file to view. Images are in the <code>poses/</code> folder next to this file.</p>",
        "<div class=\"ref\"><div>Reference</div>",
        "<img src=\"reference.jpg\" alt=\"DEGEN reference\" style=\"max-height:280px;max-width:200px;\"></div>",
    ]

    for title, slugs in sections:
        lines.append(f"<h2>{title}</h2><div class=\"grid\">")
        for slug in slugs:
            lbl = labels.get(slug, slug)
            for side in ("r", "l"):
                lines.append(
                    f"<div class=\"card\"><img src=\"poses/{slug}-{side}.png\" alt=\"{lbl}\">"
                    f"<span>{lbl} {side.upper()}</span></div>"
                )
        lines.append("</div>")

    lines.append("</body></html>")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("Wrote", html_path)


def main():
    ensure_folders()
    bake_degen()
    write_degen_html()


if __name__ == "__main__":
    main()