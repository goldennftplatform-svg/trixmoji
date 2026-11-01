Set fso = CreateObject("Scripting.FileSystemObject")
Set f = fso.CreateTextFile("C:\Users\franc\Desktop\DOSWAPZ\dev\build\_wscript_smoke.txt", True)
f.Write "smoke ok " & Now
f.Close