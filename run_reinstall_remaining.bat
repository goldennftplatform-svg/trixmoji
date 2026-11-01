@echo off
set LOG=%~dp0dev\build\_reinstall_all.txt
echo.>> "%LOG%"
echo === REMAINING RUN ===>> "%LOG%"
for %%C in (donalt roger-ver ansem michael-saylor jason-williams bitboy crypto-bitlord dogedesigner jimmy-edgar pauly0x) do (
  echo.>> "%LOG%"
  echo === %%C ===>> "%LOG%"
  py -3 "%~dp0dev\build\install_all_character_poses.py" %%C >> "%LOG%" 2>&1
)
echo REINSTALL_DONE>> "%LOG%"