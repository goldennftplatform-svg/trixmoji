Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
Set fso = CreateObject("Scripting.FileSystemObject")

Sub RunInstall(slug, logName)
  Set ex = sh.Exec("cmd /c py -3 dev\build\install_all_character_poses.py " & slug)
  Do While ex.Status = 0
    WScript.Sleep 200
  Loop
  Set f = fso.CreateTextFile("C:\Users\franc\Desktop\DOSWAPZ\dev\build\" & logName, True)
  f.Write "slug=" & slug & vbCrLf
  f.Write "code=" & ex.ExitCode & vbCrLf
  f.Write ex.StdOut.ReadAll()
  f.Write ex.StdErr.ReadAll()
  f.Close
End Sub

RunInstall "jason-williams", "_jason_cmd.log"
RunInstall "bitboy", "_bitboy_cmd.log"