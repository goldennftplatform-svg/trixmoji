@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ"
set PY=C:\Users\franc\AppData\Local\Python\bin\python.exe
set LOG=dev\build\roger_donalt_install_result.txt
echo START %DATE% %TIME%> "%LOG%"
"%PY%" "dev\build\install_all_character_poses.py" roger-ver >> "%LOG%" 2>&1
echo ROGER_EXIT %ERRORLEVEL% %DATE% %TIME%>> "%LOG%"
"%PY%" "dev\build\install_all_character_poses.py" donalt >> "%LOG%" 2>&1
echo DONALT_EXIT %ERRORLEVEL% %DATE% %TIME%>> "%LOG%"