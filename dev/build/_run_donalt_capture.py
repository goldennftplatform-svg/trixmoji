import io
import os
import sys

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, "dev", "build"))
sys.argv = ["install_all_character_poses.py", "donalt"]

log_path = os.path.join(ROOT, "dev", "build", "donalt_capture_log.txt")


class Tee(io.TextIOBase):
    def __init__(self, path):
        self.path = path
        self.buf = io.StringIO()
        open(self.path, "w", encoding="utf-8").write("CAPTURE_START\n")

    def write(self, s):
        self.buf.write(s)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(s)
        return len(s)

    def flush(self):
        pass


tee = Tee(log_path)
old_out, old_err = sys.stdout, sys.stderr
code = 0
try:
    sys.stdout = sys.stderr = tee
    import install_all_character_poses as installer

    count = installer.install_character("donalt")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"\nInstalled {count} pose PNGs for donalt\n")
except Exception:
    import traceback

    traceback.print_exc()
    code = 1
finally:
    sys.stdout, sys.stderr = old_out, old_err
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"\nCAPTURE_EXIT={code}\n")
    raise SystemExit(code)