@echo off
title Quantum Trader Bot + Dashboard
cd /d "%~dp0"
start "Quantum Trader Dashboard" cmd /k "node dashboard.js"
timeout /t 2 /nobreak >nul
start "Quantum Trader Live Bot" cmd /k "node live-scout.js"
