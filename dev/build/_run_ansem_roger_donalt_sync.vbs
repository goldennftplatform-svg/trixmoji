Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\ansem_roger_donalt_install_result.txt"
batPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\install_ansem_roger_donalt_detached.bat"
Set f = fso.CreateTextFile(logPath, True)
f.Write "sync launch at " & Now & vbCrLf
f.Close
code = sh.Run("""" & batPath & """", 0, True)
Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "BAT_EXIT " & code & " at " & Now & vbCrLf
f.Close