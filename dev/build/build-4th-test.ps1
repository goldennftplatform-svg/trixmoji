# Copy all present (orbit) pages into "4th test" folder for local review
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$srcHub = Join-Path $root 'orbit\hub.html'
$srcPages = Join-Path $root 'orbit\pages'
$dstRoot = Join-Path $root '4th test'

if (Test-Path $dstRoot) { Remove-Item $dstRoot -Recurse -Force }
New-Item -ItemType Directory -Path $dstRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dstRoot 'pages') | Out-Null

Copy-Item $srcHub (Join-Path $dstRoot 'hub.html') -Force

$pageLinks = @()
Get-ChildItem $srcPages -Recurse -Filter '*.html' | ForEach-Object {
  $rel = $_.FullName.Substring($srcPages.Length).TrimStart('\')
  $dest = Join-Path (Join-Path $dstRoot 'pages') $rel
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item $_.FullName $dest -Force
  $pageLinks += @{ rel = $rel; href = 'pages/' + ($rel -replace '\\', '/') }
  Write-Host "4th test: pages/$rel"
}

$pageLinks = $pageLinks | Sort-Object { $_.rel }
$rows = ($pageLinks | ForEach-Object {
  $label = ($_.rel -replace '\.html$', '') -replace '/', ' / '
  "    <li><a href=`"$($_.href)`">$label</a></li>"
}) -join "`n"

$index = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DOSWAPZ // 4TH TEST - PRESENT ERA</title>
  <style>
    body { margin:0; padding:32px 24px 48px; background:#000; color:#0f0; font-family:Consolas,monospace; }
    h1 { letter-spacing:4px; font-size:22px; margin:0 0 8px; }
    p { color:#6a6; line-height:1.5; max-width:720px; }
    ul { columns:2; column-gap:32px; max-width:960px; padding-left:20px; }
    a { color:#6cf; text-decoration:none; }
    a:hover { color:#ff0; }
    .hub { display:inline-block; margin:16px 0 24px; padding:10px 16px; border:2px solid #7878fc; color:#7878fc; }
    .hub:hover { color:#ff0; border-color:#ff0; }
    @media (max-width:640px) { ul { columns:1; } }
  </style>
</head>
<body>
  <h1>4TH TEST - PRESENT (ORBIT)</h1>
  <p>Review copies of the live present-era pages. Run <strong>OPEN-PREVIEW.bat</strong> first, then open
  <a href="http://localhost:8890/4th%20test/hub.html">http://localhost:8890/4th%20test/hub.html</a>
  or browse individual pages below. Asset paths still point at <code>/assets/</code> on the local server.</p>
  <a class="hub" href="hub.html">ORBIT HUB</a>
  <ul>
$rows
  </ul>
</body>
</html>
"@

[System.IO.File]::WriteAllText((Join-Path $dstRoot 'index.html'), $index, [System.Text.UTF8Encoding]::new($false))
Write-Host "Built 4th test folder with $($pageLinks.Count) pages + hub + index"