Set fso = CreateObject("Scripting.FileSystemObject")
Set f = fso.CreateTextFile("C:\Users\franc\Desktop\DOSWAPZ\dev\build\vbs_test_marker.txt", True)
f.WriteLine "vbs ran at " & Now
f.Close