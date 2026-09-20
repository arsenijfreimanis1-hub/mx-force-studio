@echo off
setlocal
title MX Bikes Force Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :need_node

if not exist "node_modules\" (
  echo Installing packages ^(first run only, takes a minute^)...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist ".next\BUILD_ID" (
  echo Building Force Studio ^(first run only, takes a minute^)...
  call npm run build
  if errorlevel 1 goto :fail
)

REM Make sure the clickable Desktop / Start Menu icon exists.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\create-shortcut.ps1" >nul 2>nul

echo Installing the MX Bikes telemetry plugin...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\install-plugin.ps1"
echo.

echo.
echo ================================================================
echo   MX Bikes Force Studio
echo   Your browser will open at http://127.0.0.1:43187
echo   Keep this window open while you ride. Close it to stop.
echo   If MX Bikes is already open, restart it so the plugin loads.
echo ================================================================
echo.

REM Live telemetry bridge (UDP 47387 -^> app). Stops when this window closes.
start "" /b node bridge/udp-bridge.mjs

REM Open the browser as soon as the server answers, then tell the rider what to do.
start "" /b powershell -NoProfile -Command "$u='http://127.0.0.1:43187'; for($i=0;$i -lt 120;$i++){ try{ $null = Invoke-WebRequest -UseBasicParsing $u -TimeoutSec 1; Start-Process $u; Write-Host ''; Write-Host '================================================================' -ForegroundColor Green; Write-Host '  APP READY -- now launch MX Bikes, then click Connect in the' -ForegroundColor Green; Write-Host '  browser to stream live forces.' -ForegroundColor Green; Write-Host '================================================================' -ForegroundColor Green; break } catch { Start-Sleep -Milliseconds 500 } }"

REM Run the visualizer in the foreground. Closing this window stops everything.
call npm run start
goto :eof

:need_node
echo Node.js is not installed, so Force Studio cannot start.
echo.
echo Install it once, then double-click this icon again:
echo   winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
echo.
echo If winget is missing, get the Windows LTS installer from:
echo   https://nodejs.org/en/download
echo Keep "Add to PATH" checked, finish the installer, then try again.
echo.
pause
goto :eof

:fail
echo.
echo Setup failed. Open a NEW Command Prompt after installing Node and try again.
pause
goto :eof
