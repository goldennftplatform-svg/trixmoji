(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, artifact, connection, deployer, busy = false
 var creator = '0x915A3D363D0a4e4470B531f008F5142c540E5417', verifier = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4'
 var expectedHash = '0xc18f4597e4b6f88db18ca526cefda84615bc18159f7b3545bd2029bb9c2aa468'
 var same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 var say = function (text) { el('status').textContent = text }
 function updateSaved() {
  var row = deployer && deployer.saved(); el('saved').hidden = !row
  if (!row) return
  el('savedDetails').textContent = 'State: ' + row.state + ' · Creator: ' + row.creator + ' · Verifier: ' + row.verifier + (row.address ? ' · Contract: ' + row.address : '')
  if (row.hash) el('hash').value = row.hash
  el('check').disabled = !connection || busy
  el('recovery').hidden = row.state !== 'awaiting-wallet' || !!row.hash
  el('recover').disabled = !connection || busy
 }
 function controls() { el('connect').disabled = busy || !artifact; el('prepare').disabled = busy || !connection || !deployer; updateSaved() }
 function review(quote) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), text = document.createElement('p'), warning = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'); host.textContent = ''; host.hidden = false
   text.textContent = 'Creator: ' + quote.creator + ' · Verifier: ' + quote.verifier + ' · Network: Ethereum mainnet · Predicted address: ' + quote.predictedAddress + ' · Estimated gas: ' + quote.estimatedGas + ' · Approximate gas cost: ' + EthscriptionCheckout.eth(quote.estimatedGasCostWei) + ' ETH. The wallet shows final fees.'
   warning.textContent = 'The verifier address is immutable. Deployment does not start the signing service or make marketplace sales ready.'
   approve.type = 'button'; approve.textContent = 'APPROVE DEPLOYMENT IN WALLET'; cancel.type = 'button'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; say('Deployment approval requested from the creator wallet. Do not submit another.'); quote.approve().then(function (row) { host.hidden = true; host.textContent = ''; resolve(row) }, function (error) { host.hidden = true; host.textContent = ''; reject(error) }) }
   cancel.onclick = function () { host.hidden = true; host.textContent = ''; reject(Error('Deployment cancelled. No transaction sent.')) }
   host.append(text, warning, approve, cancel); say('Review the constructor addresses and gas, then approve in the creator wallet.'); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  busy = true; connection = null; deployer = null; controls()
  try {
   var injected = window.ethereum, providers = injected && Array.isArray(injected.providers) ? injected.providers : injected ? [injected] : []
   if (providers.length === 1 && providers[0] && typeof providers[0].request === 'function') {
    say('Approve the creator-wallet connection if requested.')
    var accounts = await EthscriptionCheckout.requestAccounts(providers[0]); await EthscriptionCheckout.ensureChain(providers[0]); connection = { provider: providers[0], address: accounts[0] }
   } else {
    var settings = await fetch('/api/ethscriptions', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json() }).catch(function () { return {} })
    EthscriptionCheckout.configure(settings.walletConnectProjectId || ''); connection = await EthscriptionCheckout.connect(el('wallets'), say)
   }
   if (!same(connection.address, creator)) { connection = null; throw Error('Connect creator wallet ' + creator) }
   deployer = TrixmojiEscrowDeployment.create({ provider: connection.provider, storage: localStorage, locks: navigator.locks, artifact: artifact, creator: creator, verifier: verifier, chainId: 1, expectedBytecodeHash: expectedHash })
   say('Creator connected. Confirm the verifier address and prepare the deployment.')
  } catch (error) { say(error.message) } finally { busy = false; controls() }
 }
 el('prepare').onclick = async function () {
  if (busy) return; busy = true; controls()
  try {
   if (!el('confirmed').checked) throw Error('Confirm control of the displayed verifier address first.')
   say('Checking creator, network, pending transactions, bytecode and estimated deployment gas…')
   var row = await deployer.run(review)
   el('hash').value = row.hash; say('Deployment submitted: ' + row.hash + '. Do not deploy again; verify this transaction after confirmation.')
  } catch (error) { say(error.message) } finally { busy = false; controls() }
 }
 el('check').onclick = async function () {
  busy = true; controls()
  try {
   var result = await deployer.check(el('hash').value.trim())
   if (result.failed) say('Deployment transaction failed. Check wallet Activity before retrying.')
   else say('Deployment confirmed: ' + result.address + '. Creator, verifier and 2.5% royalty match. Runtime hash: ' + result.runtimeHash + '. The verifier service and indexer still need production setup.')
  } catch (error) { say(error.message) } finally { busy = false; controls() }
 }
 el('recover').onclick = async function () {
  busy = true; controls()
  try { await deployer.recoverUnsent(el('recoveryConfirmed').checked); say('No-hash deployment intent archived and cleared. No transaction sent.') }
  catch (error) { say(error.message) } finally { busy = false; controls() }
 }
 fetch('/assets/data/trixmoji-escrow-artifact.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) }).then(function (r) { if (!r.ok) throw Error('Reviewed escrow artifact unavailable.'); return r.json() }).then(function (data) {
  if (data.version !== 'trixmoji-escrow-v1' || data.chainId !== 1 || !same(data.creator, creator) || !same(data.verifier, verifier) || !same(data.bytecodeHash, expectedHash) || !same(ethers.utils.keccak256(data.bytecode), expectedHash)) throw Error('Escrow deployment artifact does not match the reviewed build.')
  artifact = data; el('details').textContent = 'Network: Ethereum mainnet\nCreator / royalty recipient: ' + creator + '\nImmutable verifier: ' + verifier + '\nRoyalty: 2.5%\nReviewed creation bytecode hash: ' + expectedHash
  say('Connect the creator wallet. No transaction has been requested.'); controls()
 }).catch(function (error) { say(error.message) })
})()
