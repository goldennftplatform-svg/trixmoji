#!/usr/bin/env bash
set -euo pipefail

APP="$HOME/Quantus-OneClick"
MESA_DIR="$HOME/mesa-dzn"
MESA_SRC="$MESA_DIR/mesa-26.1.5"
MESA_INSTALL="$MESA_DIR/install"
MINER_SRC="$HOME/quantus-miner-source"
MINER_BIN="$MINER_SRC/target/release/quantus-miner"
DZN="$MESA_INSTALL/share/vulkan/icd.d/dzn_icd.x86_64.json"

echo "=============================================================="
echo " QUANTUS INTEL GPU MINER - AUTOMATIC INSTALL"
echo "=============================================================="

if [ ! -e /dev/dxg ]; then
  echo "ERROR: WSL GPU support (/dev/dxg) is unavailable."
  echo "Update WSL/Windows GPU drivers, reboot, and run this installer again."
  exit 1
fi

echo "[1/8] Installing required Linux packages..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git curl ca-certificates build-essential pkg-config \
  python3 meson ninja-build cmake \
  libdrm-dev libexpat1-dev libwayland-dev \
  libx11-dev libxext-dev libxrandr-dev libxcb1-dev \
  libxcb-dri2-0-dev libxcb-dri3-dev libxcb-present-dev \
  libxcb-randr0-dev libxcb-sync-dev libxshmfence-dev \
  libxxf86vm-dev libxfixes-dev libxdamage-dev \
  libvulkan-dev vulkan-tools glslang-tools rustc cargo

echo "[2/8] Getting Mesa DZN..."
mkdir -p "$MESA_DIR"
if [ ! -d "$MESA_SRC/.git" ]; then
  git clone --depth 1 --branch mesa-26.1.5 https://gitlab.freedesktop.org/mesa/mesa.git "$MESA_SRC"
fi

if [ ! -f "$DZN" ]; then
  rm -rf "$MESA_SRC/build"
  meson setup "$MESA_SRC/build" "$MESA_SRC" \
    --prefix="$MESA_INSTALL" \
    --buildtype=release \
    -Dvulkan-drivers=dzn \
    -Dgallium-drivers= \
    -Dplatforms=x11,wayland \
    -Dbuild-tests=false
  meson compile -C "$MESA_SRC/build"
  meson install -C "$MESA_SRC/build"
fi
test -f "$DZN"

echo "[3/8] Getting Quantus miner source..."
if [ ! -d "$MINER_SRC/.git" ]; then
  git clone https://github.com/Quantus-Network/quantus-miner.git "$MINER_SRC"
fi

echo "[4/8] Applying WGPU compatibility patch..."
GPU_LIB="$MINER_SRC/crates/engine-gpu/src/lib.rs"
if ! grep -q 'ALLOW_UNDERLYING_NONCOMPLIANT_ADAPTER' "$GPU_LIB"; then
python3 - "$GPU_LIB" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
old="backends: wgpu::Backends::PRIMARY,\n            ..Default::default()"
new="backends: wgpu::Backends::PRIMARY,\n            flags: wgpu::InstanceFlags::ALLOW_UNDERLYING_NONCOMPLIANT_ADAPTER,\n            ..Default::default()"
if old not in s:
    raise SystemExit("Could not find expected WGPU block; upstream source changed.")
p.write_text(s.replace(old,new,1))
print("PATCH APPLIED")
PY
else
  echo "Patch already installed."
fi

echo "[5/8] Building Quantus miner..."
cd "$MINER_SRC"
cargo build --release
test -x "$MINER_BIN"

echo "[6/8] Creating permanent launcher..."
mkdir -p "$APP"

cat > "$APP/start-miner.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DZN="$HOME/mesa-dzn/install/share/vulkan/icd.d/dzn_icd.x86_64.json"
MINER="$HOME/quantus-miner-source/target/release/quantus-miner"
TOKEN="$HOME/.local/share/quantus-node/chains/mainnet/miner-auth-token"
TLS="$HOME/.local/share/quantus-node/chains/mainnet/miner-tls-cert-sha256"

for f in "$DZN" "$MINER" "$TOKEN" "$TLS"; do
  [ -f "$f" ] || { echo "ERROR: Missing $f"; exit 1; }
done

echo
echo "=============================================================="
echo " QUANTUS GPU MINER"
echo " Intel Iris Xe -> Mesa DZN -> Vulkan -> WGPU"
echo " CPU workers: 0"
echo "=============================================================="
echo

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
  --tls-cert-sha256-file "$TLS"
EOF
chmod +x "$APP/start-miner.sh"

cat > "$APP/check-gpu.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DZN="$HOME/mesa-dzn/install/share/vulkan/icd.d/dzn_icd.x86_64.json"
echo "=== Quantus Intel GPU diagnostic ==="
echo
echo "WSL GPU:"
[ -e /dev/dxg ] && echo "PASS /dev/dxg" || echo "FAIL /dev/dxg"
echo
echo "DZN:"
[ -f "$DZN" ] && echo "PASS DZN ICD" || echo "FAIL DZN ICD"
echo
echo "Vulkan adapter:"
VK_DRIVER_FILES="$DZN" vulkaninfo --summary 2>&1 | grep -E "Microsoft Direct3D12|Intel.*Iris|Dozen" || true
echo
echo "Miner:"
[ -x "$HOME/quantus-miner-source/target/release/quantus-miner" ] && echo "PASS patched miner" || echo "FAIL miner"
echo
echo "Node credentials:"
[ -f "$HOME/.local/share/quantus-node/chains/mainnet/miner-auth-token" ] && echo "PASS auth token" || echo "FAIL auth token"
[ -f "$HOME/.local/share/quantus-node/chains/mainnet/miner-tls-cert-sha256" ] && echo "PASS TLS fingerprint" || echo "FAIL TLS fingerprint"
EOF
chmod +x "$APP/check-gpu.sh"

echo "[7/8] Creating Windows-friendly launchers..."
# These live in the WSL home directory and the package's START-MINER.bat calls them.
cat > "$APP/README.txt" <<'EOF'
QUANTUS ONE CLICK GPU MINER

Start:
  ~/Quantus-OneClick/start-miner.sh

Diagnostic:
  ~/Quantus-OneClick/check-gpu.sh

Working GPU path:
  Intel Iris Xe
  Mesa DZN
  Vulkan
  WGPU
  Quantus GPU engine

The launcher reads the existing Quantus node authentication files.
It does not print their contents or store them in this package.
EOF

echo "[8/8] Final verification..."
"$APP/check-gpu.sh"

echo
echo "=============================================================="
echo " INSTALL COMPLETE"
echo "=============================================================="
echo
echo "Use START-MINER.bat to start mining."
echo "The expected working output includes:"
echo "  GPU device 0: Microsoft Direct3D12 (Intel(R) Iris(R) Xe Graphics)"
echo "  GPU 0 search started"
echo
