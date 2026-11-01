@echo off
set SESSION=C:\Users\franc\.grok\sessions\C%%3A%%5CWINDOWS%%5Csystem32\019f3377-108a-7513-b00a-d1b291aac125\images
set DEST=%~dp0assets\images\kol-fighter\characters\roger-ver\sources

copy /Y "%SESSION%\25.jpg" "%DEST%\high-kick-r.jpg"
copy /Y "%SESSION%\23.jpg" "%DEST%\low-punch-r.jpg"
copy /Y "%SESSION%\24.jpg" "%DEST%\low-kick-r.jpg"
copy /Y "%SESSION%\20.jpg" "%DEST%\med-punch-r.jpg"
copy /Y "%SESSION%\21.jpg" "%DEST%\med-kick-r.jpg"
copy /Y "%SESSION%\22.jpg" "%DEST%\special-1-r.jpg"
copy /Y "%SESSION%\29.jpg" "%DEST%\special-2-r.jpg"
copy /Y "%SESSION%\26.jpg" "%DEST%\crouch-r.jpg"
copy /Y "%SESSION%\28.jpg" "%DEST%\block-high-r.jpg"
copy /Y "%SESSION%\27.jpg" "%DEST%\block-low-r.jpg"
copy /Y "%SESSION%\30.jpg" "%DEST%\jump-r.jpg"
copy /Y "%SESSION%\31.jpg" "%DEST%\jump-peak-r.jpg"
copy /Y "%SESSION%\32.jpg" "%DEST%\idle-breath-r.jpg"
copy /Y "%SESSION%\33.jpg" "%DEST%\walk-forward-1-r.jpg"
copy /Y "%SESSION%\34.jpg" "%DEST%\walk-forward-2-r.jpg"
copy /Y "%SESSION%\35.jpg" "%DEST%\victory-r.jpg"
copy /Y "%SESSION%\36.jpg" "%DEST%\hit-stun-r.jpg"
copy /Y "%SESSION%\37.jpg" "%DEST%\knockdown-r.jpg"

py -3 "%~dp0dev\build\install_all_character_poses.py" roger-ver > "%~dp0dev\build\_roger_ver_install.txt" 2>&1
echo EXIT=%ERRORLEVEL%>> "%~dp0dev\build\_roger_ver_install.txt"