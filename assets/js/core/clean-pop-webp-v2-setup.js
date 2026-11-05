(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, info, client, connection, saleControl = CleanPopControl.createWebpV2(), salePlan
 var say = function (message) { el('status').textContent = message }
 function showSaved() {
  var row = client && client.saved(); el('saved').hidden = !row
  if (!row) return
  el('savedStatus').textContent = 'State: ' + row.state + (row.hash ? ' · ' + row.hash : ' · no transaction hash returned')
  el('hash').value = row.hash || ''; el('unsent').hidden = row.state !== 'awaiting-wallet' || !!row.hash
 }
 function review(q) {
  return new Promise(function (resolve, reject) {
   el('quote').textContent = 'Creator: ' + q.creator + '\nNew contract: ' + q.address + '\nArtwork root: ' + q.root + '\nMint: ' + ethers.utils.formatEther(q.priceWei) + ' ETH · wallet limit: ' + q.maxPerWallet + '\nEstimated deployment fee: ' + ethers.utils.formatEther(q.estimatedCostWei) + ' ETH · final fee appears in your wallet.\nAll 10,000 numbers eligible; starts paused.'
   el('review').hidden = false; say('Review the terms below. No transaction has been requested.')
   el('approve').disabled = false; el('cancel').disabled = false
   el('approve').onclick = function () { el('approve').disabled = true; el('cancel').disabled = true; say('Open the creator wallet to approve or reject. Do not submit again.'); q.approve().then(function (row) { el('review').hidden = true; resolve(row) }, function (error) { el('review').hidden = true; reject(error) }) }
   el('cancel').onclick = function () { el('review').hidden = true; reject(Error('Deployment cancelled. No transaction was requested.')) }
  })
 }
 el('connect').onclick = async function () {
  el('connect').disabled = true; el('walletChoices').textContent = ''
  try {
   var provider = await EthscriptionCheckout.choose(el('walletChoices'), say); await EthscriptionCheckout.ensureChain(provider)
   var accounts = await provider.request({ method: 'eth_accounts' }); if (!accounts || !accounts[0] || accounts[0].toLowerCase() !== info.creator.toLowerCase()) throw Error('Connect the configured creator wallet ' + info.creator + '.')
   connection = provider; client = CleanPopWebpV2Deployment.create({ provider: provider, storage: localStorage, locks: navigator.locks, artifact: info })
   el('prepare').disabled = false; showSaved(); say('Creator wallet connected. Review deployment to simulate and estimate the fee.')
  } catch (error) { connection = null; client = null; el('prepare').disabled = true; say(error.message) } finally { el('connect').disabled = false }
 }
 el('prepare').onclick = async function () {
  if (!client) return; el('prepare').disabled = true
  try { say('Checking factory, address and fee. No transaction requested…'); var row = await client.run(review); say('Deployment submitted: ' + row.hash + '. Verify it below before continuing.'); showSaved() }
  catch (error) { say(error.message); showSaved() } finally { el('prepare').disabled = false }
 }
 el('check').onclick = async function () { el('check').disabled = true; try { var result = await client.check(el('hash').value.trim()); say(result.failed ? 'Deployment failed. Inspect wallet activity before retrying.' : 'Exact contract and terms verified at ' + result.address + '. Public mint is ' + (result.paused ? 'paused.' : 'open.')); el('saleControls').hidden = !result.confirmed; showSaved() } catch (error) { say(error.message) } finally { el('check').disabled = false } }
 el('recover').onclick = async function () { el('recover').disabled = true; try { await client.recoverUnsent(el('confirmed').checked); say('Unsent deployment request checked and cleared. No transaction sent.'); showSaved() } catch (error) { say(error.message) } finally { el('recover').disabled = false } }
 function saleRecovery() { var row = saleControl.saved(); el('saleUnsent').hidden = !(row && row.state === 'awaiting-wallet' && !row.hash); if (row && row.hash) el('saleHash').value = row.hash }
 el('prepareSale').onclick = async function () {
  el('prepareSale').disabled = true; salePlan = null; el('saleReview').hidden = true
  try { var result = await saleControl.prepare(connection, info); if (result.alreadyOpen) el('saleStatus').textContent = 'Public mint is already open.'; else { salePlan = result; el('saleQuote').textContent = 'Contract: ' + info.address + '\nEstimated opening fee: ' + ethers.utils.formatEther(result.estimatedGasWei) + ' ETH. This opens public minting for everyone; final fee appears in your wallet.'; el('saleReview').hidden = false; el('saleStatus').textContent = 'Review the opening transaction. No transaction requested yet.' } }
  catch (error) { el('saleStatus').textContent = error.message } finally { el('prepareSale').disabled = false; saleRecovery() }
 }
 el('approveSale').onclick = async function () { el('approveSale').disabled = true; try { var result = await saleControl.submit(connection, info, salePlan); el('saleHash').value = result.hash; el('saleReview').hidden = true; salePlan = null; el('saleStatus').textContent = 'Opening submitted: ' + result.hash + '. Check it before proceeding.' } catch (error) { el('saleStatus').textContent = error.message } finally { el('approveSale').disabled = false; saleRecovery() } }
 el('cancelSale').onclick = function () { salePlan = null; el('saleReview').hidden = true; el('saleStatus').textContent = 'Opening cancelled. No transaction requested.' }
 el('checkSale').onclick = async function () { el('checkSale').disabled = true; try { var result = await saleControl.check(connection, info, el('saleHash').value.trim()); el('saleStatus').textContent = result.state === 'confirmed' ? 'Opening confirmed. Public mint is open.' : 'Opening failed. Inspect wallet activity.' } catch (error) { el('saleStatus').textContent = error.message } finally { el('checkSale').disabled = false; saleRecovery() } }
 el('recoverSale').onclick = async function () { el('recoverSale').disabled = true; try { await saleControl.recoverUnsent(connection, info, el('saleConfirmed').checked); el('saleStatus').textContent = 'Unsent opening checked and cleared. No transaction sent.' } catch (error) { el('saleStatus').textContent = error.message } finally { el('recoverSale').disabled = false; saleRecovery() } }
 fetch('/assets/data/clean-pop-webp-v2-candidate.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) }).then(function (response) { if (!response.ok) throw Error('Candidate artifact unavailable.'); return response.json() }).then(function (value) {
  info = value
  if (!navigator.locks || !info || info.version !== 'clean-pop-webp-v2-candidate') throw Error('Candidate or browser transaction coordination unavailable.')
  el('terms').textContent = 'Creator: ' + info.creator + '\nSite wallet: ' + info.site + '\nMint price: 0.0002 ETH + gas\nSplit: 99.5% creator / 0.5% site\nWallet limit: 20\nReservation: none\nArtwork root: ' + info.root + '\nPredicted contract: ' + info.address
  el('connect').disabled = false; say('Ready to connect the creator wallet. No transaction requested.')
 }).catch(function (error) { say(error.message) })
})()
