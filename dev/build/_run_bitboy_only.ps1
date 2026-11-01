$log = Join-Path $PSScriptRoot '_bitboy_install_fresh.log'
$py = 'C:\Users\franc\AppData\Local\Python\bin\python.exe'
if (-not (Test-Path $py)) { $py = 'py' }
$script = Join-Path $PSScriptRoot 'install_all_character_poses.py'
$out = @(& $py $script bitboy 2>&1 | ForEach-Object { "$_" })
$out += "EXIT=$LASTEXITCODE"
$out | Out-File $log -Encoding utf8 -Force
exit 0