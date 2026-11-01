$log = Join-Path $PSScriptRoot '_crypto_doge_run.log'
$exitFile = Join-Path $PSScriptRoot '_crypto_doge_install_exit.txt'
'ps1-start' | Set-Content (Join-Path $PSScriptRoot '_crypto_doge_ps1_boot.txt') -Encoding utf8
$py = 'C:\Users\franc\AppData\Local\Python\bin\python.exe'
if (-not (Test-Path $py)) { $py = 'py' }
$installScript = Join-Path $PSScriptRoot 'install_all_character_poses.py'
$out = @('=== INSTALL CRYPTO-BITLORD + DOGEDESIGNER ===')
foreach ($slug in @('crypto-bitlord', 'dogedesigner')) {
    $out += "=== RUN $slug ==="
    $out += @(& $py $installScript $slug 2>&1 | ForEach-Object { "$_" })
    $out += "EXIT=$LASTEXITCODE"
}
$out | Out-File $log -Encoding utf8 -Force
'0' | Out-File $exitFile -Encoding ascii -Force
exit 0