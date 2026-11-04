(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, busy = false, client, artifact, deployment
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function say(s) { el('status').textContent = s }
 async function get(url) { var r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(25000) }), data = await r.json(); if (!r.ok || data.ok === false) throw Error(data.error || 'Market request unavailable.'); return data }
 async function configure() {
  var connection = MarketWalletConnector.current(); if (!connection) throw Error('Connect your wallet first.')
  if (!artifact) { var values = await Promise.all([get('/assets/data/trixmoji-escrow-replacement-artifact.json'), get('/assets/data/trixmoji-escrow-replacement-deployment.json')]); artifact = values[0]; deployment = values[1] }
  if (!same(deployment.address, '0x21c1A938d06f87A039abfC48d1cCB459f55b1685') || !same(deployment.runtimeHash, '0x509d4162264a94c741c00f6acfdd096aba84b6c03ca90db29bfe1043e89cd22e')) throw Error('Replacement deployment configuration mismatch.')
  client = TrixmojiMarketWallet.create({ provider: connection.provider, storage: localStorage, locks: navigator.locks, abi: artifact.abi, market: deployment.address, runtimeHash: deployment.runtimeHash, creator: deployment.creator, verifier: deployment.verifier, chainId: 1, minter: '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC', combinedDepositEnabled: true, readAsset: async function (id) { return (await get('https://api.ethscriptions.com/v2/ethscriptions/' + id)).result } })
  return connection
 }
 function review(q, amountWei) { return new Promise(function (resolve, reject) {
  var host = el('review'), text = document.createElement('p'), yes = document.createElement('button'), no = document.createElement('button'); host.textContent = ''; host.hidden = false
  text.textContent = 'Deposit and list ' + q.assetId + ' in replacement escrow ' + q.to + '. Sale price: ' + ethers.utils.formatEther(amountWei) + ' ETH. Transaction value: 0 ETH plus gas. If your wallet wraps the transaction, the Ethscription may remain in your wallet while the contract records a deposit.'
  yes.textContent = 'REQUEST WALLET APPROVAL'; no.textContent = 'CANCEL'
  yes.onclick = function () { yes.disabled = true; no.disabled = true; say('Waiting for wallet. Do not repeat.'); q.approve().then(function (row) { host.hidden = true; resolve(row) }, function (error) { host.hidden = true; reject(error) }) }
  no.onclick = function () { host.hidden = true; reject(Error('Cancelled; no transaction requested.')) }; host.append(text, yes, no)
 }) }
 async function verify(row, receipt) {
  var iface = new ethers.utils.Interface(artifact.abi), found = (receipt.logs || []).some(function (log) { if (!same(log.address, deployment.address)) return false; try { var e = iface.parseLog(log); return e.name === 'Deposited' && same(e.args.seller, row.from) && same(e.args.id, row.assetId) } catch (_) { return false } })
  if (!found) return false
  var result = await get('/.netlify/functions/trixmoji-market-replacement')
  return (result.listings || []).some(function (item) { return same(item.id, row.assetId) && same(item.seller, row.from) })
 }
 function saved() {
  var host = el('saved'); host.textContent = ''; if (!client) return
  client.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }).forEach(function (row) {
   var p = document.createElement('p'), input = document.createElement('input'), button = document.createElement('button'); p.textContent = 'Saved ' + row.action + ': ' + (row.hash || 'no hash returned; check wallet activity before retrying')
   input.value = row.hash || ''; input.placeholder = 'Transaction hash'; button.textContent = 'CHECK SAVED TRANSACTION'
   button.onclick = async function () { button.disabled = true; try { await client.reconcile(Object.assign({}, row, { hash: input.value.trim() }), verify); say('Direct deposit, indexed custody and listing verified.'); saved(); await refresh() } catch (error) { say(error.message); button.disabled = false } }
   host.append(p, input, button)
  })
 }
 async function refresh() { try { var data = await get('/.netlify/functions/trixmoji-market-replacement'); el('listings').textContent = JSON.stringify({ marketAddress: data.marketAddress, tradingReady: data.tradingReady, listings: data.listings }, null, 2) } catch (error) { say(error.message) } }
 el('prepare').onclick = async function () { if (busy) return; busy = true; try {
  await configure(); saved(); var health = await get('/.netlify/functions/trixmoji-market-replacement?health=1'); if (!health.tradingReady || !same(health.marketAddress, deployment.address)) throw Error('Replacement market verifier is not ready.')
  var price = ethers.utils.parseEther(el('price').value.trim()); if (price.lte(0)) throw Error('Enter a positive sale price.')
  say('Checking owner, replacement contract, pending transactions and gas…'); var row = await client.run('depositAndList', { id: el('asset').value.trim(), amountWei: price.toString() }, function (q) { return review(q, price) }); say('Submitted ' + row.hash + '. Wait for indexer and cooldown, then check the saved transaction.'); saved()
 } catch (error) { say(error.message || 'Could not prepare the test.'); saved() } finally { busy = false } }
 el('refresh').onclick = refresh
 window.addEventListener('market-wallet-change', function () { configure().then(saved).catch(function (error) { say(error.message) }) })
 refresh()
})()
