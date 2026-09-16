# Creates a clickable "MX Force Studio" icon on the Desktop and in the Start Menu.
# The shortcut launches "Force Studio.cmd", which starts the visualizer, the UDP
# bridge, and opens the browser. Safe to run repeatedly; it just refreshes the icons.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $root "Force Studio.cmd"
$icon = Join-Path $root "force-studio.ico"

$shell = New-Object -ComObject WScript.Shell

$locations = @(
  [Environment]::GetFolderPath("Desktop"),
  [Environment]::GetFolderPath("Programs")
)

foreach ($dir in $locations) {
  if ([string]::IsNullOrWhiteSpace($dir)) { continue }
  if (-not (Test-Path $dir)) { continue }

  $linkPath = Join-Path $dir "MX Force Studio.lnk"
  $shortcut = $shell.CreateShortcut($linkPath)
  $shortcut.TargetPath = $launcher
  $shortcut.WorkingDirectory = $root
  $shortcut.WindowStyle = 7  # start minimized
  $shortcut.Description = "MX Bikes Force Studio"
  if (Test-Path $icon) { $shortcut.IconLocation = "$icon,0" }
  $shortcut.Save()
  Write-Host "Created shortcut: $linkPath"
}
