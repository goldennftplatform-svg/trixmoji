
QUANTUS DASHBOARD ADD-ON

This enhanced package adds:
- DASHBOARD.bat — starts the local dashboard server.
- START-MINER-AND-DASHBOARD.bat — starts the dashboard, opens it in your browser, then starts the miner.
- miner.log — created automatically and updated while the miner runs.
- dashboard.html / dashboard-server.py — live parser and dashboard.

WHAT THE DASHBOARD COUNTS
1. Chain blocks observed: every "🏆 Imported #..." event in the log.
2. Mining jobs: every "⛏️ Broadcasting job ..." event.
3. Solutions found: ONLY explicit solution/found/accepted events.
4. Peers, best block, finalized block, latest job and difficulty.

IMPORTANT:
The log you supplied contains many "Imported" blocks and many mining jobs. Imported blocks are blockchain blocks your node received/imported; they are NOT automatically proof that your miner personally won those blocks. The dashboard deliberately keeps these metrics separate.

USE
1. Replace/reinstall the Quantus-OneClick files with this package's files if needed.
2. Run START-MINER-AND-DASHBOARD.bat.
3. Open http://localhost:8787 if the browser does not open automatically.
4. Leave the miner running. The dashboard refreshes every 2 seconds.

If your existing Quantus setup is already installed, this add-on does not replace your credentials or node data.
