@echo off
setlocal EnableExtensions
title MX Force Studio - Installer
cd /d "%~dp0"
echo.
echo MX Force Studio - Installer
echo A Force Studio window will open on this PC.
echo Close that window to stop.
echo.
echo If Windows SmartScreen appears: More info, then Run anyway.
echo First run needs internet (Node.js + packages).
echo.
if not exist "%~dp0windows\launch.ps1" (
  echo Missing windows\launch.ps1
  echo Extract the whole GitHub zip folder first.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Unblock-File -LiteralPath '%~f0' -ErrorAction SilentlyContinue } catch {}; Get-ChildItem -LiteralPath '%~dp0windows' -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { try { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue } catch {} }"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\launch.ps1"
set "MXFS_ERR=%ERRORLEVEL%"
if not "%MXFS_ERR%"=="0" (
  echo.
  echo Installer did not finish. The message above is the reason.
  echo.
  pause
  exit /b %MXFS_ERR%
)
exit /b 0
