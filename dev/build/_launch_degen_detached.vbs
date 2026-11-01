Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\degen_install_exit.txt"
batPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\install_degen_detached.bat"
Set f = fso.CreateTextFile(logPath, True)
f.Write "launched detached at " & Now & vbCrLf
f.Close
sh.Run """" & batPath & """", 0, False