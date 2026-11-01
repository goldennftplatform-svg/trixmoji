$log1 = Join-Path $PSScriptRoot '_michael_saylor_install.txt'
$log2 = Join-Path $PSScriptRoot '_vitalik_install.txt'
$py = 'C:\Users\franc\AppData\Local\Python\bin\python.exe'
$pyArgs = @()
if (-not (Test-Path $py)) { $py = 'py'; $pyArgs = @('-3') }
$script = Join-Path $PSScriptRoot 'install_all_character_poses.py'

$out1 = @(& $py @pyArgs $script michael-saylor 2>&1 | ForEach-Object { "$_" })
$code1 = $LASTEXITCODE
if ($null -eq $code1) { $code1 = 0 }
$out1 += "EXIT=$code1"
$out1 | Out-File $log1 -Encoding utf8 -Force

$out2 = @(& $py @pyArgs $script vitalik-buterin 2>&1 | ForEach-Object { "$_" })
$code2 = $LASTEXITCODE
if ($null -eq $code2) { $code2 = 0 }
$out2 += "EXIT=$code2"
$out2 | Out-File $log2 -Encoding utf8 -Force

exit $code2