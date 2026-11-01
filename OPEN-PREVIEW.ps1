# DOSWAPZ local preview — starts one server, waits, opens browser
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$Port = 8890
$Bind = '127.0.0.1'
$Base = "http://${Bind}:${Port}"

Write-Host ""
Write-Host " DOSWAPZ local preview"
Write-Host " Serving from: $Root"
Write-Host ""

# Kill anything on 8890
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1

# Resolve Python (full path avoids Windows Store stub issues)
$Python = $null
foreach ($candidate in @(
  "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe",
  "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
  "python"
)) {
  if ($candidate -eq 'python') { $Python = 'python'; break }
  $hit = Get-Item $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($hit) { $Python = $hit.FullName; break }
}
if (-not $Python) { $Python = 'python' }

# Start ONE server in its own window (must stay open while you browse)
Start-Process cmd.exe -ArgumentList '/k', "`"$Python`" -m http.server $Port --bind $Bind" -WorkingDirectory $Root -WindowStyle Normal

# Wait for server (up to 20s)
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $null = Invoke-WebRequest -Uri "$Base/" -UseBasicParsing -TimeoutSec 2
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $ready) {
  Write-Host ""
  Write-Host " ERROR: Server did not start on port $Port."
  Write-Host " Check the 'DOSWAPZ Preview Server' window for errors."
  Write-Host " Try: python --version"
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host " Server ready: $Base"
Write-Host ""
Write-Host " Time machine:    $Base/portal.html"
Write-Host " Past hub:        $Base/classic/hub.html"
Write-Host " Present hub:     $Base/orbit/hub.html"
Write-Host " Dev page map:    $Base/orbit/test-hub.html  (QA only)"
Write-Host " Future hub:      $Base/future/hub.html"
Write-Host " Vision center:   $Base/classic/pages/perpetual-vision-center.html"
Write-Host " Portal:          $Base/portal.html"
Write-Host ""

Start-Process "$Base/"
Write-Host " Browser opened. Keep the server window open while you browse."
Write-Host " Run STOP-PREVIEW.bat when done."
Write-Host ""