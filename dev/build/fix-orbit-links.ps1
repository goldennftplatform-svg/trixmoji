$root = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'orbit\pages'
$files = Get-ChildItem $root -Recurse -Filter '*.html'
foreach ($file in $files) {
  $html = Get-Content $file.FullName -Raw -Encoding UTF8
  $html = $html -replace 'href="/classic/pages/', 'href="/orbit/pages/'
  $html = $html -replace 'href="/orbit/pages/cryptodad/', 'href="/classic/pages/cryptodad/'
  $html = $html -replace 'href="/orbit/pages/basement/cryptomom/', 'href="/classic/pages/basement/cryptomom/'
  $html = $html -replace 'href="/classic/hub.html"', 'href="/orbit/hub.html"'
  [System.IO.File]::WriteAllText($file.FullName, $html, [System.Text.UTF8Encoding]::new($false))
}
Write-Host "Fixed internal links in orbit/pages"