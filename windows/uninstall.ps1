# Removes Force Studio from this PC: shortcuts, portable app/Node cache,
# and the MX Bikes plugin copies. Spreadsheets in force_studio_logs stay.

$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $PSScriptRoot
Write-Host ""
Write-Host "Uninstalling MX Bikes Force Studio" -ForegroundColor White
Write-Host "Spreadsheets next to the plugin are kept." -ForegroundColor DarkGray
Write-Host ""

function Stop-ListeningPort([int]$Port) {
  $ids = New-Object System.Collections.Generic.List[int]
  try {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object {
        if ($_.OwningProcess) { [void]$ids.Add([int]$_.OwningProcess) }
      }
  } catch {}
  if ($ids.Count -eq 0) {
    try {
      $pattern = ":$Port\s+.*LISTENING"
      netstat -ano | Select-String -Pattern $pattern | ForEach-Object {
        $procId = ($_.ToString().Trim() -split '\s+')[-1]
        if ($procId -match '^\d+$') { [void]$ids.Add([int]$procId) }
      }
    } catch {}
  }
  foreach ($procId in ($ids | Select-Object -Unique)) {
    if (-not $procId -or $procId -eq 0) { continue }
    Write-Host "Stopping Force Studio process $procId on port $Port"
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

function Add-Unique([System.Collections.Generic.List[string]]$list, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return }
  $full = $value
  try { $full = [IO.Path]::GetFullPath($value) } catch { return }
  foreach ($existing in $list) {
    if ($existing -ieq $full) { return }
  }
  $list.Add($full) | Out-Null
}

function Find-PluginDirs {
  $found = New-Object System.Collections.Generic.List[string]
  $pointer = Join-Path $root "plugin\mxb-plugins-dir.txt"
  if (Test-Path -LiteralPath $pointer) {
    $line = (Get-Content -LiteralPath $pointer -Raw).Trim()
    if ($line) { Add-Unique $found $line }
  }
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($reg in @(
    "HKCU:\Software\Valve\Steam",
    "HKLM:\SOFTWARE\WOW6432Node\Valve\Steam",
    "HKLM:\SOFTWARE\Valve\Steam"
  )) {
    try {
      $install = (Get-ItemProperty -Path $reg -ErrorAction SilentlyContinue).InstallPath
      if ($install) { Add-Unique $candidates (Join-Path $install "steamapps\common\MX Bikes") }
    } catch {}
  }
  try {
    Get-Process -Name "mxbikes" -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Path) { Add-Unique $candidates (Split-Path -Parent $_.Path) }
    }
  } catch {}
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
      "PiBoSo\MX Bikes"
    )) {
      Add-Unique $candidates (Join-Path $letter $rel)
    }
  }
  foreach ($dir in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $dir "mxbikes.exe")) {
      Add-Unique $found (Join-Path $dir "plugins")
    }
  }
  return $found
}

Stop-ListeningPort 43187
Stop-ListeningPort 47387

$removedLinks = 0
$linkDirs = New-Object System.Collections.Generic.List[string]
foreach ($name in @("Desktop", "CommonDesktopDirectory", "Programs", "CommonPrograms")) {
  $p = [Environment]::GetFolderPath($name)
  if ($p) { Add-Unique $linkDirs $p }
}
foreach ($p in @(
  (Join-Path $env:USERPROFILE "Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive - Personal\Desktop"),
  $root,
  (Split-Path -Parent $root)
)) {
  if ($p) { Add-Unique $linkDirs $p }
}

foreach ($dir in $linkDirs) {
  if (-not (Test-Path -LiteralPath $dir)) { continue }
  foreach ($name in @("MX Force Studio.lnk", "Force Studio.lnk")) {
    $link = Join-Path $dir $name
    if (Test-Path -LiteralPath $link) {
      Remove-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
      if (-not (Test-Path -LiteralPath $link)) {
        Write-Host "Removed shortcut $link"
        $removedLinks++
      }
    }
  }
}

$cache = Join-Path $env:LOCALAPPDATA "MXForceStudio"
if (Test-Path -LiteralPath $cache) {
  Write-Host "Removing $cache"
  Remove-Item -LiteralPath $cache -Recurse -Force -ErrorAction SilentlyContinue
}

$pluginFiles = @("mxb_force_studio.dlo", "force_studio.ini")
foreach ($dir in (Find-PluginDirs)) {
  foreach ($name in $pluginFiles) {
    $path = Join-Path $dir $name
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
      Write-Host "Removed plugin file $path"
    }
  }
}

$pointer = Join-Path $root "plugin\mxb-plugins-dir.txt"
if (Test-Path -LiteralPath $pointer) {
  Remove-Item -LiteralPath $pointer -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Force Studio is uninstalled." -ForegroundColor Green
Write-Host "This downloaded folder is still here. Delete it yourself if you want it gone."
Write-Host "If MX Bikes is open, restart it so it drops the plugin."
Write-Host ""
