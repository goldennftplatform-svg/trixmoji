(function () {
 'use strict'
 var grid = document.getElementById('walletGrid'), status = document.getElementById('marketStatus'), more = document.getElementById('moreWallet'), reviewBox = document.getElementById('marketReview'), recoveryBox = document.getElementById('marketRecovery')
 var cursor = null, generation = 0, view = 'wallet', board = null, client = null, busy = false, artifact, deployment
 var same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 var say = function (text) { status.textContent = text }
 async function json(url, options) { var r = await fetch(url, options || { cache: 'no-store', signal: AbortSignal.timeout(25000) }); var body = await r.json(); if (!r.ok || body.ok === false) throw Error(body.error || 'Market request unavailable.'); return body }
 async function asset(id) { var body = await json('https://api.ethscriptions.com/v2/ethscriptions/' + encodeURIComponent(id)); if (!body.result) throw Error('Indexer asset unavailable.'); return body.result }
 async function configure() {
  var connection = MarketWalletConnector.current()
  if (!connection) throw Error('Connect your Ethereum wallet first.')
  if (!artifact || !deployment) {
   var values = await Promise.all([json('/assets/data/trixmoji-escrow-artifact.json'), json('/assets/data/trixmoji-escrow-deployment.json')]); artifact = values[0]; deployment = values[1]
  }
  client = TrixmojiMarketWallet.create({ provider: connection.provider, storage: localStorage, locks: navigator.locks, abi: artifact.abi, market: deployment.address, runtimeHash: deployment.runtimeHash, creator: deployment.creator, verifier: deployment.verifier, chainId: deployment.chainId, minter: '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC', readAsset: asset,
   authorize: async function (body) { return json('/.netlify/functions/trixmoji-market', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'authorize' }, body)), signal: AbortSignal.timeout(25000) }) } })
  return connection
 }
 async function verify(row, receipt) {
  var names = { deposit: 'Deposited', list: 'Listed', cancel: 'Cancelled', buy: 'Sold', auction: 'AuctionStarted', bid: 'Bid', settle: 'AuctionSettled', withdraw: 'CreditWithdrawn' }, iface = new ethers.utils.Interface(artifact.abi), event
  for (var log of receipt.logs || []) {
   if (!same(log.address, deployment.address)) continue
   try { var parsed = iface.parseLog(log); if (parsed.name === names[row.action] && (!row.assetId || same(parsed.args.id, row.assetId))) { event = parsed; break } } catch (_) {}
  }
  if (!event) return false
  if (['deposit', 'cancel', 'buy', 'settle'].includes(row.action)) {
   var indexed = await asset(row.assetId), expected = row.action === 'deposit' ? deployment.address : row.action === 'settle' ? event.args.buyer : row.from
   return same(indexed.current_owner, expected)
  }
  return true
 }
 async function reconcile(row) { var result = await client.reconcile(row, verify); say(result.failed ? 'Transaction failed. Check wallet activity.' : 'Transaction confirmed and verified.'); await load(false) }
 function recovery() {
  recoveryBox.textContent = ''; if (!client) return
  client.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }).forEach(function (row) {
   var text = document.createElement('p'), b = document.createElement('button'), input = document.createElement('input')
   text.textContent = row.action + ': ' + (row.hash || 'No transaction hash returned. Check wallet Activity; do not retry.')
   recoveryBox.appendChild(text)
   input.placeholder = '0x transaction hash from wallet Activity'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Market transaction hash'); recoveryBox.appendChild(input)
   b.textContent = 'CHECK TRANSACTION'; b.onclick = async function () { try { await reconcile(Object.assign({}, row, { hash: input.value.trim() })); recovery() } catch (e) { say(e.message) } }; recoveryBox.appendChild(b)
  })
 }
 function review(q) {
  return new Promise(function (resolve, reject) {
   reviewBox.hidden = false; reviewBox.textContent = ''
   var p = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button')
   p.textContent = 'Review ' + q.action + (q.assetId ? ' · ' + q.assetId : '') + ' · destination ' + q.to + ' · value ' + ethers.utils.formatEther(q.valueWei) + ' ETH · estimated gas ' + q.estimatedGas + '. Confirm final network fee in your wallet.'
   approve.textContent = 'APPROVE IN WALLET'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Waiting for wallet. Do not repeat the request.'); q.approve().then(function (row) { reviewBox.hidden = true; resolve(row) }, function (e) { reviewBox.hidden = true; reject(e) }) }
   cancel.onclick = function () { reviewBox.hidden = true; reject(Error('Cancelled. No transaction was requested.')) }
   reviewBox.append(p, approve, cancel); approve.focus()
  })
 }
 async function action(kind, args) {
  if (busy) return; busy = true
  try {
   await configure(); say('Checking wallet, custody, market and transaction…')
   var row = await client.run(kind, args, review); say('Submitted ' + row.hash + '. Check confirmation before retrying.'); recovery()
   try { await reconcile(row) } catch (e) { say(e.message + ' Transaction: ' + row.hash) }
  } catch (e) { say(e.message || 'Market action failed.') } finally { busy = false; recovery() }
 }
 function button(parent, label, callback, disabled) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = !!disabled; b.onclick = callback; parent.appendChild(b) }
 function amount(label) { var value = window.prompt(label + ' in ETH'); if (value === null) return null; try { var n = ethers.utils.parseEther(value.trim()); if (n.lte(0)) throw Error(); return n.toString() } catch (_) { say('Enter a positive ETH amount.'); return null } }
 function card(item, kind, connection) {
  var article = document.createElement('article'), image = document.createElement('img'), title = document.createElement('h2'), info = document.createElement('p')
  if (!Number.isInteger(item.tokenNo) || item.tokenNo < 0 || item.tokenNo >= 10000) return
  image.src = '/assets/ethscriptions/clean-pop-v1/' + item.tokenNo + '.png'; image.alt = 'Clean Pop #' + item.tokenNo; image.loading = 'lazy'; title.textContent = 'CLEAN POP #' + item.tokenNo
  article.append(image, title, info)
  if (kind === 'wallet') {
   var link = document.createElement('a'); link.href = '/classic/pages/clean-pop-transfer.html?id=' + encodeURIComponent(item.id); link.textContent = 'SEND TO WALLET ↗'; article.appendChild(link)
   button(article, 'MOVE TO ESCROW', function () { action('deposit', { id: item.id }) }, !board || !board.tradingReady)
  } else if (kind === 'escrow') {
   info.textContent = item.cooldown ? 'Wait ' + item.cooldown + ' more blocks.' : 'Ready to list, auction, or return.'
   button(article, 'LIST FOR SALE', function () { var n = amount('Sale price'); if (n) action('list', { id: item.id, amountWei: n }) }, item.cooldown || !board.tradingReady)
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
   if (connection) { await configure(); recovery() }
   try { board = await json('/.netlify/functions/trixmoji-market') } catch (_) { board = null }
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
