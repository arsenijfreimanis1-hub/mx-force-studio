@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :need_node

echo Node.js found:
node -v
echo.

if not exist "node_modules\" (
  echo Installing packages...
  call npm install
  if errorlevel 1 goto :fail
)

echo Building Force Studio...
call npm run build
if errorlevel 1 goto :fail

echo.
echo Creating the "MX Force Studio" icon on your Desktop and Start Menu...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\create-shortcut.ps1"

echo.
echo Installing the MX Bikes telemetry plugin...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\install-plugin.ps1"

echo.
echo ================================================================
echo   Done. A "MX Force Studio" icon is now on your Desktop.
echo   Double-click it before starting MX Bikes.
echo   If MX Bikes is already open, restart it so the plugin loads.
echo ================================================================
echo.
echo Starting Force Studio now...
echo.
call "%~dp0MX Force Studio.bat"
goto :eof

:need_node
echo npm is missing because Node.js is not installed.
echo.
echo This window is Command Prompt. Paste the next line, wait for it to finish,
echo then CLOSE this window and open a new Command Prompt.
echo.
echo   winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
echo.
echo If winget fails, install the Windows LTS installer from:
echo   https://nodejs.org/en/download
echo Check "Add to PATH", finish the installer, then open a NEW Command Prompt.
echo.
echo After Node is installed, run this file again from the mx-hub folder:
echo   setup-windows.cmd
echo.
pause
goto :eof

:fail
echo npm install failed. Open a NEW Command Prompt after installing Node and try again.
pause
goto :eof
