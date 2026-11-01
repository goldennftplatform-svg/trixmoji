# Generate orbit/pages/ from classic/pages/ — merge-a void shell (skip cryptodad + cryptomom)
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$srcRoot = Join-Path $root 'classic\pages'
$dstRoot = Join-Path $root 'orbit\pages'
$skip = @('\cryptodad\', '\cryptomom\', '\harbinger.html', '\vantablack\coin.html', '\perpetual-vision-center.html', '\perpetual-vision-vault.html', '\degen\trailer.html')

function Get-PageTitle($html) {
  $all = [regex]::Matches($html, '<title>([^<]+)</title>')
  for ($i = $all.Count - 1; $i -ge 0; $i--) {
    $t = $all[$i].Groups[1].Value.Trim()
    if ($t -notmatch 'use local server') { return $t }
  }
  return 'DOSWAPZ'
}

function Get-InnerContent($html) {
  if ($html -match '(?s)<div class="content"[^>]*>(.*?)</div>\s*(?:<!--\s*Glitch|<div class="glitch)') {
    return $matches[1].Trim()
  }
  if ($html -match '(?s)<div class="content"[^>]*>(.*?)</div>\s*</div>\s*<script') {
    return $matches[1].Trim()
  }
  if ($html -match '(?s)<div class="wrap"[^>]*>(.*?)</div>\s*<div class="glitch-layer"') {
    return $matches[1].Trim()
  }
  if ($html -match '(?s)<div class="wrap"[^>]*>(.*)</div>\s*</div>\s*<script') {
    return $matches[1].Trim()
  }
  if ($html -match '(?s)<div class="synopsis"[^>]*>(.*?)</div>\s*<div class="buttons"') {
    $body = "    <div class=`"synopsis`">`n" + $matches[1].Trim() + "`n    </div>"
    if ($html -match '(?s)<div class="buttons"[^>]*>(.*?)</div>') {
      $body += "`n`n    <div class=`"buttons`">" + $matches[1].Trim() + "</div>"
    }
    if ($html -match '(?s)<div class="footer"[^>]*>(.*?)</div>\s*(?:<!--|<div class="glitch)') {
      $body += "`n`n    <div class=`"footer`">" + $matches[1].Trim() + "</div>"
    }
    return $body
  }
  if ($html -match '(?s)(<div class="center-link-wrap"[^>]*>.*?</div>)') {
    return $matches[1].Trim()
  }
  if ($html -match '(?s)<div class="dos-screen"[^>]*>\s*<div class="vignette"></div>\s*(.*?)\s*<div class="glitch-layer"') {
    $inner = $matches[1].Trim()
    if ($inner -notmatch 'class="content"' -and $inner.Length -gt 40) {
      return $inner
    }
  }
  return '<p class="orbit-fallback">Orbit renovation — content pending rebuild.</p>'
}

function Sanitize-OrbitStyles($css) {
  $css = $css -replace '(?s):root\s*\{[^}]*\}', '/* orbit: :root stripped */'
  $css = $css -replace '(?s)\.header\s*\{[^}]*\}', '/* orbit: .header stripped */'
  $css = $css -replace '(?s)\.subhead\s*\{[^}]*\}', '/* orbit: .subhead stripped */'
  $css = $css -replace '(?s)\.sub\s*\{[^}]*\}', '/* orbit: .sub stripped */'
  $css = $css -replace '(?s)html\s*,\s*body\s*\{[^}]*\}', '/* orbit: global html,body stripped */'
  $css = $css -replace '(?s)\.dos-screen::before\s*\{[^}]*\}', '/* orbit: scanlines stripped */'
  $css = $css -replace '(?s)\.dos-screen\s*\{[^}]*\}', '.dos-screen { position:relative; min-height:0; background:transparent; padding:0; }'
  $pairs = @(
    @('#00ff00', 'rgba(255,255,255,0.38)'),
    @('#00ff41', 'var(--panel-accent)'),
    @('#00aa00', 'rgba(255,255,255,0.35)'),
    @('#003300', 'rgba(255,255,255,0.14)'),
    @('#001100', 'transparent'),
    @('#ffff00', 'var(--panel-accent)'),
    @('#ffaa00', 'var(--panel-accent)'),
    @('#aaffaa', 'var(--panel-accent)'),
    @('#111111', 'transparent'),
    @('#111', 'transparent'),
    @('#000000', 'transparent'),
    @('#000', 'transparent')
  )
  foreach ($pair in $pairs) {
    $css = $css -replace [regex]::Escape($pair[0]), $pair[1]
    $css = $css -replace [regex]::Escape($pair[0].ToUpper()), $pair[1]
  }
  return $css
}

function Sanitize-OrbitContent($html) {
  $html = $html -replace 'href="/classic/hub\.html"', 'href="/orbit/hub.html"'
  $html = $html -replace 'href="/classic/pages/', 'href="/orbit/pages/'
  $html = $html -replace 'href="/orbit/pages/cryptodad/', 'href="/classic/pages/cryptodad/'
  $html = $html -replace 'href="/orbit/pages/basement/cryptomom/', 'href="/classic/pages/basement/cryptomom/'
  $html = $html -replace 'color:#00ff41', 'color:var(--panel-accent)'
  $html = $html -replace 'color:#00ff00', 'color:var(--panel-accent)'
  $html = $html -replace 'color:#00aa00', 'color:rgba(255,255,255,0.35)'
  $html = $html -replace 'border-color:#00ff41', 'border-color:var(--panel-accent)'
  $html = $html -replace 'border-color:#003300', 'border-color:rgba(255,255,255,0.14)'
  return $html
}

function Get-PageStyles($html) {
  $blocks = @()
  [regex]::Matches($html, '(?s)<style[^>]*>(.*?)</style>') | ForEach-Object {
    $inner = $_.Groups[1].Value.Trim()
    if ($inner) { $blocks += $inner }
  }
  if ($blocks.Count -eq 0) { return '' }
  $joined = Sanitize-OrbitStyles ($blocks -join "`n`n")
  "  <style class=`"page-classic-styles`">`n$joined`n  </style>`n"
}

function Script-TagForSrc($src, $isModule) {
  if ($isModule) {
    return "  <script type=`"module`" src=`"$src`"></script>`n"
  }
  return "  <script src=`"$src`"></script>`n"
}

function Get-ScriptSrcEntries($block) {
  $entries = @()
  [regex]::Matches($block, '<script([^>]*)\ssrc="([^"]+)"([^>]*)></script>') | ForEach-Object {
    $before = $_.Groups[1].Value
    $src = $_.Groups[2].Value.Trim()
    $after = $_.Groups[3].Value
    $attrs = "$before $after"
    $isModule = $attrs -match 'type\s*=\s*[''"]module[''"]'
    $entries += [pscustomobject]@{ Src = $src; Module = [bool]$isModule }
  }
  # also match type=module before src
  [regex]::Matches($block, '<script([^>]*)src="([^"]+)"([^>]*)></script>') | ForEach-Object {
    $before = $_.Groups[1].Value
    $src = $_.Groups[2].Value.Trim()
    $after = $_.Groups[3].Value
    $attrs = "$before $after"
    $isModule = $attrs -match 'type\s*=\s*[''"]module[''"]'
    $exists = $false
    foreach ($e in $entries) { if ($e.Src -eq $src) { $exists = $true; break } }
    if (-not $exists) {
      $entries += [pscustomobject]@{ Src = $src; Module = [bool]$isModule }
    }
  }
  $entries
}

function Get-HeadScripts($html) {
  $head = ''
  if ($html -match '(?s)<head[^>]*>(.*?)</head>') { $head = $matches[1] }
  if (-not $head) { return '' }
  $out = ''
  foreach ($e in (Get-ScriptSrcEntries $head)) {
    $src = $e.Src
    if ($src -notmatch 'era-|hollow-|v2-orbit|shell-boot|site-shell|page-transition') {
      $out += Script-TagForSrc $src $e.Module
    }
  }
  $out
}

function Get-BodyScripts($html) {
  $body = ''
  if ($html -match '(?s)<body[^>]*>(.*?)</body>') { $body = $matches[1] }
  $lines = @()
  foreach ($e in (Get-ScriptSrcEntries $body)) {
    $src = $e.Src
    if ($src -notmatch 'era-|hollow-|v2-orbit|shell-boot|site-shell|page-transition|glitch\.js') {
      $key = if ($e.Module) { "MODULE:$src" } else { $src }
      if ($lines -notcontains $key) { $lines += $key }
    }
  }
  [regex]::Matches($body, '(?s)<script(?![^>]*\ssrc=)([^>]*)>(.*?)</script>') | ForEach-Object {
    $inner = $_.Groups[2].Value.Trim()
    if (-not $inner) { return }
    if ($inner -match 'DOSWAPZ_GLITCH\s*\.\s*init') { return }
    if ($inner -match 'initSwapCountTicker|connectSwapWallet|DOMContentLoaded|addEventListener|fetchCatalog|DOSWAPZ_VANTABLACK|launchCurve|data-launch-mode') {
      if ($lines -notcontains "INLINE:$inner") { $lines += "INLINE:$inner" }
    }
  }
  $extra = ''
  foreach ($s in $lines) {
    if ($s.StartsWith('INLINE:')) {
      $extra += "  <script>`n$($s.Substring(7))`n  </script>`n"
    } elseif ($s.StartsWith('MODULE:')) {
      $extra += Script-TagForSrc ($s.Substring(7)) $true
    } else {
      $extra += Script-TagForSrc $s $false
    }
  }
  $extra
}

function Get-PageAccent($rel) {
  $r = $rel.ToLower().Replace('\', '/')
  if ($r -match 'doswapz/swap|doswapz/meat|doswapz/bridge') { return 'accent-swap' }
  if ($r -match 'doswapz/mint|doswapz/gallery') { return 'accent-mint' }
  if ($r -match 'pond-scum') { return 'accent-pond' }
  if ($r -match 'degen/') { return 'accent-degen' }
  if ($r -match 'hardwear/') { return 'accent-hard' }
  if ($r -match 'attic') { return 'accent-attic' }
  if ($r -match 'basement') { return 'accent-basement' }
  if ($r -match 'lily-pad|nodes') { return 'accent-lily' }
  if ($r -match '13th-step') { return 'accent-13th' }
  if ($r -match 'demplar') { return 'accent-demplar' }
  if ($r -match 'i-see-you') { return 'accent-iseeyou' }
  if ($r -match 'perpetual-vision') { return 'accent-pvv' }
  return 'accent-hub'
}

function Get-PageSub($rel, $short) {
  $r = $rel.ToLower()
  if ($r -match 'bridge') { return 'multi-chain bridge' }
  if ($r -match 'i-see-you') { return 'wallet surveillance' }
  if ($r -match 'swap') { return '0% jupiter swap' }
  if ($r -match 'token-launcher') { return 'multi-chain token launch' }
  if ($r -match 'vantablack') { return 'vantablack market' }
  if ($r -match 'mint') { return 'pixel math' }
  if ($r -match 'gallery') { return 'math mint gallery' }
  if ($r -match 'meat') { return 'price alerts' }
  if ($r -match 'lily') { return 'video gate' }
  if ($r -match 'pond') { return 'dossier terminal' }
  if ($r -match 'basement') { return 'off the record' }
  if ($r -match 'attic') { return 'tcg product drops' }
  if ($r -match 'lily') { return 'node grid' }
  return ($short.ToLower())
}

$shellStart = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>
  (function(){if(location.protocol!=='file:')return;var p=location.pathname.replace(/\\/g,'/'),m='/doswapz',i=p.toLowerCase().lastIndexOf(m),r=i>=0?p.slice(i+m.length):'/orbit/hub.html',u='http://localhost:8890'+r;document.documentElement.innerHTML='<head><meta charset="UTF-8"><title>DOSWAPZ - use local server</title></head><body style="margin:0;background:#000;color:#0f0;font-family:Consolas,monospace"><div style="max-width:580px;margin:48px auto;padding:28px;border:2px solid #0f0;line-height:1.55"><h1 style="font-size:26px;letter-spacing:3px;margin:0 0 16px">OPEN VIA LOCAL SERVER</h1><p>Orbit pages need <code>/assets/</code> over HTTP - not <code>file://</code>.</p><p style="margin-top:20px"><strong>1.</strong> Double-click <code>OPEN-PREVIEW.bat</code><br><strong>2.</strong> Then open: <a href="'+u+'" style="color:#6cf">'+u+'</a></p></div></body>';})();
  </script>
  <title>__TITLE__</title>
  <link rel="stylesheet" href="/assets/css/hollow-base.css">
  <link rel="stylesheet" href="/assets/css/orbit-void.css">
  <link rel="stylesheet" href="/assets/css/orbit-void-content.css">
  <link rel="stylesheet" href="/assets/css/era-transition.css">
__EXTRA_CSS____PAGE_STYLES____HEAD_SCRIPTS__</head>
<body id="screen" class="orbit-void-inner">
  <canvas class="bg-canvas" id="bg" aria-hidden="true"></canvas>
  <div id="stars"></div>
  <div class="grain"></div>
  <div class="vignette"></div>
  <div class="glitch-layer" id="glitchLayer"></div>
  <div class="cursor-ghost" id="cursorGhost"></div>

  <nav class="ref-crumbs" style="color:rgba(255,255,255,0.15)">
    <span class="crumb-zone">__ZONE__</span>
    <a href="/portal.html" class="tm-static">&#9678; TIME MACHINE</a>
    <a href="/orbit/hub.html" class="hub-static">HUB</a>
  </nav>

  <div class="float-field" id="field">
    <div class="core-glow"></div>
    <div class="orbit-line" style="width:calc(100vw - 72px);height:calc(100vh - 72px)"></div>
    <div class="orbit-line" style="width:calc(68vw - 48px);height:calc(68vh - 48px)"></div>
    <div class="orbit-line" style="width:min(34vmin,34vw);height:min(34vmin,34vh)"></div>
  </div>

  <main class="stage" id="content">
    <h1 class="hollow-title" id="orbitTitle">__SHORT_TITLE__</h1>
    <p class="hollow-sub" id="stageSub">__PAGE_SUB__<span class="cursor-blink">&#9608;</span></p>
  </main>

  <div class="orbit-panel __ACCENT__" id="orbitPanel">
__CONTENT__
  </div>

  <p class="glitch-credit">powered by Glitch Protocol</p>

  <script src="/assets/js/core/hollow-spawn.js"></script>
  <script src="/assets/js/core/hollow-orbit.js"></script>
  <script src="/assets/js/core/hollow-page-boot.js"></script>
  <script src="/assets/js/core/era-portal.js"></script>
  <script src="/assets/js/core/era-transition.js"></script>
  <script src="/assets/js/core/glitch.js"></script>
__SCRIPTS__
  <script>hollowPageBoot('__SHORT_TITLE__');</script>
</body>
</html>
'@

$preserved = @{}
if (Test-Path $dstRoot) {
  Get-ChildItem $srcRoot -Recurse -Filter '*.html' | ForEach-Object {
    $rel = $_.FullName.Substring($srcRoot.Length)
    $skipIt = $false
    foreach ($s in $skip) { if ($rel -like "*$s*") { $skipIt = $true } }
    if ($skipIt) {
      $orbitPath = Join-Path $dstRoot $rel.TrimStart('\')
      if (Test-Path $orbitPath) {
        $preserved[$rel.TrimStart('\')] = [System.IO.File]::ReadAllText($orbitPath)
      }
    }
  }
  Remove-Item $dstRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $dstRoot | Out-Null
foreach ($kv in $preserved.GetEnumerator()) {
  $dest = Join-Path $dstRoot $kv.Key
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  [System.IO.File]::WriteAllText($dest, $kv.Value, [System.Text.UTF8Encoding]::new($false))
  Write-Host "preserved: $($kv.Key)"
}

$count = 0
Get-ChildItem $srcRoot -Recurse -Filter '*.html' | ForEach-Object {
  $rel = $_.FullName.Substring($srcRoot.Length)
  $skipIt = $false
  foreach ($s in $skip) { if ($rel -like "*$s*") { $skipIt = $true } }
  if ($skipIt) { return }

  $html = Get-Content $_.FullName -Raw -Encoding UTF8
  $title = Get-PageTitle $html
  $short = ($title -replace 'DOSWAPZ // ', '') -replace 'DOSWAPZ', 'DOSWAPZ'
  $content = Sanitize-OrbitContent (Get-InnerContent $html)
  $pageStyles = Get-PageStyles $html
  $headScripts = Get-HeadScripts $html
  $extraScripts = Get-BodyScripts $html
  $accent = Get-PageAccent $rel
  $pageSub = Get-PageSub $rel $short
  $extraCss = ''
  if ($rel -match 'i-see-you') {
    $extraCss = '  <link rel="stylesheet" href="/assets/css/i-see-you.css">`n'
  }

  $out = $shellStart
  $out = $out.Replace('__TITLE__', ($title + ' // ORBIT'))
  $out = $out.Replace('__SHORT_TITLE__', $short)
  $out = $out.Replace('__ZONE__', $short.ToUpper())
  $out = $out.Replace('__PAGE_SUB__', $pageSub)
  $out = $out.Replace('__ACCENT__', $accent)
  $out = $out.Replace('__CONTENT__', $content)
  $out = $out.Replace('__EXTRA_CSS__', $extraCss)
  $out = $out.Replace('__PAGE_STYLES__', $pageStyles)
  $out = $out.Replace('__HEAD_SCRIPTS__', $headScripts)
  $out = $out.Replace('__SCRIPTS__', $extraScripts)

  $dest = Join-Path $dstRoot $rel.TrimStart('\')
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  [System.IO.File]::WriteAllText($dest, $out, [System.Text.UTF8Encoding]::new($false))
  $count++
  Write-Host "orbit: $rel"
}

$harbingerTpl = Join-Path $PSScriptRoot 'orbit-harbinger.template.html'
$harbingerDest = Join-Path $dstRoot 'harbinger.html'
if (Test-Path $harbingerTpl) {
  Copy-Item $harbingerTpl $harbingerDest -Force
  Write-Host "orbit: harbinger.html (template)"
}

Write-Host "Built $count orbit pages in orbit/pages/"

# Rewrite internal links (cryptodad/cryptomom stay classic)
$orbitPages = Join-Path $root 'orbit\pages'
Get-ChildItem $orbitPages -Recurse -Filter '*.html' | ForEach-Object {
  $h = Get-Content $_.FullName -Raw -Encoding UTF8
  $h = Sanitize-OrbitContent $h
  [System.IO.File]::WriteAllText($_.FullName, $h, [System.Text.UTF8Encoding]::new($false))
}
Write-Host "Orbit void theme + links applied"