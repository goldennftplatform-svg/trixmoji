import os
from datetime import datetime

pose_dir = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\kol-fighter\characters\degen\poses"
log_path = r"C:\Users\franc\Desktop\DOSWAPZ-v2\dev\build\_degen_status.txt"
target = os.path.join(pose_dir, "high-punch-r.png")

lines = []
lines.append(f"checked_at={datetime.now()}")
lines.append(f"high_punch_exists={os.path.isfile(target)}")
if os.path.isfile(target):
    st = os.stat(target)
    lines.append(f"high_punch_mtime={datetime.fromtimestamp(st.st_mtime)}")
    lines.append(f"high_punch_size={st.st_size}")

pngs = [f for f in os.listdir(pose_dir) if f.endswith(".png")] if os.path.isdir(pose_dir) else []
lines.append(f"pose_count={len(pngs)}")

with open(log_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")