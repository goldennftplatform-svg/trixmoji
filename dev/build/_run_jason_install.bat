@echo off
cd /d C:\Users\franc\Desktop\DOSWAPZ
py -3 dev\build\install_all_character_poses.py jason-williams > dev\build\_jason_install_out.txt 2>&1
echo EXIT=%ERRORLEVEL%>> dev\build\_jason_install_out.txt