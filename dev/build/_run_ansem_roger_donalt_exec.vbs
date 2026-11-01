Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\ansem_roger_donalt_install_result2.txt"
py = "C:\Users\franc\AppData\Local\Python\bin\python.exe"

Set f = fso.CreateTextFile(logPath, True)
f.Write "EXEC launch at " & Now & vbCrLf
f.Close

cmd = """" & py & """ dev\build\install_all_character_poses.py ansem"
Set ex = sh.Exec(cmd)
Do While ex.Status = 0
  WScript.Sleep 200
Loop
Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "=== ANSEM ===" & vbCrLf
f.Write ex.StdOut.ReadAll()
f.Write ex.StdErr.ReadAll()
f.Write "ANSEM_EXIT " & ex.ExitCode & " " & Now & vbCrLf
f.Close

cmd = """" & py & """ dev\build\install_all_character_poses.py roger-ver"
Set ex = sh.Exec(cmd)
Do While ex.Status = 0
  WScript.Sleep 200
Loop
Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "=== ROGER-VER ===" & vbCrLf
f.Write ex.StdOut.ReadAll()
f.Write ex.StdErr.ReadAll()
f.Write "ROGER_EXIT " & ex.ExitCode & " " & Now & vbCrLf
f.Close

cmd = """" & py & """ dev\build\install_all_character_poses.py donalt"
Set ex = sh.Exec(cmd)
Do While ex.Status = 0
  WScript.Sleep 200
Loop
Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "=== DONALT ===" & vbCrLf
f.Write ex.StdOut.ReadAll()
f.Write ex.StdErr.ReadAll()
f.Write "DONALT_EXIT " & ex.ExitCode & " " & Now & vbCrLf
f.Close

cmd = """" & py & """ dev\build\ansem_hole_check.py"
Set ex = sh.Exec(cmd)
Do While ex.Status = 0
  WScript.Sleep 200
Loop
Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "=== HOLE CHECK ===" & vbCrLf
f.Write ex.StdOut.ReadAll()
f.Write ex.StdErr.ReadAll()
f.Write "HOLE_EXIT " & ex.ExitCode & " " & Now & vbCrLf
f.Write "ALL_DONE " & Now & vbCrLf
f.Close