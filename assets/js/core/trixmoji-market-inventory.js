(function () {
 'use strict'
 var grid = document.getElementById('walletGrid'), status = document.getElementById('marketStatus'), more = document.getElementById('moreWallet'), reviewBox = document.getElementById('marketReview'), recoveryBox = document.getElementById('marketRecovery')
 var cursor = null, generation = 0, view = 'wallet', board = null, client = null, busy = false, artifact, deployment, recoveryNotice = ''
  var legacy = new URLSearchParams(location.search).get('market') === 'legacy'
  var marketUrl = legacy ? '/.netlify/functions/trixmoji-market' : '/.netlify/functions/trixmoji-market-replacement'
  var expectedMarket = legacy ? '0xd935E162B6070C4FEAF600c67f7F729f318515a2' : '0x21c1A938d06f87A039abfC48d1cCB459f55b1685'
  var modeLabel = document.getElementById('marketMode'); if (modeLabel) modeLabel.textContent = legacy ? 'ORIGINAL ESCROW · ETHEREUM' : 'REPLACEMENT ESCROW · EXPERIMENTAL'
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
  client = TrixmojiMarketWallet.create({ provider: connection.provider, storage: localStorage, locks: navigator.locks, abi: artifact.abi, market: deployment.address, runtimeHash: deployment.runtimeHash, creator: deployment.creator, verifier: deployment.verifier, chainId: deployment.chainId, minter: '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC', combinedDepositEnabled: !legacy, readAsset: asset,
   authorize: async function (body) { return json(marketUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'authorize' }, body)), signal: AbortSignal.timeout(25000) }) } })
  return connection
 }
 async function verify(row, receipt) {
  var names = { deposit: 'Deposited', depositAndList: 'Deposited', list: 'Listed', cancel: 'Cancelled', buy: 'Sold', auction: 'AuctionStarted', bid: 'Bid', settle: 'AuctionSettled', withdraw: 'CreditWithdrawn' }, iface = new ethers.utils.Interface(artifact.abi), event
  for (var log of receipt.logs || []) {
   if (!same(log.address, deployment.address)) continue
   try { var parsed = iface.parseLog(log); if (parsed.name === names[row.action] && (!row.assetId || same(parsed.args.id, row.assetId))) { event = parsed; break } } catch (_) {}
  }
  if (!event) return false
  if (row.action === 'depositAndList') {
   var marketData = await json(marketUrl)
   return (marketData.listings || []).some(function (item) { return same(item.id, row.assetId) && same(item.seller, row.from) })
  }
  if (['deposit', 'cancel', 'buy', 'settle'].includes(row.action)) {
   var indexed = await asset(row.assetId), expected = row.action === 'deposit' ? deployment.address : row.action === 'settle' ? event.args.buyer : row.from
   return same(indexed.current_owner, expected)
  }
  return true
 }
 async function reconcile(row) { var result = await client.reconcile(row, verify); say(result.failed ? 'Transaction failed. Check wallet activity.' : 'Transaction confirmed and verified.'); await load(false) }
 async function reconcileKnownRecovery() {
  if (legacy || !client) return
  var original = '0x9de253efbaeb700b2947630706ce0234c19b23a8eb3ab16d1adb40db0e5a57c5', cancellation = '0x430a0f0cafa463ab9d8b075b68d88ec4bc9639a9490132f164dfb08d801e93db'
  var pending = client.records().filter(function (r) { return r && r.state !== 'complete' && r.state !== 'failed' && r.action === 'depositAndList' && same(r.to, deployment.address) })
  if (pending.some(function (r) { return !same(r.hash, original) })) return
  var row = pending.find(function (r) { return same(r.hash, original) })
  if (!row) return
  try {
   await client.reconcileClearedWrapped(row.key, cancellation, function () { return json('https://api.ethscriptions.com/v2/status') })
   recoveryNotice = 'The recovered wrapped #6 request was verified and cleared from the pending list. No transaction or gas was used. The wallet route is still unproven.'
  } catch (error) {
   recoveryNotice = 'Could not yet verify the saved #6 recovery: ' + (error.message || 'retry the read-only check') + '. No transaction was sent.'
  }
 }
 function recovery() {
  recoveryBox.textContent = ''
  if (recoveryNotice) { var notice = document.createElement('p'); notice.textContent = recoveryNotice; recoveryBox.appendChild(notice) }
  if (client) client.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }).forEach(function (row) {
   var text = document.createElement('p'), b = document.createElement('button'), input = document.createElement('input')
   text.textContent = row.action + ': ' + (row.hash || 'No transaction hash returned. Check wallet Activity; do not retry.')
   if (!same(row.to, deployment.address)) { var link = document.createElement('a'); link.href = '/classic/pages/trixmoji-market.html' + (legacy ? '' : '?market=legacy'); link.textContent = 'OPEN THE OTHER ESCROW TO CHECK THIS REQUEST ↗'; recoveryBox.append(text, link); return }
   recoveryBox.appendChild(text)
   input.placeholder = '0x transaction hash from wallet Activity'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Market transaction hash'); recoveryBox.appendChild(input)
   b.textContent = 'CHECK TRANSACTION'; b.onclick = async function () { try { await reconcile(Object.assign({}, row, { hash: input.value.trim() })); recovery() } catch (e) { say(e.message + (/wrapped deposit/i.test(e.message) ? ' If recovery already confirmed, use CHECK CLEARED RECORD · NO GAS above.' : '')) } }; recoveryBox.appendChild(b)
   if (row.action === 'deposit' || row.action === 'depositAndList') {
    var cancelInput = document.createElement('input'), resolveButton = document.createElement('button')
    cancelInput.placeholder = '0x confirmed cancellation / recovery hash'; cancelInput.setAttribute('aria-label', 'Confirmed escrow recovery transaction hash')
    if (same(row.hash, '0x9de253efbaeb700b2947630706ce0234c19b23a8eb3ab16d1adb40db0e5a57c5')) cancelInput.value = '0x430a0f0cafa463ab9d8b075b68d88ec4bc9639a9490132f164dfb08d801e93db'
    resolveButton.type = 'button'; resolveButton.textContent = 'CHECK CLEARED RECORD · NO GAS'
    resolveButton.onclick = async function () { resolveButton.disabled = true; try { await client.reconcileClearedWrapped(row.key, cancelInput.value.trim(), function () { return json('https://api.ethscriptions.com/v2/status') }); say('Recovered deposit verified: escrow record is clear and the piece remains in your wallet. No transaction was sent.'); recovery() } catch (e) { say(e.message); resolveButton.disabled = false } }
    recoveryBox.append(cancelInput, resolveButton)
    if (!legacy && same(row.hash, '0x4bfc63cf6bb20dd54b4a44929593a01df76fe990ac4874280845386fb705d0c7')) { var recoveryLink = document.createElement('a'); recoveryLink.href = '/classic/pages/replacement-6-recovery.html'; recoveryLink.textContent = 'OPEN RECOVERY FOR LATEST WRAPPED #6 DEPOSIT ↗'; recoveryBox.appendChild(recoveryLink) }
   }
  })
  CleanPopTransferCheckout.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }).forEach(function (row) {
   var text = document.createElement('p'), input = document.createElement('input'), check = document.createElement('button'), help = document.createElement('a')
   text.textContent = 'Saved transfer of CLEAN POP #' + row.tokenNo + '. Check wallet Activity before sending again.'
   input.placeholder = '0x transfer transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Saved transfer transaction hash')
   check.type = 'button'; check.textContent = 'CHECK TRANSFER'
   check.onclick = async function () { check.disabled = true; try { var result = await CleanPopTransferCheckout.reconcile(Object.assign({}, row, { hash: input.value.trim() }), function (r) { return transferCheck('verify', { id: r.id, hash: r.hash, from: r.from, to: r.to }) }); say('Transfer confirmed. Indexed owner: ' + result.currentOwner); recovery(); await load(false) } catch (e) { say(e.message); check.disabled = false } }
   help.href = '/classic/pages/clean-pop-transfer.html?id=' + encodeURIComponent(row.id); help.textContent = 'TRANSFER RECOVERY ↗'
   recoveryBox.append(text, input, check, help)
  })
 }
 function review(q, listingPrice, target) {
  return new Promise(function (resolve, reject) {
   var host = target || reviewBox; host.hidden = false; host.textContent = ''
   var p = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button')
   p.textContent = 'Review ' + q.action + (q.assetId ? ' · ' + q.assetId : '') + ' · destination ' + q.to + ' · value ' + ethers.utils.formatEther(q.valueWei) + ' ETH' + (listingPrice ? ' · listing price ' + ethers.utils.formatEther(listingPrice) + ' ETH' : '') + ' · estimated gas ' + q.estimatedGas + '. Confirm final network fee in your wallet.' + (q.action === 'deposit' || q.action === 'depositAndList' ? ' The outer transaction must directly target this escrow with the Ethscription ID as calldata. If your wallet wraps it, the contract may record a deposit without transferring the piece. If you cannot verify the outer transaction, cancel.' : '')
   approve.type = 'button'; cancel.type = 'button'; approve.textContent = 'CONTINUE TO WALLET'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Waiting for wallet. Do not repeat the request.'); q.approve().then(function (row) { host.hidden = true; resolve(row) }, function (e) { host.hidden = true; reject(e) }) }
   cancel.onclick = function () { host.hidden = true; reject(Error('Cancelled. No transaction was requested.')) }
   host.append(p, approve, cancel); say(target ? 'Review the listing on the artwork card, then click CONTINUE TO WALLET.' : 'Review the transaction above, then click CONTINUE TO WALLET.'); if (typeof host.scrollIntoView === 'function') host.scrollIntoView({ behavior: 'smooth', block: 'center' }); approve.focus()
  })
 }
 async function action(kind, args, reviewTarget) {
  if (busy) return; busy = true
  try {
   await configure(); say('Checking wallet, custody, market and transaction…')
   var row = await client.run(kind, args, function (q) { return review(q, kind === 'list' || kind === 'depositAndList' ? args.amountWei : null, reviewTarget) }); say('Submitted ' + row.hash + '. Check confirmation before retrying.'); recovery()
   try { await reconcile(row) } catch (e) { say(e.message + ' Transaction: ' + row.hash) }
  } catch (e) { say(e.message || 'Market action failed.') } finally { busy = false; recovery() }
 }
 async function sendPiece(item, recipient) {
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
  image.src = '/assets/ethscriptions/clean-pop-v1/' + item.tokenNo + '.png'; image.alt = 'Clean Pop #' + item.tokenNo; image.loading = 'lazy'; title.textContent = 'CLEAN POP #' + item.tokenNo
  article.append(image, title, info)
  if (kind === 'wallet') {
   info.textContent = 'First move this piece to escrow. Once indexed and the cooldown is complete, list it from MY ESCROW.'
   var form = document.createElement('form'), recipient = document.createElement('input'), send = document.createElement('button')
   recipient.type = 'text'; recipient.placeholder = 'Recipient 0x address'; recipient.setAttribute('aria-label', 'Recipient address for Clean Pop #' + item.tokenNo); recipient.autocomplete = 'off'; recipient.required = true
   send.type = 'submit'; send.textContent = 'SEND TO WALLET'; form.onsubmit = function (event) { event.preventDefault(); sendPiece(item, recipient.value) }; form.append(recipient, send); article.appendChild(form)
   var depositReview = document.createElement('div'); depositReview.className = 'market-review'; depositReview.hidden = true
   button(article, 'MOVE TO ESCROW', function () { action('deposit', { id: item.id }, depositReview) }, !board || !board.tradingReady); article.appendChild(depositReview)
  } else if (kind === 'escrow') {
   info.textContent = item.cooldown ? 'Wait ' + item.cooldown + ' more blocks.' : 'Ready to list, auction, or return.'
   var listForm = document.createElement('form'), priceLabel = document.createElement('label'), priceInput = document.createElement('input'), listButton = document.createElement('button'), cardReview = document.createElement('div')
   priceLabel.textContent = 'SALE PRICE · ETH'; priceInput.type = 'text'; priceInput.inputMode = 'decimal'; priceInput.placeholder = '0.01'; priceInput.autocomplete = 'off'; priceInput.required = true; priceInput.setAttribute('aria-label', 'Sale price in ETH for Clean Pop #' + item.tokenNo)
   listButton.type = 'submit'; listButton.textContent = 'LIST FOR SALE'; listButton.disabled = !!item.cooldown || !board.tradingReady
   cardReview.className = 'market-review'; cardReview.hidden = true
   listForm.onsubmit = function (event) { event.preventDefault(); var n; try { n = ethers.utils.parseEther(priceInput.value.trim()); if (n.lte(0)) throw Error() } catch (_) { say('Enter a positive ETH sale price on the artwork card.'); priceInput.focus(); return } action('list', { id: item.id, amountWei: n.toString() }, cardReview) }
   priceLabel.appendChild(priceInput); listForm.append(priceLabel, listButton); article.append(listForm, cardReview)
   button(article, 'START AUCTION', function () { var n = amount('Auction reserve'), duration = n && window.prompt('Auction duration in hours (1–168)', '24'); if (n && duration !== null) action('auction', { id: item.id, amountWei: n, duration: Number(duration) * 3600 }) }, item.cooldown || !board.tradingReady)
   button(article, 'RETURN TO WALLET', function () { action('cancel', { id: item.id }) }, item.cooldown)
  } else if (kind === 'sale') {
   info.textContent = ethers.utils.formatEther(item.priceWei) + ' ETH · seller ' + item.seller
   button(article, 'BUY', function () { action('buy', { id: item.id, seller: item.seller, amountWei: item.priceWei }) }, !connection || !board.tradingReady || same(item.seller, connection.address))
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
   if (connection) { await configure(); await reconcileKnownRecovery(); recovery() }
   try { board = await json(marketUrl); if (!same(board.marketAddress, expectedMarket)) throw Error('Wrong market service.') } catch (_) { board = null }
   if (request !== generation) return
   if (view === 'wallet') {
    if (!connection) { say('Connect an Ethereum wallet to see your Clean Pop pieces.'); return }
    var url = new URL('/.netlify/functions/market-wallet-inventory', location.origin); url.searchParams.set('wallet', connection.address); if (cursor) url.searchParams.set('pageKey', cursor)
    var data = await json(url); if (request !== generation) return
    data.items.forEach(function (item) { card(item, 'wallet', connection) }); cursor = data.nextPageKey; more.hidden = !cursor
    say((grid.children.length ? 'Verified Clean Pop pieces in ' + connection.address : 'No verified Clean Pop pieces found in this wallet.') + (!board || !board.tradingReady ? ' Trading service is unavailable; deposits are disabled.' : ''))
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
