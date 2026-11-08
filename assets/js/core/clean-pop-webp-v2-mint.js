(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, client = CleanPopCheckout.createWebpV2()
 var info, manifest, connection = null, paused = true, deployed = false, busy = false, page = 0, selected = {}, pageSize = 40
 var same = function (a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 var say = function (message) { el('status').textContent = message }
 function pending() { return client.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }) }
 function selection() { return Object.keys(selected).map(Number).sort(function (a, b) { return a - b }) }
 function controls() {
  el('selected').textContent = 'SELECTED ' + selection().length + ' / 20'
  el('mint').disabled = busy || !connection || !deployed || paused || !selection().length || pending().length > 0
  el('connect').disabled = busy
 }
 function draw() {
  var grid = el('grid'); grid.textContent = ''
  var completed = {}; client.records().forEach(function (r) { if (r.state === 'complete') completed[r.tokenNo] = true })
  var start = page * pageSize, end = Math.min(start + pageSize, 10000)
  for (var i = start; i < end; i++) {
   var card = document.createElement('button'), cover = document.createElement('span'), label = document.createElement('span')
   card.type = 'button'; card.className = 'cover' + (selected[i] ? ' selected' : ''); card.disabled = !!completed[i] || busy
   card.setAttribute('aria-pressed', String(!!selected[i])); cover.className = 'blank'; cover.textContent = 'UNREVEALED'
   label.className = 'label'; label.textContent = 'CLEAN POP #' + i + (completed[i] ? ' · MINTED' : selected[i] ? ' · SELECTED' : ' · SELECT TO CHECK')
   ;(function (token) { card.onclick = function () { if (selected[token]) delete selected[token]; else if (selection().length < 20) selected[token] = true; else say('Choose at most 20 pieces.'); draw() } })(i)
   card.append(cover, label); grid.appendChild(card)
  }
  el('page').textContent = (start + 1) + '–' + end + ' / 10,000'; el('previous').disabled = page === 0; el('next').disabled = end === 10000; controls()
 }
 async function json(url) {
  var response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(45000) }), body = await response.json()
  if (!response.ok || body.ok === false) throw Error(body.error || 'WebP mint service is unavailable.')
  return body
 }
 async function statusOfContract() {
  await EthscriptionCheckout.identity(connection.provider, connection.address)
  var code = await connection.provider.request({ method: 'eth_getCode', params: [info.address, 'latest'] })
  if (!code || code === '0x' || code === '0x0') { deployed = false; paused = true; return }
  if (!same(code, info.runtime)) throw Error('Deployed contract does not match the reviewed WebP candidate.')
  var iface = new ethers.utils.Interface(info.abi), result = await connection.provider.request({ method: 'eth_call', params: [{ to: info.address, data: iface.encodeFunctionData('paused') }, 'latest'] })
  deployed = true; paused = iface.decodeFunctionResult('paused', result)[0]
 }
 async function artwork(token) {
  var entry = manifest.files[token]
  if (!entry || entry.id !== token || !Array.isArray(entry.proof) || entry.proof.length !== 14) throw Error('Artwork proof is unavailable for #' + token)
  var response = await fetch('/assets/ethscriptions/clean-pop-webp-v2/' + token + '.webp', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw Error('WebP artwork is unavailable for #' + token)
  var bytes = new Uint8Array(await response.arrayBuffer()), binary = ''
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  var uri = 'data:image/webp;base64,' + btoa(binary)
  var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uri)), sha = Array.from(new Uint8Array(digest)).map(function (n) { return n.toString(16).padStart(2, '0') }).join('')
  if (!same(sha, entry.contentSha256)) throw Error('WebP artwork hash mismatch for #' + token)
  return { uri: uri, proof: entry.proof, sha: sha }
 }
 async function preflight(token, sha) {
  var result = await json('/.netlify/functions/clean-pop-webp-v2-preflight?token=' + encodeURIComponent(token) + '&buyer=' + encodeURIComponent(connection.address))
  if (!result.readyToRequestWallet || result.paused || result.minted || result.walletMintCount >= 20 || result.contentAlreadyInscribed || !result.artworkProofValid || result.chainId !== 1 || result.tokenNo !== token || !same(result.contentSha256, sha) || !same(result.buyer, connection.address) || !same(result.contract, info.address)) throw Error(result.estimateError || 'WebP mint preflight did not confirm availability.')
  return result
 }
 async function verify(row) { return json('/.netlify/functions/clean-pop-webp-v2-verify?token=' + encodeURIComponent(row.tokenNo) + '&buyer=' + encodeURIComponent(row.buyer) + '&hash=' + encodeURIComponent(row.hash)) }
 function recovery() {
  var host = el('recovery'); host.textContent = ''
  pending().forEach(function (row) {
   var box = document.createElement('div'), title = document.createElement('p'), input = document.createElement('input'), check = document.createElement('button')
   box.className = 'panel'; title.textContent = 'Mint #' + row.tokenNo + (row.hash ? ' · awaiting confirmation' : ' · unfinished wallet request'); input.placeholder = 'Transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Transaction hash for mint #' + row.tokenNo)
   check.type = 'button'; check.textContent = 'CHECK TRANSACTION · NO GAS'; check.onclick = async function () { check.disabled = true; try { await client.reconcile(Object.assign({}, row, { hash: input.value.trim() }), verify); delete selected[row.tokenNo]; say('Mint #' + row.tokenNo + ' confirmed and indexed.'); recovery(); draw() } catch (error) { say(error.message); check.disabled = false } }
   box.append(title, input, check)
   if (row.state === 'awaiting-wallet' && !row.hash) {
    var label = document.createElement('label'), confirm = document.createElement('input'), clear = document.createElement('button')
    confirm.type = 'checkbox'; label.append(confirm, document.createTextNode(' I checked wallet activity and there is no pending mint or open approval.'))
    clear.type = 'button'; clear.textContent = 'CHECK & CLEAR UNSENT · NO GAS'; clear.disabled = !connection
    clear.onclick = async function () { clear.disabled = true; try { await client.recoverUnsent({ provider: connection.provider, from: connection.address, info: info, tokenNo: row.tokenNo, confirmed: confirm.checked }); say('Unsent request cleared. No transaction sent.'); recovery(); draw() } catch (error) { say(error.message); clear.disabled = false } }
    box.append(label, clear)
   }
   host.appendChild(box)
  }); controls()
 }
 function review(token, quote) {
  return new Promise(function (resolve, reject) {
   var host = el('review'), text = document.createElement('p'), approve = document.createElement('button'), cancel = document.createElement('button')
   host.textContent = ''; host.hidden = false
   text.textContent = 'Review mint #' + token + ' · price ' + EthscriptionCheckout.eth(quote.price) + ' ETH · ' + (quote.insufficientFunds ? 'wallet will show the fee and may require more funds' : 'estimated gas ' + EthscriptionCheckout.eth(quote.gas) + ' ETH') + '. Your wallet displays the final fee.'
   approve.type = cancel.type = 'button'; approve.textContent = 'APPROVE IN WALLET'; cancel.textContent = 'CANCEL'
   approve.onclick = function () { approve.disabled = true; cancel.disabled = true; quote.approve().then(function (row) { host.hidden = true; resolve(row) }, function (error) { host.hidden = true; reject(error) }) }
   cancel.onclick = function () { host.hidden = true; reject(Error('Mint cancelled; no transaction requested.')) }
   host.append(text, approve, cancel); approve.focus()
  })
 }
 el('connect').onclick = async function () {
  el('connect').disabled = true; el('walletChoices').textContent = ''
  try {
   if (!info || !manifest) throw Error('WebP mint configuration is still loading.')
   var provider = await EthscriptionCheckout.choose(el('walletChoices'), say); await EthscriptionCheckout.ensureChain(provider)
   var accounts = await provider.request({ method: 'eth_accounts' }); if (!accounts || !accounts[0]) throw Error('No wallet account connected.')
   connection = { provider: provider, address: accounts[0] }; await statusOfContract()
   if (provider.on) { var selectedProvider = provider; var invalidate = function () { if (connection && connection.provider === selectedProvider) { connection = null; deployed = false; paused = true; say('Wallet or network changed. Connect again.'); recovery(); draw() } }; provider.on('accountsChanged', invalidate); provider.on('chainChanged', invalidate); provider.on('disconnect', invalidate) }
   say(!deployed ? 'Your wallet’s Ethereum RPC did not return the WebP contract code. Check its network and reconnect; no mint was requested.' : paused ? 'The WebP mint is paused.' : 'Wallet connected. Select pieces to mint.')
   recovery(); draw()
  } catch (error) { connection = null; deployed = false; paused = true; say(error.message); recovery(); draw() } finally { el('connect').disabled = false }
 }
 el('mint').onclick = async function () {
  if (busy || !connection) return; busy = true; draw()
  try {
   var ids = selection()
   for (var i = 0; i < ids.length; i++) {
    var token = ids[i], image = await artwork(token), iface = new ethers.utils.Interface(info.abi)
    var tx = { from: connection.address, to: info.address, value: '0x' + BigInt(info.priceWei).toString(16), data: iface.encodeFunctionData('mint', [image.uri, image.proof, token]) }
    var row = await client.send({ provider: connection.provider, from: connection.address, tokenNo: token, tx: tx, progress: say, preferServerGas: true,
     preflight: function () { return preflight(token, image.sha) }, gasFallback: async function () { var q = await preflight(token, image.sha); return { gas: q.estimatedGas, gasPrice: q.estimatedGasPriceWei, insufficientFunds: q.insufficientFunds === true } },
     review: function (quote) { return review(token, quote) } })
    say('Mint submitted: ' + row.hash + '. Checking confirmation and indexing…'); recovery()
    await client.reconcile(row, verify); delete selected[token]; recovery(); draw()
   }
   say('Selected mints confirmed and indexed.')
  } catch (error) { say(error.message); recovery() } finally { busy = false; draw() }
 }
 el('previous').onclick = function () { if (page > 0) { page--; draw() } }
 el('next').onclick = function () { if ((page + 1) * pageSize < 10000) { page++; draw() } }
 el('go').onclick = function () { var raw = el('jump').value.trim(), n = Number(raw); if (!/^\d+$/.test(raw) || n >= 10000) return say('Enter a piece number from 0 to 9999.'); page = Math.floor(n / pageSize); draw() }
 Promise.all([json('/assets/data/clean-pop-webp-v2-candidate.json'), json('/assets/ethscriptions/clean-pop-webp-v2/manifest.json')]).then(function (values) {
  info = values[0]; manifest = values[1]
  if (info.root !== manifest.root || manifest.count !== 10000 || info.mimeType !== 'image/webp' || !same(info.address, '0xD085EB56d7195Bdf4a17bf3107FDC938a118B704') || !same(ethers.utils.keccak256(info.runtime), info.runtimeHash)) throw Error('WebP candidate configuration mismatch.')
  recovery(); draw(); say('Connect a wallet to check the current mint status.')
 }).catch(function (error) { say(error.message) })
})()
