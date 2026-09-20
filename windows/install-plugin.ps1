# Copies mxb_force_studio.dlo + force_studio.ini into the MX Bikes plugins folder.
# Primary path: D:\New folder\steamapps\common\MX Bikes
# Fallback: Steam libraryfolders.vdf autodetection.
# Idempotent. Safe to run every launch.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$srcDlo = Join-Path $root "plugin\mxb_force_studio.dlo"
$srcIni = Join-Path $root "plugin\force_studio.ini"
$primary = "D:\New folder\steamapps\common\MX Bikes"

function Find-MxBikesRoot {
  $candidates = New-Object System.Collections.Generic.List[string]
  $candidates.Add($primary) | Out-Null

  $vdfPaths = New-Object System.Collections.Generic.List[string]
  foreach ($reg in @(
    "HKCU:\Software\Valve\Steam",
    "HKLM:\SOFTWARE\WOW6432Node\Valve\Steam",
    "HKLM:\SOFTWARE\Valve\Steam"
  )) {
    try {
      $install = (Get-ItemProperty -Path $reg -ErrorAction SilentlyContinue).InstallPath
      if ($install) {
        $vdfPaths.Add((Join-Path $install "steamapps\libraryfolders.vdf")) | Out-Null
      }
    } catch {}
  }
  $vdfPaths.Add("C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf") | Out-Null
  $vdfPaths.Add("D:\New folder\steamapps\libraryfolders.vdf") | Out-Null

  foreach ($vdf in $vdfPaths) {
    if (-not (Test-Path -LiteralPath $vdf)) { continue }
    $text = Get-Content -LiteralPath $vdf -Raw -ErrorAction SilentlyContinue
    if (-not $text) { continue }
    [regex]::Matches($text, '"path"\s+"([^"]+)"') | ForEach-Object {
      $lib = $_.Groups[1].Value -replace '\\\\', '\'
      $candidates.Add((Join-Path $lib "steamapps\common\MX Bikes")) | Out-Null
    }
  }

  foreach ($dir in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $dir "mxbikes.exe")) { return $dir }
    if (Test-Path -LiteralPath $dir) { return $dir }
  }
  return $null
}

if (-not (Test-Path -LiteralPath $srcDlo) -or -not (Test-Path -LiteralPath $srcIni)) {
  Write-Host "Plugin files missing in $root\plugin — skip install."
  exit 0
}

$game = Find-MxBikesRoot
if (-not $game) {
  Write-Host "MX Bikes not found. Expected:"
  Write-Host "  $primary"
  Write-Host "Copy plugin\mxb_force_studio.dlo and plugin\force_studio.ini into the game plugins folder yourself."
  exit 0
}

$dest = Join-Path $game "plugins"
if (-not (Test-Path -LiteralPath $dest)) {
  New-Item -ItemType Directory -Path $dest | Out-Null
}

Copy-Item -LiteralPath $srcDlo -Destination (Join-Path $dest "mxb_force_studio.dlo") -Force
Copy-Item -LiteralPath $srcIni -Destination (Join-Path $dest "force_studio.ini") -Force

Write-Host "Plugin installed to $dest"
Write-Host "MX Bikes loads plugins at startup — if the game is already open, restart it."
