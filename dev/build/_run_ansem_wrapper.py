"""Wrapper: run ansem install and write _ansem_install.txt."""
import io
import os
import sys

LOG = os.path.join(os.path.dirname(__file__), "_ansem_install.txt")
BOOT = os.path.join(os.path.dirname(__file__), "_ansem_install_boot.txt")
with open(BOOT, "w", encoding="utf-8") as _b:
    _b.write("boot\n")
EXIT = os.path.join(os.path.dirname(__file__), "_ansem_install_exit.txt")

sys.argv = [sys.argv[0], "ansem"]
sys.path.insert(0, os.path.dirname(__file__))

buf = io.StringIO()
old_stdout, old_stderr = sys.stdout, sys.stderr
code = 0
try:
    sys.stdout = sys.stderr = buf
    import install_all_character_poses as mod
    mod.main()
except SystemExit as e:
    code = int(e.code) if e.code is not None else 1
except Exception:
    import traceback
    traceback.print_exc(file=buf)
    code = 1
finally:
    sys.stdout, sys.stderr = old_stdout, old_stderr

out = buf.getvalue()
with open(LOG, "w", encoding="utf-8") as f:
    f.write(out)
    f.write(f"EXIT={code}\n")
with open(EXIT, "w", encoding="utf-8") as f:
    f.write(str(code))
sys.exit(code)