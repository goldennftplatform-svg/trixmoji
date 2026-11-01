@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ\dev\build"
"C:\Users\franc\AppData\Local\Python\bin\python.exe" install_all_character_poses.py michael-saylor > _michael_saylor_install.txt 2>&1
echo EXIT=%ERRORLEVEL%>> _michael_saylor_install.txt
"C:\Users\franc\AppData\Local\Python\bin\python.exe" install_all_character_poses.py vitalik-buterin > _vitalik_install.txt 2>&1
echo EXIT=%ERRORLEVEL%>> _vitalik_install.txt