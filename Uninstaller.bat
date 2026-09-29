@echo off
setlocal EnableExtensions
title MX Force Studio - Uninstaller
cd /d "%~dp0"
echo.
echo This removes Force Studio from this PC:
echo   Desktop and Start Menu icons
echo   App files under %%LOCALAPPDATA%%\MXForceStudio
echo   The MX Bikes plugin (spreadsheets stay)
echo.
echo Your downloaded folder is not deleted.
echo Close the Force Studio window first if it is still open.
echo.
pause
if not exist "%~dp0windows\uninstall.ps1" (
  echo Missing windows\uninstall.ps1
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { Unblock-File -LiteralPath '%~dp0windows\uninstall.ps1' -ErrorAction SilentlyContinue } catch {}"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\uninstall.ps1"
set "MXFS_ERR=%ERRORLEVEL%"
echo.
if not "%MXFS_ERR%"=="0" (
  echo Uninstall did not finish cleanly.
  pause
  exit /b %MXFS_ERR%
)
pause
exit /b 0
