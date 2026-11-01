function Get-SynopsisBody($path) {
  $h = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  if ($h -match '(?s)<div class="synopsis"[^>]*>(.*?)</div>') {
    return $matches[1].Trim()
  }
  return $null
}

$classic = 'C:\Users\franc\Desktop\DOSWAPZ\classic\pages\degen\synopsis.html'
$orbit = 'C:\Users\franc\Desktop\DOSWAPZ\orbit\pages\degen\synopsis.html'
$ct = Get-SynopsisBody $classic
$ot = Get-SynopsisBody $orbit

if (-not $ot) { Write-Host 'FAIL: orbit synopsis wrapper missing'; exit 1 }
if ($ct -eq $ot) {
  Write-Host "OK: synopsis body identical ($($ct.Length) chars)"
} else {
  Write-Host "FAIL: synopsis differs classic=$($ct.Length) orbit=$($ot.Length)"
  exit 1
}