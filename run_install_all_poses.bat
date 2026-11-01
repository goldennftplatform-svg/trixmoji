@echo off
cd /d "%~dp0"
python dev\build\setup_character_folders.py
python dev\build\install_all_character_poses.py
if errorlevel 1 exit /b 1
start "" "assets\images\kol-fighter\characters\view-all-poses.html"
exit /b 0