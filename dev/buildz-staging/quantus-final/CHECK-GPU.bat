@echo off
title Quantus GPU Diagnostic
wsl.exe bash -lc "$HOME/Quantus-OneClick/check-gpu.sh"
pause
