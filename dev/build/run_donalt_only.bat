@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ"
set PY=C:\Users\franc\AppData\Local\Python\bin\python.exe
echo START %DATE% %TIME%> "dev\build\donalt_only_result.txt"
"%PY%" "dev\build\install_all_character_poses.py" donalt >> "dev\build\donalt_only_result.txt" 2>&1
echo DONALT_EXIT %ERRORLEVEL% %DATE% %TIME%>> "dev\build\donalt_only_result.txt"