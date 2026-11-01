@echo off
cd /d "%~dp0"
echo Starting DOSWAPZ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8890 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
start "DOSWAPZ-8890" /MIN cmd /c "node start-site-server.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8890/classic/pages/harbinger.html"
exit /b 0
