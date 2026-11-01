$session = "C:\Users\franc\.grok\sessions\C%3A%5CWINDOWS%5Csystem32\019f3377-108a-7513-b00a-d1b291aac125\images"
$root = "C:\Users\franc\Desktop\DOSWAPZ\assets\images\kol-fighter\characters"

$jimmy = @{
  "58.jpg" = "high-punch-r.jpg"
  "57.jpg" = "high-kick-r.jpg"
  "62.jpg" = "low-punch-r.jpg"
  "61.jpg" = "low-kick-r.jpg"
  "64.jpg" = "med-punch-r.jpg"
  "63.jpg" = "med-kick-r.jpg"
  "65.jpg" = "special-1-r.jpg"
  "66.jpg" = "special-2-r.jpg"
  "70.jpg" = "crouch-r.jpg"
  "67.jpg" = "block-high-r.jpg"
  "69.jpg" = "block-low-r.jpg"
  "71.jpg" = "jump-r.jpg"
  "72.jpg" = "jump-peak-r.jpg"
  "68.jpg" = "idle-breath-r.jpg"
  "76.jpg" = "walk-forward-1-r.jpg"
  "75.jpg" = "walk-forward-2-r.jpg"
  "74.jpg" = "victory-r.jpg"
  "73.jpg" = "hit-stun-r.jpg"
  "77.jpg" = "knockdown-r.jpg"
}

$pauly = @{
  "59.jpg" = "high-punch-r.jpg"
  "60.jpg" = "high-kick-r.jpg"
  "78.jpg" = "low-punch-r.jpg"
  "80.jpg" = "low-kick-r.jpg"
  "79.jpg" = "med-punch-r.jpg"
  "82.jpg" = "med-kick-r.jpg"
  "81.jpg" = "special-1-r.jpg"
  "83.jpg" = "special-2-r.jpg"
  "84.jpg" = "crouch-r.jpg"
  "86.jpg" = "block-high-r.jpg"
  "88.jpg" = "block-low-r.jpg"
  "89.jpg" = "jump-r.jpg"
  "85.jpg" = "jump-peak-r.jpg"
  "87.jpg" = "idle-breath-r.jpg"
  "93.jpg" = "walk-forward-1-r.jpg"
  "91.jpg" = "walk-forward-2-r.jpg"
  "92.jpg" = "victory-r.jpg"
  "90.jpg" = "hit-stun-r.jpg"
  "94.jpg" = "knockdown-r.jpg"
}

foreach ($pair in @(@{slug='jimmy-edgar'; map=$jimmy}, @{slug='pauly0x'; map=$pauly})) {
  $dest = Join-Path $root $pair.slug "sources"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach ($k in $pair.map.Keys) {
    Copy-Item -Force (Join-Path $session $k) (Join-Path $dest $pair.map[$k])
  }
  Write-Host "$($pair.slug): $((Get-ChildItem $dest).Count) sources"
}