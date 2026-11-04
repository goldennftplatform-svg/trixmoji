(function () {
 'use strict'
 var owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', escrow = '0xd935E162B6070C4FEAF600c67f7F729f318515a2', assetId = '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74', originalHash = '0x48ff06edf9d3038bba749a56ec3832d5c73cf399edf099a83e0ab18712b872a8', depositBlock = 26337993
 var expectedRuntimeHash = '0x773514ab71d5c588d5c83a4866beb041dabd069ef142f9eb46584dff72cf7e36', storageKey = 'trixmoji.clean-pop.6.ghost-recovery.v2.' + originalHash, marketKey = 'trixmoji.market.contract.transaction.v1', experimentKey = 'trixmoji.clean-pop.6.direct-escrow-test.v1', connection, iface, busy = false
 var el = function (id) { return document.getElementById(id) }, same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }, say = function (s) { el('status').textContent = s }
 function saved() { return JSON.parse(localStorage.getItem(storageKey) || 'null') }
 function controls() { el('connect').disabled = busy; el('prepare').disabled = busy || !connection || !!saved() }
 async function rpc(method, params) { return connection.provider.request({ method: method, params: params || [] }) }
 async function contractRead(name, args) { return iface.decodeFunctionResult(name, await rpc('eth_call', [{ to: escrow, data: iface.encodeFunctionData(name, args) }, 'latest'])) }
 async function indexedState(minimumBlock) {
  var results = await Promise.all([fetch('https://api.ethscriptions.com/v2/status', { cache: 'no-store', signal: AbortSignal.timeout(12000) }), fetch('https://api.ethscriptions.com/v2/ethscriptions/' + assetId, { cache: 'no-store', signal: AbortSignal.timeout(12000) }), rpc('eth_blockNumber')])
  if (!results[0].ok || !results[1].ok) throw Error('Ethscriptions verification is unavailable.')
  var status = await results[0].json(), asset = (await results[1].json()).result, head = Number(BigInt(results[2])), indexed = Number(status.last_imported_block)
  if (!Number.isSafeInteger(indexed) || indexed < head - 2 || indexed < minimumBlock) throw Error('The indexer is still catching up. Wait and check again.')
  if (!asset || !same(asset.transaction_hash, assetId) || !same(asset.current_owner, owner)) throw Error('The indexer does not currently show #6 in this wallet. Stop and inspect ownership.')
  return asset
 }
 async function verifyOriginal() {
  var result = await Promise.all([rpc('eth_getTransactionByHash', [originalHash]), rpc('eth_getTransactionReceipt', [originalHash])]), tx = result[0], receipt = result[1], found = false
  if (!tx || !receipt || !same(tx.hash, originalHash) || !same(receipt.transactionHash, originalHash) || receipt.status !== '0x1' || !same(tx.from, owner) || same(tx.to, escrow) || Number(BigInt(receipt.blockNumber)) !== depositBlock) throw Error('The original delegated transaction did not match the expected record.')
  for (var log of receipt.logs || []) { if (!same(log.address, escrow)) continue; try { var event = iface.parseLog(log); if (event.name === 'Deposited' && same(event.args.seller, owner) && same(event.args.id, assetId)) found = true } catch (_) {} }
  if (!found) throw Error('The expected original escrow event was not found.')
 }
 async function check() {
  await EthscriptionCheckout.identity(connection.provider, owner)
  var code = await rpc('eth_getCode', [escrow, 'latest'])
  if (!code || code === '0x' || !same(ethers.utils.keccak256(code), expectedRuntimeHash)) throw Error('Escrow runtime does not match the verified deployment.')
  await verifyOriginal(); await indexedState(depositBlock + 5)
  var states = await Promise.all([contractRead('depositBlock', [owner, assetId]), contractRead('listings', [owner, assetId]), contractRead('auctions', [owner, assetId])])
  if (!states[0][0].eq(depositBlock)) throw Error('The escrow record changed. Stop and inspect it before continuing.')
  if (!states[1].price.isZero() || (!states[2].end.isZero() && !states[2].settled)) throw Error('An active listing or auction exists. Stop and inspect it before continuing.')
 }
 async function verifyRecovery(row) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(row.hash || ''))) throw Error('Enter the recovery transaction hash from wallet Activity.')
  await EthscriptionCheckout.identity(connection.provider, owner)
  var receipt = await rpc('eth_getTransactionReceipt', [row.hash]); if (!receipt) throw Error('Recovery is not confirmed yet. Do not submit another.')
  if (!same(receipt.transactionHash, row.hash) || Number(BigInt(receipt.blockNumber)) <= depositBlock) throw Error('This recovery receipt predates the current false deposit record.')
  if (receipt.status !== '0x1') throw Error('Recovery transaction did not succeed. Check wallet Activity.')
  var match = false
  for (var log of receipt.logs || []) { if (!same(log.address, escrow)) continue; try { var event = iface.parseLog(log); if (event.name === 'Cancelled' && same(event.args.seller, owner) && same(event.args.id, assetId)) match = true } catch (_) {} }
  if (!match) throw Error('This receipt does not contain the expected recovery event.')
  var state = await contractRead('depositBlock', [owner, assetId]); if (!state[0].isZero()) throw Error('The escrow record is still present. Do not retry.')
  await indexedState(Number(BigInt(receipt.blockNumber)))
  var raw = localStorage.getItem(marketKey), records = JSON.parse(raw || '[]')
  if (!Array.isArray(records)) throw Error('Saved market records are invalid. Do not retry.')
  records.forEach(function (r) { if (r.action === 'deposit' && same(r.assetId, assetId) && same(r.from, owner) && same(r.to, escrow) && same(r.data, assetId) && (same(r.hash, originalHash) || (!r.hash && String(r.startingNonce) === '569'))) { r.state = 'failed'; r.resolution = 'Wrapped deposit did not transfer the Ethscription; false contract record cleared by ' + row.hash } })
  if (localStorage.getItem(marketKey) !== raw) throw Error('Saved market records changed. Reload and inspect them.')
  var experimentRaw = localStorage.getItem(experimentKey), experiment = JSON.parse(experimentRaw || 'null')
  if (experiment && same(experiment.from, owner) && same(experiment.to, escrow) && same(experiment.data, assetId) && (same(experiment.hash, originalHash) || (!experiment.hash && String(experiment.startingNonce) === '569'))) {
   localStorage.setItem(experimentKey + '.archive.' + Date.now(), JSON.stringify({ original: experiment, resolvedBy: row.hash, reason: 'wrapped deposit record cleared; experiment closed' }))
   experiment.state = 'recovered'; experiment.recoveryHash = row.hash; localStorage.setItem(experimentKey, JSON.stringify(experiment))
  }
  localStorage.setItem(marketKey, JSON.stringify(records)); row.state = 'confirmed'; localStorage.setItem(storageKey, JSON.stringify(row)); return true
 }
 function showSaved() {
  var box = el('saved'), row = saved(); box.hidden = !row; box.textContent = ''
  if (!row) return
  var p = document.createElement('p'); p.textContent = row.state === 'confirmed' ? 'Recovery confirmed. The escrow record is clear and #6 is still indexed to this wallet.' : 'Saved recovery: ' + (row.hash || 'no hash returned. Check wallet Activity; do not submit again.'); box.appendChild(p)
  if (row.state !== 'confirmed') { var input = document.createElement('input'), button = document.createElement('button'); input.placeholder = 'Recovery transaction hash'; input.value = row.hash || ''; button.textContent = 'CHECK RECOVERY'; button.onclick = async function () { button.disabled = true; try { await verifyRecovery(Object.assign({}, row, { hash: input.value.trim() })); say('Recovery confirmed. The false record is cleared.'); showSaved() } catch (e) { say(e.message); button.disabled = false } }; box.append(input, button) }
 }
 el('connect').onclick = async function () {
  busy = true; controls(); try { el('wallets').textContent = ''; var provider = await EthscriptionCheckout.choose(el('wallets'), say)
   var accounts = await provider.request({ method: 'eth_accounts' }); await EthscriptionCheckout.ensureChain(provider); if (!accounts || !same(accounts[0], owner)) throw Error('Connect wallet ' + owner + '.')
   connection = { provider: provider, address: accounts[0] }; var artifact = await fetch('/assets/data/trixmoji-escrow-artifact.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw Error('Escrow ABI unavailable.'); return r.json() }); iface = new ethers.utils.Interface(artifact.abi)
   showSaved(); say('Wallet connected. Check and prepare the recovery.')
  } catch (e) { connection = null; say(e.message) } finally { busy = false; controls() }
 }
 el('prepare').onclick = async function () {
  if (busy) return; busy = true; controls()
  try {
   if (!navigator.locks) throw Error('Use a browser with Web Locks support.')
   await navigator.locks.request(marketKey, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('Another market request is in progress. Finish it first.')
    if (saved()) throw Error('A recovery request is already saved. Check wallet Activity before proceeding.')
    say('Checking the original transaction, current ownership and escrow record…'); await check()
    var nonces = await Promise.all([rpc('eth_getTransactionCount', [owner, 'latest']), rpc('eth_getTransactionCount', [owner, 'pending'])]); if (BigInt(nonces[0]) !== BigInt(nonces[1])) throw Error('This wallet has a pending transaction. Resolve it before recovery.')
    var tx = { from: owner, to: escrow, value: '0x0', data: iface.encodeFunctionData('cancel', [assetId]) }, gas = ethers.BigNumber.from(await rpc('eth_estimateGas', [tx]))
    tx.gas = ethers.utils.hexValue(gas.mul(12).div(10)); tx.chainId = '0x1'
    await new Promise(function (resolve, reject) {
     var box = el('review'), text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button'), invalid = false, started = Date.now()
     function changed() { invalid = true } if (connection.provider.on) { connection.provider.on('accountsChanged', changed); connection.provider.on('chainChanged', changed) }
     function finish() { if (connection.provider.removeListener) { connection.provider.removeListener('accountsChanged', changed); connection.provider.removeListener('chainChanged', changed) } box.hidden = true }
     box.hidden = false; box.textContent = ''; text.textContent = 'Clear the false #6 deposit record in escrow. The piece currently remains in ' + owner + '. Value: 0 ETH. Estimated gas: ' + gas.toString() + ' units; your wallet shows the final fee.'
     approve.textContent = 'APPROVE RECOVERY IN WALLET'; cancel.textContent = 'CANCEL'
     approve.onclick = function () {
      if (invalid || Date.now() - started > 60000) { finish(); reject(Error('Wallet or review changed. Prepare recovery again.')); return }
      approve.disabled = true; cancel.disabled = true
      var row = { state: 'awaiting-wallet', hash: '', startingNonce: BigInt(nonces[0]).toString() }
      try { localStorage.setItem(storageKey, JSON.stringify(row)) } catch (_) { finish(); reject(Error('Browser storage is unavailable. No recovery was requested.')); return }
      say('Waiting for wallet approval. Do not submit another recovery.')
      connection.provider.request({ method: 'eth_sendTransaction', params: [tx] }).then(function (hash) { if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('Wallet returned no hash. Check Activity; do not retry.'); row.hash = hash; row.state = 'submitted'; localStorage.setItem(storageKey, JSON.stringify(row)); finish(); showSaved(); say('Recovery submitted: ' + hash + '. Use CHECK RECOVERY after confirmation.'); resolve() }).catch(function (e) { if (Number(e && e.code) === 4001) localStorage.removeItem(storageKey); finish(); showSaved(); reject(e) })
     }
     cancel.onclick = function () { finish(); reject(Error('Cancelled. No transaction was requested.')) }
     box.append(text, approve, cancel); say('Review the recovery before requesting wallet approval.'); approve.focus()
    })
   })
  } catch (e) { say(e.message || 'Recovery could not be prepared.'); showSaved() } finally { busy = false; controls() }
 }
showSaved(); controls()
})()
