$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root

$ports = @(8888, 5500, 3000, 8080)

Write-Host ""
Write-Host " DOSWAPZ local preview"
Write-Host ""

foreach ($port in $ports) {
  Write-Host "Trying port $port..."
  try {
    npx.cmd --yes serve -l $port .
    exit $LASTEXITCODE
  } catch {
    Write-Host "serve failed on $port, trying Python..."
    try {
      python -m http.server $port --directory $root
      exit $LASTEXITCODE
    } catch {
      continue
    }
  }
}

Write-Host "Could not start a local server. Try running as Administrator or pick another port."
exit 1