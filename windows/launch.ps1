# Downloads Node if needed, installs packages, builds, installs the MX Bikes
# plugin, creates the Desktop icon, starts the bridge, and runs the app.
# Called from "MX Force Studio.bat". Keep this window open while you ride.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion = "22.14.0"
$NodeZipName = "node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"

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
  $installed = Join-Path $env:LOCALAPPDATA "MXForceStudio\app"
  if (Test-Path -LiteralPath (Join-Path $installed "package.json")) { return $installed }
  return $null
}

function Unblock-Tree($dir) {
  Get-ChildItem -LiteralPath $dir -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
}

function Invoke-Npm([string]$ArgsLine) {
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue) -and -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found after installing Node.js."
  }
  Write-Host "npm $ArgsLine"
  cmd.exe /c "npm.cmd $ArgsLine"
  if ($LASTEXITCODE -ne 0) { throw "npm $ArgsLine failed (exit $LASTEXITCODE)" }
}

function Save-Url($url, $outFile) {
  $curl = Join-Path $env:SystemRoot "System32\curl.exe"
  if (Test-Path -LiteralPath $curl) {
    & $curl -L --fail --retry 3 --retry-delay 2 -o $outFile $url
    if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $outFile)) { return }
  }
  Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing
}

function Install-Node {
  $existing = Get-Command node -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Using Node $($existing.Source)"
    return
  }
  foreach ($candidate in @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
  )) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      $env:PATH = "$(Split-Path -Parent $candidate);$env:PATH"
      Write-Host "Using Node $candidate"
      return
    }
  }

  $tools = Join-Path $env:LOCALAPPDATA "MXForceStudio"
  $nodeHome = Join-Path $tools "node-v$NodeVersion-win-x64"
  $nodeExe = Join-Path $nodeHome "node.exe"
  if (-not (Test-Path -LiteralPath $nodeExe)) {
    Write-Step "Node.js not found - downloading portable Node $NodeVersion (no admin needed)"
    New-Item -ItemType Directory -Force -Path $tools | Out-Null
    $zip = Join-Path $tools $NodeZipName
    Save-Url $NodeUrl $zip
    Write-Host "Extracting $zip"
    if (Test-Path -LiteralPath $nodeHome) { Remove-Item -LiteralPath $nodeHome -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $tools -Force
  }
  if (-not (Test-Path -LiteralPath $nodeExe)) {
    throw "Failed to install Node.js. Download the LTS installer from https://nodejs.org/en/download , keep Add to PATH checked, then double-click MX Force Studio.bat again."
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
    throw "App files are missing. Double-click the MX Force Studio.bat that unpacks itself, or extract MX_Force_Studio_Windows.zip and run the .bat inside the folder."
  }
  Set-Location -LiteralPath $root
  Unblock-Tree $root
  Write-Host "App folder: $root"

  Install-Node
  Write-Host "node $(node -v)   npm $(cmd.exe /c npm.cmd -v)"

  if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules\next"))) {
    Write-Step "Installing packages (first run only, a minute or two - needs internet)"
    if (Test-Path -LiteralPath (Join-Path $root "package-lock.json")) {
      Invoke-Npm "ci"
    } else {
      Invoke-Npm "install"
    }
  }

  if (-not (Test-Path -LiteralPath (Join-Path $root ".next\BUILD_ID"))) {
    Write-Step "Building Force Studio (first run only)"
    Invoke-Npm "run build"
  }

  $shortcut = Join-Path $root "windows\create-shortcut.ps1"
  if (Test-Path -LiteralPath $shortcut) {
    Write-Step "Creating Desktop / Start Menu icon"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $shortcut
  }

  $plugin = Join-Path $root "windows\install-plugin.ps1"
  if (Test-Path -LiteralPath $plugin) {
    Write-Step "Installing MX Bikes telemetry plugin"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $plugin
  }

  Write-Host ""
  Write-Host "================================================================" -ForegroundColor Green
  Write-Host "  APP READY   http://127.0.0.1:43187" -ForegroundColor Green
  Write-Host "  NOW launch MX Bikes on this same PC, go on track," -ForegroundColor Green
  Write-Host "  switch Force Studio to Live, click Connect." -ForegroundColor Green
  Write-Host "  If the game is already open, restart it so the plugin loads." -ForegroundColor Green
  Write-Host "================================================================" -ForegroundColor Green
  Write-Host ""

  $bridge = Start-Process -FilePath "node" -ArgumentList "bridge\udp-bridge.mjs" -WorkingDirectory $root -PassThru -WindowStyle Hidden

  $opener = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile", "-Command",
    "`$u='http://127.0.0.1:43187'; for(`$i=0;`$i -lt 120;`$i++){ try{ `$null = Invoke-WebRequest -UseBasicParsing `$u -TimeoutSec 1; Start-Process `$u; break } catch { Start-Sleep -Milliseconds 500 } }"
  ) -PassThru -WindowStyle Hidden

  try {
    Invoke-Npm "run start"
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
  Write-Host "Leave this window open so you can read the error."
  Write-Host "Need internet on the first run (Node.js + npm packages)."
  Write-Host ""
  exit 1
}
