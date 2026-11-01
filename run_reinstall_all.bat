@echo off
set LOG=%~dp0dev\build\_reinstall_all.txt
echo REINSTALL_START > "%LOG%"
for %%C in (degen donalt roger-ver ansem michael-saylor vitalik-buterin jason-williams bitboy crypto-bitlord dogedesigner jimmy-edgar pauly0x) do (
  echo.>> "%LOG%"
  echo === %%C ===>> "%LOG%"
  py -3 "%~dp0dev\build\install_all_character_poses.py" %%C >> "%LOG%" 2>&1
)
echo REINSTALL_DONE>> "%LOG%"