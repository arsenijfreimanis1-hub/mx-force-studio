#!/usr/bin/env python3
"""Build a self-extracting MX Force Studio.bat that works as a lone Downloads file.

Windows cmd.exe cannot run Unix-LF batch files, and a private git clone cannot
run on the gaming PC. This packs the app into the .bat itself (CRLF).
"""

from __future__ import annotations

import base64
import io
import os
import stat
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_BAT = ROOT / "MX Force Studio.bat"

SKIP_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "agent-tools",
    ".cursor",
    "coverage",
    "out",
    "build",
    "force_studio_logs",
}
SKIP_NAMES = {
    "MX Force Studio.bat",  # replaced by a small stub inside the zip
    "AGENTS.md",
    "CLAUDE.md",
    "Force Studio.cmd",
    "setup-windows.cmd",
    "eslint.config.mjs",
    "pack-standalone.py",
    ".gitignore",
    ".gitattributes",
    "mxb-plugins-dir.txt",
    "next-env.d.ts",
}
SKIP_PLUGIN_DEV = {
    "plugin/build.sh",
    "plugin/mxb_force_studio.c",
    "plugin/README.md",
}

STUB_BAT = "\r\n".join(
    [
        "@echo off",
        "setlocal EnableExtensions",
        "title MX Bikes Force Studio",
        'cd /d "%~dp0"',
        "echo.",
        "echo MX Bikes Force Studio",
        "echo Keep this window open. Close it to stop.",
        "echo.",
        'if not exist "%~dp0windows\\launch.ps1" (',
        "  echo Missing windows\\launch.ps1",
        "  pause",
        "  exit /b 1",
        ")",
        'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\\launch.ps1"',
        "if errorlevel 1 (",
        "  echo.",
        "  pause",
        "  exit /b 1",
        ")",
        "",
    ]
)


def should_skip(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if rel.name in SKIP_NAMES:
        return True
    if rel.name.endswith(".test.ts") or rel.name.endswith(".tsbuildinfo"):
        return True
    if rel.as_posix() in SKIP_PLUGIN_DEV:
        return True
    parts = set(rel.parts)
    return bool(parts & SKIP_DIRS)


def collect_files() -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in sorted(dirnames) if d not in SKIP_DIRS]
        for name in sorted(filenames):
            path = Path(dirpath) / name
            if should_skip(path):
                continue
            files.append(path)
    return files


def crlf_bytes(text: str) -> bytes:
    return text.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8")


def add_text(zf: zipfile.ZipFile, name: str, text: str) -> None:
    data = crlf_bytes(text)
    info = zipfile.ZipInfo(name)
    info.date_time = (2026, 9, 20, 0, 0, 0)
    info.external_attr = (stat.S_IFREG | 0o644) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(info, data)


def build_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in collect_files():
            rel = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            if path.suffix.lower() in {".bat", ".cmd", ".ps1", ".txt", ".md", ".ini"}:
                data = data.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
            info = zipfile.ZipInfo(rel)
            info.date_time = (2026, 9, 20, 0, 0, 0)
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, data)
        add_text(zf, "MX Force Studio.bat", STUB_BAT)
    return buf.getvalue()


PS_BODY = r"""
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$bat = $env:MXFS_BAT
if (-not $bat) { throw 'MXFS_BAT was not set' }
try { Unblock-File -LiteralPath $bat -ErrorAction SilentlyContinue } catch {}
$here = Split-Path -Parent $bat
Set-Location -LiteralPath $here

function Unpack-Payload($dest) {
  Write-Host ""
  Write-Host "Unpacking MX Force Studio into $dest"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  $raw = Get-Content -LiteralPath $bat -Raw
  $startTag = '::MXFS_PAY' + 'LOAD_BEGIN'
  $endTag = '::MXFS_PAY' + 'LOAD_END'
  $start = $raw.IndexOf($startTag)
  $end = $raw.IndexOf($endTag)
  if ($start -lt 0 -or $end -lt 0 -or $end -le $start) { throw 'This .bat is missing its packed app (payload). Re-download MX Force Studio.bat' }
  $b64 = $raw.Substring($start + $startTag.Length, $end - ($start + $startTag.Length))
  $b64 = [regex]::Replace($b64, '[^A-Za-z0-9+/=]', '')
  $bytes = [Convert]::FromBase64String($b64)
  $zip = Join-Path $env:TEMP 'MXForceStudio-app.zip'
  [IO.File]::WriteAllBytes($zip, $bytes)
  $stage = Join-Path $env:TEMP ('MXForceStudio-unpack-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $stage | Out-Null
  Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force
  if (Test-Path -LiteralPath $dest) {
    Write-Host "Replacing previous unpack so leftover files (old wheels) cannot stay"
    Get-ChildItem -LiteralPath $dest -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -ne 'node_modules' } |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
  }
  Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($stage.Length).TrimStart('\')
    $target = Join-Path $dest $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
  }
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}

$localLaunch = Join-Path $here 'windows\launch.ps1'
$localPkg = Join-Path $here 'package.json'
if ((Test-Path -LiteralPath $localLaunch) -and (Test-Path -LiteralPath $localPkg)) {
  Write-Host "Using app files next to the .bat"
  $legacy = Join-Path $env:LOCALAPPDATA 'MXForceStudio\app'
  if (Test-Path -LiteralPath $legacy) {
    $hereFull = [IO.Path]::GetFullPath($here)
    $legacyFull = [IO.Path]::GetFullPath($legacy)
    if ($hereFull -ne $legacyFull) {
      Write-Host "Removing leftover app at $legacyFull so an old garage cannot start"
      Remove-Item -LiteralPath $legacy -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $localLaunch
  exit $LASTEXITCODE
}

$dest = Join-Path $env:LOCALAPPDATA 'MXForceStudio\app'
Unpack-Payload $dest
$launch = Join-Path $dest 'windows\launch.ps1'
if (-not (Test-Path -LiteralPath $launch)) { throw "Unpack failed - $launch not found" }
Set-Location -LiteralPath $dest
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launch
exit $LASTEXITCODE
""".strip()


