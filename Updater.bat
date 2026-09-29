@echo off
setlocal EnableExtensions
title MX Force Studio - Updater
cd /d "%~dp0"
echo.
echo MX Force Studio - Updater
echo Forces a clean rebuild, reinstalls the plugin, then starts the app.
echo Keep this window open. Close it to stop.
echo.
set "MXFS_FORCE_UPDATE=1"
if exist "%~dp0Installer.bat" (
  call "%~dp0Installer.bat"
  exit /b %ERRORLEVEL%
)
echo Missing Installer.bat next to this file.
pause
exit /b 1
