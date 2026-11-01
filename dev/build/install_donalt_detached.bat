@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ"
echo START %DATE% %TIME%> "dev\build\donalt_install_result.txt"
py -3 "dev\build\install_all_character_poses.py" donalt >> "dev\build\donalt_install_result.txt" 2>&1
echo EXIT %ERRORLEVEL% %DATE% %TIME%>> "dev\build\donalt_install_result.txt"
py -3 "dev\build\_donalt_sizes_only.py" >> "dev\build\donalt_install_result.txt" 2>&1
echo SIZES_DONE %DATE% %TIME%>> "dev\build\donalt_install_result.txt"