def bat_header() -> str:
    # CMD must never reach the payload. exit /b comes before the marker.
    lines = [
        "@echo off",
        "setlocal EnableExtensions",
        "title MX Bikes Force Studio",
        'cd /d "%~dp0"',
        'set "MXFS_BAT=%~f0"',
        "echo.",
        "echo MX Bikes Force Studio",
        "echo Keep this window open. Close it to stop.",
        "echo.",
        "echo If Windows SmartScreen appears: More info, then Run anyway.",
        "echo First run downloads Node.js and the app. That needs internet.",
        "echo.",
        'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$r = Get-Content -LiteralPath $env:MXFS_BAT -Raw; $m1 = \'___MXFS_PS\' + \'_START___\'; $m2 = \'___MXFS_PS\' + \'_END___\'; $a = $r.IndexOf($m1) + $m1.Length; $b = $r.IndexOf($m2); if ($a -lt 8 -or $b -le $a) { throw \'launcher markers missing\' }; iex $r.Substring($a, $b - $a)"',
        "set \"MXFS_ERR=%ERRORLEVEL%\"",
        "if not \"%MXFS_ERR%\"==\"0\" (",
        "  echo.",
        "  echo The app did not start. The message above is the reason.",
        "  echo.",
        "  pause",
        "  exit /b %MXFS_ERR%",
        ")",
        "exit /b 0",
        "___MXFS_PS_START___",
        PS_BODY.replace("\r\n", "\n").replace("\n", "\r\n"),
        "___MXFS_PS_END___",
        "::MXFS_PAYLOAD_BEGIN",
    ]
    return "\r\n".join(lines) + "\r\n"


def write_folder_zip(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(payload), "r") as src, zipfile.ZipFile(
        buf, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as dst:
        for info in src.infolist():
            data = src.read(info.filename)
            inner = zipfile.ZipInfo("MX-Force-Studio/" + info.filename)
            inner.date_time = info.date_time
            inner.compress_type = zipfile.ZIP_DEFLATED
            inner.external_attr = info.external_attr
            dst.writestr(inner, data)
        add_text(
            dst,
            "MX-Force-Studio/DOUBLE-CLICK ME.txt",
            "\r\n".join(
                [
                    "Extract this whole folder, then double-click:",
                    "  MX Force Studio.bat",
                    "",
                    "Read START HERE.txt if you want the same steps in plain English.",
                    "",
                ]
            ),
        )
    path.write_bytes(buf.getvalue())


def crlf_repo_scripts() -> None:
    for path in list(ROOT.glob("*.bat")) + list(ROOT.glob("*.cmd")) + list((ROOT / "windows").glob("*.ps1")):
        if path.name == "MX Force Studio.bat":
            continue
        data = path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
        path.write_bytes(data)


def main() -> None:
    crlf_repo_scripts()
    zbytes = build_zip()
    b64 = base64.b64encode(zbytes).decode("ascii")
    wrapped = "\r\n".join(b64[i : i + 76] for i in range(0, len(b64), 76))
    body = bat_header() + wrapped + "\r\n::MXFS_PAYLOAD_END\r\n"
    OUT_BAT.write_bytes(body.encode("ascii"))
    print(f"wrote {OUT_BAT} ({OUT_BAT.stat().st_size} bytes)")
    print(f"payload zip {len(zbytes)} bytes, base64 {len(b64)} chars")

    artifacts = Path("/opt/cursor/artifacts")
    artifacts.mkdir(parents=True, exist_ok=True)
    bat_copy = artifacts / "MX_Force_Studio.bat"
    bat_copy.write_bytes(OUT_BAT.read_bytes())
    folder_zip = artifacts / "MX_Force_Studio_Windows.zip"
    write_folder_zip(folder_zip, zbytes)
    print(f"wrote {bat_copy} ({bat_copy.stat().st_size} bytes)")
    print(f"wrote {folder_zip} ({folder_zip.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
