@echo off
py -3 "%~dp0dev\build\install_all_character_poses.py" michael-saylor > "%~dp0dev\build\_michael_saylor_install.txt" 2>&1
echo EXIT=%ERRORLEVEL%>> "%~dp0dev\build\_michael_saylor_install.txt"