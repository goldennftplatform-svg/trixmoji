Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ\dev\build"
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File ""C:\Users\franc\Desktop\DOSWAPZ\dev\build\_run_crypto_doge.ps1""", 0, True