@echo off
echo Stopping DOSWAPZ preview server on port 8890...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":8890 .*LISTENING"') do (
  echo  Killing PID %%p
  taskkill /F /PID %%p >nul 2>&1
)
echo Done.
ping 127.0.0.1 -n 2 >nul