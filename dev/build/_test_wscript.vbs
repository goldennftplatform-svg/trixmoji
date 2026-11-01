Set f = CreateObject("Scripting.FileSystemObject").CreateTextFile("C:\Users\franc\Desktop\DOSWAPZ\dev\build\_wscript_test.txt", True)
f.Write "wscript-ok " & Now
f.Close