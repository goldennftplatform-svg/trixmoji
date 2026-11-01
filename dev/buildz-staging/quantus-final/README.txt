QUANTUS INTEL GPU MINER — ONE CLICK V2

1. Extract the ZIP on Windows.
2. Double-click INSTALL.bat.
3. Wait for INSTALL COMPLETE.
4. Double-click START-MINER.bat.

No manual patching. No copying the long miner command.

The package reproduces the configuration validated on Intel Iris Xe:
Intel Iris Xe -> Mesa DZN -> Vulkan -> WGPU -> Quantus GPU engine.

CHECK-GPU.bat runs diagnostics.

Requirements:
- Windows with WSL2 Ubuntu
- WSL GPU support
- Quantus node already installed/running locally
- Internet connection during installation

Security:
The package does not contain the Quantus auth token or TLS fingerprint.
It reads the existing files from the local Quantus node installation.
