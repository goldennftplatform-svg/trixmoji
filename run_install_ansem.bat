@echo off
py -3 "%~dp0dev\build\install_all_character_poses.py" ansem > "%~dp0dev\build\_ansem_install.txt" 2>&1
echo EXIT=%ERRORLEVEL%>> "%~dp0dev\build\_ansem_install.txt"