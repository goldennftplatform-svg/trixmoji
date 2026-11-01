Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_jimmy_install.txt"
waitPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_jimmy_install_wait.txt"
Set f = fso.CreateTextFile(waitPath, True)
f.Write "wait-start " & Now & vbCrLf
f.Close

For i = 1 To 120
  WScript.Sleep 5000
  On Error Resume Next
  Set rf = fso.OpenTextFile(logPath, 1, False)
  If Err.Number = 0 Then
    content = rf.ReadAll()
    rf.Close
    If Len(content) > 0 Then
      Set wf = fso.OpenTextFile(waitPath, 8, True)
      wf.Write "ready-after-" & (i * 5) & "s " & Now & vbCrLf
      wf.Write content
      wf.Close
      WScript.Quit 0
    End If
  End If
  Err.Clear
Next

Set wf = fso.OpenTextFile(waitPath, 8, True)
wf.Write "timeout " & Now & vbCrLf
wf.Close