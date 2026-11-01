@echo off
cd /d "%~dp0"
title Set X login (identity only)
echo.
echo  SET X LOGIN  -  identity only, no timeline scrape
echo  =================================================
echo.
echo  1. Open https://developer.x.com/en/portal/dashboard
echo  2. Create a Project + App
echo  3. User authentication = OAuth 2.0, type Web App
echo  4. Callback URLs (exact):
echo       http://127.0.0.1:8890/api/auth/x
echo       https://doswapz.com/api/auth/x
echo  5. Website URL: https://doswapz.com
echo  6. Paste Client ID and Client Secret below
echo.
set /p XID=X Client ID: 
if "%XID%"=="" (
  echo No Client ID. Aborting.
  pause
  exit /b 1
)
set /p XSECRET=X Client Secret: 
if "%XSECRET%"=="" (
  echo No Client Secret. Aborting.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found.
  pause
  exit /b 1
)

node "%~dp0dev\scripts\set-x-login.mjs" --id "%XID%" --secret "%XSECRET%"
if errorlevel 1 (
  echo Failed to write .env
  pause
  exit /b 1
)

echo.
echo  Local .env updated.
echo  Optional: push the same three secrets to Netlify for production.
echo.
set /p NET=Set Netlify env now? [y/N]: 
if /i "%NET%"=="y" (
  cmd /c netlify env:set X_CLIENT_ID %XID% --force
  cmd /c netlify env:set X_CLIENT_SECRET %XSECRET% --force
  echo  Also set X_SESSION_SECRET to the value now in .env, then:
  echo    netlify env:set X_REDIRECT_URI https://doswapz.com/api/auth/x --force
  echo    netlify deploy --prod
)
echo.
echo  Restart START-SITE.bat and open:
echo    http://127.0.0.1:8890/classic/pages/arcade/x-connect.html
echo.
pause
