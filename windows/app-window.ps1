# Opens Force Studio in its own desktop window (no browser tab, no URL bar).
# The Next.js server stays on 127.0.0.1 only - this PC, not the network.

param(
  [string]$Url = "http://127.0.0.1:43187",
  [int]$WaitSeconds = 120
)

$ErrorActionPreference = "Stop"

function Find-AppBrowser {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
  )
  foreach ($path in $candidates) {
    if ($path -and (Test-Path -LiteralPath $path)) { return $path }
  }
  return $null
}

function Wait-LocalReady([string]$probe, [int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $null = Invoke-WebRequest -UseBasicParsing $probe -TimeoutSec 1
      return $true
    } catch {
      Start-Sleep -Milliseconds 400
    }
  }
  return $false
}

$browser = Find-AppBrowser
if (-not $browser) {
  throw "Edge or Chrome was not found. Force Studio needs one of them to open its window."
}

Write-Host "Waiting for the local app..."
if (-not (Wait-LocalReady $Url $WaitSeconds)) {
  throw "The local app did not start in time."
}

$profile = Join-Path $env:LOCALAPPDATA "MXForceStudio\app-window"
New-Item -ItemType Directory -Force -Path $profile | Out-Null

$args = @(
  "--app=$Url",
  "--user-data-dir=$profile",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-features=TranslateUI",
  "--window-size=1600,980",
  "--window-position=80,40"
)

Write-Host "Opening Force Studio window"
$proc = Start-Process -FilePath $browser -ArgumentList $args -PassThru
if (-not $proc) { throw "Could not open the Force Studio window." }

Wait-Process -Id $proc.Id
exit 0
