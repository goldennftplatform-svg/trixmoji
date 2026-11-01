#!/usr/bin/env bash
set -euo pipefail
DZN="$HOME/mesa-dzn/install/share/vulkan/icd.d/dzn_icd.x86_64.json"
MINER="$HOME/quantus-miner-source/target/release/quantus-miner"
TOKEN="$HOME/.local/share/quantus-node/chains/mainnet/miner-auth-token"
TLS="$HOME/.local/share/quantus-node/chains/mainnet/miner-tls-cert-sha256"
LOG="$HOME/Quantus-OneClick/miner.log"

for f in "$DZN" "$MINER" "$TOKEN" "$TLS"; do
  [ -f "$f" ] || { echo "ERROR: Missing $f"; exit 1; }
done

mkdir -p "$HOME/Quantus-OneClick"

echo
echo "=============================================================="
echo " QUANTUS GPU MINER"
echo " Intel Iris Xe -> Mesa DZN -> Vulkan -> WGPU"
echo " CPU workers: 0"
echo " Dashboard log: $LOG"
echo "=============================================================="
echo

# Preserve a timestamped copy of the miner output so the dashboard can read it.
# The terminal still shows the live output.
touch "$LOG"
exec env \
  VK_DRIVER_FILES="$DZN" \
  WGPU_BACKEND=vulkan \
  WGPU_ALLOW_UNDERLYING_NONCOMPLIANT_ADAPTER=1 \
  "$MINER" serve \
  --gpu-devices 1 \
  --allow-integrated \
  --cpu-workers 0 \
  --node-addr 127.0.0.1:9833 \
  --auth-token-file "$TOKEN" \
  --tls-cert-sha256-file "$TLS" 2>&1 | tee -a "$LOG"
