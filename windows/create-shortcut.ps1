# Creates a clickable "MX Force Studio" icon on the Desktop, Start Menu,
# and in this folder. Always points at the .bat you just launched.

$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $PSScriptRoot
$launcher = $null
if ($env:MXFS_BAT -and (Test-Path -LiteralPath $env:MXFS_BAT)) {
  $launcher = $env:MXFS_BAT
} else {
  $launcher = Join-Path $root "MX Force Studio.bat"
}
if (-not (Test-Path -LiteralPath $launcher)) {
  Write-Host "No MX Force Studio.bat found to pin."
  exit 1
}

$workDir = Split-Path -Parent $launcher
$icon = Join-Path $root "force-studio.ico"
if (-not (Test-Path -LiteralPath $icon)) {
  $icon = Join-Path $workDir "force-studio.ico"
}

$shell = New-Object -ComObject WScript.Shell

$desktops = New-Object System.Collections.Generic.List[string]
foreach ($name in @("Desktop", "CommonDesktopDirectory", "Programs")) {
  $p = [Environment]::GetFolderPath($name)
  if ($p) { $desktops.Add($p) | Out-Null }
}
foreach ($p in @(
  (Join-Path $env:USERPROFILE "Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive - Personal\Desktop"),
  $root,
  $workDir
)) {
  if ($p) { $desktops.Add($p) | Out-Null }
}

$written = 0
$seen = @{}
foreach ($dir in $desktops) {
  if ([string]::IsNullOrWhiteSpace($dir)) { continue }
  if (-not (Test-Path -LiteralPath $dir)) { continue }
  $key = $dir.ToLowerInvariant()
  if ($seen.ContainsKey($key)) { continue }
  $seen[$key] = $true

  foreach ($staleName in @("Force Studio.lnk")) {
    $stale = Join-Path $dir $staleName
    if (Test-Path -LiteralPath $stale) {
      Remove-Item -LiteralPath $stale -Force -ErrorAction SilentlyContinue
    }
  }

  $linkPath = Join-Path $dir "MX Force Studio.lnk"
  try {
    $shortcut = $shell.CreateShortcut($linkPath)
    $shortcut.TargetPath = $launcher
    $shortcut.Arguments = ""
    $shortcut.WorkingDirectory = $workDir
    $shortcut.WindowStyle = 1
    $shortcut.Description = "MX Bikes Force Studio"
    if (Test-Path -LiteralPath $icon) { $shortcut.IconLocation = "$icon,0" }
    $shortcut.Save()
    Write-Host "Created shortcut: $linkPath"
    $written++
  } catch {
    Write-Host "Could not create shortcut in $dir : $($_.Exception.Message)"
  }
}

if ($written -eq 0) {
  Write-Host "No Desktop shortcut was created. Double-click this file instead:"
  Write-Host "  $launcher"
  exit 1
}
