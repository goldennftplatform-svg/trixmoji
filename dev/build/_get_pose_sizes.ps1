$poses = 'C:\Users\franc\Desktop\DOSWAPZ\assets\images\kol-fighter\characters\donalt\poses'
@('idle-r.png','high-punch-r.png','high-kick-r.png') | ForEach-Object {
  $p = Join-Path $poses $_
  if (Test-Path $p) { '{0}: {1} bytes' -f $_, (Get-Item $p).Length }
} | Set-Content 'C:\Users\franc\Desktop\DOSWAPZ\dev\build\_donalt_pose_sizes.txt'