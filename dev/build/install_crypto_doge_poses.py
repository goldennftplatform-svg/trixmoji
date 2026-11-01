"""Copy generated pose JPGs and install crypto-bitlord + dogedesigner."""
import os
import shutil
import sys

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
SESSION = (
    r"C:\Users\franc\.grok\sessions"
    r"\C%3A%5CWINDOWS%5Csystem32\019f33ae-9cda-7072-bd6d-603686ddfe06\images"
)

CBL_MAP = {
    1: "low-punch-r",
    2: "high-kick-r",
    3: "med-punch-r",
    4: "low-kick-r",
    5: "high-punch-r",
    6: "block-high-r",
    7: "med-kick-r",
    8: "special-1-r",
    9: "crouch-r",
    10: "special-2-r",
    11: "jump-peak-r",
    12: "walk-forward-1-r",
    13: "block-low-r",
    14: "idle-breath-r",
    15: "jump-r",
    16: "victory-r",
    17: "hit-stun-r",
    18: "walk-forward-2-r",
    19: "knockdown-r",
}

DOGE_MAP = {
    20: "low-punch-r",
    21: "high-kick-r",
    22: "high-punch-r",
    23: "low-kick-r",
    24: "med-punch-r",
    25: "block-high-r",
    26: "crouch-r",
    27: "special-1-r",
    28: "med-kick-r",
    29: "special-2-r",
    30: "jump-peak-r",
    31: "jump-r",
    32: "block-low-r",
    33: "idle-breath-r",
    34: "walk-forward-1-r",
    35: "victory-r",
    36: "walk-forward-2-r",
    37: "knockdown-r",
    38: "hit-stun-r",
}


def copy_map(dest_dir, mapping):
    os.makedirs(dest_dir, exist_ok=True)
    for num, pose in mapping.items():
        src = os.path.join(SESSION, f"{num}.jpg")
        dst = os.path.join(dest_dir, f"{pose}.jpg")
        shutil.copy2(src, dst)
        print(f"Copied {num}.jpg -> {dst}")


def main():
    sys.path.insert(0, os.path.dirname(__file__))
    from install_all_character_poses import install_character, write_master_index

    char_root = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")
    copy_map(os.path.join(char_root, "crypto-bitlord", "sources"), CBL_MAP)
    copy_map(os.path.join(char_root, "dogedesigner", "sources"), DOGE_MAP)

    counts = {}
    for slug in ("crypto-bitlord", "dogedesigner"):
        counts[slug] = install_character(slug)
    write_master_index()

    print("\n=== POSE COUNTS ===")
    for slug, n in counts.items():
        print(f"{slug}: {n} poses")
    return 0


if __name__ == "__main__":
    log_path = os.path.join(ROOT, "dev", "build", "_crypto_doge_run.log")
    with open(log_path, "w", encoding="utf-8") as log:
        import builtins
        _real_print = builtins.print

        def logprint(*args, **kwargs):
            text = " ".join(str(a) for a in args)
            _real_print(text, **kwargs)
            log.write(text + "\n")
            log.flush()

        builtins.print = logprint
        try:
            code = main()
            logprint(f"EXIT={code}")
            raise SystemExit(code)
        except Exception as exc:
            logprint(f"ERROR: {exc}")
            logprint("EXIT=1")
            raise SystemExit(1)