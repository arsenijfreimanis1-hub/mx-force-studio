# Copies mxb_force_studio.dlo + force_studio.ini into every MX Bikes
# plugins folder found on this PC. Safe to run every launch.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$srcDlo = Join-Path $root "plugin\mxb_force_studio.dlo"
$srcIni = Join-Path $root "plugin\force_studio.ini"

function Add-Unique([System.Collections.Generic.List[string]]$list, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return }
  $full = $value
  try { $full = [IO.Path]::GetFullPath($value) } catch { return }
  foreach ($existing in $list) {
    if ($existing -ieq $full) { return }
  }
  $list.Add($full) | Out-Null
}

function Add-LibraryVdf([System.Collections.Generic.List[string]]$vdfs, [string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  Add-Unique $vdfs $path
}

function Find-MxBikesRoots {
  $candidates = New-Object System.Collections.Generic.List[string]
  $vdfPaths = New-Object System.Collections.Generic.List[string]

  foreach ($reg in @(
    "HKCU:\Software\Valve\Steam",
    "HKLM:\SOFTWARE\WOW6432Node\Valve\Steam",
    "HKLM:\SOFTWARE\Valve\Steam"
  )) {
    try {
      $install = (Get-ItemProperty -Path $reg -ErrorAction SilentlyContinue).InstallPath
      if ($install) {
        Add-Unique $candidates (Join-Path $install "steamapps\common\MX Bikes")
        Add-LibraryVdf $vdfPaths (Join-Path $install "steamapps\libraryfolders.vdf")
      }
    } catch {}
  }

  try {
    Get-Process -Name "mxbikes" -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Path) { Add-Unique $candidates (Split-Path -Parent $_.Path) }
    }
  } catch {}

  $shell = $null
  try { $shell = New-Object -ComObject WScript.Shell } catch {}
  foreach ($programs in @(
    [Environment]::GetFolderPath("Programs"),
    [Environment]::GetFolderPath("CommonPrograms"),
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("CommonDesktopDirectory")
  )) {
    if (-not $programs -or -not (Test-Path -LiteralPath $programs)) { continue }
    Get-ChildItem -LiteralPath $programs -Recurse -Filter "*.lnk" -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match 'MX Bikes' } |
      ForEach-Object {
        if (-not $shell) { return }
        try {
          $target = $shell.CreateShortcut($_.FullName).TargetPath
          if ($target -and ((Split-Path -Leaf $target) -ieq "mxbikes.exe")) {
            Add-Unique $candidates (Split-Path -Parent $target)
          }
        } catch {}
      }
  }

  $drives = @()
  try {
    $drives = [IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.DriveType -eq 'Fixed' }
  } catch {}
  foreach ($drive in $drives) {
    $letter = $drive.RootDirectory.FullName
    foreach ($rel in @(
      "Program Files (x86)\Steam\steamapps\common\MX Bikes",
      "Program Files\Steam\steamapps\common\MX Bikes",
      "Steam\steamapps\common\MX Bikes",
      "SteamLibrary\steamapps\common\MX Bikes",
      "Games\steamapps\common\MX Bikes",
      "Games\MX Bikes",
      "MX Bikes",
      "piboso\MX Bikes",
      "PiBoSo\MX Bikes",
      "New folder\steamapps\common\MX Bikes"
    )) {
      Add-Unique $candidates (Join-Path $letter $rel)
    }
    foreach ($vdfRel in @(
      "Program Files (x86)\Steam\steamapps\libraryfolders.vdf",
      "Program Files\Steam\steamapps\libraryfolders.vdf",
      "Steam\steamapps\libraryfolders.vdf",
      "SteamLibrary\steamapps\libraryfolders.vdf",
      "New folder\steamapps\libraryfolders.vdf"
    )) {
      Add-LibraryVdf $vdfPaths (Join-Path $letter $vdfRel)
    }
  }

  Add-LibraryVdf $vdfPaths "C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf"
  Add-LibraryVdf $vdfPaths "D:\New folder\steamapps\libraryfolders.vdf"

  foreach ($vdf in $vdfPaths) {
    if (-not (Test-Path -LiteralPath $vdf)) { continue }
    $text = Get-Content -LiteralPath $vdf -Raw -ErrorAction SilentlyContinue
    if (-not $text) { continue }
    [regex]::Matches($text, '"path"\s+"([^"]+)"') | ForEach-Object {
      $lib = $_.Groups[1].Value -replace '\\\\', '\'
      Add-Unique $candidates (Join-Path $lib "steamapps\common\MX Bikes")
      Add-LibraryVdf $vdfPaths (Join-Path $lib "steamapps\libraryfolders.vdf")
    }
  }

  $found = New-Object System.Collections.Generic.List[string]
  foreach ($dir in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $dir "mxbikes.exe")) {
      Add-Unique $found $dir
    }
  }
  return $found
}

if (-not (Test-Path -LiteralPath $srcDlo) -or -not (Test-Path -LiteralPath $srcIni)) {
  Write-Host "Plugin files missing in $root\plugin - skip install."
  exit 0
}

$games = Find-MxBikesRoots
if ($null -eq $games -or $games.Count -eq 0) {
  Write-Host "MX Bikes was not found on this PC (no mxbikes.exe)."
  Write-Host "Install MX Bikes, then double-click MX Force Studio.bat again."
  Write-Host "Or copy plugin\mxb_force_studio.dlo and plugin\force_studio.ini into the game plugins folder yourself."
  exit 0
}

$pointer = $null
foreach ($game in $games) {
  $dest = Join-Path $game "plugins"
  if (-not (Test-Path -LiteralPath $dest)) {
    New-Item -ItemType Directory -Path $dest | Out-Null
  }
  Copy-Item -LiteralPath $srcDlo -Destination (Join-Path $dest "mxb_force_studio.dlo") -Force
  Copy-Item -LiteralPath $srcIni -Destination (Join-Path $dest "force_studio.ini") -Force
  $logDir = Join-Path $dest "force_studio_logs"
  if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
  }
  if (-not $pointer) { $pointer = $dest }
  Write-Host "Plugin installed to $dest"
  Write-Host "Spreadsheets save to $logDir"
}

if ($pointer) {
  Set-Content -LiteralPath (Join-Path $root "plugin\mxb-plugins-dir.txt") -Value $pointer -NoNewline
}

Write-Host "MX Bikes loads plugins at startup - if the game is already open, restart it."
