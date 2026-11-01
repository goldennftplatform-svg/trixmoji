"""Run DEGEN pose install with explicit log file (detached-safe)."""
import os
import sys

LOG = r"C:\Users\franc\Desktop\DOSWAPZ-v2\dev\build\_degen_install_result.txt"
BUILD = os.path.dirname(__file__)
sys.path.insert(0, BUILD)
os.chdir(r"C:\Users\franc\Desktop\DOSWAPZ-v2")

class Tee:
    def __init__(self, path):
        self.file = open(path, "a", encoding="utf-8")

    def write(self, data):
        self.file.write(data)
        self.file.flush()

    def flush(self):
        self.file.flush()


if __name__ == "__main__":
    with open(LOG, "a", encoding="utf-8") as f:
        f.write("inline-start\n")
    sys.argv = ["install_all_character_poses.py", "degen"]
    sys.stdout = Tee(LOG)
    sys.stderr = sys.stdout
    import install_all_character_poses as installer

    installer.main()
    sys.stdout.write("inline-done\n")