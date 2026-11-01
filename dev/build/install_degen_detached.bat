@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ"
echo START %DATE% %TIME%> "dev\build\_degen_reinstall.txt"
py -3 "dev\build\install_all_character_poses.py" degen >> "dev\build\_degen_reinstall.txt" 2>&1
echo EXIT %ERRORLEVEL% %DATE% %TIME%>> "dev\build\_degen_reinstall.txt"