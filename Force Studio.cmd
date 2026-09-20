@echo off
setlocal
title MX Bikes Force Studio
cd /d "%~dp0"
if not exist "%~dp0windows\launch.ps1" (
  echo Missing windows\launch.ps1
  echo Double-click "MX Force Studio.bat" from the mx-hub folder instead.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\launch.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
