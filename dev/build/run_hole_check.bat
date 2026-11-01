@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ"
set PY=C:\Users\franc\AppData\Local\Python\bin\python.exe
echo START %DATE% %TIME%> "dev\build\ansem_hole_check_result.txt"
"%PY%" "dev\build\ansem_hole_check.py" >> "dev\build\ansem_hole_check_result.txt" 2>&1
echo EXIT %ERRORLEVEL% %DATE% %TIME%>> "dev\build\ansem_hole_check_result.txt"