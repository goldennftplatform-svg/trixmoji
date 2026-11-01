Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\ansem_roger_donalt_ps1_launch.txt"
ps1 = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_run_ansem_roger_donalt.ps1"
Set f = fso.CreateTextFile(logPath, True)
f.Write "launched ps1 detached at " & Now & vbCrLf
f.Close
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & ps1 & """", 0, False