# Downloads Node if needed, installs packages, builds, installs the MX Bikes
# plugin, creates the Desktop icon, starts the bridge, and runs the app.
# Called from "MX Force Studio.bat". Keep this window open while you ride.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion = "22.14.0"
$NodeZipName = "node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"
$RepoUrl = "https://origin.cursor.com/git/arsenij-freimanis/mx-hub.git"
$RepoBranch = "cursor/windows-clickable-launcher-e196"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Get-AppRoot {
  if ($PSScriptRoot) {
    $fromScript = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $fromScript "package.json")) { return $fromScript }
  }
  if ($PSCommandPath) {
    $fromCmd = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
    if (Test-Path -LiteralPath (Join-Path $fromCmd "package.json")) { return $fromCmd }
  }
  $here = (Get-Location).Path
  if (Test-Path -LiteralPath (Join-Path $here "package.json")) { return $here }
  return $null
}

function Install-Repo($dest) {
  Write-Step "App files are missing here — downloading MX Force Studio to $dest"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) {
    if (Test-Path -LiteralPath (Join-Path $dest ".git")) {
      & git -C $dest fetch origin $RepoBranch
      & git -C $dest checkout $RepoBranch
      & git -C $dest pull origin $RepoBranch
    } else {
      if ((Get-ChildItem -LiteralPath $dest -Force -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
        $dest = Join-Path $dest "mx-hub"
      }
      & git clone --depth 1 --branch $RepoBranch $RepoUrl $dest
    }
    return $dest
  }
  throw "This folder is missing the rest of MX Force Studio (package.json / Force Studio.cmd), and git is not installed, so it cannot download the app. Extract the whole mx-hub folder (not just the .bat) and double-click 'MX Force Studio.bat' inside it."
}

function Install-Node {
  $existing = Get-Command node -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Using Node $($existing.Source)"
    return
  }

  $tools = Join-Path $env:LOCALAPPDATA "MXForceStudio"
  $nodeHome = Join-Path $tools "node-v$NodeVersion-win-x64"
  $nodeExe = Join-Path $nodeHome "node.exe"
  if (-not (Test-Path -LiteralPath $nodeExe)) {
    Write-Step "Node.js not found — downloading portable Node $NodeVersion (no admin needed)"
    New-Item -ItemType Directory -Force -Path $tools | Out-Null
    $zip = Join-Path $tools $NodeZipName
    Invoke-WebRequest -Uri $NodeUrl -OutFile $zip -UseBasicParsing
    Write-Host "Extracting $zip"
    if (Test-Path -LiteralPath $nodeHome) { Remove-Item -LiteralPath $nodeHome -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $tools -Force
  }
  if (-not (Test-Path -LiteralPath $nodeExe)) {
    throw "Failed to install Node.js. Download the LTS installer from https://nodejs.org/en/download and run MX Force Studio.bat again."
  }
  $env:PATH = "$nodeHome;$env:PATH"
  Write-Host "Using portable Node $nodeHome"
}

try {
  Write-Host ""
  Write-Host "MX Bikes Force Studio" -ForegroundColor White
  Write-Host "Keep this window open while you ride. Close it to stop." -ForegroundColor DarkGray

  $root = Get-AppRoot
  if (-not $root) {
    $root = Install-Repo (Join-Path $env:LOCALAPPDATA "MXForceStudio\app")
  }
  Set-Location -LiteralPath $root
  Write-Host "App folder: $root"

  Install-Node
  Write-Host "node $(node -v)   npm $(npm -v)"

  if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
    Write-Step "Installing packages (first run only, a minute or two)"
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  }

  if (-not (Test-Path -LiteralPath (Join-Path $root ".next\BUILD_ID"))) {
    Write-Step "Building Force Studio (first run only)"
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
  }

  $shortcut = Join-Path $root "windows\create-shortcut.ps1"
  if (Test-Path -LiteralPath $shortcut) {
    Write-Step "Creating Desktop / Start Menu icon"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $shortcut
  }

  $plugin = Join-Path $root "windows\install-plugin.ps1"
  if (Test-Path -LiteralPath $plugin) {
    Write-Step "Installing MX Bikes telemetry plugin"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $plugin
  }

  Write-Host ""
  Write-Host "================================================================" -ForegroundColor Green
  Write-Host "  Starting at http://127.0.0.1:43187" -ForegroundColor Green
  Write-Host "  When the browser opens: launch MX Bikes, go on track," -ForegroundColor Green
  Write-Host "  switch to Live, click Connect." -ForegroundColor Green
  Write-Host "  If the game is already open, restart it so the plugin loads." -ForegroundColor Green
  Write-Host "================================================================" -ForegroundColor Green
  Write-Host ""

  $bridge = Start-Process -FilePath "node" -ArgumentList "bridge\udp-bridge.mjs" -WorkingDirectory $root -PassThru -WindowStyle Hidden

  $opener = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile", "-Command",
    "`$u='http://127.0.0.1:43187'; for(`$i=0;`$i -lt 120;`$i++){ try{ `$null = Invoke-WebRequest -UseBasicParsing `$u -TimeoutSec 1; Start-Process `$u; break } catch { Start-Sleep -Milliseconds 500 } }"
  ) -PassThru -WindowStyle Hidden

  try {
    & npm run start
  } finally {
    foreach ($proc in @($bridge, $opener)) {
      if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }
} catch {
  Write-Host ""
  Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Write-Host "If you only downloaded the .bat, that is why. You need the whole mx-hub folder."
  Write-Host "Put MX Force Studio.bat next to package.json, Force Studio.cmd, and the windows\ folder."
  Write-Host ""
  exit 1
}
