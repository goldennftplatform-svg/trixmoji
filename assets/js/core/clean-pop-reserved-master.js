(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, owner = '0x915A3D363D0a4e4470B531f008F5142c540E5417', contractAddress = '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC', legacyAddress = '0x64A0CA6fE1f944De3210a64bD1DAb0619725281d'
 var info, ledger, manifest, connection, states = [], busy = false, next = null
 var same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function say(text) { el('status').textContent = text }
 function pending() { return CleanPopDeliveryCheckout.records().find(function (r) { return r.state !== 'complete' && r.state !== 'failed' }) }
 function controls() { el('connect').disabled = busy || !info; el('refresh').disabled = busy || !connection; el('prepare').disabled = busy || !connection || !next || !!pending() }
 async function currentContract() {
  if (!connection) throw Error('Connect the owner wallet first.')
  await EthscriptionCheckout.identity(connection.provider, owner)
  var code = await connection.provider.request({ method: 'eth_getCode', params: [contractAddress, 'latest'] })
  if (!same(code, info.runtime)) throw Error('The deployed Clean Pop contract does not match the approved runtime.')
  return new ethers.Contract(contractAddress, info.abi, new ethers.providers.Web3Provider(connection.provider))
 }
 async function checkState(record) {
  var c = await currentContract(), legacy = new ethers.Contract(legacyAddress, ['function minted(uint256) view returns (bool)'], c.provider)
  var values = await Promise.all([c.minted(record.tokenNo), c.replaced(record.legacyId), legacy.minted(record.tokenNo)])
  if (values[0] || values[1]) throw Error('This token or legacy ID was already used. Check its transaction before continuing.')
  if (!values[2]) throw Error('The legacy contract does not mark this token as minted.')
  return true
 }
 async function updateQueue() {
  var c = await currentContract(), saved = CleanPopDeliveryCheckout.records()
  states = await Promise.all(ledger.mints.map(async function (r) {
   var result = await Promise.all([c.minted(r.tokenNo), c.replaced(r.legacyId)]), row = saved.find(function (x) { return same(x.legacyId, r.legacyId) && x.state === 'complete' && same(x.recipient, owner) })
   return { record: r, minted: result[0], replaced: result[1], verified: !!row }
  }))
  var host = el('items'); host.textContent = ''; next = null; var verified = 0, ambiguous = 0
  states.forEach(function (s) {
   var box = document.createElement('div'), label = document.createElement('strong'), description = document.createElement('div'); box.className = 'item'; label.textContent = 'CLEAN POP #' + s.record.tokenNo
   if (s.verified && s.minted && s.replaced) { description.textContent = 'CONFIRMED TO OWNER'; verified++ }
   else if (s.minted || s.replaced) { description.textContent = 'ALREADY USED · CHECK HISTORY'; ambiguous++ }
   else { description.textContent = 'READY'; if (!next) next = s.record }
   box.append(label, description); host.appendChild(box)
  })
  el('progress').textContent = verified + ' / ' + ledger.mints.length + ' verified in this browser' + (ambiguous ? ' · ' + ambiguous + ' already used: inspect their history.' : '')
  recovery(); controls()
 }
 async function artwork(record) {
  var entry = manifest.files[record.tokenNo]
  if (!entry || entry.id !== record.tokenNo || !entry.proof || entry.proof.length !== 14) throw Error('Approved artwork proof unavailable.')
  var response = await fetch('/assets/ethscriptions/clean-pop-v1/' + record.tokenNo + '.png', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw Error('Approved artwork unavailable.')
  var bytes = new Uint8Array(await response.arrayBuffer()), binary = ''
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  var uri = 'data:image/png;base64,' + btoa(binary), digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uri))
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
 async function reconcile(row) { var result = await CleanPopDeliveryCheckout.reconcile(row, verify); say('Clean Pop #' + row.tokenNo + ' confirmed and indexed to the owner wallet.'); await updateQueue(); return result }
 function recovery() {
  var host = el('recovery'), row = pending(); host.textContent = ''; host.hidden = !row
  if (!row) return
  var text = document.createElement('p'), input = document.createElement('input'), check = document.createElement('button')
  text.textContent = 'Saved request for #' + row.tokenNo + ' · ' + row.state + '. Check wallet Activity before retrying.'
  input.className = 'wide'; input.placeholder = '0x transaction hash from wallet Activity'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Saved delivery transaction hash')
  check.type = 'button'; check.textContent = 'CHECK SAVED MINT'; check.onclick = async function () { check.disabled = true; try { await reconcile(Object.assign({}, row, { hash: input.value.trim() })) } catch (e) { say(e.message); check.disabled = false } }
  host.append(text, input, check)
  if (!row.hash && row.state === 'awaiting-wallet') {
   var note = document.createElement('p'); note.textContent = 'If there is no transaction hash, do not start another mint. Contact the operator after checking for an open or pending wallet request.'; host.appendChild(note)
  }
 }
 function review(quote) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'); host.hidden = false; host.textContent = ''
   text.textContent = 'Mint CLEAN POP #' + quote.tokenNo + ' to ' + quote.recipient + '. Mint price: 0 ETH. Estimated network fee: ' + EthscriptionCheckout.eth(quote.gasWei) + ' ETH. Your wallet shows the final fee.'
   approve.type = 'button'; approve.textContent = 'APPROVE THIS MINT IN WALLET'; cancel.type = 'button'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Waiting for wallet approval; do not send another mint.'); quote.approve().then(function (row) { host.hidden = true; resolve(row) }, function (e) { host.hidden = true; reject(e) }) }
   cancel.onclick = function () { host.hidden = true; reject(Error('Cancelled. No transaction was requested.')) }
   host.append(text, approve, cancel); say('Review the piece and recipient, then approve in the wallet.'); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  busy = true; connection = null; controls()
  try {
   var injected = window.ethereum, providers = injected && Array.isArray(injected.providers) ? injected.providers : injected ? [injected] : []
   if (providers.length === 1 && providers[0] && typeof providers[0].request === 'function') {
    var accounts = await EthscriptionCheckout.requestAccounts(providers[0]); await EthscriptionCheckout.ensureChain(providers[0]); connection = { provider: providers[0], address: accounts[0] }
   } else { var settings = await fetch('/api/ethscriptions', { cache: 'no-store' }).then(function (r) { return r.json() }).catch(function () { return {} }); EthscriptionCheckout.configure(settings.walletConnectProjectId || ''); connection = await EthscriptionCheckout.connect(el('wallets'), say) }
   if (!same(connection.address, owner)) { connection = null; throw Error('Connect owner wallet ' + owner + '.') }
   await updateQueue(); say('Owner connected. Prepare the next mint; each piece needs a separate wallet approval.')
  } catch (e) { say(e.message) } finally { busy = false; controls() }
 }
 el('refresh').onclick = async function () { busy = true; controls(); try { await updateQueue(); say('Queue refreshed.') } catch (e) { say(e.message) } finally { busy = false; controls() } }
 el('prepare').onclick = async function () {
  if (busy || !next) return; busy = true; controls()
  try {
   var record = next; say('Checking owner, reserved token and approved artwork…'); await checkState(record)
   var image = await artwork(record), query = new URLSearchParams({ token: String(record.tokenNo), legacy: record.legacyId, recipient: owner })
   var response = await fetch('/.netlify/functions/clean-pop-delivery-preflight?' + query, { cache: 'no-store', signal: AbortSignal.timeout(45000) }), quote = await response.json()
   if (!response.ok || !quote.ok || !quote.readyToRequestWallet || quote.minted || quote.replaced || !quote.legacyMinted || quote.contentAlreadyInscribed || quote.chainId !== 1 || quote.tokenNo !== record.tokenNo || !same(quote.legacyId, record.legacyId) || !same(quote.recipient, owner) || !same(quote.creator, owner) || !same(quote.contract, contractAddress) || quote.contentSha256 !== image.sha) throw Error(quote.estimateError || quote.error || 'Preflight could not confirm this piece.')
   var estimate = BigInt(quote.estimatedGas), gasPrice = BigInt(quote.estimatedGasPriceWei); if (estimate <= 0n || gasPrice <= 0n) throw Error('Network fee estimate unavailable.')
   var iface = new ethers.utils.Interface(info.abi), tx = { from: owner, to: contractAddress, value: '0x0', data: iface.encodeFunctionData('deliverReplacement', [image.uri, image.proof, record.tokenNo, record.legacyId, owner]), gas: '0x' + (estimate + estimate / 5n).toString(16) }
   var row = await CleanPopDeliveryCheckout.send({ provider: connection.provider, info: info, tokenNo: record.tokenNo, legacyId: record.legacyId, recipient: owner, tx: tx, gasWei: (estimate * gasPrice).toString(),
    preflight: async function () { await checkState(record); var counts = await Promise.all(['latest', 'pending'].map(function (tag) { return connection.provider.request({ method: 'eth_getTransactionCount', params: [owner, tag] }) })); if (BigInt(counts[0]) !== BigInt(counts[1])) throw Error('The owner wallet has a pending transaction. Resolve it before continuing.') }, review: review })
   say('Submitted ' + row.hash + '. Checking confirmation and indexing.'); recovery()
   var done = false
   for (var i = 0; i < 24; i++) { try { await reconcile(row); done = true; break } catch (e) { if (!/not confirmed|not on Ethereum|indexing is pending/i.test(e.message) || i === 23) throw e; await new Promise(function (resolve) { setTimeout(resolve, 5000) }) } }
   if (done && !next) say('Queue complete for this browser. Verify the resulting pieces in the owner wallet before manual distribution.')
  } catch (e) { say(e.message || 'Mint preparation failed.'); recovery() } finally { busy = false; controls() }
 }
 Promise.all(['/assets/data/clean-pop-minter.json', '/assets/data/clean-pop-legacy-mints.json', '/assets/ethscriptions/clean-pop-v1/manifest.json'].map(function (path) { return fetch(path, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw Error('Queue configuration unavailable.'); return r.json() }) })).then(function (data) {
  info = data[0]; ledger = data[1]; manifest = data[2]
  if (!same(info.address, contractAddress) || !same(info.creator, owner) || info.root !== manifest.root || manifest.count !== 10000 || !Array.isArray(ledger.mints) || ledger.mints.length !== 12 || new Set(ledger.mints.map(function (r) { return r.tokenNo })).size !== 12) throw Error('Reserved mint configuration does not match.')
  ledger.mints.forEach(function (r) { var box = document.createElement('div'); box.className = 'item'; box.textContent = 'CLEAN POP #' + r.tokenNo; el('items').appendChild(box) })
  recovery(); say('Connect the owner wallet to check the queue.'); controls()
 }).catch(function (e) { say(e.message) })
})()
