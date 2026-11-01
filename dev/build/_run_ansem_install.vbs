Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ\dev\build"
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File ""C:\Users\franc\Desktop\DOSWAPZ\dev\build\_run_ansem.ps1""", 0, True