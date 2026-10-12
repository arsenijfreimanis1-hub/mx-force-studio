# Downloads Node if needed, installs packages, builds, installs the MX Bikes
# plugin, creates the Desktop icon, starts the bridge, and runs the app.
# Called from Installer.bat / Updater.bat. Keep this window open while you ride.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion = "22.14.0"
$NodeZipName = "node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"

function Show-Status([string]$msg) {
  if (-not $script:StatusTotal) { $script:StatusTotal = 8 }
  if (-not $script:StatusStep) { $script:StatusStep = 0 }
  if ($msg -ne $script:LastStatus) {
    $script:StatusStep++
    $script:LastStatus = $msg
  }
  if ($script:StatusStep -gt $script:StatusTotal) { $script:StatusTotal = $script:StatusStep }
  $pct = [math]::Min(100, [int](100 * $script:StatusStep / $script:StatusTotal))
  $fill = [int](28 * $pct / 100)
  $bar = ("#" * $fill).PadRight(28, "-")
  $line = "[$bar] $pct%  $msg"
  Write-Host ("`r" + $line.PadRight(110)) -NoNewline
}

function Write-Step($msg) {
  Show-Status $msg
}

function Same-Path($a, $b) {
  try {
    return ([IO.Path]::GetFullPath($a).TrimEnd('\') -ieq [IO.Path]::GetFullPath($b).TrimEnd('\'))
  } catch {
    return $false
  }
}

# Copy-Item throws "Cannot overwrite the item ... with itself" when the
# extracted GitHub folder already contains Uninstaller.bat.
function Copy-IfDifferent($src, $dest) {
  if (-not (Test-Path -LiteralPath $src)) { return }
  $destDir = Split-Path -Parent $dest
  if ($destDir -and -not (Test-Path -LiteralPath $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  }
  if (Same-Path $src $dest) { return }
  try {
    Copy-Item -LiteralPath $src -Destination $dest -Force -ErrorAction Stop
  } catch {
    if ("$($_.Exception.Message)" -match 'with itself') { return }
    throw
  }
}

function Get-UpdateRevision([string]$AppRoot) {
  $log = Join-Path $AppRoot "UPDATES.txt"
  if (Test-Path -LiteralPath $log) {
    $raw = (Get-Content -LiteralPath $log -Raw).TrimStart([char]0xFEFF)
    if ($raw -match '(?m)^id:\s*(\S+)') { return $Matches[1] }
  }
  $revFile = Join-Path $AppRoot "windows\app-revision.txt"
  if (Test-Path -LiteralPath $revFile) { return (Get-Content -LiteralPath $revFile -Raw).Trim() }
  return "unknown"
}

function Read-LogTail([string]$path, [int]$n = 40) {
  if (-not (Test-Path -LiteralPath $path)) { return "" }
  return ((Get-Content -LiteralPath $path -Tail $n -ErrorAction SilentlyContinue) -join "`n")
}

function Wait-LocalReady([string]$url, [int]$seconds, $proc, [string]$log) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if ($proc -and $proc.HasExited) {
      $tail = Read-LogTail $log
      throw "The local app stopped before the window could open (exit $($proc.ExitCode)).`n$tail"
    }
    try {
      $resp = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { return }
    } catch {}
    Start-Sleep -Milliseconds 400
  }
  $tail = Read-LogTail $log
  throw "The local app did not start in time.`n$tail"
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

function Unblock-Tree($dir) {
  Get-ChildItem -LiteralPath $dir -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
}

function Invoke-Npm([string]$ArgsLine) {
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue) -and -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found after installing Node.js."
  }
  Show-Status "npm $ArgsLine" 
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
    Show-Status "Using Node $($existing.Source)"
    return
  }
  foreach ($candidate in @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
  )) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      $env:PATH = "$(Split-Path -Parent $candidate);$env:PATH"
      Show-Status "Using Node $candidate"
      return
    }
  }

  $tools = Join-Path $env:LOCALAPPDATA "MXForceStudio"
  $nodeHome = Join-Path $tools "node-v$NodeVersion-win-x64"
  $nodeExe = Join-Path $nodeHome "node.exe"
  if (-not (Test-Path -LiteralPath $nodeExe)) {
    Write-Step "Node.js not found - downloading portable Node $NodeVersion"
    New-Item -ItemType Directory -Force -Path $tools | Out-Null
    $zip = Join-Path $tools $NodeZipName
    Save-Url $NodeUrl $zip
    Show-Status "Extracting Node.js"
    if (Test-Path -LiteralPath $nodeHome) { Remove-Item -LiteralPath $nodeHome -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $tools -Force
  }
  if (-not (Test-Path -LiteralPath $nodeExe)) {
    throw "Failed to install Node.js. Download the LTS installer from https://nodejs.org/en/download , keep Add to PATH checked, then double-click Installer.bat again."
  }
  $env:PATH = "$nodeHome;$env:PATH"
  Show-Status "Using portable Node"
}

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
    Show-Status "Closing leftover process $procId"
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-StudioLocks($root) {
  Show-Status "Closing leftover Force Studio"
  foreach ($port in @(43187, 43188, 47387)) { Stop-ListeningPort $port }
  $needle = ""
  try { $needle = [IO.Path]::GetFullPath($root).TrimEnd('\').ToLowerInvariant() } catch {}
  try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.ProcessId -ne $PID -and
        $_.Name -match '^(node|npm|cmd)\.exe$' -and
        $_.CommandLine -and $needle -and $_.CommandLine.ToLowerInvariant().Contains($needle)
      } |
      ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
  } catch {}
  Start-Sleep -Milliseconds 400
}

