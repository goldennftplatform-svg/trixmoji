@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ"
set PY=C:\Users\franc\AppData\Local\Python\bin\python.exe
echo START %DATE% %TIME%> "dev\build\ansem_roger_donalt_install_result.txt"
"%PY%" "dev\build\install_all_character_poses.py" ansem >> "dev\build\ansem_roger_donalt_install_result.txt" 2>&1
echo ANSEM_EXIT %ERRORLEVEL% %DATE% %TIME%>> "dev\build\ansem_roger_donalt_install_result.txt"
"%PY%" "dev\build\install_all_character_poses.py" roger-ver >> "dev\build\ansem_roger_donalt_install_result.txt" 2>&1
echo ROGER_EXIT %ERRORLEVEL% %DATE% %TIME%>> "dev\build\ansem_roger_donalt_install_result.txt"
"%PY%" "dev\build\install_all_character_poses.py" donalt >> "dev\build\ansem_roger_donalt_install_result.txt" 2>&1
echo DONALT_EXIT %ERRORLEVEL% %DATE% %TIME%>> "dev\build\ansem_roger_donalt_install_result.txt"
"%PY%" "dev\build\ansem_hole_check.py" >> "dev\build\ansem_roger_donalt_install_result.txt" 2>&1
echo HOLE_CHECK_DONE %DATE% %TIME%>> "dev\build\ansem_roger_donalt_install_result.txt"