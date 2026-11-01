@echo off
cd /d "%~dp0"
title Set Harbinger XAI key
echo.
echo  SET HARBINGER XAI KEY
echo  ====================
echo  1. Open https://console.x.ai
echo  2. DELETE any old keys that were shared/pasted
echo  3. Create a NEW API key
echo  4. Paste it below (it will not be shown again in this window)
echo.
echo  Credits: buy when ready — without credits, chat stays offline.
echo.
set /p KEY=New XAI_API_KEY: 
if "%KEY%"=="" (
  echo No key entered. Aborting.
  pause
  exit /b 1
)

REM Write local .env (preserve model settings)
(
echo # Local only — gitignored
echo XAI_API_KEY=%KEY%
echo XAI_MODEL=grok-4.5
echo HARBINGER_MAX_TOKENS=500
echo HARBINGER_RATE_PER_MIN=12
echo HARBINGER_RATE_PER_DAY=80
echo HARBINGER_ALLOWED_ORIGINS=http://127.0.0.1:8890,http://localhost:8890,https://doswapz.com,https://www.doswapz.com,https://doswapz.netlify.app
) > .env

echo.
echo  Local .env updated.
echo  Pushing to Netlify env...
cmd /c netlify env:set XAI_API_KEY %KEY% --force
if errorlevel 1 (
  echo  Netlify set failed — check netlify login. Local .env is still set.
) else (
  echo  Netlify XAI_API_KEY set. Redeploy needed for production.
  echo.
  set /p DEPLOY=Redeploy production now? [y/N]: 
  if /i "%DEPLOY%"=="y" (
    cmd /c netlify deploy --prod
  ) else (
    echo  Skip deploy. When ready: netlify deploy --prod
  )
)
echo.
echo  Done. Restart local server: START-SITE.bat
pause
