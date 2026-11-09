(function () {
 'use strict'
 var grid = document.getElementById('walletGrid'), status = document.getElementById('marketStatus'), more = document.getElementById('moreWallet'), reviewBox = document.getElementById('marketReview'), recoveryBox = document.getElementById('marketRecovery')
 var cursor = null, generation = 0, view = 'wallet', board = null, client = null, busy = false, artifact, deployment, recoveryNotice = '', activeSubmissionKey = null
  var params = new URLSearchParams(location.search), webpV2 = params.get('collection') === 'webp-v2', launch = !webpV2 && params.get('market') !== 'legacy' && (params.get('collection') === 'trixmoji' || !!(document.body && document.body.dataset.defaultCollection === 'trixmoji'))
  var legacy = !launch && !webpV2 && params.get('market') === 'legacy'
  var marketUrl = launch ? '/.netlify/functions/trixmoji-market-launch' : webpV2 ? '/.netlify/functions/trixmoji-market-webp-v2' : legacy ? '/.netlify/functions/trixmoji-market' : '/.netlify/functions/trixmoji-market-replacement'
  var expectedMarket = legacy ? '0xd935E162B6070C4FEAF600c67f7F729f318515a2' : '0x21c1A938d06f87A039abfC48d1cCB459f55b1685'
  var modeLabel = document.getElementById('marketMode'); if (modeLabel) modeLabel.textContent = launch ? 'TRIXMOJI · ETHEREUM' : webpV2 ? 'WEBP V2 · REPLACEMENT ESCROW' : legacy ? 'ORIGINAL ESCROW · ETHEREUM' : 'REPLACEMENT ESCROW · EXPERIMENTAL'
  if (webpV2 || legacy) {
   var collectionNotice = document.getElementById('collectionNotice')
   if (collectionNotice) { collectionNotice.hidden = false; collectionNotice.textContent = 'You are viewing a previous collection. To see current TrixMoji pieces, open '; var currentLink = document.createElement('a'); currentLink.href = '/classic/pages/trixmoji-market.html?collection=trixmoji'; currentLink.textContent = 'THE CURRENT TRIXMOJI MARKET ↗'; collectionNotice.appendChild(currentLink) }
  }
  if ((launch || webpV2) && document.querySelector) {
   var brandLink = document.querySelector('.market-header .brand'), mintLink = document.querySelector('.market-header .mint-link'), brandLabel = document.querySelector('.market-header .brand small')
   if (brandLink) brandLink.href = '/classic/pages/trixmoji-market.html?collection=' + (launch ? 'trixmoji' : 'webp-v2')
   if (mintLink) mintLink.href = launch ? '/classic/pages/trixmoji-mint.html' : '/classic/pages/clean-pop-webp-v2-mint.html'
   if (brandLabel) brandLabel.textContent = launch ? 'TRIXMOJI' : 'TRIXMOJI · WEBP V2'
   if (launch) {
    var notice = document.querySelector('.notice'), detailLabel = document.querySelector('#artDialog .eyebrow')
    if (notice && notice.childNodes.length > 1) notice.childNodes[1].nodeValue = ' TRIXMOJI MARKET '
    if (detailLabel) detailLabel.textContent = 'TRIXMOJI'
   }
  }
 var same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 var say = function (text) { status.textContent = text }
 async function json(url, options) { var r = await fetch(url, options || { cache: 'no-store', signal: AbortSignal.timeout(25000) }); var body = await r.json(); if (!r.ok || body.ok === false) throw Error(body.error || 'Market request unavailable.'); return body }
 async function asset(id) { var body = await json('https://api.ethscriptions.com/v2/ethscriptions/' + encodeURIComponent(id)); if (!body.result) throw Error('Indexer asset unavailable.'); return body.result }
 async function transferCheck(action, values) { var url = new URL('/.netlify/functions/clean-pop-transfer', location.origin); Object.entries(Object.assign({ action: action }, values)).forEach(function (entry) { url.searchParams.set(entry[0], entry[1]) }); return json(url) }
 async function configure() {
  var connection = MarketWalletConnector.current()
  if (!connection) throw Error('Connect your Ethereum wallet first.')
  if (!artifact || !deployment) {
   var values = await Promise.all([json(legacy ? '/assets/data/trixmoji-escrow-artifact.json' : '/assets/data/trixmoji-escrow-replacement-artifact.json'), json(legacy ? '/assets/data/trixmoji-escrow-deployment.json' : '/assets/data/trixmoji-escrow-replacement-deployment.json')]); artifact = values[0]; deployment = values[1]
   if (!same(deployment.address, expectedMarket)) throw Error('Market deployment address does not match the selected market.')
  }
   client = TrixmojiMarketWallet.create({ provider: connection.provider, storage: localStorage, storageKey: launch ? 'trixmoji.market.contract.transaction.launch' : webpV2 ? 'trixmoji.market.contract.transaction.webp-v2' : 'trixmoji.market.contract.transaction.v1', locks: navigator.locks, abi: artifact.abi, market: deployment.address, runtimeHash: deployment.runtimeHash, creator: deployment.creator, verifier: deployment.verifier, chainId: deployment.chainId, minter: launch ? '0x14F9B4a11A10A83C6A686012110Dc2bd54eFD673' : webpV2 ? '0xD085EB56d7195Bdf4a17bf3107FDC938a118B704' : '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC', combinedDepositEnabled: !legacy, readAsset: asset,
   authorize: async function (body) { return json(marketUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'authorize' }, body)), signal: AbortSignal.timeout(25000) }) } })
  return connection
 }
 async function verify(row, receipt) {
  if (row.action === 'gift') {
   var gift = await asset(row.assetId)
   return same(gift.current_owner, row.to) && Array.isArray(gift.ethscription_transfers) && gift.ethscription_transfers.some(function (t) { return same(t.transaction_hash, row.hash) && same(t.from_address, row.from) && same(t.to_address, row.to) })
  }
  var names = { deposit: 'Deposited', depositAndList: 'Deposited', list: 'Listed', cancel: 'Cancelled', buy: 'Sold', auction: 'AuctionStarted', bid: 'Bid', settle: 'AuctionSettled', withdraw: 'CreditWithdrawn' }, iface = new ethers.utils.Interface(artifact.abi), event
  for (var log of receipt.logs || []) {
   if (!same(log.address, deployment.address)) continue
   try { var parsed = iface.parseLog(log); if (parsed.name === names[row.action] && (!row.assetId || same(parsed.args.id, row.assetId)) && (!['deposit', 'depositAndList', 'list', 'cancel'].includes(row.action) || same(parsed.args.seller, row.from))) { event = parsed; break } } catch (_) {}
  }
  if (!event) return false
  if (row.action === 'depositAndList') {
   var marketData = await json(marketUrl)
   return (marketData.listings || []).some(function (item) { return same(item.id, row.assetId) && same(item.seller, row.from) })
  }
  if (['deposit', 'cancel', 'buy', 'settle'].includes(row.action)) {
   var indexed = await asset(row.assetId), expected = row.action === 'deposit' ? deployment.address : row.action === 'settle' ? event.args.buyer : row.from
   if (row.action === 'deposit') return same(indexed.current_owner, expected) && same(indexed.previous_owner, row.from) && Array.isArray(indexed.ethscription_transfers) && indexed.ethscription_transfers.some(function (t) { return same(t.transaction_hash, row.hash) && same(t.from_address, row.from) && same(t.to_address, deployment.address) })
   return same(indexed.current_owner, expected)
  }
  return true
 }
 async function reconcile(row) { var result = await client.reconcile(row, verify); say(result.failed ? 'Transaction failed. Check wallet activity.' : 'Transaction confirmed and verified.'); await load(false) }
 async function reconcileSubmittedActions() {
  if (!client || !deployment) return
  var connection = MarketWalletConnector.current()
  if (!connection) return
  var pending = client.records().filter(function (row) { return row && row.state === 'submitted' && ['list', 'deposit', 'depositAndList'].includes(row.action) && /^0x[a-f0-9]{64}$/i.test(String(row.hash || '')) && same(row.to, deployment.address) && same(row.from, connection.address) })
  for (var row of pending) {
   try { await client.reconcile(row, verify) } catch (_) { /* Keep unresolved requests visible for manual checks. */ }
  }
 }
 async function waitForDeposit(row, targetClient) {
  for (var attempt = 0; attempt < 24; attempt++) {
   try { return await targetClient.reconcile(row, verify) }
   catch (error) {
    if (!/not confirmed|indexing.*pending|indexer.*unavailable|not found/i.test(error.message) || attempt === 23) throw error
    say('Deposit submitted. Waiting for confirmation and indexed custody…')
    await new Promise(function (resolve) { setTimeout(resolve, 5000) })
   }
  }
 }
 async function reconcileKnownRecovery() {
   if (legacy || webpV2 || !client) return
  var recoveries = launch ? {
   '0xd908efe7044911d8c368a0a998d3ace3d36a359c86b9998b40ffcece74e61cb4': '0x99c2fda0b421b81a0eae8e70753b6acbf6844eed3bd7c08d32cbdcb78eea0627'
  } : {
   '0x9de253efbaeb700b2947630706ce0234c19b23a8eb3ab16d1adb40db0e5a57c5': '0x430a0f0cafa463ab9d8b075b68d88ec4bc9639a9490132f164dfb08d801e93db',
   '0x939deedb5781d5895daf8127f9c72a593909b53869eb25ce40eeca62830be472': '0xf7ce6ffe0734282df2c67758b56bfdb063f2f811073c6e1dea6306cd372e2a8f',
   '0x4bfc63cf6bb20dd54b4a44929593a01df76fe990ac4874280845386fb705d0c7': '0xf0db5c57d47fd3b9eb32ddd3f3ceffd1339df6ebda31d9e474ccef65422a8fed',
   '0xe8200d6de23a76bb9f185b20f75d2758d0378f840d94b809c54afdc21a6b892a': '0x28ef37a34a01928885627dbef04b15a9434b0a42b26715c1db3198a97e952cb2',
   '0x11a345e1991dbbac260346f5dbc8c4a85214e8b3cfa4d66ddb24eff85074e846': '0x8bb809bd4614e794dc5a3af262ee134d4331a2805375556730f366c9862ce834'
  }
  var pending = client.records().filter(function (r) { return r && r.state !== 'complete' && r.state !== 'failed' && (r.action === 'deposit' || r.action === 'depositAndList') && same(r.to, deployment.address) && recoveries[String(r.hash || '').toLowerCase()] })
  var cleared = 0, errors = []
  for (var row of pending) {
   try {
    await client.reconcileClearedWrapped(row.key, recoveries[row.hash.toLowerCase()], function () { return json('https://api.ethscriptions.com/v2/status') })
    cleared++
   } catch (error) {
    errors.push(row.hash + ': ' + (error.message || 'check failed'))
   }
  }
  if (cleared || errors.length) recoveryNotice = (cleared ? 'Cleared ' + cleared + ' recovered deposit record(s). No gas used. ' : '') + (errors.length ? 'Could not clear: ' + errors.join(' | ') : '')
  else {
   var blockers = client.records().filter(function (r) { return r && r.state !== 'complete' && r.state !== 'failed' })
   recoveryNotice = blockers.length ? 'Saved request(s) blocking new actions: ' + blockers.map(function (r) { return (r.action || '?') + ' · ' + (r.hash || 'no hash') + ' · ' + r.state }).join(' | ') : ''
  }
 }
 function recovery() {
  recoveryBox.textContent = ''
  if (recoveryNotice) { var notice = document.createElement('p'); notice.textContent = recoveryNotice; recoveryBox.appendChild(notice) }
  if (client) client.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }).forEach(function (row) {
   if (row.key === activeSubmissionKey) return
   var text = document.createElement('p'), b = document.createElement('button'), input = document.createElement('input')
    text.textContent = row.action + ': ' + (row.hash || 'No transaction hash returned. Check wallet Activity; do not retry.')
    if (!same(row.to, deployment.address)) { var link = document.createElement('a'); link.href = '/classic/pages/trixmoji-market.html' + (legacy ? '' : '?market=legacy'); link.textContent = 'OPEN THE OTHER ESCROW TO CHECK THIS REQUEST ↗'; recoveryBox.append(text, link); return }
    if (!row.hash && row.state === 'awaiting-wallet' && (row.action === 'deposit' || row.action === 'depositAndList' || row.action === 'list')) {
     var details = document.createElement('details'), summary = document.createElement('summary'), instructions = document.createElement('p'), clearUnsent = document.createElement('button'), hashDetails = document.createElement('details'), hashSummary = document.createElement('summary')
     details.className = 'pending-request'; summary.textContent = 'Previous wallet request needs attention'
     instructions.textContent = 'If your wallet has no pending approval or transaction, check and clear the unsent request. No gas is used.'
     clearUnsent.type = 'button'; clearUnsent.textContent = 'I CHECKED MY WALLET · CLEAR UNSENT REQUEST'
     clearUnsent.onclick = async function () {
      clearUnsent.disabled = true
      try {
       await client.recoverUnsent(row.key, true, async function (saved) {
        if (!/^0x[a-f0-9]{64}$/i.test(String(saved.assetId || '')) || !same(saved.to, deployment.address)) return false
        var connection = MarketWalletConnector.current(), provider = connection && connection.provider
        if (!provider) return false
        var iface = new ethers.utils.Interface(artifact.abi)
        var checks = await Promise.all([
         asset(saved.assetId), json('https://api.ethscriptions.com/v2/status'),
         provider.request({ method: 'eth_blockNumber', params: [] }),
         provider.request({ method: 'eth_call', params: [{ to: deployment.address, data: iface.encodeFunctionData('depositBlock', [saved.from, saved.assetId]) }, 'latest'] }),
         saved.action === 'list' ? provider.request({ method: 'eth_call', params: [{ to: deployment.address, data: iface.encodeFunctionData('listings', [saved.from, saved.assetId]) }, 'latest'] }) : Promise.resolve(null)
        ])
        var head = Number(BigInt(checks[2])), indexed = Number(checks[1] && checks[1].last_imported_block)
        if (!Number.isSafeInteger(head) || !Number.isSafeInteger(indexed) || indexed > head || head - indexed > 12 || !same(checks[0].transaction_hash, saved.assetId)) return false
        var recorded = iface.decodeFunctionResult('depositBlock', checks[3])[0]
        if (saved.action === 'list') {
         var requested
         try { requested = iface.decodeFunctionData('list', saved.data) } catch (_) { return false }
         var current = iface.decodeFunctionResult('listings', checks[4])
         return same(requested.id, saved.assetId) && same(checks[0].current_owner, deployment.address) && same(checks[0].previous_owner, saved.from) && !recorded.isZero() && !current.price.eq(requested.price)
        }
        return same(checks[0].current_owner, saved.from) && recorded.isZero()
       })
       recoveryNotice = 'Unsent ' + row.action + ' request checked and cleared. No transaction or gas was used.'; recovery(); say(recoveryNotice)
      } catch (error) { say(error.message); clearUnsent.disabled = false }
     }
     hashSummary.textContent = 'I have a transaction hash'; input.placeholder = '0x transaction hash'; input.setAttribute('aria-label', 'Market transaction hash')
     b.type = 'button'; b.textContent = 'CHECK TRANSACTION'; b.onclick = async function () { b.disabled = true; try { await reconcile(Object.assign({}, row, { hash: input.value.trim() })); recovery() } catch (error) { say(error.message); b.disabled = false } }
     hashDetails.append(hashSummary, input, b); details.append(summary, instructions, clearUnsent, hashDetails); recoveryBox.appendChild(details)
     return
    }
    var entryHost = recoveryBox
    if (row.hash) { var submittedDetails = document.createElement('details'), submittedSummary = document.createElement('summary'); submittedDetails.className = 'pending-request'; submittedSummary.textContent = 'Recent transaction · verification pending'; submittedDetails.appendChild(submittedSummary); recoveryBox.appendChild(submittedDetails); entryHost = submittedDetails }
    entryHost.appendChild(text)
   input.placeholder = '0x transaction hash from wallet Activity'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Market transaction hash'); entryHost.appendChild(input)
   b.textContent = 'CHECK TRANSACTION'; b.onclick = async function () { try { await reconcile(Object.assign({}, row, { hash: input.value.trim() })); recovery() } catch (e) { say(e.message + (/wrapped deposit/i.test(e.message) ? ' If recovery already confirmed, use CHECK CLEARED RECORD · NO GAS above.' : '')) } }; entryHost.appendChild(b)
   if (row.action === 'deposit' || row.action === 'depositAndList') {
    var cancelInput = document.createElement('input'), resolveButton = document.createElement('button')
    cancelInput.placeholder = '0x confirmed cancellation / recovery hash'; cancelInput.setAttribute('aria-label', 'Confirmed escrow recovery transaction hash')
    if (same(row.hash, '0x9de253efbaeb700b2947630706ce0234c19b23a8eb3ab16d1adb40db0e5a57c5')) cancelInput.value = '0x430a0f0cafa463ab9d8b075b68d88ec4bc9639a9490132f164dfb08d801e93db'
    resolveButton.type = 'button'; resolveButton.textContent = 'CHECK CLEARED RECORD · NO GAS'
    resolveButton.onclick = async function () { resolveButton.disabled = true; try { await client.reconcileClearedWrapped(row.key, cancelInput.value.trim(), function () { return json('https://api.ethscriptions.com/v2/status') }); say('Recovered deposit verified: escrow record is clear and the piece remains in your wallet. No transaction was sent.'); recovery() } catch (e) { say(e.message); resolveButton.disabled = false } }
    entryHost.append(cancelInput, resolveButton)
    if (!legacy && same(row.from, '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E') && same(row.assetId, '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74')) { var recoveryLink = document.createElement('a'); recoveryLink.href = '/classic/pages/replacement-6-recovery.html'; recoveryLink.textContent = 'OPEN #6 ESCROW RECORD RECOVERY ↗'; entryHost.appendChild(recoveryLink) }
   }
  })
  if (!webpV2 && !launch) CleanPopTransferCheckout.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }).forEach(function (row) {
   var text = document.createElement('p'), input = document.createElement('input'), check = document.createElement('button')
   text.textContent = 'Saved transfer of CLEAN POP #' + row.tokenNo + '. Check wallet Activity before sending again.'
   input.placeholder = '0x transfer transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Saved transfer transaction hash')
   check.type = 'button'; check.textContent = 'CHECK TRANSFER'
   check.onclick = async function () { check.disabled = true; try { var result = await CleanPopTransferCheckout.reconcile(Object.assign({}, row, { hash: input.value.trim() }), function (r) { return transferCheck('verify', { id: r.id, hash: r.hash, from: r.from, to: r.to }) }); say('Transfer confirmed. Indexed owner: ' + result.currentOwner); recovery(); await load(false) } catch (e) { say(e.message); check.disabled = false } }
   recoveryBox.append(text, input, check)
  })
 }
 function review(q, listingPrice, target, auctionDuration) {
  return new Promise(function (resolve, reject) {
   var host = target || reviewBox; host.hidden = false; host.textContent = ''
   var p = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button')
   p.textContent = 'Review ' + q.action + (q.assetId ? ' · ' + q.assetId : '') + ' · destination ' + q.to + ' · value ' + ethers.utils.formatEther(q.valueWei) + ' ETH' + (listingPrice ? ' · ' + (q.action === 'auction' ? 'minimum bid ' : 'listing price ') + ethers.utils.formatEther(listingPrice) + ' ETH' : '') + (auctionDuration ? ' · duration ' + (auctionDuration / 3600) + ' hours' : '') + ' · estimated gas ' + q.estimatedGas + '. Confirm final network fee in your wallet.' + (q.action === 'deposit' || q.action === 'depositAndList' ? ' In your wallet, reject if the outer transaction shows redeemDelegations or a different destination. A successful receipt alone does not prove custody; the indexer must confirm it.' : '')
   approve.type = 'button'; cancel.type = 'button'; approve.textContent = 'CONTINUE TO WALLET'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Waiting for wallet. Do not repeat the request.'); q.approve().then(function (row) { host.hidden = true; resolve(row) }, function (e) { host.hidden = true; reject(e) }) }
   cancel.onclick = function () { host.hidden = true; reject(Error('Cancelled. No transaction was requested.')) }
   host.append(p, approve, cancel); say(target ? 'Review the transaction on the artwork card, then click CONTINUE TO WALLET.' : 'Review the transaction above, then click CONTINUE TO WALLET.'); if (typeof host.scrollIntoView === 'function') host.scrollIntoView({ behavior: 'smooth', block: 'center' }); approve.focus()
  })
 }
 async function action(kind, args, reviewTarget) {
  if (busy) return; busy = true
  try {
   await configure(); say('Checking saved recovery records…'); await reconcileKnownRecovery(); await reconcileSubmittedActions(); recovery()
   if (kind === 'deposit' || kind === 'depositAndList') {
     var selectedWallet = MarketWalletConnector.current()
     var rabby = selectedWallet && (selectedWallet.provider.isRabby === true || (selectedWallet.walletInfo && selectedWallet.walletInfo.rdns === 'io.rabby'))
     if (launch && selectedWallet && same(selectedWallet.address, '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E') && !rabby) {
      throw Error('This account previously sent a wrapped deposit through MetaMask. Connect the same account using Rabby, which you used for the earlier direct deposit. No transaction was requested.')
     }
     say('Checking market availability…')
    var currentBoard = await json(marketUrl)
    if (!same(currentBoard.marketAddress, expectedMarket) || !currentBoard.tradingReady) throw Error('The market is not ready for escrow deposits. No transaction was requested; please try the check again shortly.')
    board = currentBoard
   }
   say('Checking wallet, custody, market and transaction…')
   var row = await client.run(kind, args, function (q) { return review(q, kind === 'list' || kind === 'depositAndList' || kind === 'auction' ? args.amountWei : null, reviewTarget, kind === 'auction' ? args.duration : null) }); activeSubmissionKey = row.key; say('Submitted ' + row.hash + '. Checking confirmation…'); recovery()
   try {
    if (kind === 'deposit' || kind === 'depositAndList') { var result = await waitForDeposit(row, client); say(result.failed ? 'Transaction failed. Check wallet activity.' : 'Deposit confirmed and indexed. Open MY ESCROW to list it.'); await load(false) }
    else await reconcile(row)
   } catch (e) { say(e.message + ' Transaction: ' + row.hash) }
   } catch (e) {
    var message = e.message || 'Market action failed.'
    say(message)
    if (reviewTarget) {
     reviewTarget.textContent = message
     reviewTarget.hidden = false
     reviewTarget.setAttribute('role', 'alert')
     if (typeof reviewTarget.scrollIntoView === 'function') reviewTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
   } finally { activeSubmissionKey = null; busy = false; recovery() }
 }
 async function sendPiece(item, recipient) {
  if (webpV2 || launch) return action('gift', { id: item.id, recipient: recipient.trim() })
  if (busy) return; busy = true
  try {
   var connection = MarketWalletConnector.current()
   if (!connection) throw Error('Connect your wallet first.')
   var to = recipient.trim(), from = connection.address
   if (!ethers.utils.isAddress(to) || same(to, ethers.constants.AddressZero) || same(to, from) || same(to, '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC') || same(to, '0xd935E162B6070C4FEAF600c67f7F729f318515a2') || same(to, '0x21c1A938d06f87A039abfC48d1cCB459f55b1685')) throw Error('Enter a valid, different recipient wallet address.')
   say('Checking ownership and network fee…')
   var q = await transferCheck('plan', { id: item.id, from: from, to: to })
   if (!q.owned || !same(q.id, item.id) || !same(q.from, from) || !same(q.to, to) || q.chainId !== 1 || q.value !== '0' || q.tokenNo !== item.tokenNo || BigInt(q.estimatedGas) <= 0n || BigInt(q.estimatedGasPriceWei) <= 0n) throw Error('Transfer check did not match the selected piece and recipient.')
   var row = await CleanPopTransferCheckout.send({ provider: connection.provider, id: item.id, from: from, to: to, tokenNo: item.tokenNo, gas: q.estimatedGas, gasWei: (BigInt(q.estimatedGas) * BigInt(q.estimatedGasPriceWei)).toString(),
    preflight: async function () { await EthscriptionCheckout.identity(connection.provider, from); var owner = await transferCheck('ownership', { id: item.id, wallet: from }); if (!owner.owned || !same(owner.id, item.id) || !same(owner.currentOwner, from)) throw Error('This piece is no longer shown in your wallet.') },
    review: function (gift) { return review({ action: 'send CLEAN POP #' + item.tokenNo, assetId: gift.id, to: gift.to, valueWei: '0', estimatedGas: q.estimatedGas, approve: gift.approve }) } })
   say('Transfer submitted: ' + row.hash + '. Checking confirmation and indexer…'); recovery()
   try { await CleanPopTransferCheckout.reconcile(row, function (r) { return transferCheck('verify', { id: r.id, hash: r.hash, from: r.from, to: r.to }) }); await load(false); say('Transfer confirmed and indexed.') }
   catch (e) { say(e.message + ' Check the saved transfer below before retrying.') }
  } catch (e) { say(e.message || 'Transfer failed.') } finally { busy = false; recovery() }
 }
 function button(parent, label, callback, disabled) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = !!disabled; b.onclick = callback; parent.appendChild(b) }
 function amount(label) { var value = window.prompt(label + ' in ETH'); if (value === null) return null; try { var n = ethers.utils.parseEther(value.trim()); if (n.lte(0)) throw Error(); return n.toString() } catch (_) { say('Enter a positive ETH amount.'); return null } }
 function card(item, kind, connection) {
  var article = document.createElement('article'), image = document.createElement('img'), title = document.createElement('h2'), info = document.createElement('p')
  if (!Number.isInteger(item.tokenNo) || item.tokenNo < 0 || item.tokenNo >= 10000) return
  image.src = launch ? '/assets/ethscriptions/trixmoji-launch/' + item.tokenNo + '.webp' : webpV2 ? '/assets/ethscriptions/clean-pop-webp-v2/' + item.tokenNo + '.webp' : '/assets/ethscriptions/clean-pop-v1/' + item.tokenNo + '.png'; image.alt = (launch ? 'TrixMoji #' : 'Clean Pop #') + item.tokenNo; image.loading = 'lazy'; title.textContent = (launch ? 'TRIXMOJI #' : 'CLEAN POP #') + item.tokenNo
  article.append(image, title, info)
  if (kind === 'wallet') {
   info.textContent = 'First move this piece to escrow. Once indexed and the cooldown is complete, list it from MY ESCROW.'
   var form = document.createElement('form'), recipient = document.createElement('input'), send = document.createElement('button')
   recipient.type = 'text'; recipient.placeholder = 'Recipient 0x address'; recipient.setAttribute('aria-label', 'Recipient address for Clean Pop #' + item.tokenNo); recipient.autocomplete = 'off'; recipient.required = true
   send.type = 'submit'; send.textContent = 'SEND TO WALLET'; form.onsubmit = function (event) { event.preventDefault(); sendPiece(item, recipient.value) }; form.append(recipient, send); article.appendChild(form)
   var depositReview = document.createElement('div'); depositReview.className = 'market-review'; depositReview.hidden = true
   button(article, 'MOVE TO ESCROW', function () { action('deposit', { id: item.id }, depositReview) }, false); article.appendChild(depositReview)
  } else if (kind === 'escrow') {
   var listing = (board.listings || []).find(function (x) { return same(x.id, item.id) && same(x.seller, item.seller) })
   var activeAuction = (board.auctions || []).find(function (x) { return same(x.id, item.id) && same(x.seller, item.seller) })
   info.textContent = activeAuction ? 'Auction active. Manage or settle it from AUCTIONS.' : item.cooldown ? 'Wait ' + item.cooldown + ' more blocks.' : listing ? 'Listed for ' + ethers.utils.formatEther(listing.priceWei) + ' ETH. You can update the price or replace the listing with an auction.' : 'Ready to list, auction, or return.'
   var listForm = document.createElement('form'), priceLabel = document.createElement('label'), priceInput = document.createElement('input'), listButton = document.createElement('button'), cardReview = document.createElement('div')
   priceLabel.textContent = 'SALE PRICE · ETH'; priceInput.type = 'text'; priceInput.inputMode = 'decimal'; priceInput.placeholder = '0.01'; priceInput.autocomplete = 'off'; priceInput.required = true; priceInput.setAttribute('aria-label', 'Sale price in ETH for Clean Pop #' + item.tokenNo)
   if (listing) priceInput.value = ethers.utils.formatEther(listing.priceWei)
   listButton.type = 'submit'; listButton.textContent = listing ? 'UPDATE SALE PRICE' : 'LIST FOR SALE'; listButton.disabled = !!item.cooldown || !board.tradingReady || !!activeAuction
   cardReview.className = 'market-review'; cardReview.hidden = true
   listForm.onsubmit = function (event) { event.preventDefault(); var n; try { n = ethers.utils.parseEther(priceInput.value.trim()); if (n.lte(0)) throw Error() } catch (_) { say('Enter a positive ETH sale price on the artwork card.'); priceInput.focus(); return } action('list', { id: item.id, amountWei: n.toString() }, cardReview) }
   priceLabel.appendChild(priceInput); listForm.append(priceLabel, listButton); article.append(listForm, cardReview)
   var auctionToggle = document.createElement('button'), auctionForm = document.createElement('form'), auctionHeading = document.createElement('h3'), auctionNote = document.createElement('p'), reserveLabel = document.createElement('label'), reserveInput = document.createElement('input'), durationLabel = document.createElement('label'), durationInput = document.createElement('input'), auctionError = document.createElement('p'), auctionSubmit = document.createElement('button')
   auctionToggle.type = 'button'; auctionToggle.textContent = 'SET UP AUCTION'; auctionToggle.disabled = !!item.cooldown || !board.tradingReady || !!activeAuction; auctionToggle.setAttribute('aria-expanded', 'false')
   auctionForm.className = 'auction-form'; auctionForm.hidden = true
   auctionHeading.textContent = 'CREATE AN AUCTION'
   auctionNote.textContent = listing ? 'Starting an auction replaces your current fixed-price listing. Review the details before approving in your wallet.' : 'Choose a minimum bid and duration. Review the details before approving in your wallet.'
   reserveLabel.textContent = 'MINIMUM BID · ETH'; reserveInput.type = 'text'; reserveInput.inputMode = 'decimal'; reserveInput.placeholder = '0.01'; reserveInput.autocomplete = 'off'; reserveInput.required = true; reserveInput.setAttribute('aria-label', 'Minimum bid in ETH for Clean Pop #' + item.tokenNo); reserveLabel.appendChild(reserveInput)
   durationLabel.textContent = 'DURATION · HOURS'; durationInput.type = 'number'; durationInput.min = '1'; durationInput.max = '168'; durationInput.step = '1'; durationInput.value = '24'; durationInput.required = true; durationInput.setAttribute('aria-label', 'Auction duration in hours for Clean Pop #' + item.tokenNo); durationLabel.appendChild(durationInput)
   auctionError.className = 'auction-error'; auctionError.setAttribute('role', 'alert')
   auctionSubmit.type = 'submit'; auctionSubmit.textContent = 'REVIEW AUCTION'
   auctionToggle.onclick = function () { auctionForm.hidden = !auctionForm.hidden; auctionToggle.setAttribute('aria-expanded', String(!auctionForm.hidden)); auctionToggle.textContent = auctionForm.hidden ? 'SET UP AUCTION' : 'CLOSE AUCTION SETUP'; if (!auctionForm.hidden) reserveInput.focus() }
   auctionForm.onsubmit = function (event) {
    event.preventDefault(); auctionError.textContent = ''
    var reserve, hours = Number(durationInput.value)
    try { reserve = ethers.utils.parseEther(reserveInput.value.trim()); if (reserve.lte(0)) throw Error() } catch (_) { auctionError.textContent = 'Enter a minimum bid greater than zero in ETH.'; reserveInput.focus(); return }
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) { auctionError.textContent = 'Choose a whole number of hours between 1 and 168.'; durationInput.focus(); return }
    action('auction', { id: item.id, amountWei: reserve.toString(), duration: hours * 3600 }, cardReview)
   }
   auctionForm.append(auctionHeading, auctionNote, reserveLabel, durationLabel, auctionError, auctionSubmit); article.append(auctionToggle, auctionForm)
   button(article, listing ? 'REMOVE LISTING & RETURN' : 'RETURN TO WALLET', function () { action('cancel', { id: item.id }, cardReview) }, item.cooldown || !!activeAuction)
   } else if (kind === 'sale') {
    article.classList.add('sale-card')
    info.className = 'sale-price'
    var priceLabel = document.createElement('span'), priceValue = document.createElement('strong'), sellerLine = document.createElement('p'), sellerAddress = document.createElement('span')
    priceLabel.textContent = 'PRICE'; priceValue.textContent = ethers.utils.formatEther(item.priceWei) + ' ETH'
    info.append(priceLabel, priceValue)
    sellerLine.className = 'sale-seller'; sellerLine.appendChild(document.createTextNode('SELLER '))
    sellerAddress.textContent = item.seller.slice(0, 6) + '…' + item.seller.slice(-4); sellerAddress.title = item.seller; sellerAddress.setAttribute('aria-label', 'Seller ' + item.seller); sellerLine.appendChild(sellerAddress); article.appendChild(sellerLine)
    var isOwn = connection && same(item.seller, connection.address)
    button(article, isOwn ? 'YOUR LISTING' : 'BUY', function () { action('buy', { id: item.id, seller: item.seller, amountWei: item.priceWei }) }, !connection || !board.tradingReady || isOwn)
  } else {
   info.textContent = 'Reserve ' + ethers.utils.formatEther(item.reserveWei) + ' ETH · top bid ' + ethers.utils.formatEther(item.amountWei) + ' ETH · ends ' + new Date(item.end * 1000).toLocaleString()
   if (item.end * 1000 > Date.now()) button(article, 'PLACE BID', function () { var n = amount('Your bid'); if (n) action('bid', { id: item.id, seller: item.seller, nonce: item.nonce, amountWei: n }) }, !connection || same(item.seller, connection.address))
   else button(article, 'SETTLE AUCTION', function () { action('settle', { id: item.id, seller: item.seller, nonce: item.nonce }) }, !connection)
  }
  grid.appendChild(article)
 }
 async function load(append) {
  var connection = MarketWalletConnector.current(), request = ++generation
  if (!append) { grid.textContent = ''; cursor = null }
  more.hidden = true; say('Loading verified market data…')
  try {
   if (connection) { await configure(); await reconcileKnownRecovery(); await reconcileSubmittedActions(); recovery() }
   try { board = await json(marketUrl); if (!same(board.marketAddress, expectedMarket)) throw Error('Wrong market service.') } catch (_) { board = null }
   if (request !== generation) return
   if (view === 'wallet') {
    if (!connection) { say('Connect an Ethereum wallet to see your ' + (launch ? 'TrixMoji' : 'Clean Pop') + ' pieces.'); return }
    var url = new URL(launch ? '/.netlify/functions/market-wallet-inventory-launch' : webpV2 ? '/.netlify/functions/market-wallet-inventory-webp-v2' : '/.netlify/functions/market-wallet-inventory', location.origin); url.searchParams.set('wallet', connection.address); if (cursor) url.searchParams.set('pageKey', cursor)
    var data = await json(url); if (request !== generation) return
    data.items.forEach(function (item) { card(item, 'wallet', connection) }); cursor = data.nextPageKey; more.hidden = !cursor
    var collectionName = launch ? 'TrixMoji' : 'Clean Pop'
    say((grid.children.length ? 'Verified ' + collectionName + ' pieces in ' + connection.address : 'No verified ' + collectionName + ' pieces found in this wallet.') + (!board || !board.tradingReady ? ' Market data is unavailable; MOVE TO ESCROW will recheck before requesting a wallet transaction.' : ''))
   } else {
    if (!board) throw Error('Trading service is unavailable. No market transaction was requested.')
    if (view === 'escrow' && !connection) throw Error('Connect your wallet to view your escrow.')
    var rows = view === 'escrow' ? board.deposits.filter(function (x) { return same(x.seller, connection.address) }) : view === 'sale' ? board.listings : board.auctions
    rows.forEach(function (item) { card(item, view, connection) }); say(rows.length ? rows.length + ' verified items.' : 'No items in this view.')
   }
  } catch (e) { if (request === generation) say(e.message || 'Market data unavailable.') }
 }
 ;[['myWallet', 'wallet'], ['myEscrow', 'escrow'], ['forSale', 'sale'], ['auctions', 'auction']].forEach(function (pair) { document.getElementById(pair[0]).onclick = function () { view = pair[1]; load(false) } })
 document.getElementById('refreshWallet').onclick = function () { load(false) }
 document.getElementById('withdrawCredit').onclick = function () { var connection = MarketWalletConnector.current(); if (!connection) return say('Connect your wallet first.'); action('withdraw', { recipient: connection.address }) }
 more.onclick = function () { if (cursor) load(true) }
 window.addEventListener('market-wallet-change', function () { client = null; load(false) })
})()
