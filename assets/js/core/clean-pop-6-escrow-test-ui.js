(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, test, busy = false, requestRows = []
 function renderTrace() { el('walletTrace').textContent = 'PAGE STATUS: ' + el('status').textContent + '\n\n' + JSON.stringify(requestRows, null, 2) }
 function say(s) { el('status').textContent = s; renderTrace() }
 function controls() { el('connect').disabled = busy; el('prepare').disabled = busy || !test || !!test.saved() || test.earlierRoutes().length > 0 }
 async function get(url) { var r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!r.ok) throw Error('Indexer unavailable: HTTP ' + r.status); return r.json() }
 function earlier() {
  var host = el('earlier'), entries = test ? test.earlierRoutes() : []; host.textContent = ''; host.hidden = !entries.length
  if (!entries.length) return
  var p = document.createElement('p'); p.textContent = 'An earlier wallet-route test is saved. Clearing this record sends no transaction and costs no gas. First check MetaMask for any open approval, pending test or hash.'; host.appendChild(p)
  if (entries.some(function (entry) { return !!entry.row.hash })) { p.textContent += ' A saved hash exists: use the earlier test page to verify it.'; return }
  var label = document.createElement('label'), checkbox = document.createElement('input'), button = document.createElement('button'), note = document.createElement('p'); checkbox.type = 'checkbox'
  label.append(checkbox, document.createTextNode(' I checked MetaMask: there is no open approval, pending test, or transaction hash.'))
  button.type = 'button'; button.textContent = 'CHECK AND CLEAR UNSENT ROUTE TEST · NO GAS'
  note.textContent = 'The check verifies the original nonce and archives only matching no-hash records. Public pending counts cannot see every private wallet request.'
  button.onclick = async function () {
   if (busy) return; busy = true; controls(); button.disabled = true
   try { say('Checking the earlier test and wallet nonce. No transaction will be sent…'); await test.clearEarlierRoutes(checkbox.checked); earlier(); say('Earlier no-hash test archived and cleared. Click CHECK #6 AND PREPARE ESCROW TEST for read-only checks. No transaction was sent by recovery.') }
   catch (e) { say(e.message); button.disabled = false } finally { busy = false; controls() }
  }
  host.append(label, button, note)
 }
 function saved() {
  var host = el('saved'), row = test && test.saved(); host.hidden = !row; host.textContent = ''; if (!row) return
  var p = document.createElement('p'); p.textContent = 'Escrow test: ' + row.state + ' · ' + (row.hash || 'No hash returned. Do not repeat the request.'); host.appendChild(p)
  if (row.state === 'verified') { p.textContent += ' · Direct transaction and indexed escrow ownership verified. Public trading remains disabled.'; return }
  if (row.state === 'wrapped-unverified') { p.textContent += ' · MetaMask wrapped this deposit. Do not retry; inspect ownership and the escrow record.'; return }
  if (row.state === 'failed') return
  var input = document.createElement('input'), b = document.createElement('button'); input.type = 'text'; input.value = row.hash || ''; input.placeholder = '0x escrow-test transaction hash'; input.setAttribute('aria-label', 'Escrow test transaction hash'); b.textContent = 'VERIFY ESCROW TEST'
  b.onclick = async function () { b.disabled = true; try { var result = await test.check(input.value.trim()); say(result.state === 'verified' ? '#6 deposit verified: direct transaction, escrow record, indexed custody and cooldown agree.' : 'Escrow test result: ' + result.state + '. Do not repeat the request.'); saved() } catch (e) { say(e.message); b.disabled = false } }
  host.append(input, b)
 }
 function review(q) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), p = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'); host.hidden = false; host.textContent = ''
   p.textContent = 'Transfer CLEAN POP #6 from ' + q.from + ' to existing escrow ' + q.to + '. Value: 0 ETH; network gas applies. Read-only estimate: ' + q.estimatedGas + ' gas units. MetaMask determines the final fee. The deployed escrow source is verified on Sourcify. In MetaMask, inspect the transaction destination and calldata: approve only if the outer transaction is the exact direct escrow transfer. If MetaMask shows Added Protection wrapping it through DelegationManager/redeemDelegations, cancel; it will not transfer the Ethscription. This is an experimental real deposit, not a sale.'
   var checkLabel = document.createElement('label'), directCheck = document.createElement('input')
   directCheck.type = 'checkbox'; directCheck.style.width = 'auto'
   checkLabel.append(directCheck, document.createTextNode(' I reviewed the MetaMask transaction details: recipient is the escrow address above, calldata is the #6 Ethscription ID, and MetaMask has not replaced the request with DelegationManager / redeemDelegations. I will cancel if they differ.'))
   approve.textContent = 'APPROVE #6 ESCROW TEST IN WALLET'; cancel.textContent = 'CANCEL'
   approve.disabled = true; directCheck.onchange = function () { approve.disabled = !directCheck.checked }
   approve.onclick = function () {
    approve.disabled = true; cancel.disabled = true; say('Escrow request sent to the selected wallet. Do not repeat it.')
    var timer = setTimeout(function () { say('The selected wallet has not answered. Request status is shown below; no transaction hash has been returned. Do not retry.') }, 12000)
    q.approve().then(function (row) { clearTimeout(timer); host.hidden = true; resolve(row) }, function (e) { clearTimeout(timer); host.hidden = true; reject(e) }); saved()
   }
   cancel.onclick = function () { host.hidden = true; reject(Error('Cancelled before requesting a wallet transaction.')) }
   host.append(p, checkLabel, approve, cancel); say('Review the MetaMask transaction details. Check the confirmation only if the wallet shows the exact direct escrow call.'); directCheck.focus()
  })
 }
 el('connect').onclick = async function () {
  busy = true; test = null; controls(); el('wallets').textContent = ''
  try {
   say('Select MetaMask below. Connecting sends no transaction.')
   var provider = await EthscriptionCheckout.choose(el('wallets'), say), trace = WalletRequestTrace.create(provider, function (rows) { requestRows = rows; renderTrace() })
   await EthscriptionCheckout.ensureChain(trace.provider)
   test = CleanPop6EscrowTest.create({ provider: trace.provider, storage: localStorage, locks: navigator.locks, report: say, readStatus: function () { return get('https://api.ethscriptions.com/v2/status') }, readAsset: async function (id) { return (await get('https://api.ethscriptions.com/v2/ethscriptions/' + id)).result } })
   saved(); earlier(); say(test.saved() ? 'A saved escrow test must be checked before continuing.' : test.earlierRoutes().length ? 'Clear the confirmed no-hash route-test record below; this check sends no transaction.' : 'Wallet connected. Run the read-only #6 checks; the actual escrow request is only made after you review and explicitly approve it.')
  } catch (e) { say(e.message || 'Wallet connection failed.') } finally { busy = false; controls() }
 }
 el('prepare').onclick = async function () {
  if (busy || !test) return; busy = true; controls()
  try { say('Checking wallet, earlier requests, indexed ownership, escrow record and simulation…'); var row = await test.run(review); say('Escrow test submitted: ' + row.hash + '. Wait for confirmation, then verify the result.'); saved() }
  catch (e) { say(e.message || 'Escrow test could not be prepared.'); saved(); earlier() } finally { busy = false; controls() }
 }
 controls()
})()
