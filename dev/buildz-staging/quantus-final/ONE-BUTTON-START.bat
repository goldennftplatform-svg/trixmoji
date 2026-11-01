@echo off
setlocal EnableExtensions EnableDelayedExpansion
title QUANTUS ONE-BUTTON MINING + DASHBOARD

echo.
echo ============================================================
echo        QUANTUS MINING + LIVE DASHBOARD
echo ============================================================
echo.
echo [1/3] Checking WSL...
wsl.exe --status >nul 2>&1
if errorlevel 1 (
    echo WSL is not available. Please make sure WSL is installed.
    pause
    exit /b 1
)

echo [2/3] Starting dashboard...
for /f "delims=" %%I in ('wsl.exe wslpath -a "%~dp0dashboard-server.py"') do set "SERVER=%%I"
if not defined SERVER (
    echo Could not find the dashboard server.
    pause
    exit /b 1
)

start "Quantus Dashboard Server" wsl.exe bash -c "python3 '!SERVER!'"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8787"

echo [3/3] Starting Quantus miner...
for /f "delims=" %%I in ('wsl.exe wslpath -a "%~dp0start-miner.sh"') do set "MINER=%%I"
if not defined MINER (
    echo Could not find the miner launcher.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   DASHBOARD: http://localhost:8787
echo   KEEP THIS WINDOW OPEN TO KEEP MINING
echo   CTRL+C STOPS THE MINER
echo ============================================================
echo.

wsl.exe bash -c "bash '!MINER!'"
echo.
echo Quantus miner stopped.
pause
endlocal
