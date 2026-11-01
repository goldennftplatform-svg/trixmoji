$ErrorActionPreference = 'Continue'
$root = 'C:\Users\franc\Desktop\DOSWAPZ'
$py = 'C:\Users\franc\AppData\Local\Python\bin\python.exe'
$script = Join-Path $root 'dev\build\install_all_character_poses.py'
$hole = Join-Path $root 'dev\build\ansem_hole_check.py'
$log = Join-Path $root 'dev\build\ansem_roger_donalt_install_result.txt'

function Run-Step($label, $args) {
    Add-Content $log "`n=== $label START $(Get-Date) ==="
    $out = @(& $py $script @args 2>&1 | ForEach-Object { "$_" })
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
    $out += "${label}_EXIT=$code"
    $out | Add-Content $log
}

Set-Content $log "PS1 launch $(Get-Date)"
Run-Step 'ANSEM' @('ansem')
Run-Step 'ROGER-VER' @('roger-ver')
Run-Step 'DONALT' @('donalt')
Add-Content $log "`n=== HOLE CHECK START $(Get-Date) ==="
$holeOut = @(& $py $hole 2>&1 | ForEach-Object { "$_" })
$holeOut | Add-Content $log
Add-Content $log "ALL_DONE $(Get-Date)"