@echo on
cd /d C:\Users\franc\Desktop\DOSWAPZ
echo BAT_START>> dev\build\_bitboy_install_out.txt
C:\Users\franc\AppData\Local\Python\bin\python.exe dev\build\install_all_character_poses.py bitboy>> dev\build\_bitboy_install_out.txt 2>&1
echo EXIT=%ERRORLEVEL%>> dev\build\_bitboy_install_out.txt