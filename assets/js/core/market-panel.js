(function () {
 'use strict'
 var host = document.getElementById('catalogMarket')
 if (!host) return
 var el = function (id) { return document.getElementById(id) }, board = null, busy = false
 function say(text) { el('marketDeskStatus').textContent = text }
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 async function api(body) {
  var response = await fetch('/api/ethscriptions', { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
   headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) })
  var data = await response.json()
  if (!response.ok || !data.ok) throw Error(data.error || 'Marketplace unavailable.')
  return data
 }
 function sessionText() {
  var connection = MarketWalletConnector.current()
  el('marketDeskAccount').textContent = board && board.me ? 'Signed in · account wallet: ' + (board.me.wallet || 'not configured') : 'Sign in to your DOSWAPZ account to list or buy.'
  if (connection && board && board.me && board.me.wallet && !same(connection.address, board.me.wallet)) el('marketDeskAccount').textContent += ' Connected wallet does not match the account wallet.'
 }
 function pending() { return MarketplacePayment.records().filter(function (row) { return row.state !== 'paid' && row.state !== 'confirmed' && row.state !== 'failed' }) }
 function recovery() {
  var container = el('marketPaymentRecovery'); container.textContent = ''
  pending().forEach(function (row) {
   var section = document.createElement('div'), label = document.createElement('p'), input = document.createElement('input'), button = document.createElement('button')
   label.textContent = (row.kind === 'transfer' ? 'Transfer ' : 'Purchase ') + row.id + ' · ' + row.state + '. Check wallet Activity before trying again.'
   input.placeholder = '0x transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Saved marketplace transaction hash')
   button.type = 'button'; button.textContent = 'CHECK SAVED TRANSACTION'
   button.onclick = async function () {
    button.disabled = true
    try {
     var candidate = Object.assign({}, row, { hash: input.value.trim() })
     await MarketplacePayment.reconcile(candidate, api)
     if (row.kind === 'transfer' && board && same(row.to, board.escrow)) { el('marketAsset').value = row.id; el('marketLock').value = candidate.hash }
     say(row.kind === 'transfer' ? 'Transfer confirmed and indexed.' : 'Payment verified. Escrow still needs to release the piece and payouts.'); recovery(); await refresh()
    } catch (error) { say(error.message); button.disabled = false }
   }
   section.append(label, input, button); container.appendChild(section)
  })
 }
 function reviewTransfer(quote) {
  return new Promise(function (resolve, reject) {
   var box = el('marketPaymentReview'); box.textContent = ''; box.hidden = false
   var text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button')
   text.textContent = 'Send Ethscription ' + quote.id + ' from ' + quote.from + ' to ' + quote.to + '. This is a 0 ETH transfer plus gas. If this is the escrow wallet, its operator controls release.'
   approve.type = 'button'; approve.textContent = 'APPROVE TRANSFER IN WALLET'; cancel.type = 'button'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Waiting for wallet approval. Do not submit another transfer.'); quote.approve().then(function (row) { box.hidden = true; box.textContent = ''; resolve(row) }, function (error) { box.hidden = true; box.textContent = ''; reject(error) }) }
   cancel.onclick = function () { box.hidden = true; box.textContent = ''; reject(Error('Transfer cancelled.')) }
   box.append(text, approve, cancel); say('Review the destination and transfer below.'); approve.focus()
  })
 }
 function review(quote) {
  return new Promise(function (resolve, reject) {
   var box = el('marketPaymentReview'); box.textContent = ''; box.hidden = false
   var text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button')
   text.textContent = 'Pay ' + EthscriptionCheckout.eth(quote.amountWei) + ' ETH plus network gas to escrow ' + quote.escrow + '. Escrow must separately deliver the piece and payouts.'
   approve.type = 'button'; approve.textContent = 'APPROVE PAYMENT IN WALLET'; cancel.type = 'button'; cancel.textContent = 'CANCEL'
   approve.onclick = function () {
    approve.disabled = true; cancel.disabled = true
    say('Waiting for wallet approval. Do not send another payment.')
    quote.approve().then(function (row) { box.hidden = true; box.textContent = ''; resolve(row) }, function (error) { box.hidden = true; box.textContent = ''; reject(error) })
   }
   cancel.onclick = function () { box.hidden = true; box.textContent = ''; reject(Error('Purchase cancelled; the temporary hold will expire.')) }
   box.append(text, approve, cancel); say('Review the escrow payment below.'); approve.focus()
  })
 }
 async function finish(row) {
  for (var i = 0; i < 24; i++) {
   try { return await MarketplacePayment.reconcile(row, api) } catch (error) {
    if (!/not confirmed|not on Ethereum|indexing/i.test(error.message) || i === 23) throw error
    await new Promise(function (resolve) { setTimeout(resolve, 5000) })
   }
  }
 }
 async function buy(item) {
  if (busy) return
  busy = true
  try {
   var connection = MarketWalletConnector.current()
   if (!connection) throw Error('Connect your Ethereum wallet above first.')
   if (!board || !board.me || !board.me.wallet) throw Error('Sign in and add your Ethereum wallet to your DOSWAPZ account first.')
   if (!same(board.me.wallet, connection.address)) throw Error('Connected wallet must match the Ethereum wallet on your account.')
   if (pending().length) throw Error('Check the previous saved payment before paying again.')
   await EthscriptionCheckout.identity(connection.provider, connection.address)
   say('Checking indexed escrow custody and reserving this listing…')
   var held = await api({ action: 'hold', id: item.id })
   if (!held.listing || held.listing.id !== item.id || !same(held.escrow, board.escrow)) throw Error('The listing or escrow changed. Refresh before paying.')
   var row = await MarketplacePayment.send({ id: item.id, from: connection.address, escrow: held.escrow, amountWei: held.listing.buyerWei,
    provider: connection.provider, preflight: function () { return EthscriptionCheckout.identity(connection.provider, connection.address) }, review: review })
   say('Payment submitted: ' + row.hash + '. Waiting for confirmation; do not pay again.'); recovery()
   await finish(row); say('Payment confirmed. Escrow still needs to release the piece and payouts.'); recovery(); await refresh()
  } catch (error) { say(error.message); recovery() } finally { busy = false }
 }
 function render() {
  sessionText(); recovery()
  var grid = el('marketListings'); grid.textContent = ''
  var rows = (board.listings || []).filter(function (item) { return item.state === 'open' && /^\/assets\/ethscriptions\/clean-pop-v1\/(?:0|[1-9]\d{0,3})\.png$/.test(String(item.preview || '')) })
  el('marketListingCount').textContent = rows.length + ' OPEN CLEAN POP LISTINGS'
  if (!rows.length) { var empty = document.createElement('p'); empty.textContent = 'No open Clean Pop listings yet.'; grid.appendChild(empty); return }
  rows.forEach(function (item) {
   var card = document.createElement('article'), img = document.createElement('img'), title = document.createElement('h3'), details = document.createElement('p'), button = document.createElement('button')
   card.className = 'market-listing'; img.src = item.preview; img.alt = 'Listed Clean Pop artwork'; img.loading = 'lazy'
   title.textContent = 'CLEAN POP #' + item.preview.match(/(\d+)\.png$/)[1]
   details.textContent = item.priceEth + ' ETH ask · seller ' + item.seller
   button.type = 'button'; button.textContent = 'BUY · ' + item.buyerEth + ' ETH'; button.onclick = function () { buy(item) }
   card.append(img, title, details, button); grid.appendChild(card)
  })
 }
 async function refresh() {
  try { board = await api(); render() } catch (error) { say(error.message) }
 }
 el('marketRefresh').onclick = refresh
 el('marketUseEscrow').onclick = function () { if (board && board.escrow) el('marketRecipient').value = board.escrow; else say('Escrow address is unavailable. Refresh the market.') }
 el('marketTransferForm').onsubmit = async function (event) {
  event.preventDefault(); if (busy) return; busy = true
  try {
   var connection = MarketWalletConnector.current(), id = el('marketSendAsset').value.trim(), to = el('marketRecipient').value.trim()
   if (!connection) throw Error('Connect your Ethereum wallet above first.')
   if (pending().length) throw Error('Check the previous saved marketplace transaction first.')
   var row = await MarketplacePayment.transfer({ id: id, from: connection.address, to: to, provider: connection.provider,
    preflight: async function () {
     await EthscriptionCheckout.identity(connection.provider, connection.address)
     var check = await api({ action: 'marketCheckOwner', id: id, wallet: connection.address })
     if (!check.owned) throw Error('The Ethscriptions indexer does not show this piece in the connected wallet.')
    }, review: reviewTransfer })
   say('Transfer submitted: ' + row.hash + '. Waiting for indexer confirmation.'); recovery()
   await finish(row)
   if (board && same(row.to, board.escrow)) { el('marketAsset').value = row.id; el('marketLock').value = row.hash }
   say('Transfer confirmed and indexed.' + (board && same(row.to, board.escrow) ? ' Enter a price below to list it.' : '')); recovery(); await refresh()
  } catch (error) { say(error.message); recovery() } finally { busy = false }
 }
 el('marketListForm').onsubmit = async function (event) {
  event.preventDefault(); if (busy) return; busy = true
  try {
   var connection = MarketWalletConnector.current()
   if (!connection) throw Error('Connect your Ethereum wallet above first.')
   if (!board || !board.me || !board.me.wallet) throw Error('Sign in and add your Ethereum wallet to your DOSWAPZ account first.')
   if (!same(board.me.wallet, connection.address)) throw Error('Connected wallet must match the Ethereum wallet on your account.')
   await EthscriptionCheckout.identity(connection.provider, connection.address)
   say('Checking the indexed escrow transfer…')
   await api({ action: 'list', ethscriptionId: el('marketAsset').value.trim(), lockTx: el('marketLock').value.trim(), priceEth: el('marketPrice').value.trim(), lane: 'standard' })
   say('Listing published after indexed escrow verification.'); el('marketListForm').reset(); await refresh()
  } catch (error) { say(error.message) } finally { busy = false }
 }
 window.addEventListener('market-wallet-change', sessionText)
 recovery(); refresh()
})()
