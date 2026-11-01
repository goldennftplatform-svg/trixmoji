Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_jimmy_install_alt.txt"

Sub RunInstall(slug)
  Set ex = sh.Exec("cmd /c set PYTHONUNBUFFERED=1 && py -3 dev\build\install_all_character_poses.py " & slug)
  Do While ex.Status = 0
    WScript.Sleep 200
  Loop
  Set f = fso.OpenTextFile(logPath, 8, True)
  f.Write ex.StdOut.ReadAll()
  f.Write ex.StdErr.ReadAll()
  If slug = "jimmy-edgar" Then
    f.Write "JIMMY_EXIT=" & ex.ExitCode & vbCrLf
  ElseIf slug = "pauly0x" Then
    f.Write "PAULY_EXIT=" & ex.ExitCode & vbCrLf
  End If
  f.Close
End Sub

Set f = fso.CreateTextFile(logPath, True)
f.Write "vbs-start " & Now & vbCrLf
f.Close

RunInstall "jimmy-edgar"
RunInstall "pauly0x"

Set f = fso.OpenTextFile(logPath, 8, True)
f.Write "VBS_DONE " & Now & vbCrLf
f.Close

On Error Resume Next
fso.CopyFile logPath, "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_jimmy_install.txt", True