function Clear-NextCache($dir) {
  if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { return }
  Show-Status "Clearing old build cache"
  $last = $null
  for ($i = 0; $i -lt 10; $i++) {
    try {
      attrib -R -S -H "$dir\*" /S /D 2>$null | Out-Null
      Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction Stop
      if (-not (Test-Path -LiteralPath $dir)) { return }
    } catch {
      $last = $_.Exception.Message
      Start-Sleep -Milliseconds 500
    }
  }
  $hint = if ($last) { $last } else { "Access denied." }
  throw "Could not clear the old build cache ($hint). Close every Force Studio window, then run Installer.bat again."
}

function Clear-StaleStudio($keepRoot) {
  $legacy = Join-Path $env:LOCALAPPDATA "MXForceStudio\app"
  if (-not (Test-Path -LiteralPath $legacy)) { return }
  $legacyFull = [IO.Path]::GetFullPath($legacy).TrimEnd('\')
  $keep = ""
  if ($keepRoot) { $keep = [IO.Path]::GetFullPath($keepRoot).TrimEnd('\') }
  if ($keep -and ($legacyFull -ieq $keep)) { return }
  Show-Status "Clearing leftover app"
  Remove-Item -LiteralPath $legacy -Recurse -Force -ErrorAction SilentlyContinue
}

try {
  Write-Host ""
  Show-Status "Preparing Force Studio"
  $root = Get-AppRoot
  if (-not $root) {
    throw "App files are missing. Double-click Installer.bat (or Updater.bat), or extract the GitHub zip and run Installer.bat inside that folder."
  }
  Set-Location -LiteralPath $root
  Unblock-Tree $root
  Show-Status "App folder ready"

  foreach ($stale in @("Select", "select", "MX Force Studio.bat", "MX Force Studio.lnk", "START HERE.txt", "Uninstall Force Studio.bat")) {
    $stalePath = Join-Path $root $stale
    if (Test-Path -LiteralPath $stalePath) {
      Show-Status "Removing leftover $stale"
      Remove-Item -LiteralPath $stalePath -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  Clear-StaleStudio $root
  Stop-StudioLocks $root

  Show-Status "Checking Node.js"
  Install-Node
  Show-Status "node $(node -v)"

  $forceUpdate = ($env:MXFS_FORCE_UPDATE -eq "1")
  if ($forceUpdate) {
    Write-Step "Updater: clean rebuild requested"
    Clear-NextCache (Join-Path $root ".next")
  }

  if ($forceUpdate -or -not (Test-Path -LiteralPath (Join-Path $root "node_modules\next"))) {
    Write-Step "Installing packages (needs internet)"
    if (Test-Path -LiteralPath (Join-Path $root "package-lock.json")) {
      Invoke-Npm "ci"
    } else {
      Invoke-Npm "install"
    }
  }

  $builtRevFile = Join-Path $root ".next\app-revision.txt"
  $rev = Get-UpdateRevision $root
  $builtRev = if (Test-Path -LiteralPath $builtRevFile) { (Get-Content -LiteralPath $builtRevFile -Raw).Trim() } else { "" }
  $haveBuild = Test-Path -LiteralPath (Join-Path $root ".next\BUILD_ID")
  if ($forceUpdate -or -not $haveBuild -or $builtRev -ne $rev) {
    Write-Step "Building Force Studio"
    Stop-StudioLocks $root
    Clear-NextCache (Join-Path $root ".next")
    Invoke-Npm "run build"
    if (-not (Test-Path -LiteralPath (Join-Path $root ".next\BUILD_ID"))) {
      throw "The build finished but .next\BUILD_ID is missing, so the app cannot start. Close every Force Studio window, then run Installer.bat again."
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $root ".next") | Out-Null
    Set-Content -LiteralPath $builtRevFile -Value $rev -NoNewline
  }

  if (-not $env:MXFS_BAT) {
    foreach ($name in @("Installer.bat", "Updater.bat")) {
      $guess = Join-Path $root $name
      if (Test-Path -LiteralPath $guess) { $env:MXFS_BAT = $guess; break }
    }
  }

  $shortcut = Join-Path $root "windows\create-shortcut.ps1"
  if (Test-Path -LiteralPath $shortcut) {
    Write-Step "Creating Desktop / Start Menu icon"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $shortcut
  }

  if ($env:MXFS_BAT -and (Test-Path -LiteralPath $env:MXFS_BAT)) {
    $batDir = Split-Path -Parent $env:MXFS_BAT
    foreach ($name in @("Installer.bat", "Updater.bat", "Uninstaller.bat", "FEATURES.txt", "UPDATES.txt")) {
      Copy-IfDifferent (Join-Path $root $name) (Join-Path $batDir $name)
    }
    Copy-IfDifferent (Join-Path $root "windows\uninstall.ps1") (Join-Path $batDir "windows\uninstall.ps1")
    Copy-IfDifferent (Join-Path $root "windows\launch.ps1") (Join-Path $batDir "windows\launch.ps1")
    Copy-IfDifferent (Join-Path $root "windows\app-window.ps1") (Join-Path $batDir "windows\app-window.ps1")
  }

  $plugin = Join-Path $root "windows\install-plugin.ps1"
  if (Test-Path -LiteralPath $plugin) {
    Write-Step "Installing MX Bikes telemetry plugin"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $plugin
  }

  $pointer = Join-Path $root "plugin\mxb-plugins-dir.txt"
  if (Test-Path -LiteralPath $pointer) {
    $env:MXB_PLUGINS_DIR = (Get-Content -LiteralPath $pointer -Raw).Trim()
  }

  if ($env:MXFS_UPDATE_ONLY -eq "1") {
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  UPDATE READY    $rev" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  Latest update downloaded. Plugin reinstalled." -ForegroundColor Green
    Write-Host "  Double-click Installer.bat to start Force Studio." -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
    cmd.exe /c pause
    exit 0
  }

  $logDir = Join-Path $env:LOCALAPPDATA "MXForceStudio"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $nextLog = Join-Path $logDir "next-start.log"
  $bridgeLog = Join-Path $logDir "bridge.log"
  $winOut = Join-Path $logDir "app-window.log"
  $winErr = Join-Path $logDir "app-window.err.log"
  foreach ($oldLog in @($nextLog, $bridgeLog, $winOut, $winErr)) {
    if (Test-Path -LiteralPath $oldLog) { Remove-Item -LiteralPath $oldLog -Force -ErrorAction SilentlyContinue }
  }

  Show-Status "Starting the local app"
  $bridge = Start-Process -FilePath "cmd.exe" -ArgumentList "/c node bridge\udp-bridge.mjs > `"$bridgeLog`" 2>&1" -WorkingDirectory $root -PassThru -WindowStyle Hidden
  $next = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm.cmd run start > `"$nextLog`" 2>&1" -WorkingDirectory $root -PassThru -WindowStyle Hidden

  $windowScript = Join-Path $root "windows\app-window.ps1"
  $window = $null
  try {
    Wait-LocalReady "http://127.0.0.1:43187" 120 $next $nextLog
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  APP READY    $rev" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  This PC only. Close the app window to stop." -ForegroundColor Green
    Write-Host "  Start MX Bikes on this PC, go on track." -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
    if (-not (Test-Path -LiteralPath $windowScript)) {
      throw "Missing windows\app-window.ps1"
    }
    $window = Start-Process -FilePath "powershell.exe" -ArgumentList @(
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $windowScript
    ) -PassThru -WindowStyle Hidden -RedirectStandardOutput $winOut -RedirectStandardError $winErr
    if (-not $window) { throw "Could not open the Force Studio window." }
    Wait-Process -Id $window.Id
    if ($window.ExitCode -ne 0) {
      $why = "$(Read-LogTail $winErr)`n$(Read-LogTail $winOut)`n$(Read-LogTail $nextLog)"
      throw "The Force Studio window closed before it was ready (exit $($window.ExitCode)). $why"
    }
  } finally {
    foreach ($proc in @($window, $bridge, $next)) {
      if ($proc -and -not $proc.HasExited) {
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
          Where-Object { $_.ParentProcessId -eq $proc.Id } |
          ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      }
    }
    Stop-ListeningPort 43187
    Stop-ListeningPort 43188
    Stop-ListeningPort 47387
  }
} catch {
  Write-Host ""
  $msg = "$($_.Exception.Message)"
  if ($msg -match 'Access to the path|Access is denied|\.sst') {
    $msg = "A leftover Force Studio process had the build cache locked. Close every Force Studio window, then double-click Installer.bat again. ($msg)"
  }
  Write-Host "FAILED: $msg" -ForegroundColor Red
  Write-Host ""
  Write-Host "This window stays open so you can read the error."
  Write-Host "Need internet on the first run (Node.js + packages)."
  Write-Host ""
  cmd.exe /c pause
  exit 1
}
