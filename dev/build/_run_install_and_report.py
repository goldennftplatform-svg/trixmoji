"""Run install for michael-saylor and vitalik-buterin, write report."""
import os
import subprocess
import sys

BUILD = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(BUILD, "..", "..")
CHAR_ROOT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")
INSTALL = os.path.join(BUILD, "install_all_character_poses.py")

logs = {}
for slug in ("michael-saylor", "vitalik-buterin"):
    log_path = os.path.join(BUILD, f"_{slug.replace('-', '_')}_install.txt")
    proc = subprocess.run(
        [sys.executable, INSTALL, slug],
        capture_output=True,
        text=True,
        cwd=BUILD,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    out += f"\nEXIT={proc.returncode}"
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(out)
    logs[slug] = out

report_path = os.path.join(BUILD, "_pose_report.txt")
lines = []
for slug in ("michael-saylor", "vitalik-buterin"):
    pose_dir = os.path.join(CHAR_ROOT, slug, "poses")
    sources_dir = os.path.join(CHAR_ROOT, slug, "sources")
    pose_count = len([f for f in os.listdir(pose_dir) if f.endswith(".png")]) if os.path.isdir(pose_dir) else 0
    source_count = len([f for f in os.listdir(sources_dir) if f.endswith((".jpg", ".png"))]) if os.path.isdir(sources_dir) else 0
    hp = os.path.join(pose_dir, "high-punch-r.png")
    idle = os.path.join(pose_dir, "idle-r.png")
    hp_size = os.path.getsize(hp) if os.path.isfile(hp) else 0
    idle_size = os.path.getsize(idle) if os.path.isfile(idle) else 0
    lines.append(f"{slug}: poses={pose_count} sources={source_count}")
    lines.append(f"  high-punch-r.png = {hp_size} bytes")
    lines.append(f"  idle-r.png = {idle_size} bytes")
    lines.append("")

with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("\n".join(lines))