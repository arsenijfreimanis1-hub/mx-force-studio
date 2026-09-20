@echo off
setlocal
title MX Bikes Force Studio
cd /d "%~dp0"

echo.
echo Creating the MX Force Studio icon on your Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\create-shortcut.ps1"
echo.

call "%~dp0Force Studio.cmd"
