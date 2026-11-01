$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$classic = Join-Path $root 'classic\pages'
$orbit = Join-Path $root 'orbit\pages'
$skip = @('\cryptodad\', '\cryptomom\', '\harbinger.html', '\vantablack\coin.html')

function Get-PlainText($path) {
  $h = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  $h = $h -replace '(?s)<script.*?</script>', ''
  $h = $h -replace '(?s)<style.*?</style>', ''
  $h = $h -replace '<[^>]+>', ' '
  return ([regex]::Replace($h, '\s+', ' ')).Trim()
}

$issues = @()
Get-ChildItem -LiteralPath $classic -Recurse -Filter '*.html' | ForEach-Object {
  $rel = $_.FullName.Substring($classic.Length)
  foreach ($s in $skip) {
    if ($rel -like "*$s*") { return }
  }
  $o = Join-Path $orbit $rel
  if (-not (Test-Path -LiteralPath $o)) {
    $issues += "MISSING orbit:$rel"
    return
  }
  $ct = Get-PlainText $_.FullName
  $ot = Get-PlainText $o
  $ct = $ct -replace '/classic/', '/orbit/'
  $ct = $ct -replace ' DOSWAPZ // [^/]+ // ORBIT', ''
  $ct = $ct -replace ' OPEN VIA LOCAL SERVER.*', ''
  $ot = $ot -replace ' OPEN VIA LOCAL SERVER.*', ''
  if ($ct -ne $ot) {
    $issues += "DIFF:$rel classic=$($ct.Length) orbit=$($ot.Length)"
  }
}

if ($issues.Count -eq 0) {
  Write-Host 'OK: comparable classic/orbit pages share the same text (paths normalized).'
} else {
  $issues | ForEach-Object { Write-Host $_ }
}