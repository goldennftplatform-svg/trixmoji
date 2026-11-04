(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, connection, probe, busy = false, owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E'
 function say(text) { el('status').textContent = text }
 function controls() { el('connect').disabled = busy; el('prepare').disabled = busy || !probe || !!probe.saved() }
 async function unused(id) {
  var status = await fetch('https://api.ethscriptions.com/v2/status', { cache: 'no-store', signal: AbortSignal.timeout(12000) }); if (!status.ok) return false
  var state = await status.json(); if (!Number.isSafeInteger(Number(state.blocks_behind)) || Number(state.blocks_behind) > 2) return false
  var response = await fetch('https://api.ethscriptions.com/v2/ethscriptions/' + id, { cache: 'no-store', signal: AbortSignal.timeout(12000) }); if (response.status !== 404) return false
  var body = await response.json().catch(function () { return null }); return !!body && body.error === 'Not found'
 }
 function showSaved() {
  var host = el('saved'), row = probe && probe.saved(), old = probe && probe.oldSaved(); el('oldLabel').hidden = !(old && (old.state === 'awaiting-wallet' || old.state === 'submitted'))
  host.hidden = !row; host.textContent = ''; if (!row) return
  var text = document.createElement('p'); text.textContent = 'Saved test: ' + row.state + (row.hash ? ' · ' + row.hash : ' · no hash returned. Check wallet Activity; do not retry.'); host.appendChild(text)
  if (row.state === 'direct' || row.state === 'wrapped') return
  var input = document.createElement('input'), check = document.createElement('button'); input.type = 'text'; input.placeholder = '0x transaction hash from wallet Activity'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Test transaction hash'); check.textContent = 'CHECK TEST RESULT'
  check.onclick = async function () { check.disabled = true; try { var result = await probe.check(input.value.trim()); say(result.direct ? 'This test used a direct outer transaction. A real escrow deposit is not yet proven.' : 'This test was wrapped by the wallet. This route is not usable for an Ethscription deposit.'); showSaved() } catch (e) { say(e.message); check.disabled = false } }
  host.append(input, check)
  if (row.state === 'awaiting-wallet' && !row.hash) {
   var label = document.createElement('label'), confirmed = document.createElement('input'), recover = document.createElement('button'), note = document.createElement('p')
   confirmed.type = 'checkbox'; label.append(confirmed, document.createTextNode(' I checked MetaMask Activity and closed or rejected any open request. There is no pending test transaction or hash.'))
   recover.type = 'button'; recover.textContent = 'CHECK WALLET AND CLEAR UNSENT TEST'; note.textContent = 'This does not send a transaction. RPC pending counts cannot detect every private request; check MetaMask first.'
   recover.onclick = async function () { recover.disabled = true; try { await probe.recoverUnsent(confirmed.checked); say('Unsent test record archived and cleared. No transaction was sent by this check.'); showSaved(); controls() } catch (e) { say(e.message); recover.disabled = false } }
   host.append(label, recover, note)
  }
 }
 function review(q) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'); host.hidden = false; host.textContent = ''
   text.textContent = 'Test from ' + q.from + ' to your wallet ' + q.to + '. Value: 0 ETH. Unused test data: ' + q.data + '. MetaMask determines and displays the network fee.'
   approve.textContent = 'APPROVE TEST IN WALLET'; cancel.textContent = 'CANCEL'
   approve.onclick = function () {
    approve.disabled = true; cancel.disabled = true; say('Waiting for wallet approval. Do not send another test.')
    var timer = setTimeout(function () { say('The wallet has not answered yet. Open the MetaMask extension icon and check for an approval or pending request. Do not submit another test.') }, 12000)
    q.approve().then(function (row) { clearTimeout(timer); host.hidden = true; resolve(row) }, function (e) { clearTimeout(timer); host.hidden = true; reject(e) }); showSaved()
   }
   cancel.onclick = function () { host.hidden = true; reject(Error('Cancelled. No transaction was requested.')) }
   host.append(text, approve, cancel); say('Review the destination and fee before approving.'); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  busy = true; connection = null; probe = null; controls(); el('wallets').textContent = ''
  try {
   say('Choose MetaMask from the wallet buttons below. This connection step sends no transaction.')
   var selected = await EthscriptionCheckout.choose(el('wallets'), say)
   var trace = WalletRequestTrace.create(selected, function (rows) { el('walletTrace').textContent = JSON.stringify(rows, null, 2) })
   var accounts = await trace.provider.request({ method: 'eth_accounts' }); if (!accounts || !accounts[0]) accounts = await EthscriptionCheckout.requestAccounts(trace.provider)
   await EthscriptionCheckout.ensureChain(trace.provider); connection = { provider: trace.provider, address: accounts[0] }
   if (String(connection.address).toLowerCase() !== owner.toLowerCase()) { connection = null; throw Error('Connect the wallet ending aa3E.') }
   probe = QuantumRouteTest.create({ provider: connection.provider, storage: localStorage, locks: navigator.locks, isUnused: unused, generateData: function () { return ethers.utils.hexlify(crypto.getRandomValues(new Uint8Array(32))) } })
   showSaved(); say('Selected wallet connected: ' + connection.address + '. No new transaction has been requested. Resolve any saved test before preparing another.')
  } catch (e) { probe = null; say(e.message || 'Wallet connection failed.') } finally { busy = false; controls() }
 }
 el('prepare').onclick = async function () {
  if (busy || !probe) return; busy = true; controls()
  try { say('Checking the previous request, wallet and unused test data…'); var row = await probe.run(el('oldConfirmed').checked, review); say('Test submitted: ' + row.hash + '. Check its result after confirmation.'); showSaved() }
  catch (e) { say(e.message || 'Test could not be prepared.'); showSaved() } finally { busy = false; controls() }
 }
 controls()
})()
