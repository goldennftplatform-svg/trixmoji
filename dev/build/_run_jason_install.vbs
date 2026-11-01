Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
Set ex = sh.Exec("cmd /c py -3 dev\build\install_all_character_poses.py jason-williams")
Do While ex.Status = 0
  WScript.Sleep 200
Loop
Set f = CreateObject("Scripting.FileSystemObject").CreateTextFile("C:\Users\franc\Desktop\DOSWAPZ\dev\build\_jason_cmd.log", True)
f.Write "code=" & ex.ExitCode & vbCrLf & ex.StdOut.ReadAll() & ex.StdErr.ReadAll()
f.Close