@echo off
setlocal EnableExtensions
title MX Force Studio - Updater
cd /d "%~dp0"
echo.
echo MX Force Studio - Updater
echo Downloads / rebuilds. Does not start the app.
echo.
set "MXFS_FORCE_UPDATE=1"
set "MXFS_UPDATE_ONLY=1"
if not exist "%~dp0windows\launch.ps1" (
  echo Missing windows\launch.ps1
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\launch.ps1"
set "MXFS_ERR=%ERRORLEVEL%"
if not "%MXFS_ERR%"=="0" (
  echo.
  echo Updater did not finish. The message above is the reason.
  echo.
  pause
  exit /b %MXFS_ERR%
)
exit /b 0
