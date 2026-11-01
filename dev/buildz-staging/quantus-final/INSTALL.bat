@echo off
setlocal
title Quantus Intel GPU Miner - One Click Installer
echo.
echo ==============================================================
echo        QUANTUS INTEL GPU MINER - ONE CLICK INSTALLER
echo ==============================================================
echo.
echo This will install the working Intel Iris Xe GPU mining setup.
echo Keep this window open until it says INSTALL COMPLETE.
echo.
wsl.exe bash -lc "cd '%~dp0' && chmod +x installer.sh && ./installer.sh"
if errorlevel 1 (
  echo.
  echo INSTALL FAILED. See the error above.
  pause
  exit /b 1
)
echo.
echo INSTALL COMPLETE.
echo.
echo A launcher was created in your Windows Start Menu.
echo You can also run START-MINER.bat from this folder.
echo.
pause
