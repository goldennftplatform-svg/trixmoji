"""Create per-character pose folders — images come from Grok AI, not auto-generated."""
import os

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
CHAR_ROOT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")

CHARACTERS = [
    "degen", "ansem", "jason-williams", "dogedesigner", "roger-ver", "bitboy",
    "jimmy-edgar", "michael-saylor", "crypto-bitlord", "donalt", "vitalik-buterin", "pauly0x"
]

POSE_FILES = [
    "idle-r", "idle-l", "idle-breath-r", "idle-breath-l",
    "walk-forward-1-r", "walk-forward-1-l", "walk-forward-2-r", "walk-forward-2-l",
    "walk-backward-1-r", "walk-backward-1-l", "walk-backward-2-r", "walk-backward-2-l",
    "crouch-r", "crouch-l", "jump-r", "jump-l", "jump-peak-r", "jump-peak-l",
    "falling-r", "falling-l", "block-high-r", "block-high-l", "block-low-r", "block-low-l",
    "hit-stun-r", "hit-stun-l", "crouch-hit-stun-r", "crouch-hit-stun-l",
    "knockdown-r", "knockdown-l", "get-up-r", "get-up-l",
    "victory-r", "victory-l", "defeat-r", "defeat-l",
    "high-punch-r", "high-punch-l", "high-kick-r", "high-kick-l",
    "low-punch-r", "low-punch-l", "low-kick-r", "low-kick-l",
    "med-punch-r", "med-punch-l", "med-kick-r", "med-kick-l",
    "special-1-r", "special-1-l", "special-2-r", "special-2-l",
    "throw-r", "throw-l", "thrown-r", "thrown-l",
]

BOSS_EXTRA = [
    "phase-2-r", "phase-2-l", "phase-3-r", "phase-3-l",
    "taunt-r", "taunt-l", "summon-r", "summon-l",
    "heavy-special-windup-r", "heavy-special-windup-l",
]


def write_readme(char_dir, slug):
    files = POSE_FILES + (BOSS_EXTRA if slug == "pauly0x" else [])
    path = os.path.join(char_dir, "POSE-FILENAMES.txt")
    lines = [
        f"# {slug.upper()} — drop Grok AI images here as PNG",
        "# Folder: poses/",
        "# Facing right = -r.png   Facing left = -l.png",
        "# Transparent background preferred (or white — we can strip on import)",
        "",
    ]
    lines.extend(f + ".png" for f in files)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def write_view_html(char_dir, slug, title):
    files = POSE_FILES + (BOSS_EXTRA if slug == "pauly0x" else [])
    sections = [
        ("Idle", ["idle", "idle-breath"]),
        ("Walk", ["walk-forward-1", "walk-forward-2", "walk-backward-1", "walk-backward-2"]),
        ("Air", ["jump", "jump-peak", "falling"]),
        ("Defense", ["crouch", "block-high", "block-low"]),
        ("Hit", ["hit-stun", "crouch-hit-stun", "knockdown", "get-up"]),
        ("Result", ["victory", "defeat"]),
        ("Attacks", [
            "high-punch", "high-kick", "low-punch", "low-kick",
            "med-punch", "med-kick", "special-1", "special-2", "throw", "thrown",
        ]),
    ]
    if slug == "pauly0x":
        sections.append(("Boss", ["phase-2", "phase-3", "taunt", "summon", "heavy-special-windup"]))

    html = os.path.join(char_dir, "view-poses.html")
    parts = [
        "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">",
        f"<title>{title} Poses</title>",
        "<style>",
        "body{margin:0;padding:20px;background:#111;color:#eee;font-family:Consolas,monospace;}",
        "h1{color:#f8d878;} h2{color:#8cf;font-size:14px;margin:20px 0 8px;}",
        "p{color:#888;font-size:13px;max-width:720px;line-height:1.5;}",
        ".grid{display:flex;flex-wrap:wrap;gap:10px;}",
        ".card{background:#222;border:2px solid #444;padding:8px;width:108px;text-align:center;}",
        ".card.missing{border-color:#633;opacity:.7;}",
        "img{image-rendering:pixelated;max-width:92px;max-height:130px;display:block;margin:0 auto 4px;}",
        ".ph{height:80px;line-height:80px;color:#555;font-size:10px;}",
        "span{font-size:9px;color:#8f8;}",
        "</style></head><body>",
        f"<h1>{title}</h1>",
        "<p><strong>Grok AI makes the art.</strong> Drop pose images into <code>sources/</code> named like <code>high-punch-r.jpg</code>, then run the installer. Double-click this file to preview.</p>",
        "<p style=\"margin-top:8px;\"><img src=\"reference.jpg\" alt=\"reference\" style=\"max-height:120px;border:2px solid #444;\" onerror=\"this.style.display='none'\"></p>",
    ]

    for sec_title, bases in sections:
        parts.append(f"<h2>{sec_title}</h2><div class=\"grid\">")
        for base in bases:
            for side in ("r", "l"):
                fn = f"poses/{base}-{side}.png"
                parts.append(
                    f'<div class="card" id="{base}-{side}">'
                    f'<img src="{fn}" alt="{base}-{side}" onerror="this.style.display=\'none\';'
                    f'this.nextElementSibling.style.display=\'block\';this.parentElement.classList.add(\'missing\');">'
                    f'<div class="ph" style="display:none">missing</div>'
                    f"<span>{base}-{side}</span></div>"
                )
        parts.append("</div>")

    parts.append("</body></html>")
    with open(html, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))


def main():
    for slug in CHARACTERS:
        char_dir = os.path.join(CHAR_ROOT, slug)
        os.makedirs(os.path.join(char_dir, "poses"), exist_ok=True)
        os.makedirs(os.path.join(char_dir, "sources"), exist_ok=True)
        write_readme(char_dir, slug)
        title = "PAULY0X" if slug == "pauly0x" else slug.replace("-", " ").upper()
        if slug == "degen":
            title = "DEGEN"
        write_view_html(char_dir, slug, title)
        print("OK", char_dir)


if __name__ == "__main__":
    main()