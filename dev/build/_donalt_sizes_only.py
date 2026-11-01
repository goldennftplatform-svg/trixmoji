import os
p = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\kol-fighter\characters\donalt\poses"
out = r"C:\Users\franc\Desktop\DOSWAPZ-v2\dev\build\_donalt_pose_sizes.txt"
lines = []
for f in ("idle-r.png", "high-punch-r.png", "high-kick-r.png"):
    fp = os.path.join(p, f)
    if os.path.exists(fp):
        lines.append(f"{f}: {os.path.getsize(fp)} bytes")
    else:
        lines.append(f"{f}: MISSING")
open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))