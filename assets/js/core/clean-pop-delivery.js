(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, info, ledger, manifest, connection, busy = false, connecting = false, eligible = false, generation = 0
 var same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 var say = function (text) { el('status').textContent = text }
 function selected() { return ledger && ledger.mints.find(function (x) { return String(x.tokenNo) === el('mint').value }) }
 function unfinished() { return CleanPopDeliveryCheckout.records().filter(function (x) { return x.state !== 'complete' && x.state !== 'failed' }) }
 function controls() { el('prepareDelivery').disabled = busy || connecting || !connection || !eligible || !selected() || unfinished().length > 0; el('connect').disabled = busy || connecting; el('mint').disabled = busy || !ledger; el('useOriginal').disabled = busy || !ledger; el('recipient').disabled = busy; el('confirmed').disabled = busy }
 async function currentContract() {
  await EthscriptionCheckout.identity(connection.provider, info.creator)
  var code = await connection.provider.request({ method: 'eth_getCode', params: [info.address, 'latest'] })
  if (!code || !same(code, info.runtime)) throw Error('Deployed contract does not match the approved runtime.')
  return new ethers.Contract(info.address, info.abi, new ethers.providers.Web3Provider(connection.provider))
 }
 async function chainState(record) {
  var c = await currentContract(), legacyAddress = await c.LEGACY(), old = new ethers.Contract(legacyAddress, ['function minted(uint256) view returns (bool)'], c.provider)
  var states = await Promise.all([c.paused(), c.minted(record.tokenNo), c.replaced(record.legacyId), old.minted(record.tokenNo)])
  if (states[1]) throw Error('Clean Pop #' + record.tokenNo + ' is already minted.')
  if (states[2]) throw Error('This legacy ID has already been used.')
  if (!states[3]) throw Error('The original contract does not mark this token as minted.')
  return { paused: states[0] }
 }
 async function showRecord() {
  var record = selected(), n = ++generation
  if (!record) return
  eligible = false; controls()
  el('details').textContent = 'Token: #' + record.tokenNo + '\nOriginal minter: ' + record.originalMinter + '\nLegacy Ethscription: ' + record.legacyId + '\nContract: ' + info.address
  if (connection) {
   try { var state = await chainState(record); if (n === generation) { eligible = true; say('Creator connected. Public mint is ' + (state.paused ? 'paused' : 'open') + '; creator delivery is available in either state.') } }
   catch (error) { if (n === generation) say(error.message) }
  }
  controls()
 }
 async function artwork(record) {
  var entry = manifest.files[record.tokenNo]
  if (!entry || entry.id !== record.tokenNo || !entry.proof || entry.proof.length !== 14) throw Error('Approved artwork proof unavailable.')
  var response = await fetch('/assets/ethscriptions/clean-pop-v1/' + record.tokenNo + '.png', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw Error('Approved artwork unavailable.')
  var bytes = new Uint8Array(await response.arrayBuffer()), binary = ''
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  var uri = 'data:image/png;base64,' + btoa(binary)
  var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uri))
  var sha = Array.from(new Uint8Array(digest)).map(function (v) { return v.toString(16).padStart(2, '0') }).join('')
  if (sha !== entry.contentSha256) throw Error('Approved artwork hash mismatch.')
  return { uri: uri, proof: entry.proof, sha: sha }
 }
 async function verify(row) {
  var query = new URLSearchParams({ hash: row.hash, token: String(row.tokenNo), legacy: row.legacyId, recipient: row.recipient })
  var response = await fetch('/.netlify/functions/clean-pop-delivery-verify?' + query, { cache: 'no-store', signal: AbortSignal.timeout(25000) }), result = await response.json()
  if (!response.ok || !result.ok) throw Error(result.error || 'Delivery verification unavailable.')
  return result
 }
 async function finish(row) {
  for (var i = 0; i < 24; i++) {
   try { return await CleanPopDeliveryCheckout.reconcile(row, verify) } catch (error) {
    if (!/not confirmed|not on Ethereum|indexing is pending/i.test(error.message) || i === 23) throw error
    await new Promise(function (resolve) { setTimeout(resolve, 5000) })
   }
  }
 }
 function recovery() {
  var host = el('recovery'); host.textContent = ''
  CleanPopDeliveryCheckout.records().forEach(function (row) {
   var wrap = document.createElement('div'), title = document.createElement('p'); wrap.className = 'record'
   title.textContent = '#' + row.tokenNo + ' → ' + row.recipient + ' · ' + row.state.toUpperCase(); wrap.appendChild(title)
   if (row.hash) { var link = document.createElement('a'); link.href = 'https://etherscan.io/tx/' + row.hash; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = row.hash; wrap.appendChild(link) }
   if (row.state !== 'complete' && row.state !== 'failed') {
    var input = document.createElement('input'), check = document.createElement('button')
    input.placeholder = '0x delivery transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Delivery transaction hash for token ' + row.tokenNo)
    check.type = 'button'; check.textContent = 'CHECK DELIVERY'
    check.onclick = async function () { check.disabled = true; try { await CleanPopDeliveryCheckout.reconcile(Object.assign({}, row, { hash: input.value.trim() }), verify); say('Delivery confirmed and indexed.'); recovery(); await showRecord() } catch (error) { say(error.message); check.disabled = false } }
    wrap.appendChild(input); wrap.appendChild(check)
    if (row.state === 'awaiting-wallet' && !row.hash) {
     var label = document.createElement('label'), checkbox = document.createElement('input'), recover = document.createElement('button'), warning = document.createElement('p')
     checkbox.type = 'checkbox'; checkbox.style.width = 'auto'; label.appendChild(checkbox); label.appendChild(document.createTextNode(' I checked the creator wallet: no pending delivery, hash, or open approval request.'))
     recover.type = 'button'; recover.textContent = 'CHECK WALLET · RECOVER UNSENT DELIVERY'; recover.disabled = !connection
     recover.onclick = async function () { recover.disabled = true; try { await CleanPopDeliveryCheckout.recoverUnsent({ provider: connection.provider, info: info, legacyId: row.legacyId, confirmed: checkbox.checked }); say('No-hash delivery intent archived and cleared. No transaction sent.'); recovery(); controls() } catch (error) { say(error.message); recover.disabled = false } }
     warning.textContent = 'Pending-count checks cannot see every private or smart-wallet request. Resolve wallet activity before recovering.'
     wrap.append(label, recover, warning)
    }
   }
   host.appendChild(wrap)
  }); controls()
 }
 function review(quote) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'); host.textContent = ''; host.hidden = false
   text.textContent = 'Deliver Clean Pop #' + quote.tokenNo + ' to ' + quote.recipient + '. Mint price: 0 ETH. Estimated gas: ' + EthscriptionCheckout.eth(quote.gasWei) + ' ETH. The wallet displays final fees.'
   approve.type = 'button'; approve.textContent = 'APPROVE DELIVERY IN WALLET'; cancel.type = 'button'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Requesting approval in the creator wallet. Do not submit another delivery.'); quote.approve().then(function (row) { host.hidden = true; host.textContent = ''; resolve(row) }, function (error) { host.hidden = true; host.textContent = ''; reject(error) }) }
   cancel.onclick = function () { host.hidden = true; host.textContent = ''; reject(Error('Delivery cancelled; no transaction sent.')) }
   host.append(text, approve, cancel); say('Review the full destination and gas estimate, then approve in your wallet.'); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  connecting = true; connection = null; eligible = false; controls()
  try {
   if (!info) throw Error('Configuration is still loading.')
   var injected = window.ethereum, providers = injected && Array.isArray(injected.providers) ? injected.providers : injected ? [injected] : []
   if (providers.length === 1 && providers[0] && typeof providers[0].request === 'function') {
    say('Approve the connection in the creator wallet if requested.')
    var accounts = await EthscriptionCheckout.requestAccounts(providers[0]); await EthscriptionCheckout.ensureChain(providers[0]); connection = { provider: providers[0], address: accounts[0] }
   } else {
    var settings = await fetch('/api/ethscriptions', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json() }).catch(function () { return {} })
    EthscriptionCheckout.configure(settings.walletConnectProjectId || ''); connection = await EthscriptionCheckout.connect(el('wallets'), say)
   }
   if (!same(connection.address, info.creator)) { connection = null; throw Error('Connect creator wallet ' + info.creator) }
   recovery(); await showRecord()
  } catch (error) { say(error.message) } finally { connecting = false; controls() }
 }
 el('mint').onchange = showRecord
 el('useOriginal').onclick = function () { var row = selected(); if (row) el('recipient').value = row.originalMinter }
 el('prepareDelivery').onclick = async function () {
  if (busy) return
  busy = true; controls()
  try {
   var record = selected(), recipient = el('recipient').value.trim()
   if (!el('confirmed').checked) throw Error('Confirm that you verified the original claim and destination.')
   if (!ethers.utils.isAddress(recipient) || same(recipient, ethers.constants.AddressZero) || same(recipient, info.address)) throw Error('Enter a valid recipient wallet.')
   say('Checking creator wallet and exact approved artwork…'); await chainState(record)
   var image = await artwork(record), query = new URLSearchParams({ token: String(record.tokenNo), legacy: record.legacyId, recipient: recipient })
   say('Estimating the creator-paid delivery using the site’s read-only Ethereum RPC…')
   var response = await fetch('/.netlify/functions/clean-pop-delivery-preflight?' + query, { cache: 'no-store', signal: AbortSignal.timeout(45000) }), quote = await response.json()
   if (!response.ok || !quote.ok || !quote.readyToRequestWallet || quote.minted || quote.replaced || !quote.legacyMinted || quote.contentAlreadyInscribed || quote.chainId !== 1 || quote.tokenNo !== record.tokenNo || !same(quote.legacyId, record.legacyId) || !same(quote.recipient, recipient) || !same(quote.creator, info.creator) || !same(quote.contract, info.address) || quote.contentSha256 !== image.sha) throw Error(quote.estimateError || quote.error || 'Delivery preflight could not confirm this piece and recipient.')
   var iface = new ethers.utils.Interface(info.abi), estimate = BigInt(quote.estimatedGas), gasPrice = BigInt(quote.estimatedGasPriceWei)
   if (estimate <= 0n || gasPrice <= 0n) throw Error('Delivery gas estimate is unavailable.')
   var tx = { from: info.creator, to: info.address, value: '0x0', data: iface.encodeFunctionData('deliverReplacement', [image.uri, image.proof, record.tokenNo, record.legacyId, recipient]), gas: '0x' + (estimate + estimate / 5n).toString(16) }
   var saved = await CleanPopDeliveryCheckout.send({ provider: connection.provider, info: info, tokenNo: record.tokenNo, legacyId: record.legacyId, recipient: recipient, tx: tx, gasWei: (estimate * gasPrice).toString(),
    preflight: function () { return chainState(record) }, review: review })
   say('Submitted ' + saved.hash + '. Waiting for Ethereum and Ethscriptions indexing.'); recovery()
   await finish(saved); eligible = false; say('Delivery #' + record.tokenNo + ' confirmed and indexed to ' + recipient + '.'); recovery()
  } catch (error) { say(error.message); recovery() } finally { busy = false; controls() }
 }
 Promise.all([fetch('/assets/data/clean-pop-minter.json', { cache: 'no-store' }), fetch('/assets/data/clean-pop-legacy-mints.json', { cache: 'no-store' }), fetch('/assets/ethscriptions/clean-pop-v1/manifest.json', { cache: 'no-store' })]).then(async function (responses) {
  if (responses.some(function (r) { return !r.ok })) throw Error('Clean Pop configuration unavailable.')
  info = await responses[0].json(); ledger = await responses[1].json(); manifest = await responses[2].json()
  if (!same(info.address, '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC') || info.root !== manifest.root || manifest.count !== 10000 || !Array.isArray(ledger.mints)) throw Error('Clean Pop configuration does not match.')
  ledger.mints.forEach(function (row) { var option = document.createElement('option'); option.value = row.tokenNo; option.textContent = '#' + row.tokenNo + ' · ' + row.originalMinter; el('mint').appendChild(option) })
  el('mint').disabled = false; el('useOriginal').disabled = false; recovery(); await showRecord()
 }).catch(function (error) { say(error.message) })
})()
