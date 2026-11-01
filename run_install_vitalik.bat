@echo off
py -3 "%~dp0dev\build\install_all_character_poses.py" vitalik-buterin > "%~dp0dev\build\_vitalik_install.txt" 2>&1
echo EXIT=%ERRORLEVEL%>> "%~dp0dev\build\_vitalik_install.txt"