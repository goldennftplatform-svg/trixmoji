(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, connection, probe, busy = false, account = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E'
 function say(value) { el('status').textContent = value }
 function controls() { el('connect').disabled = busy; el('prepare').disabled = busy || !probe || !!probe.saved() }
 async function unused(id) {
  var status = await fetch('https://api.ethscriptions.com/v2/status', { cache: 'no-store', signal: AbortSignal.timeout(12000) })
  if (!status.ok) return false
  var state = await status.json(); if (!Number.isSafeInteger(Number(state.blocks_behind)) || Number(state.blocks_behind) > 2) return false
  var response = await fetch('https://api.ethscriptions.com/v2/ethscriptions/' + id, { cache: 'no-store', signal: AbortSignal.timeout(12000) })
  if (response.status !== 404) return false
  var body = await response.json().catch(function () { return null })
  return !!body && body.error === 'Not found'
 }
 function saved() {
  var host = el('saved'), row = probe && probe.saved(); host.hidden = !row; host.textContent = ''
  if (!row) return
  var text = document.createElement('p'); text.textContent = 'Saved test: ' + row.state + (row.hash ? ' · ' + row.hash : ' · no hash returned. Check wallet Activity; do not repeat the test.'); host.appendChild(text)
  if (row.state === 'direct' || row.state === 'wrapped') return
  var input = document.createElement('input'), button = document.createElement('button'); input.placeholder = '0x route-test transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Route test transaction hash'); button.textContent = 'CHECK TEST RESULT'
  button.onclick = async function () { button.disabled = true; try { var result = await probe.check(input.value.trim()); say(result.direct ? 'Result: this test transaction was direct. This does not yet prove an escrow deposit.' : 'Result: the wallet wrapped this test transaction. This route cannot be used for an Ethscription deposit.'); saved() } catch (e) { say(e.message); button.disabled = false } }
  host.append(input, button)
 }
 function review(q) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'); host.hidden = false; host.textContent = ''
   text.textContent = 'Route test from ' + q.from + ' to ' + q.to + '. Value: 0 ETH. Random test data: ' + q.data + '. Maximum network fee: ' + EthscriptionCheckout.eth(q.maxGasWei) + ' ETH. The wallet shows the final fee.'
   approve.textContent = 'APPROVE TEST IN WALLET'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Waiting for wallet approval. Do not submit another test.'); q.approve().then(function (row) { host.hidden = true; resolve(row) }, function (e) { host.hidden = true; reject(e) }) }
   cancel.onclick = function () { host.hidden = true; reject(Error('Cancelled. No transaction was requested.')) }
   host.append(text, approve, cancel); say('Review the test and network fee before requesting approval.'); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  busy = true; controls()
  try {
   var injected = window.ethereum, providers = injected && Array.isArray(injected.providers) ? injected.providers : injected ? [injected] : []
   if (providers.length === 1 && providers[0] && typeof providers[0].request === 'function') { var accounts = await EthscriptionCheckout.requestAccounts(providers[0]); await EthscriptionCheckout.ensureChain(providers[0]); connection = { provider: providers[0], address: accounts[0] } }
   else { var settings = await fetch('/api/ethscriptions', { cache: 'no-store' }).then(function (r) { return r.json() }).catch(function () { return {} }); EthscriptionCheckout.configure(settings.walletConnectProjectId || ''); connection = await EthscriptionCheckout.connect(el('wallets'), say) }
   if (String(connection.address).toLowerCase() !== account.toLowerCase()) { connection = null; throw Error('Connect the wallet ending aa3E.') }
   probe = EthscriptionRouteProbe.create({ provider: connection.provider, storage: localStorage, locks: navigator.locks, isUnused: unused, generateData: function () { return ethers.utils.hexlify(crypto.getRandomValues(new Uint8Array(32))) } })
   saved(); say('Wallet connected. Prepare the route test; nothing has been sent.')
  } catch (e) { say(e.message); probe = null } finally { busy = false; controls() }
 }
 el('prepare').onclick = async function () {
  if (busy || !probe) return; busy = true; controls()
  try { say('Checking wallet, unused test data, and network fee…'); var row = await probe.run(review); say('Test submitted: ' + row.hash + '. Check its result after confirmation.'); saved() }
  catch (e) { say(e.message || 'Route test could not be prepared.'); saved() } finally { busy = false; controls() }
 }
 controls()
})()
