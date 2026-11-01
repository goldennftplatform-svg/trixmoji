# Deploy orbit/hub.html from template (floater-only void hub)
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$template = Join-Path $PSScriptRoot 'orbit-hub.template.html'
$dest = Join-Path $root 'orbit\hub.html'

if (-not (Test-Path $template)) {
  Write-Error "Missing template: $template"
  exit 1
}

$content = [System.IO.File]::ReadAllText($template)
[System.IO.File]::WriteAllText($dest, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "orbit/hub.html built from orbit-hub.template.html"