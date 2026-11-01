/**
 * DOSWAPZ multi-chain registry - Robinhood Chain + EVM + Solana.
 * Shared by bridge, Vantablack launcher, and market filters.
 */
window.DOSWAPZ_CHAINS = (function () {
 'use strict';

 var CHAINS = [
 {
 id: 'solana',
 label: 'Solana',
 kind: 'sol',
 chainId: null,
 symbol: 'SOL',
 decimalsDefault: 9,
 modes: ['curve', 'classic'],
 defaultMode: 'curve',
 explorerTx: function (sig) {
 return 'https://solscan.io/tx/' + encodeURIComponent(sig || '');
 },
 explorerToken: function (mint) {
 return 'https://solscan.io/token/' + encodeURIComponent(mint || '');
 },
 dexscreener: function (mint) {
 return 'https://dexscreener.com/solana/' + encodeURIComponent(mint || '');
 }
 },
 {
 id: 'ethereum',
 label: 'Ethereum',
 kind: 'evm',
 chainId: 1,
 symbol: 'ETH',
 decimalsDefault: 18,
 modes: ['erc20'],
 defaultMode: 'erc20',
 rpcUrls: ['https://ethereum.publicnode.com'],
 explorerTx: function (hash) {
 return 'https://etherscan.io/tx/' + encodeURIComponent(hash || '');
 },
 explorerToken: function (addr) {
 return 'https://etherscan.io/token/' + encodeURIComponent(addr || '');
 },
 dexscreener: function (addr) {
 return 'https://dexscreener.com/ethereum/' + encodeURIComponent(addr || '');
 }
 },
 {
 id: 'base',
 label: 'Base',
 kind: 'evm',
 chainId: 8453,
 symbol: 'ETH',
 decimalsDefault: 18,
 modes: ['erc20'],
 defaultMode: 'erc20',
 rpcUrls: ['https://mainnet.base.org'],
 explorerTx: function (hash) {
 return 'https://basescan.org/tx/' + encodeURIComponent(hash || '');
 },
 explorerToken: function (addr) {
 return 'https://basescan.org/token/' + encodeURIComponent(addr || '');
 },
 dexscreener: function (addr) {
 return 'https://dexscreener.com/base/' + encodeURIComponent(addr || '');
 }
 },
 {
 id: 'arbitrum',
 label: 'Arbitrum',
 kind: 'evm',
 chainId: 42161,
 symbol: 'ETH',
 decimalsDefault: 18,
 modes: ['erc20'],
 defaultMode: 'erc20',
 rpcUrls: ['https://arb1.arbitrum.io/rpc'],
 explorerTx: function (hash) {
 return 'https://arbiscan.io/tx/' + encodeURIComponent(hash || '');
 },
 explorerToken: function (addr) {
 return 'https://arbiscan.io/token/' + encodeURIComponent(addr || '');
 },
 dexscreener: function (addr) {
 return 'https://dexscreener.com/arbitrum/' + encodeURIComponent(addr || '');
 }
 },
 {
 id: 'polygon',
 label: 'Polygon',
 kind: 'evm',
 chainId: 137,
 symbol: 'POL',
 decimalsDefault: 18,
 modes: ['erc20'],
 defaultMode: 'erc20',
 rpcUrls: ['https://polygon-rpc.com'],
 explorerTx: function (hash) {
 return 'https://polygonscan.com/tx/' + encodeURIComponent(hash || '');
 },
 explorerToken: function (addr) {
 return 'https://polygonscan.com/token/' + encodeURIComponent(addr || '');
 },
 dexscreener: function (addr) {
 return 'https://dexscreener.com/polygon/' + encodeURIComponent(addr || '');
 }
 },
 {
 id: 'optimism',
 label: 'Optimism',
 kind: 'evm',
 chainId: 10,
 symbol: 'ETH',
 decimalsDefault: 18,
 modes: ['erc20'],
 defaultMode: 'erc20',
 rpcUrls: ['https://mainnet.optimism.io'],
 explorerTx: function (hash) {
 return 'https://optimistic.etherscan.io/tx/' + encodeURIComponent(hash || '');
 },
 explorerToken: function (addr) {
 return 'https://optimistic.etherscan.io/token/' + encodeURIComponent(addr || '');
 },
 dexscreener: function (addr) {
 return 'https://dexscreener.com/optimism/' + encodeURIComponent(addr || '');
 }
 },
 {
 id: 'bsc',
 label: 'BNB Chain',
 kind: 'evm',
 chainId: 56,
 symbol: 'BNB',
 decimalsDefault: 18,
 modes: ['erc20'],
 defaultMode: 'erc20',
 rpcUrls: ['https://bsc-dataseed.binance.org'],
 explorerTx: function (hash) {
 return 'https://bscscan.com/tx/' + encodeURIComponent(hash || '');
 },
 explorerToken: function (addr) {
 return 'https://bscscan.com/token/' + encodeURIComponent(addr || '');
 },
 dexscreener: function (addr) {
 return 'https://dexscreener.com/bsc/' + encodeURIComponent(addr || '');
 }
 },
 {
 id: 'robinhood',
 label: 'Robinhood Chain',
 kind: 'evm',
 chainId: 4663,
 symbol: 'ETH',
 decimalsDefault: 18,
 modes: ['erc20'],
 defaultMode: 'erc20',
 hood: true,
 rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
 blockExplorerUrls: ['https://robinhoodchain.blockscout.com'],
 explorerTx: function (hash) {
 return 'https://robinhoodchain.blockscout.com/tx/' + encodeURIComponent(hash || '');
 },
 explorerToken: function (addr) {
 return 'https://robinhoodchain.blockscout.com/token/' + encodeURIComponent(addr || '');
 },
 dexscreener: function (addr) {
 return 'https://dexscreener.com/robinhood/' + encodeURIComponent(addr || '');
 },
 walletAddParams: {
 chainId: '0x1237',
 chainName: 'Robinhood Chain',
 nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
 rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
 blockExplorerUrls: ['https://robinhoodchain.blockscout.com']
 }
 }
 ];

 var BRIDGE_ROUTES = [
 {
 id: 'lifi',
 name: 'LI.FI / Jumper',
 eta: 'secs - mins',
 feeBps: 8,
 note: 'Best multi-chain coverage',
 url: function (fromId, toId) {
 return 'https://jumper.exchange/?fromChain=' + encodeURIComponent(fromId) +
 '&toChain=' + encodeURIComponent(toId);
 }
 },
 {
 id: 'across',
 name: 'Across',
 eta: '~seconds',
 feeBps: 6,
 note: 'Fast intents -> Robinhood',
 url: function () {
 return 'https://across.to/?to=robinhood';
 }
 },
 {
 id: 'relay',
 name: 'Relay',
 eta: 'seconds',
 feeBps: 7,
 note: 'Bridge + execute',
 url: function () {
 return 'https://relay.link/bridge/robinhood';
 }
 },
 {
 id: 'stargate',
 name: 'Stargate (LayerZero)',
 eta: 'mins',
 feeBps: 10,
 note: 'OFT / omnichain tokens',
 url: function () {
 return 'https://stargate.finance';
 }
 },
 {
 id: 'ccip',
 name: 'Chainlink CCIP',
 eta: 'mins',
 feeBps: 12,
 note: 'Secure messaging',
 url: function () {
 return 'https://app.transporter.io/?from=robinhood&tab=token';
 }
 },
 {
 id: 'canonical',
 name: 'Arbitrum Canonical',
 eta: 'dep ~10m / exit ~7d',
 feeBps: 3,
 note: 'Trustless ETH ↔ Robinhood',
 url: function () {
 return 'https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum';
 }
 }
 ];

 var EVM_CHAIN_IDS = {
 1: 'ethereum',
 8453: 'base',
 42161: 'arbitrum',
 137: 'polygon',
 10: 'optimism',
 56: 'bsc',
 4663: 'robinhood',
 46630: 'robinhood'
 };

 function list() {
 return CHAINS.slice();
 }

 function byId(id) {
 id = String(id || '').toLowerCase();
 if (id === 'eth') id = 'ethereum';
 if (id === 'hood' || id === 'rh' || id === 'robinhood-chain') id = 'robinhood';
 if (id === 'sol') id = 'solana';
 if (id === 'arb') id = 'arbitrum';
 if (id === 'matic') id = 'polygon';
 for (var i = 0; i < CHAINS.length; i++) {
 if (CHAINS[i].id === id) return CHAINS[i];
 }
 return null;
 }

 function byChainId(chainId) {
 var n = Number(chainId);
 var id = EVM_CHAIN_IDS[n];
 return id ? byId(id) : null;
 }

 function isEvm(id) {
 var c = byId(id);
 return !!(c && c.kind === 'evm');
 }

 function isSol(id) {
 var c = byId(id);
 return !!(c && c.kind === 'sol');
 }

 function bridgeRoutes() {
 return BRIDGE_ROUTES.slice();
 }

 function chainIdHex(chainId) {
 return '0x' + Number(chainId).toString(16);
 }

 /** Map DOSWAPZ chain id -> LI.FI / Jumper friendly labels when possible */
 function jumperChainKey(id) {
 var map = {
 solana: 'SOL',
 ethereum: 'ETH',
 base: 'BAS',
 arbitrum: 'ARB',
 polygon: 'POL',
 optimism: 'OPT',
 bsc: 'BSC',
 robinhood: 'ROBINHOOD'
 };
 return map[id] || id;
 }

 return {
 list: list,
 byId: byId,
 byChainId: byChainId,
 isEvm: isEvm,
 isSol: isSol,
 bridgeRoutes: bridgeRoutes,
 chainIdHex: chainIdHex,
 jumperChainKey: jumperChainKey,
 ROBINHOOD_CHAIN_ID: 4663,
 ROBINHOOD_TESTNET_CHAIN_ID: 46630
 };
})();
