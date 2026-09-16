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

echo Starting Force Studio at http://127.0.0.1:43187
echo.
call npm run dev
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
