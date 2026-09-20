@echo off
setlocal
title MX Bikes Force Studio
cd /d "%~dp0"

echo.
echo MX Bikes Force Studio
echo Keep this window open. Close it to stop.
echo.

if exist "%~dp0windows\launch.ps1" goto :launch

echo This .bat was saved by itself — the rest of the app is not here.
echo Downloading Node.js and the app into %LOCALAPPDATA%\MXForceStudio ...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
  "$dest = Join-Path $env:LOCALAPPDATA 'MXForceStudio\app';" ^
  "New-Item -ItemType Directory -Force -Path $dest | Out-Null;" ^
  "$git = Get-Command git -ErrorAction SilentlyContinue;" ^
  "if (-not $git) { throw 'Git is not installed. Install Git from https://git-scm.com/download/win then double-click this file again, OR extract the whole mx-hub folder and run MX Force Studio.bat from inside it.' };" ^
  "if (Test-Path (Join-Path $dest '.git')) { git -C $dest fetch origin cursor/windows-clickable-launcher-e196; git -C $dest checkout cursor/windows-clickable-launcher-e196; git -C $dest pull origin cursor/windows-clickable-launcher-e196 } else { git clone --depth 1 --branch cursor/windows-clickable-launcher-e196 https://origin.cursor.com/git/arsenij-freimanis/mx-hub.git $dest };" ^
  "& (Join-Path $dest 'windows\launch.ps1')"
if errorlevel 1 goto :fail
goto :eof

:launch
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\launch.ps1"
if errorlevel 1 goto :fail
goto :eof

:fail
echo.
echo The app did not start. The message above is the reason.
echo.
echo You must run this from the mx-hub folder (next to package.json),
echo not a lone copy of the .bat in Downloads.
echo.
pause
exit /b 1
