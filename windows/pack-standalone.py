#!/usr/bin/env python3
"""Keep rider launchers as thin CRLF .bat files. Never recreate MX Force Studio.bat."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

STALE = (
    "MX Force Studio.bat",
    "MX Force Studio.lnk",
    "START HERE.txt",
    "Uninstall Force Studio.bat",
    "Select",
    "select",
)

INSTALLER = "\r\n".join(
    [
        "@echo off",
        "setlocal EnableExtensions",
        "title MX Force Studio - Installer",
        'cd /d "%~dp0"',
        "echo.",
        "echo MX Force Studio - Installer",
        "echo Keep this window open. Close it to stop.",
        "echo.",
        "echo If Windows SmartScreen appears: More info, then Run anyway.",
        "echo First run needs internet (Node.js + packages).",
        "echo.",
        'if not exist "%~dp0windows\\launch.ps1" (',
        "  echo Missing windows\\launch.ps1",
        "  echo Extract the whole GitHub zip folder first.",
        "  pause",
        "  exit /b 1",
        ")",
        "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command \"try { Unblock-File -LiteralPath '%~f0' -ErrorAction SilentlyContinue } catch {}; Get-ChildItem -LiteralPath '%~dp0windows' -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { try { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue } catch {} }\"",
        'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\\launch.ps1"',
        'set "MXFS_ERR=%ERRORLEVEL%"',
        'if not "%MXFS_ERR%"=="0" (',
        "  echo.",
        "  echo Installer did not finish. The message above is the reason.",
        "  echo.",
        "  pause",
        "  exit /b %MXFS_ERR%",
        ")",
        "exit /b 0",
        "",
    ]
)

UPDATER = "\r\n".join(
    [
        "@echo off",
        "setlocal EnableExtensions",
        "title MX Force Studio - Updater",
        'cd /d "%~dp0"',
        "echo.",
        "echo MX Force Studio - Updater",
        "echo Forces a clean rebuild, reinstalls the plugin, then starts the app.",
        "echo Keep this window open. Close it to stop.",
        "echo.",
        'set "MXFS_FORCE_UPDATE=1"',
        'if exist "%~dp0Installer.bat" (',
        '  call "%~dp0Installer.bat"',
        "  exit /b %ERRORLEVEL%",
        ")",
        "echo Missing Installer.bat next to this file.",
        "pause",
        "exit /b 1",
        "",
    ]
)

UNINSTALLER = "\r\n".join(
    [
        "@echo off",
        "setlocal EnableExtensions",
        "title MX Force Studio - Uninstaller",
        'cd /d "%~dp0"',
        "echo.",
        "echo This removes Force Studio from this PC:",
        "echo   Desktop and Start Menu icons",
        "echo   App files under %%LOCALAPPDATA%%\\MXForceStudio",
        "echo   The MX Bikes plugin (spreadsheets stay)",
        "echo.",
        "echo Your downloaded folder is not deleted.",
        "echo Close the Force Studio window first if it is still open.",
        "echo.",
        "pause",
        'if not exist "%~dp0windows\\uninstall.ps1" (',
        "  echo Missing windows\\uninstall.ps1",
        "  pause",
        "  exit /b 1",
        ")",
        "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command \"try { Unblock-File -LiteralPath '%~dp0windows\\uninstall.ps1' -ErrorAction SilentlyContinue } catch {}\"",
        'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\\uninstall.ps1"',
        'set "MXFS_ERR=%ERRORLEVEL%"',
        "echo.",
        'if not "%MXFS_ERR%"=="0" (',
        "  echo Uninstall did not finish cleanly.",
        "  pause",
        "  exit /b %MXFS_ERR%",
        ")",
        "pause",
        "exit /b 0",
        "",
    ]
)


def crlf_bytes(text: str) -> bytes:
    return text.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8")


def crlf_file(path: Path) -> None:
    data = path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    path.write_bytes(data)


def main() -> None:
    for name in STALE:
        path = ROOT / name
        if path.is_dir():
            import shutil

            shutil.rmtree(path, ignore_errors=True)
            print(f"removed folder {path}")
        elif path.is_file():
            path.unlink()
            print(f"removed {path}")

    (ROOT / "Installer.bat").write_bytes(crlf_bytes(INSTALLER))
    (ROOT / "Updater.bat").write_bytes(crlf_bytes(UPDATER))
    (ROOT / "Uninstaller.bat").write_bytes(crlf_bytes(UNINSTALLER))

    for path in list(ROOT.glob("*.cmd")) + list((ROOT / "windows").glob("*.ps1")):
        crlf_file(path)

    print("wrote Installer.bat, Updater.bat, Uninstaller.bat (CRLF)")
    print("MX Force Studio.bat is not created")


if __name__ == "__main__":
    main()
