Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
code = sh.Run("cmd /c py -3 dev\build\_donalt_sizes_only.py > dev\build\donalt_pose_sizes.txt 2>&1", 0, True)