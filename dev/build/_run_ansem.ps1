$log = Join-Path $PSScriptRoot '_ansem_install_fresh.txt'
$exitFile = Join-Path $PSScriptRoot '_ansem_install_exit.txt'
'ps1-start' | Set-Content (Join-Path $PSScriptRoot '_ansem_ps1_boot.txt') -Encoding utf8
$py = 'C:\Users\franc\AppData\Local\Python\bin\python.exe'
$script = Join-Path $PSScriptRoot 'install_all_character_poses.py'
$out = @(& $py $script ansem 2>&1 | ForEach-Object { "$_" })
$code = $LASTEXITCODE
if ($null -eq $code) { $code = 0 }
$out += "EXIT=$code"
$out | Out-File $log -Encoding utf8 -Force
"$code" | Out-File $exitFile -Encoding ascii -Force
exit $code