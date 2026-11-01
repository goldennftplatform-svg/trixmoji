@echo off
cd /d "%~dp0..\.."
echo.
echo  DOSWAPZ local preview — http://localhost:8890
echo.
echo  Orbit hub:  http://localhost:8890/orbit/hub.html
echo  Classic hub: http://localhost:8890/classic/hub.html
echo  Portal:      http://localhost:8890/portal.html
echo.
start http://localhost:8890/orbit/hub.html
python -m http.server 8890