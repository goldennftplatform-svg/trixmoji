(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, connection = null, piece = null, busy = false, connecting = false, generation = 0
 var same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 var say = function (text) { el('status').textContent = text }
 function unfinished() { return CleanPopTransferCheckout.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }) }
 function controls() { el('connect').disabled = busy || connecting; el('lookup').disabled = busy || connecting || !connection; el('prepareTransfer').disabled = busy || connecting || !connection || !piece || !piece.owned || unfinished().length > 0; el('asset').disabled = busy; el('recipient').disabled = busy }
 async function check(action, values) {
  var query = new URLSearchParams(Object.assign({ action: action }, values)), response = await fetch('/.netlify/functions/clean-pop-transfer?' + query, { cache: 'no-store', signal: AbortSignal.timeout(25000) })
  var data = await response.json(); if (!response.ok || !data.ok) throw Error(data.error || 'Transfer check unavailable.')
  return data
 }
 async function lookup() {
  var n = ++generation, id = el('asset').value.trim()
  piece = null; el('piece').hidden = true; controls()
  if (!connection) throw Error('Connect the wallet that owns the piece.')
  await EthscriptionCheckout.identity(connection.provider, connection.address)
  var result = await check('ownership', { id: id, wallet: connection.address })
  if (n !== generation) return
  if (!same(result.id, id) || !/^\/assets\/ethscriptions\/clean-pop-v1\/(?:0|[1-9]\d{0,3})\.png$/.test(result.preview || '')) throw Error('Could not verify this Clean Pop piece.')
  piece = result; el('pieceTitle').textContent = 'CLEAN POP #' + result.tokenNo
  el('pieceDetails').textContent = 'Indexed owner: ' + result.currentOwner + '\nEthscription ID: ' + result.id
  el('art').src = result.preview; el('art').alt = 'Clean Pop #' + result.tokenNo
  el('ethscriptionLink').href = 'https://ethscriptions.com/ethscriptions/' + result.id; el('piece').hidden = false
  say(result.owned ? 'The indexer confirms this piece is in the connected wallet.' : 'The connected wallet is not the indexed owner.'); controls()
 }
 async function verify(row) { return check('verify', { id: row.id, hash: row.hash, from: row.from, to: row.to }) }
 async function finish(row) {
  for (var i = 0; i < 24; i++) {
   try { return await CleanPopTransferCheckout.reconcile(row, verify) } catch (error) {
    if (!/not confirmed|not on Ethereum|indexing/i.test(error.message) || i === 23) throw error
    await new Promise(function (resolve) { setTimeout(resolve, 5000) })
   }
  }
 }
 function recovery() {
  var host = el('recovery'); host.textContent = ''
  CleanPopTransferCheckout.records().forEach(function (row) {
   var wrap = document.createElement('div'), title = document.createElement('p'); wrap.className = 'record'
   title.textContent = 'CLEAN POP #' + row.tokenNo + ' · ' + row.state.toUpperCase() + ' · FROM ' + row.from + ' TO ' + row.to; wrap.appendChild(title)
   if (row.hash) { var link = document.createElement('a'); link.href = 'https://etherscan.io/tx/' + row.hash; link.textContent = row.hash; link.target = '_blank'; link.rel = 'noopener noreferrer'; wrap.appendChild(link) }
   if (row.state !== 'complete' && row.state !== 'failed') {
    var input = document.createElement('input'), checkButton = document.createElement('button'); input.type = 'text'; input.placeholder = '0x transfer transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Saved transfer transaction hash'); checkButton.type = 'button'; checkButton.textContent = 'CHECK SAVED TRANSFER'
    checkButton.onclick = async function () { checkButton.disabled = true; try { var candidate = Object.assign({}, row, { hash: input.value.trim() }), result = await CleanPopTransferCheckout.reconcile(candidate, verify); say('Transfer indexed. Current indexed owner: ' + result.currentOwner); recovery() } catch (error) { say(error.message); checkButton.disabled = false } }
    wrap.append(input, checkButton)
    if (row.state === 'awaiting-wallet' && !row.hash) {
     var label = document.createElement('label'), checkbox = document.createElement('input'), recover = document.createElement('button'), warning = document.createElement('p')
     checkbox.type = 'checkbox'; label.append(checkbox, document.createTextNode(' I checked this wallet: no pending transfer, transaction hash, or open approval request.'))
     recover.type = 'button'; recover.textContent = 'CHECK WALLET · RECOVER NO-HASH TRANSFER'; recover.disabled = !connection
     warning.textContent = 'Recovery sends no transaction. RPC pending counts cannot detect every private or smart-wallet request.'
     recover.onclick = async function () { recover.disabled = true; try { await CleanPopTransferCheckout.recoverUnsent({ provider: connection.provider, id: row.id, from: connection.address, confirmed: checkbox.checked, verifyOwner: function (saved) { return check('ownership', { id: saved.id, wallet: saved.from }) } }); say('No-hash transfer intent archived and cleared. No transaction sent.'); recovery(); controls() } catch (error) { say(error.message); recover.disabled = false } }
     wrap.append(label, recover, warning)
    }
   }
   host.appendChild(wrap)
  }); controls()
 }
 function review(quote) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'); host.textContent = ''; host.hidden = false
   text.textContent = 'Send CLEAN POP #' + quote.tokenNo + ' (' + quote.id + ') from ' + quote.from + ' to ' + quote.to + '. Value: 0 ETH. Estimated gas: ' + EthscriptionCheckout.eth(quote.gasWei) + ' ETH. Verify the destination carefully; the wallet shows final fees.'
   approve.type = 'button'; approve.textContent = 'APPROVE TRANSFER IN WALLET'; cancel.type = 'button'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Waiting for the wallet approval. Do not submit another transfer.'); quote.approve().then(function (row) { host.hidden = true; host.textContent = ''; resolve(row) }, function (error) { host.hidden = true; host.textContent = ''; reject(error) }) }
   cancel.onclick = function () { host.hidden = true; host.textContent = ''; reject(Error('Transfer cancelled. No transaction sent.')) }
   host.append(text, approve, cancel); say('Review the exact recipient and gas estimate below.'); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  connecting = true; connection = null; piece = null; controls()
  try {
   var injected = window.ethereum, providers = injected && Array.isArray(injected.providers) ? injected.providers : injected ? [injected] : []
   if (providers.length === 1 && providers[0] && typeof providers[0].request === 'function') {
    el('walletStatus').textContent = 'Approve the wallet connection if requested.'
    var accounts = await EthscriptionCheckout.requestAccounts(providers[0]); await EthscriptionCheckout.ensureChain(providers[0]); connection = { provider: providers[0], address: accounts[0] }
   } else {
    var settings = await fetch('/api/ethscriptions', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json() }).catch(function () { return {} })
    EthscriptionCheckout.configure(settings.walletConnectProjectId || ''); connection = await EthscriptionCheckout.connect(el('wallets'), function (text) { el('walletStatus').textContent = text })
   }
   await EthscriptionCheckout.identity(connection.provider, connection.address)
   el('walletStatus').textContent = 'Connected: ' + connection.address + ' · Ethereum mainnet.'
   var previous = CleanPopCheckout.records().filter(function (r) { return r.state === 'complete' && same(r.buyer, connection.address) && /^0x[a-f0-9]{64}$/i.test(String(r.hash || '')) })
   if (!el('asset').value && previous.length) el('asset').value = previous[previous.length - 1].hash
   recovery()
   if (el('asset').value.trim()) await lookup()
  } catch (error) { connection = null; el('walletStatus').textContent = error.message } finally { connecting = false; controls() }
 }
 el('asset').oninput = function () { generation++; piece = null; el('piece').hidden = true; controls() }
 el('lookup').onclick = async function () { try { say('Checking the indexed owner and approved artwork…'); await lookup() } catch (error) { say(error.message) } }
 el('prepareTransfer').onclick = async function () {
  if (busy) return; busy = true; controls()
  try {
   if (!connection || !piece || !piece.owned) throw Error('Connect the owner wallet and find the piece first.')
   var id = piece.id, to = el('recipient').value.trim(), from = connection.address
   if (!ethers.utils.isAddress(to) || same(to, ethers.constants.AddressZero) || same(to, from) || same(to, '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC')) throw Error('Enter a valid, different recipient wallet. Do not send to the mint contract.')
   say('Checking indexed ownership and estimating transfer gas…')
   var quote = await check('plan', { id: id, from: from, to: to })
   if (!quote.owned || !same(quote.id, id) || !same(quote.from, from) || !same(quote.to, to) || quote.chainId !== 1 || quote.value !== '0' || !Number.isInteger(quote.tokenNo) || quote.tokenNo !== piece.tokenNo || BigInt(quote.estimatedGas) <= 0n || BigInt(quote.estimatedGasPriceWei) <= 0n) throw Error('Transfer preflight did not match the requested piece and recipient.')
   var row = await CleanPopTransferCheckout.send({ provider: connection.provider, id: id, from: from, to: to, tokenNo: quote.tokenNo, gas: quote.estimatedGas, gasWei: (BigInt(quote.estimatedGas) * BigInt(quote.estimatedGasPriceWei)).toString(), review: review,
    preflight: async function () { await EthscriptionCheckout.identity(connection.provider, from); var owner = await check('ownership', { id: id, wallet: from }); if (!owner.owned || !same(owner.id, id) || !same(owner.currentOwner, from)) throw Error('The indexer no longer shows this piece in your wallet.') } })
   say('Submitted ' + row.hash + '. Waiting for Ethereum and Ethscriptions indexing.'); recovery()
   var result = await finish(row); piece = null; el('piece').hidden = true; say('Transfer indexed. Current indexed owner: ' + result.currentOwner); recovery()
  } catch (error) { say(error.message); recovery() } finally { busy = false; controls() }
 }
 var id = new URLSearchParams(location.search).get('id')
 if (id && /^0x[a-f0-9]{64}$/i.test(id)) el('asset').value = id
 recovery(); controls()
})()
