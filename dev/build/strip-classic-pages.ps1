# Remove orbit overlay patches from classic pages/ — keep original site pristine
$root = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'classic\pages'
$patterns = @(
  '<script src="/assets/js/core/era-boot\.js"></script>\s*',
  '<link rel="stylesheet" href="/assets/css/era-past\.css">\s*',
  '<link rel="stylesheet" href="/assets/css/era-present\.css">\s*',
  '<link rel="stylesheet" href="/assets/css/era-portal\.css">\s*',
  '<link rel="stylesheet" href="/assets/css/hollow-v2\.css">\s*',
  '<script src="/assets/js/core/hollow-spawn\.js"></script>\s*',
  '<script src="/assets/js/core/hollow-orbit\.js"></script>\s*',
  '<script src="/assets/js/core/v2-orbit-shell\.js"></script>\s*',
  '<script src="/assets/js/core/v2-orbit-shell\.js"></script>',
  '<script src="/assets/js/core/era-portal\.js"></script>\s*'
)

$files = Get-ChildItem $root -Recurse -Filter '*.html'
$n = 0
foreach ($file in $files) {
  $html = Get-Content $file.FullName -Raw -Encoding UTF8
  $orig = $html
  foreach ($p in $patterns) {
    $html = $html -replace $p, ''
  }
  $html = $html -replace '\s*doswapz-v2', ''
  $html = $html -replace 'class=""', 'class=""' 
  $html = $html -replace '<body class="">', '<body>'
  if ($html -ne $orig) {
    [System.IO.File]::WriteAllText($file.FullName, $html, [System.Text.UTF8Encoding]::new($false))
    $n++
    Write-Host "stripped: $($file.Name)"
  }
}
Write-Host "Stripped $n classic pages"