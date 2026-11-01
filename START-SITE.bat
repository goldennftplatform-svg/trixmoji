@echo off
title DOSWAPZ SITE - KEEP OPEN
color 0A
cd /d "%~dp0"

echo.
echo  ============================================
echo   DOSWAPZ LOCAL SITE
echo  ============================================
echo.
echo  KEEP THIS WINDOW OPEN while you browse.
echo  Closing it turns the site OFF.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Node.js not found.
  echo  Install from https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8890 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8890/go.html"
node "%~dp0start-site-server.js"

echo.
echo  Server stopped.
pause
