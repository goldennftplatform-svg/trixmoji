Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
Set ex = sh.Exec("cmd /c set PYTHONUNBUFFERED=1 && ""C:\Users\franc\Desktop\DOSWAPZ\run_reinstall_remaining.bat""")
Do While ex.Status = 0
  WScript.Sleep 500
Loop
Set f = CreateObject("Scripting.FileSystemObject").OpenTextFile("C:\Users\franc\Desktop\DOSWAPZ\dev\build\_reinstall_all_exit.txt", 2, True)
f.WriteLine "remaining_exit=" & ex.ExitCode & " at " & Now
f.Close