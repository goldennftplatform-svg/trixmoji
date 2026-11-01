"""Copy DEGEN pose sources into characters/degen/sources/."""
import os
import shutil

from character_sources import DEGEN_PRIMARY, DEGEN_SOURCES

os.makedirs(DEGEN_SOURCES, exist_ok=True)
copied = 0
for pose, src in sorted(DEGEN_PRIMARY.items()):
    if not src or not os.path.isfile(src):
        print(f"SKIP {pose}: {src}")
        continue
    dst = os.path.join(DEGEN_SOURCES, pose + ".jpg")
    if os.path.abspath(src) != os.path.abspath(dst):
        shutil.copy2(src, dst)
        copied += 1
        print(f"Copied {pose} <- {os.path.basename(src)}")
print(f"Total copied: {copied}")