@echo off
cd /d "%~dp0"
python dev\build\install_all_character_poses.py degen
if errorlevel 1 exit /b 1
start "" "assets\images\kol-fighter\characters\degen\view-poses.html"
exit /b 0