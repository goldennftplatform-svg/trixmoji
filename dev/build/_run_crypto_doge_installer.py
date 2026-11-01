"""Installer for crypto-bitlord + dogedesigner (skips global inbox ingest)."""
import os
import sys

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
LOG = os.path.join(ROOT, "dev", "build", "_crypto_doge_run.log")
EXIT = os.path.join(ROOT, "dev", "build", "_crypto_doge_install_exit.txt")

sys.path.insert(0, os.path.join(ROOT, "dev", "build"))
from install_all_character_poses import install_character, write_master_index


def logprint(text=""):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(text + "\n")


with open(LOG, "w", encoding="utf-8") as f:
    f.write("=== INSTALL CRYPTO-BITLORD + DOGEDESIGNER ===\n")

import builtins

_real_print = builtins.print


def tee_print(*args, **kwargs):
    text = " ".join(str(a) for a in args)
    _real_print(text, **kwargs)
    logprint(text)


counts = {}
code = 0
try:
    builtins.print = tee_print
    for slug in ("crypto-bitlord", "dogedesigner"):
        logprint(f"=== RUN {slug} ===")
        counts[slug] = install_character(slug)
        logprint(f"Done {slug}: {counts[slug]} poses")
    write_master_index()
    logprint("")
    logprint("=== POSE COUNTS ===")
    for slug, n in counts.items():
        logprint(f"{slug}: {n} poses")
except Exception as exc:
    logprint(f"ERROR: {exc}")
    code = 1

with open(EXIT, "w", encoding="ascii") as f:
    f.write(str(code))
raise SystemExit(code)