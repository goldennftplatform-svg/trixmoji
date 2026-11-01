import os, sys, traceback
B = r"Z:\dev\build"
open(os.path.join(B, "o.txt"), "w").write("boot\n")
try:
    sys.path.insert(0, B)
    import install_all_character_poses as i
    R = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\kol-fighter\characters"
    out = []
    for s in ("michael-saylor", "vitalik-buterin"):
        open(os.path.join(B, "o.txt"), "a").write(f"installing {s}\n")
        c = i.install_character(s)
        out.append(f"Done {s}: {c}")
        with open(os.path.join(B, f"_{s.replace('-','_')}_install.txt"), "w", encoding="utf-8") as f:
            f.write(f"Done {s}: {c}\nEXIT=0\n")
    L = []
    for s in ("michael-saylor", "vitalik-buterin"):
        d = os.path.join(R, s, "poses")
        n = len([f for f in os.listdir(d) if f.endswith(".png")])
        hp = os.path.getsize(os.path.join(d, "high-punch-r.png"))
        idl = os.path.getsize(os.path.join(d, "idle-r.png"))
        L += [f"{s}: {n} poses", f"  high-punch-r.png = {hp} bytes", f"  idle-r.png = {idl} bytes", ""]
    t = "\n".join(L)
    with open(os.path.join(B, "_pose_report.txt"), "w", encoding="utf-8") as f:
        f.write(t)
    with open(os.path.join(B, "o.txt"), "a", encoding="utf-8") as f:
        f.write(t + "\n" + "\n".join(out))
except Exception:
    with open(os.path.join(B, "o.txt"), "a", encoding="utf-8") as f:
        f.write(traceback.format_exc())