@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules\bs58 (
  echo Installing required Node packages...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)
if not exist .env (
  echo ERROR: .env is missing from this folder.
  echo Copy your existing .env here, then run this file again.
  exit /b 1
)
set ENABLE_LIVE=true
node live-scout.js
