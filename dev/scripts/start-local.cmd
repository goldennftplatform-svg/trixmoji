@echo off
cd /d "%~dp0..\.."
echo.
echo  DOSWAPZ local preview
echo  Open: http://localhost:8888/classic/hub.html
echo.
echo  (Port 3456 is blocked on some Windows PCs — using 8888)
echo.
npx.cmd --yes serve -l 8888 .
if errorlevel 1 (
  echo serve failed — trying Python on port 8888...
  python -m http.server 8888 --directory "%CD%"
)