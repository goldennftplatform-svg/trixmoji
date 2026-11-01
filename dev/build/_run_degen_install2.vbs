Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
Set fso = CreateObject("Scripting.FileSystemObject")
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_degen_install_result.txt"

Set f = fso.CreateTextFile(logPath, True)
f.Write "sync-start " & Now & vbCrLf
f.Close

Set ex = sh.Exec("cmd /c set PYTHONUNBUFFERED=1 && py -3 dev\build\install_all_character_poses.py degen")
Do While ex.Status = 0
  WScript.Sleep 500
Loop

Set f = fso.OpenTextFile(logPath, 8, True)
f.Write ex.StdOut.ReadAll()
f.Write ex.StdErr.ReadAll()
f.Write "DEGEN_EXIT=" & ex.ExitCode & vbCrLf
f.Write "sync-done " & Now & vbCrLf
f.Close