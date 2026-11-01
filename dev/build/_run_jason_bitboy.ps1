$log = Join-Path $PSScriptRoot '_jason_bitboy_install.log'
$exitFile = Join-Path $PSScriptRoot '_jason_bitboy_install_exit.txt'
'ps1-start' | Set-Content (Join-Path $PSScriptRoot '_jason_bitboy_ps1_boot.txt') -Encoding utf8
$py = 'C:\Users\franc\AppData\Local\Python\bin\python.exe'
if (-not (Test-Path $py)) { $py = 'py' }
$script = Join-Path $PSScriptRoot 'install_all_character_poses.py'
$out = @()
foreach ($slug in @('jason-williams', 'bitboy')) {
    $out += "=== RUN $slug ==="
    $out += @(& $py -3 $script $slug 2>&1 | ForEach-Object { "$_" })
    $out += "EXIT=$LASTEXITCODE"
}
$out | Out-File $log -Encoding utf8 -Force
'0' | Out-File $exitFile -Encoding ascii -Force
exit 0