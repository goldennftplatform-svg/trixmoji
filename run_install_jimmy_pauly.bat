@echo off
py -3 "%~dp0dev\build\install_all_character_poses.py" jimmy-edgar > "%~dp0dev\build\_jimmy_install.txt" 2>&1
echo JIMMY_EXIT=%ERRORLEVEL%>> "%~dp0dev\build\_jimmy_install.txt"
py -3 "%~dp0dev\build\install_all_character_poses.py" pauly0x >> "%~dp0dev\build\_jimmy_install.txt" 2>&1
echo PAULY_EXIT=%ERRORLEVEL%>> "%~dp0dev\build\_jimmy_install.txt"