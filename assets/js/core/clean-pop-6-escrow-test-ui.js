(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, test, busy = false
 function say(s) { el('status').textContent = s }
 function controls() { el('connect').disabled = busy; el('prepare').disabled = busy || !test || !!test.saved() }
 async function get(url) { var r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!r.ok) throw Error('Indexer unavailable: HTTP ' + r.status); return r.json() }
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
   p.textContent = 'Transfer CLEAN POP #6 from ' + q.from + ' to existing escrow ' + q.to + '. Value: 0 ETH; network gas applies. Read-only estimate: ' + q.estimatedGas + ' gas units. MetaMask determines the final fee. This is an experimental real deposit, not a sale.'
   approve.textContent = 'APPROVE #6 ESCROW TEST IN WALLET'; cancel.textContent = 'CANCEL'
   approve.onclick = function () {
    approve.disabled = true; cancel.disabled = true; say('Escrow request sent to the selected wallet. Do not repeat it.')
    var timer = setTimeout(function () { say('The selected wallet has not answered. Request status is shown below; no transaction hash has been returned. Do not retry.') }, 12000)
    q.approve().then(function (row) { clearTimeout(timer); host.hidden = true; resolve(row) }, function (e) { clearTimeout(timer); host.hidden = true; reject(e) }); saved()
   }
   cancel.onclick = function () { host.hidden = true; reject(Error('Cancelled before requesting a wallet transaction.')) }
   host.append(p, approve, cancel); say('Review the experimental #6 deposit before approving.'); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  busy = true; test = null; controls(); el('wallets').textContent = ''
  try {
   say('Select MetaMask below. Connecting sends no transaction.')
   var provider = await EthscriptionCheckout.choose(el('wallets'), say), trace = WalletRequestTrace.create(provider, function (rows) { el('walletTrace').textContent = JSON.stringify(rows, null, 2) })
   await EthscriptionCheckout.ensureChain(trace.provider)
   test = CleanPop6EscrowTest.create({ provider: trace.provider, storage: localStorage, locks: navigator.locks, readStatus: function () { return get('https://api.ethscriptions.com/v2/status') }, readAsset: async function (id) { return (await get('https://api.ethscriptions.com/v2/ethscriptions/' + id)).result } })
   saved(); say('Selected wallet connected. Check #6 and prepare the escrow test; no transaction has been requested.')
  } catch (e) { say(e.message || 'Wallet connection failed.') } finally { busy = false; controls() }
 }
 el('prepare').onclick = async function () {
  if (busy || !test) return; busy = true; controls()
  try { say('Checking wallet, earlier requests, indexed ownership, escrow record and simulation…'); var row = await test.run(review); say('Escrow test submitted: ' + row.hash + '. Wait for confirmation, then verify the result.'); saved() }
  catch (e) { say(e.message || 'Escrow test could not be prepared.'); saved() } finally { busy = false; controls() }
 }
 controls()
})()
