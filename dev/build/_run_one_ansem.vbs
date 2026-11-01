Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_one_ansem_debug.txt"
py = "C:\Users\franc\AppData\Local\Python\bin\python.exe"

Set f = fso.CreateTextFile(logPath, True)
f.Write "start " & Now & vbCrLf
f.Close

On Error Resume Next
cmd = """" & py & """ dev\build\install_all_character_poses.py ansem"
Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "cmd=" & cmd & vbCrLf
f.Close

Set ex = sh.Exec(cmd)
Set f = fso.OpenTextFile(logPath, 8, True)
If Err.Number <> 0 Then
  f.Write "exec err " & Err.Number & " " & Err.Description & vbCrLf
  f.Close
  WScript.Quit 1
End If
f.Write "exec ok status=" & ex.Status & vbCrLf
f.Close

Do While ex.Status = 0
  WScript.Sleep 500
Loop

Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "done status=" & ex.Status & " code=" & ex.ExitCode & vbCrLf
f.Write ex.StdOut.ReadAll()
f.Write ex.StdErr.ReadAll()
f.Close