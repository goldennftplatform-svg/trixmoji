/**
 * Vantablack - EVM ERC-20 deploy (wallet-signed) for multi-chain market listing.
 * Requires: chains-config.js, vb-erc20-artifact.js, ethers via esm
 */
import { BrowserProvider, ContractFactory, parseUnits, parseEther } from 'https://esm.sh/ethers@6.13.4';

function $(id) {
 return document.getElementById(id);
}

function shortAddr(addr) {
 if (!addr || addr.length < 10) return addr || '';
 return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function setEvmStatus(msg, color) {
 const el = $('evmLaunchStatus');
 if (!el) return;
 el.textContent = msg;
 el.style.color = color || '#ddbbff';
}

function isOrbit() {
 return location.pathname.indexOf('/orbit/') >= 0;
}

function marketHref() {
 return isOrbit()
 ? '/orbit/pages/basement/vantablack/market.html'
 : '/classic/pages/basement/vantablack/market.html';
}

function bridgeHref() {
 return isOrbit()
 ? '/orbit/pages/doswapz/bridge.html'
 : '/classic/pages/doswapz/bridge.html';
}

function getSelectedChain() {
 const id = window.VB_SELECTED_CHAIN || 'ethereum';
 return (window.DOSWAPZ_CHAINS && window.DOSWAPZ_CHAINS.byId(id)) || null;
}

function publishWallet(address) {
 window.VB_LAUNCHER_WALLET = address
 ? { provider: window.ethereum, pubkey: address, kind: 'evm' }
 : null;
 window.dispatchEvent(new CustomEvent('vb-wallet-change', {
 detail: window.VB_LAUNCHER_WALLET
 }));
}

async function ensureChain(chain) {
 if (!window.ethereum || !chain || chain.kind !== 'evm' || chain.chainId == null) {
 throw new Error('EVM wallet / chain unavailable');
 }
 const hexId = '0x' + Number(chain.chainId).toString(16);
 try {
 await window.ethereum.request({
 method: 'wallet_switchEthereumChain',
 params: [{ chainId: hexId }]
 });
 } catch (err) {
 if (err && (err.code === 4902 || String(err.message || '').includes('Unrecognized'))) {
 const params = chain.walletAddParams || {
 chainId: hexId,
 chainName: chain.label,
 nativeCurrency: {
 name: chain.symbol || 'ETH',
 symbol: chain.symbol || 'ETH',
 decimals: 18
 },
 rpcUrls: chain.rpcUrls || [],
 blockExplorerUrls: chain.blockExplorerUrls || []
 };
 await window.ethereum.request({
 method: 'wallet_addEthereumChain',
 params: [params]
 });
 } else {
 throw err;
 }
 }
}

async function connectEvm() {
 if (!window.ethereum || !window.ethereum.request) {
 setEvmStatus('Install MetaMask or another EVM wallet.', '#ff6666');
 return null;
 }
 const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
 const address = accounts && accounts[0];
 if (!address) {
 setEvmStatus('No account returned.', '#ff6666');
 return null;
 }
 publishWallet(address);
 const addrEl = $('walletAddr');
 if (addrEl) addrEl.textContent = shortAddr(address);
 const btn = $('connectWalletBtn');
 if (btn) btn.textContent = 'DISCONNECT';
 setEvmStatus('EVM connected * ' + shortAddr(address), '#00ff41');
 const launchBtn = $('launchEvmBtn');
 if (launchBtn) launchBtn.disabled = false;
 const listBtn = $('listEvmBtn');
 if (listBtn) listBtn.disabled = false;
 return address;
}

async function disconnectEvm() {
 publishWallet(null);
 const addrEl = $('walletAddr');
 if (addrEl) addrEl.textContent = ' - ';
 const btn = $('connectWalletBtn');
 if (btn) btn.textContent = 'CONNECT WALLET';
 const launchBtn = $('launchEvmBtn');
 if (launchBtn) launchBtn.disabled = true;
 const listBtn = $('listEvmBtn');
 if (listBtn) listBtn.disabled = true;
 setEvmStatus('Disconnected.', '#cc88ff');
}

async function deployErc20() {
 const chain = getSelectedChain();
 if (!chain || chain.kind !== 'evm') {
 setEvmStatus('Select an EVM chain (ETH / Base / Arbitrum / Polygon / Robinhood...).', '#ff6666');
 return;
 }
 if (!window.VB_ERC20_ARTIFACT) {
 setEvmStatus('ERC-20 artifact missing.', '#ff6666');
 return;
 }
 if (!window.ethereum) {
 setEvmStatus('Connect an EVM wallet first.', '#ff6666');
 return;
 }

 const name = String(($('evmTokenName') && $('evmTokenName').value) || '').trim();
 const symbol = String(($('evmTokenSymbol') && $('evmTokenSymbol').value) || '').trim().toUpperCase();
 const decimals = Math.min(18, Math.max(0, parseInt(($('evmTokenDecimals') && $('evmTokenDecimals').value) || '18', 10)));
 const supplyStr = String(($('evmTokenSupply') && $('evmTokenSupply').value) || '').replace(/,/g, '').trim();

 if (!name || !symbol) {
 setEvmStatus('Name and symbol required.', '#ff6666');
 return;
 }
 if (!supplyStr || !/^\d+(\.\d+)?$/.test(supplyStr)) {
 setEvmStatus('Enter a valid initial supply.', '#ff6666');
 return;
 }

 const btn = $('launchEvmBtn');
 if (btn) {
 btn.disabled = true;
 btn.textContent = 'DEPLOYING...';
 }

 try {
 setEvmStatus('Switching network to ' + chain.label + '...', '#ffaa00');
 await ensureChain(chain);
 const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
 const address = accounts[0];
 publishWallet(address);

 setEvmStatus('Approve ERC-20 deploy in wallet...', '#ffaa00');
 const provider = new BrowserProvider(window.ethereum);
 const signer = await provider.getSigner();
 const vb = window.VANTABLACK_CONFIG || {};
 const feeEth = Number(vb.launchFeeEth);
 const feeTo = String(vb.siteFeeEth || '').trim();
 if (Number.isFinite(feeEth) && feeEth > 0 && feeTo && /^0x[a-fA-F0-9]{40}$/.test(feeTo)) {
  setEvmStatus('Collecting site launch fee (' + feeEth + ' ETH)...', '#ffaa00');
  const feeTx = await signer.sendTransaction({
   to: feeTo,
   value: parseEther(String(feeEth))
  });
  await feeTx.wait();
 }
 const supply = parseUnits(supplyStr, decimals);
 const factory = new ContractFactory(
 window.VB_ERC20_ARTIFACT.abi,
 window.VB_ERC20_ARTIFACT.bytecode,
 signer
 );
 const contract = await factory.deploy(name, symbol, decimals, supply);
 setEvmStatus('Waiting for confirmation...', '#ffaa00');
 await contract.waitForDeployment();
 const contractAddress = await contract.getAddress();
 const deployTx = contract.deploymentTransaction();
 const txHash = deployTx ? deployTx.hash : '';

 if (window.DOSWAPZ_VANTABLACK && window.DOSWAPZ_VANTABLACK.register) {
 await window.DOSWAPZ_VANTABLACK.register({
 mint: contractAddress,
 symbol,
 name,
 decimals,
 supply: supplyStr,
 creator: address,
 chain: chain.id,
 launchType: 'erc20',
 tag: 'created',
 section: 'created',
 source: 'launcher'
 });
 }

 const result = $('evmLaunchResult');
 if (result) result.style.display = 'block';
 if ($('evmResultMint')) $('evmResultMint').textContent = contractAddress;
 if ($('evmResultSig')) {
 const exp = chain.explorerTx ? chain.explorerTx(txHash) : '#';
 $('evmResultSig').innerHTML = txHash
 ? '<a href="' + exp + '" target="_blank" rel="noopener" style="color:#aaffaa;">' +
 shortAddr(txHash) + ' -> explorer</a>'
 : ' - ';
 }
 if ($('evmMarketBtn')) $('evmMarketBtn').href = marketHref();
 if ($('evmBridgeBtn')) $('evmBridgeBtn').href = bridgeHref();
 if ($('evmExplorerBtn') && chain.explorerToken) {
 $('evmExplorerBtn').href = chain.explorerToken(contractAddress);
 }

 setEvmStatus(
 'LIVE on ' + chain.label + ' * listed on Vantablack * ' + shortAddr(contractAddress),
 '#00ff41'
 );
 } catch (err) {
 console.error(err);
 setEvmStatus('Deploy failed: ' + (err && err.message ? err.message : err), '#ff6666');
 } finally {
 if (btn) {
 btn.disabled = false;
 btn.textContent = 'DEPLOY ERC-20 + LIST';
 }
 }
}

async function listExistingEvm() {
 const chain = getSelectedChain();
 if (!chain || chain.kind !== 'evm') {
 setEvmStatus('Select an EVM chain first.', '#ff6666');
 return;
 }
 const addr = String(($('evmExistingAddr') && $('evmExistingAddr').value) || '').trim();
 if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
 setEvmStatus('Paste a valid 0x contract address.', '#ff6666');
 return;
 }
 const name = String(($('evmTokenName') && $('evmTokenName').value) || 'Token').trim() || 'Token';
 const symbol = String(($('evmTokenSymbol') && $('evmTokenSymbol').value) || 'TOKEN').trim().toUpperCase() || 'TOKEN';
 const decimals = Math.min(18, Math.max(0, parseInt(($('evmTokenDecimals') && $('evmTokenDecimals').value) || '18', 10)));

 try {
 setEvmStatus('Listing on Vantablack...', '#ffaa00');
 let creator = '';
 if (window.ethereum) {
 try {
 const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
 creator = (accounts && accounts[0]) || '';
 } catch (e) {}
 }
 if (window.DOSWAPZ_VANTABLACK && window.DOSWAPZ_VANTABLACK.register) {
 await window.DOSWAPZ_VANTABLACK.register({
 mint: addr,
 symbol,
 name,
 decimals,
 creator,
 chain: chain.id,
 launchType: 'erc20',
 tag: 'created',
 section: 'created',
 source: 'track'
 });
 }
 const result = $('evmLaunchResult');
 if (result) result.style.display = 'block';
 if ($('evmResultMint')) $('evmResultMint').textContent = addr;
 if ($('evmResultSig')) $('evmResultSig').textContent = 'listed (existing)';
 if ($('evmMarketBtn')) $('evmMarketBtn').href = marketHref();
 if ($('evmBridgeBtn')) $('evmBridgeBtn').href = bridgeHref();
 if ($('evmExplorerBtn') && chain.explorerToken) {
 $('evmExplorerBtn').href = chain.explorerToken(addr);
 }
 setEvmStatus('Listed $' + symbol + ' on ' + chain.label, '#00ff41');
 } catch (err) {
 setEvmStatus('List failed: ' + (err && err.message ? err.message : err), '#ff6666');
 }
}

function onConnectClick() {
 const chain = getSelectedChain();
 const existing = window.VB_LAUNCHER_WALLET;
 if (existing && existing.kind === 'evm') {
 disconnectEvm();
 return;
 }
 // If Solana module owns connect for sol chains, multichain controller routes this.
 if (chain && chain.kind === 'evm') {
 connectEvm().catch(function (e) {
 setEvmStatus(e.message || String(e), '#ff6666');
 });
 }
}

function bind() {
 $('launchEvmBtn')?.addEventListener('click', function () {
 deployErc20();
 });
 $('listEvmBtn')?.addEventListener('click', function () {
 listExistingEvm();
 });

 window.VB_EVM_LAUNCHER = {
 connect: connectEvm,
 disconnect: disconnectEvm,
 deploy: deployErc20,
 listExisting: listExistingEvm,
 ensureChain: ensureChain,
 onConnectClick: onConnectClick
 };

 setEvmStatus('Pick an EVM chain * connect wallet * deploy or list existing.', '#cc88ff');
}

if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', bind);
} else {
 bind();
}
