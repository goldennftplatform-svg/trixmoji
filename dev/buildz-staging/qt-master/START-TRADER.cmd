@echo off
title QUANTUM TRADER - BOT + DASHBOARD
cd /d "%~dp0"

echo ==========================================
echo       QUANTUM TRADER + DASHBOARD
echo ==========================================
echo.
echo Starting dashboard...
start "Quantum Trader Dashboard" cmd /k "cd /d ""%~dp0"" && node dashboard.js"

timeout /t 2 /nobreak >nul

echo Starting trading bot...
start "Quantum Trader Bot" cmd /k "cd /d ""%~dp0"" && npm.cmd run live"

echo.
echo Dashboard: http://127.0.0.1:8787
echo.
echo Two windows have been opened:
echo   1. Dashboard
echo   2. Trading bot
echo.
pause
