Set fso = CreateObject("Scripting.FileSystemObject")
boot = "C:\Users\franc\Desktop\DOSWAPZ\dev\build\_copy_install_boot.txt"
Set tf = fso.CreateTextFile(boot, True)
tf.WriteLine "vbs-start " & Now
tf.Close

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\franc\Desktop\DOSWAPZ\dev\build"
rc = sh.Run("cmd /c ""py -3 C:\Users\franc\Desktop\DOSWAPZ\dev\build\_copy_pose_batch.py > C:\Users\franc\Desktop\DOSWAPZ\dev\build\_copy_install_log.txt 2>&1""", 0, True)

Set tf = fso.CreateTextFile("C:\Users\franc\Desktop\DOSWAPZ\dev\build\_copy_install_done.txt", True)
tf.WriteLine "vbs-done rc=" & rc & " " & Now
tf.Close