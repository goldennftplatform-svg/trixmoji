# First collection: remint delivery report

Checked **2026-11-02 at 16:50:23 UTC**. Snapshot: **12 successfully minted pieces across 5 wallets**.

Legacy contract: `0x64A0CA6fE1f944De3210a64bD1DAb0619725281d`.

Each token number was independently decoded from the successful transaction's `mint(string,bytes32[],uint256)` calldata using Blockscout. Each original minter and current owner was checked against the Ethscriptions V2 indexer. At this snapshot, every current indexed owner matches its original minter. Addresses below are full lowercase Ethereum addresses.

[Download the spreadsheet-ready CSV](./FIRST-COLLECTION-HOLDERS.csv).

| Token number | Original minter AND current indexed owner | Legacy creation transaction |
|---:|---|---|
| 0 | `0x8e066f69ce11aeae7b796a399ccedee14291d0b2` | [Transaction](https://etherscan.io/tx/0x19975935092ed41f0ce6f4c4e3018ef4ed66e76f7ac8008efbc0490089bc0338) |
| 12 | `0x6a0bbcccbaf9669d40e28a42ed99a08ce9598b40` | [Transaction](https://etherscan.io/tx/0x296b67b4022b485b32dba6962f43393130027d034849f8d975e7e83ba72ded7c) |
| 14 | `0x6a0bbcccbaf9669d40e28a42ed99a08ce9598b40` | [Transaction](https://etherscan.io/tx/0x8250be53bc831a6133e43981f40cc1ab52b437aad733759e2e232f768ab7127e) |
| 29 | `0x6a0bbcccbaf9669d40e28a42ed99a08ce9598b40` | [Transaction](https://etherscan.io/tx/0x9c1ed6bbd2c45c5f6c13ae7028efaf2a974b904c2298ef43a7d00eff25b88acf) |
| 31 | `0x6a0bbcccbaf9669d40e28a42ed99a08ce9598b40` | [Transaction](https://etherscan.io/tx/0x08a9089dbd8574538dea4ed513fff8e4acaa232d81316cd41321ba2d1cd000c8) |
| 35 | `0x15e85a85b7026875d3529ef0c6de2723c285da11` | [Transaction](https://etherscan.io/tx/0x37a2a8bbd3c03a023e2b314da0f8d2c0ee19a69979abf8ac69a2c5fdb18b5937) |
| 39 | `0x915a3d363d0a4e4470b531f008f5142c540e5417` | [Transaction](https://etherscan.io/tx/0x32bde2380a35c8a43cd385e7ee8d1991fa790d6f0eff3d25a5b065d834363399) |
| 419 | `0x47cf60bdd877203264921d05ce26f81f6d36aa3e` | [Transaction](https://etherscan.io/tx/0x68f93845ad5afd466664a88223b1bd61f7f02988cd3bb600030ff430705771ea) |
| 453 | `0x47cf60bdd877203264921d05ce26f81f6d36aa3e` | [Transaction](https://etherscan.io/tx/0x4bc6c65fe48376fbda2ecf80da632f91aba0d38bf4286208d887ee636843b433) |
| 534 | `0x47cf60bdd877203264921d05ce26f81f6d36aa3e` | [Transaction](https://etherscan.io/tx/0x7ced96a6cd237b35f076b0b764116c442f1d1f01986995f585551c3e0cf33f6b) |
| 1259 | `0x47cf60bdd877203264921d05ce26f81f6d36aa3e` | [Transaction](https://etherscan.io/tx/0x1d6924a7f4ec968c33320a91220f4b2cbb317b393893d752ba971cdd5ccba6c0) |
| 1260 | `0x47cf60bdd877203264921d05ce26f81f6d36aa3e` | [Transaction](https://etherscan.io/tx/0x2eb592028b5ed4970fa0a883122aab493fa6c0dc58e137ee24baa441d5bb6009) |

Token **35** is held by the configured site/escrow wallet. Token **39** is held by the creator wallet. Both are included, as requested for all 12 pieces.

Use the legacy creation transaction as the `legacyId` for a creator-paid `deliverReplacement` of the same token number. This report does not send anything or assert that a replacement has already been delivered. Check the new contract's `minted(tokenNo)` and `replaced(legacyId)` before delivery; the delivery page performs those checks. Confirm each destination with the operator, and refresh ownership if using this report later.

Sources: `https://eth.blockscout.com/api/v2/transactions/<transaction_hash>` and `https://api.ethscriptions.com/v2/ethscriptions/<transaction_hash>`.
