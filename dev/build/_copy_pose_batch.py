"""Copy session pose images to character sources folders."""
import os
import shutil

SESSION = r"C:\Users\franc\.grok\sessions\C%3A%5CWINDOWS%5Csystem32\019f33ae-9cda-7072-bd6d-6011272a7e13\images"
ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\kol-fighter\characters"

MICHAEL = {
    "1.jpg": "high-punch-r",
    "2.jpg": "med-punch-r",
    "3.jpg": "high-kick-r",
    "4.jpg": "low-kick-r",
    "5.jpg": "low-punch-r",
    "6.jpg": "block-high-r",
    "7.jpg": "special-1-r",
    "8.jpg": "special-2-r",
    "9.jpg": "med-kick-r",
    "10.jpg": "crouch-r",
    "11.jpg": "jump-peak-r",
    "12.jpg": "block-low-r",
    "13.jpg": "jump-r",
    "14.jpg": "idle-breath-r",
    "15.jpg": "walk-forward-1-r",
    "16.jpg": "victory-r",
    "17.jpg": "knockdown-r",
    "18.jpg": "hit-stun-r",
    "19.jpg": "walk-forward-2-r",
}

VITALIK = {
    "20.jpg": "med-punch-r",
    "21.jpg": "low-punch-r",
    "22.jpg": "high-kick-r",
    "23.jpg": "high-punch-r",
    "24.jpg": "low-kick-r",
    "25.jpg": "med-kick-r",
    "26.jpg": "block-high-r",
    "27.jpg": "special-1-r",
    "28.jpg": "crouch-r",
    "29.jpg": "special-2-r",
    "30.jpg": "idle-breath-r",
    "31.jpg": "block-low-r",
    "32.jpg": "jump-peak-r",
    "33.jpg": "jump-r",
    "34.jpg": "walk-forward-1-r",
    "35.jpg": "victory-r",
    "36.jpg": "walk-forward-2-r",
    "37.jpg": "knockdown-r",
    "38.jpg": "hit-stun-r",
}


def copy_map(slug, mapping):
    dst_dir = os.path.join(ROOT, slug, "sources")
    os.makedirs(dst_dir, exist_ok=True)
    copied = []
    for src_name, pose in sorted(mapping.items(), key=lambda x: int(x[0].split(".")[0])):
        src = os.path.join(SESSION, src_name)
        dst = os.path.join(dst_dir, pose + ".jpg")
        if not os.path.isfile(src):
            print(f"MISSING {src}")
            continue
        shutil.copy2(src, dst)
        copied.append(pose)
        print(f"Copied {slug}/{pose}.jpg <- {src_name}")
    return copied


BUILD = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Users\franc\Desktop\DOSWAPZ-v2\dev\build"


def run_install(slug):
    import subprocess
    script = os.path.join(BUILD, "install_all_character_poses.py")
    log = os.path.join(BUILD, f"_{slug.replace('-', '_')}_install.txt")
    proc = subprocess.run([sys.executable, script, slug], capture_output=True, text=True)
    out = (proc.stdout or "") + (proc.stderr or "") + f"\nEXIT={proc.returncode}"
    with open(log, "w", encoding="utf-8") as f:
        f.write(out)
    return proc.returncode


def report():
    lines = []
    for slug in ("michael-saylor", "vitalik-buterin"):
        pose_dir = os.path.join(ROOT, slug, "poses")
        sources_dir = os.path.join(ROOT, slug, "sources")
        pose_count = len([f for f in os.listdir(pose_dir) if f.endswith(".png")])
        source_count = len([f for f in os.listdir(sources_dir) if f.endswith((".jpg", ".png"))])
        hp = os.path.join(pose_dir, "high-punch-r.png")
        idle = os.path.join(pose_dir, "idle-r.png")
        lines.append(f"{slug}: poses={pose_count} sources={source_count}")
        lines.append(f"  high-punch-r.png = {os.path.getsize(hp)} bytes")
        lines.append(f"  idle-r.png = {os.path.getsize(idle)} bytes")
    text = "\n".join(lines)
    report_path = os.path.join(BUILD, "_pose_report.txt")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(text)


if __name__ == "__main__":
    import sys

    m = copy_map("michael-saylor", MICHAEL)
    v = copy_map("vitalik-buterin", VITALIK)
    print(f"\nmichael-saylor: {len(m)} poses copied")
    print(f"vitalik-buterin: {len(v)} poses copied")
    run_install("michael-saylor")
    run_install("vitalik-buterin")
    print()
    report()