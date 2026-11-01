/**
 * DOSWAPZ Phunk Lab - secure Ethereum wallet connect + calldata inscription
 * MetaMask 12.15+ blocks self-send with calldata - we send to an external EOA instead.
 */
window.PHUNK_INSCRIBE = (function () {
 'use strict';

 var cfg = window.DOSWAPZ_PHUNK_INSCRIBE_CONFIG || {};
 var CHAIN_ID = cfg.chainId != null ? cfg.chainId : 1;
 var CHAIN_LABEL = cfg.chainLabel || 'Ethereum Mainnet';

 var provider = null;
 var signer = null;
 var connectedAddress = null;
 var inFlight = false;
 var statusEl = null;
 var walletInfoEl = null;
 var recipientInfoEl = null;
 var connectBtn = null;
 var disconnectBtn = null;
 var inscribeBtn = null;
 var pendingRecipient = null;

 function shortAddr(addr) {
 if (!addr || addr.length < 10) return addr || '';
 return addr.slice(0, 6) + '...' + addr.slice(-4);
 }

 function normalizeChainId(chainId) {
 if (chainId == null) return null;
 if (typeof chainId === 'number') return chainId;
 if (typeof chainId === 'string') return parseInt(chainId, 10);
 if (chainId.toNumber) return chainId.toNumber();
 return Number(chainId);
 }

 function setStatus(msg, color) {
 if (statusEl) {
 statusEl.textContent = msg;
 if (color) statusEl.style.color = color;
 }
 }

 function updateWalletUi() {
 var connected = !!connectedAddress;
 if (connectBtn) {
 connectBtn.style.display = connected ? 'none' : 'inline-block';
 connectBtn.disabled = inFlight;
 }
 if (disconnectBtn) {
 disconnectBtn.style.display = connected ? 'inline-block' : 'none';
 disconnectBtn.disabled = inFlight;
 }
 if (inscribeBtn) {
 inscribeBtn.style.display = connected ? 'inline-block' : 'none';
 inscribeBtn.disabled = inFlight;
 }
 }

 function setBusy(busy) {
 inFlight = !!busy;
 updateWalletUi();
 }

 async function assertMainnet() {
 if (!provider) throw new Error('Wallet not connected.');
 var net = await provider.getNetwork();
 var chainId = normalizeChainId(net.chainId);
 if (chainId !== CHAIN_ID) {
 throw new Error('Switch wallet to ' + CHAIN_LABEL + ' (chain ID ' + CHAIN_ID + ') before inscribing.');
 }
 }

 function detectProvider() {
 var eth = window.ethereum;
 if (!eth) return null;
 if (eth.providers && eth.providers.length) {
 var mm = eth.providers.find(function (p) { return p.isMetaMask; });
 if (mm) return mm;
 return eth.providers[0];
 }
 return eth;
 }

 function isInternalRecipient(recipient) {
 if (!recipient || !connectedAddress) return false;
 try {
 return ethers.utils.getAddress(recipient) === ethers.utils.getAddress(connectedAddress);
 } catch (e) {
 return false;
 }
 }

 function createExternalRecipient() {
 var wallet = ethers.Wallet.createRandom();
 return {
 address: wallet.address,
 privateKey: wallet.privateKey
 };
 }

 function showRecipientModal(recipient) {
 return new Promise(function (resolve) {
 var overlay = document.createElement('div');
 overlay.className = 'phunk-inscribe-modal-overlay';
 overlay.innerHTML =
 '<div class="phunk-inscribe-modal" role="dialog" aria-labelledby="phunkInscribeModalTitle">' +
 '<h3 id="phunkInscribeModalTitle">SAVE INSCRIPTION WALLET</h3>' +
 '<p>MetaMask blocks calldata to your own account. Your ethscription will be minted to this <strong>new external address</strong> (you own it via the private key below).</p>' +
 '<label>Recipient address</label>' +
 '<input type="text" readonly id="phunkInscribeRecipientAddr" value="' + recipient.address + '">' +
 '<button type="button" class="btn btn-inscribe" id="phunkCopyRecipientAddr">COPY ADDRESS</button>' +
 '<label>Private key (save offline - DOSWAPZ cannot recover this)</label>' +
 '<textarea readonly id="phunkInscribeRecipientPk" rows="3">' + recipient.privateKey + '</textarea>' +
 '<button type="button" class="btn btn-inscribe" id="phunkCopyRecipientPk">COPY PRIVATE KEY</button>' +
 '<p class="phunk-inscribe-modal-note">Import this key into MetaMask/Rabby later to hold or transfer your ethscription.</p>' +
 '<div class="phunk-inscribe-modal-actions">' +
 '<button type="button" class="btn btn-inscribe" id="phunkInscribeModalCancel">CANCEL</button>' +
 '<button type="button" class="btn btn-inscribe" id="phunkInscribeModalConfirm">I SAVED IT - INSCRIBE</button>' +
 '</div>' +
 '</div>';

 document.body.appendChild(overlay);

 function cleanup(result) {
 document.body.removeChild(overlay);
 resolve(result);
 }

 overlay.querySelector('#phunkCopyRecipientAddr').onclick = function () {
 navigator.clipboard.writeText(recipient.address);
 setStatus('Recipient address copied.', '#ffff00');
 };
 overlay.querySelector('#phunkCopyRecipientPk').onclick = function () {
 navigator.clipboard.writeText(recipient.privateKey);
 setStatus('Private key copied - store it safely.', '#ffff00');
 };
 overlay.querySelector('#phunkInscribeModalCancel').onclick = function () { cleanup(false); };
 overlay.querySelector('#phunkInscribeModalConfirm').onclick = function () { cleanup(true); };
 overlay.addEventListener('click', function (e) {
 if (e.target === overlay) cleanup(false);
 });
 });
 }

 async function resolveInscriptionRecipient(forceNew) {
 if (cfg.inscriptionRecipient && !forceNew) {
 return {
 address: ethers.utils.getAddress(cfg.inscriptionRecipient),
 privateKey: null,
 external: !isInternalRecipient(cfg.inscriptionRecipient)
 };
 }

 if (pendingRecipient && !forceNew) {
 return pendingRecipient;
 }

 var recipient = createExternalRecipient();
 var ok = await showRecipientModal(recipient);
 if (!ok) return null;

 pendingRecipient = {
 address: recipient.address,
 privateKey: recipient.privateKey,
 external: true
 };

 if (recipientInfoEl) {
 recipientInfoEl.innerHTML =
 'INSCRIPTION RECIPIENT: <strong>' + shortAddr(recipient.address) + '</strong> ' +
 '(external - save private key from popup)';
 recipientInfoEl.style.color = '#ffcc00';
 }

 return pendingRecipient;
 }

 async function connect() {
 if (typeof ethers === 'undefined') {
 setStatus('Wallet library failed to load. Refresh the page.', '#ff5555');
 return false;
 }
 var eth = detectProvider();
 if (!eth) {
 setStatus('No Ethereum wallet detected. Install MetaMask or Coinbase Wallet.', '#ff5555');
 return false;
 }
 try {
 provider = new ethers.providers.Web3Provider(eth, 'any');
 await provider.send('eth_requestAccounts', []);
 await assertMainnet();
 signer = provider.getSigner();
 connectedAddress = await signer.getAddress();
 var bal = await provider.getBalance(connectedAddress);
 if (walletInfoEl) {
 walletInfoEl.textContent =
 shortAddr(connectedAddress) + ' * BAL: ' +
 parseFloat(ethers.utils.formatEther(bal)).toFixed(4) + ' ETH * ' + CHAIN_LABEL;
 }
 updateWalletUi();
 var balEth = parseFloat(ethers.utils.formatEther(bal));
 if (balEth < 0.003) {
 setStatus(
 'WALLET CONNECTED - LOW BALANCE: keep ~0.003+ ETH for gas (you have ' +
 balEth.toFixed(4) + '). Add funds before inscribing.',
 '#ffaa00'
 );
 } else {
 setStatus('WALLET CONNECTED - READY TO INSCRIBE (STAMPED EXPORT)', '#ffff00');
 }
 return true;
 } catch (err) {
 disconnect(true);
 setStatus('Connect failed: ' + (err.message || err), '#ff5555');
 return false;
 }
 }

 function disconnect(silent) {
 provider = null;
 signer = null;
 connectedAddress = null;
 pendingRecipient = null;
 if (walletInfoEl) walletInfoEl.textContent = '';
 if (recipientInfoEl) recipientInfoEl.textContent = '';
 updateWalletUi();
 if (!silent) setStatus('WALLET DISCONNECTED', '#8866aa');
 }

 function buildInscriptionCalldata(pngBase64) {
 var dataUri = 'data:image/png;base64,' + pngBase64;
 var hex = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(dataUri));
 if (!hex || hex === '0x') {
 throw new Error('Inscription calldata is empty.');
 }
 return hex;
 }

 function buildInscriptionTxRequest(recipient, calldata) {
 var to = ethers.utils.getAddress(recipient);
 var txReq = {
 to: to,
 value: ethers.constants.Zero,
 data: calldata,
 from: connectedAddress
 };

 var feeEth = cfg.feeEth != null ? cfg.feeEth : 0;
 var feeRecipient = cfg.feeRecipient;
 if (feeEth > 0 && feeRecipient) {
 txReq.to = ethers.utils.getAddress(feeRecipient);
 txReq.value = ethers.utils.parseEther(String(feeEth));
 }
 return txReq;
 }

 async function estimateInscriptionCost(recipient, calldata) {
 var txReq = buildInscriptionTxRequest(recipient, calldata);
 var gasEst = await provider.estimateGas(txReq);
 var gasLimit = gasEst.mul(115).div(100);
 var feeData = await provider.getFeeData();
 var gasPrice = feeData.gasPrice || feeData.maxFeePerGas || await provider.getGasPrice();
 var gasCost = gasLimit.mul(gasPrice);
 var total = gasCost.add(txReq.value || 0);
 return {
 txReq: txReq,
 gasLimit: gasLimit,
 total: total,
 totalEth: parseFloat(ethers.utils.formatEther(total)),
 gasEth: parseFloat(ethers.utils.formatEther(gasCost))
 };
 }

 async function assertSufficientFunds(recipient, calldata) {
 var bal = await provider.getBalance(connectedAddress);
 var est = await estimateInscriptionCost(recipient, calldata);
 var have = parseFloat(ethers.utils.formatEther(bal)).toFixed(5);
 if (bal.lt(est.total)) {
 var need = est.totalEth.toFixed(5);
 var short = parseFloat(ethers.utils.formatEther(est.total.sub(bal))).toFixed(5);
 throw new Error(
 'INSUFFICIENT ETH FOR GAS - inscription needs ~' + need + ' ETH (gas ~' +
 est.gasEth.toFixed(5) + '). You have ' + have + ' ETH. Add ~' + short + ' ETH.'
 );
 }
 if (walletInfoEl) {
 walletInfoEl.textContent =
 shortAddr(connectedAddress) + ' * BAL: ' + have + ' ETH * EST. INSCRIBE: ~' +
 est.totalEth.toFixed(5) + ' ETH * ' + CHAIN_LABEL;
 }
 return est;
 }

 async function refreshGasEstimate(pngBase64) {
 if (!provider || !connectedAddress || !pngBase64) return null;
 try {
 await assertMainnet();
 var recipient = pendingRecipient && pendingRecipient.address
 ? pendingRecipient.address
 : (cfg.inscriptionRecipient || connectedAddress);
 var calldata = buildInscriptionCalldata(pngBase64);
 return await assertSufficientFunds(recipient, calldata);
 } catch (err) {
 var msg = err && err.message ? err.message : String(err);
 if (/INSUFFICIENT ETH FOR GAS/i.test(msg)) {
 setStatus(msg, '#ff5555');
 }
 return null;
 }
 }

 async function sendInscriptionTx(recipient, calldata, est) {
 var txReq = est.txReq;
 txReq.gasLimit = est.gasLimit;

 var feeEth = cfg.feeEth != null ? cfg.feeEth : 0;
 if (feeEth > 0 && cfg.feeRecipient) {
 setStatus('Confirm inscription + fee in wallet...', '#ffff00');
 } else {
 setStatus(
 'Confirm inscription in wallet (~' + est.totalEth.toFixed(5) + ' ETH gas - calldata to ' +
 shortAddr(recipient) + ')...',
 '#ffff00'
 );
 }

 try {
 return await signer.sendTransaction(txReq);
 } catch (err) {
 var msg = err && err.message ? err.message : String(err);
 if (!/internal accounts|cannot include data|no data/i.test(msg)) throw err;

 var txParams = {
 from: connectedAddress,
 to: txReq.to,
 value: ethers.utils.hexValue(txReq.value || 0),
 data: calldata,
 gas: ethers.utils.hexValue(txReq.gasLimit)
 };
 var hash = await provider.send('eth_sendTransaction', [txParams]);
 return provider.getTransaction(hash);
 }
 }

 async function inscribeStampedPng(pngBase64, meta) {
 if (inFlight) return null;
 if (!signer || !connectedAddress) {
 setStatus('Connect wallet first.', '#ff5555');
 return null;
 }
 if (!pngBase64) {
 setStatus('Nothing to inscribe - paint your phunk first.', '#ff5555');
 return null;
 }

 setBusy(true);
 setStatus('Preparing inscription recipient...', '#ffff00');

 try {
 await assertMainnet();

 var recipient = await resolveInscriptionRecipient(false);
 if (!recipient) {
 setStatus('Inscription cancelled.', '#ffaa00');
 return null;
 }

 if (isInternalRecipient(recipient.address)) {
 recipient = await resolveInscriptionRecipient(true);
 if (!recipient) {
 setStatus('Inscription cancelled.', '#ffaa00');
 return null;
 }
 }

 setStatus('Building inscription calldata...', '#ffff00');
 var calldata = buildInscriptionCalldata(pngBase64);

 setStatus('Estimating gas (large phunks cost more)...', '#ffff00');
 var est = await assertSufficientFunds(recipient.address, calldata);

 var tx = await sendInscriptionTx(recipient.address, calldata, est);
 setStatus('TX SENT - ' + tx.hash.slice(0, 10) + '... waiting for confirmation...', '#ffff00');
 var receipt = await tx.wait();

 pendingRecipient = null;
 disconnect(true);
 setStatus(
 'INSCRIBED ON ' + CHAIN_LABEL + ' - ' + shortAddr(receipt.transactionHash) +
 ' * OWNER: ' + shortAddr(recipient.address) +
 ' * WALLET AUTO-DISCONNECTED. Reconnect to inscribe again.',
 '#00ff41'
 );

 return {
 hash: receipt.transactionHash,
 blockNumber: receipt.blockNumber,
 recipient: recipient.address,
 meta: meta || {}
 };
 } catch (err) {
 var msg = err && err.message ? err.message : String(err);
 if (/user rejected|denied|cancel/i.test(msg)) {
 setStatus('Inscription cancelled in wallet.', '#ffaa00');
 } else if (/internal accounts|cannot include data|no data/i.test(msg)) {
 setStatus(
 'Wallet blocked calldata to your own account. Retry - we will mint to a new external address (save the private key popup).',
 '#ff5555'
 );
 } else if (/INSUFFICIENT_FUNDS|insufficient funds/i.test(msg)) {
 setStatus(
 'NOT ENOUGH ETH FOR GAS - your balance is too low for this inscription size. Add ~0.001+ ETH and try a simpler/smaller phunk.',
 '#ff5555'
 );
 } else if (/INSUFFICIENT ETH FOR GAS/i.test(msg)) {
 setStatus(msg, '#ff5555');
 } else {
 setStatus('Inscribe failed: ' + msg.slice(0, 220), '#ff5555');
 }
 return null;
 } finally {
 setBusy(false);
 }
 }

 function bindUi(ids) {
 ids = ids || {};
 statusEl = document.getElementById(ids.status || 'inscribeStatus');
 walletInfoEl = document.getElementById(ids.walletInfo || 'inscribeWalletInfo');
 recipientInfoEl = document.getElementById(ids.recipientInfo || 'inscribeRecipientInfo');
 connectBtn = document.getElementById(ids.connect || 'btnInscribeConnect');
 disconnectBtn = document.getElementById(ids.disconnect || 'btnInscribeDisconnect');
 inscribeBtn = document.getElementById(ids.inscribe || 'btnInscribe');

 if (connectBtn) connectBtn.addEventListener('click', function () { connect(); });
 if (disconnectBtn) disconnectBtn.addEventListener('click', function () { disconnect(); });

 if (recipientInfoEl && cfg.inscriptionRecipient) {
 var feeNote = cfg.feeEth > 0
 ? ' * MINT FEE: ' + cfg.feeEth + ' ETH'
 : '';
 recipientInfoEl.innerHTML =
 'INSCRIPTION + MINT FUNDS: <strong>' + shortAddr(cfg.inscriptionRecipient) + '</strong>' + feeNote;
 recipientInfoEl.style.color = '#ffcc00';
 }

 updateWalletUi();
 window.addEventListener('beforeunload', function () { disconnect(true); });
 }

 function isConnected() {
 return !!connectedAddress;
 }

 return {
 bindUi: bindUi,
 connect: connect,
 disconnect: disconnect,
 inscribeStampedPng: inscribeStampedPng,
 refreshGasEstimate: refreshGasEstimate,
 isConnected: isConnected,
 setStatus: setStatus
 };
})();