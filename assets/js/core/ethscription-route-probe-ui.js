(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, connection, busy = false
 function say(value) { el('status').textContent = value }
 function controls() { el('connect').disabled = busy; el('check').disabled = busy || !connection }
 el('connect').onclick = async function () {
  busy = true; connection = null; controls()
  try {
   var injected = window.ethereum, providers = injected && Array.isArray(injected.providers) ? injected.providers : injected ? [injected] : []
   if (providers.length === 1 && providers[0] && typeof providers[0].request === 'function') { var accounts = await EthscriptionCheckout.requestAccounts(providers[0]); await EthscriptionCheckout.ensureChain(providers[0]); connection = { provider: providers[0], address: accounts[0] } }
   else { var settings = await fetch('/api/ethscriptions', { cache: 'no-store' }).then(function (r) { return r.json() }).catch(function () { return {} }); EthscriptionCheckout.configure(settings.walletConnectProjectId || ''); connection = await EthscriptionCheckout.connect(el('wallets'), say) }
   say('Wallet connected. Run the no-transaction compatibility check.')
  } catch (e) { say(e.message || 'Wallet connection failed.') } finally { busy = false; controls() }
 }
 el('check').onclick = async function () {
  if (busy || !connection) return; busy = true; controls()
  try {
   say('Checking wallet capabilities without submitting a transaction…')
   var report = await EthscriptionRouteProbe.inspect(connection.provider), output = el('result')
   output.hidden = false; output.textContent = 'Account: ' + report.account + '\nDelegated account: ' + (report.delegated ? 'yes' : 'no') + '\nDelegate-call mode: ' + (report.delegateCallSupported === null ? 'unknown' : report.delegateCallSupported ? 'supported' : 'not supported') + '\nDirect transaction signing probe: ' + report.signTransactionProbe + '\nEthscription deposit compatibility: NOT YET PROVEN'
   say('Check complete. No transaction was sent and no gas was spent.')
  } catch (e) { say(e.message || 'Compatibility check unavailable.') } finally { busy = false; controls() }
 }
 controls()
})()
