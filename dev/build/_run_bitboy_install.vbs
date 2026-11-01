Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ"
logPath = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_bitboy_install_result.txt"
Set f = CreateObject("Scripting.FileSystemObject").CreateTextFile(logPath, True)
f.Write "vbs-start " & Now & vbCrLf
f.Close
code = sh.Run("cmd /c C:\Users\franc\AppData\Local\Python\bin\python.exe dev\build\install_all_character_poses.py bitboy >> """ & logPath & """ 2>&1", 0, True)
Set f = CreateObject("Scripting.FileSystemObject").OpenTextFile(logPath, 8, True)
f.Write "run-code=" & code & vbCrLf
f.Close