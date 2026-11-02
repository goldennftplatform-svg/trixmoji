(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }
 var page = 0, pageSize = 40, supply = 10000, selected = {}, connection = null, info, manifest, busy = false, paused = true
 var status = function (message) { el('cleanPopStatus').textContent = message }
 function list() { return Object.keys(selected).map(Number).sort(function (a, b) { return a - b }) }
 function unfinished() { return CleanPopCheckout.records().filter(function (r) { return r.state !== 'complete' && r.state !== 'failed' }) }
 function updateControls() {
  el('cleanPopSelection').textContent = 'SELECTED ' + list().length + ' / 20'
  el('cleanPopMint').disabled = busy || !connection || paused || !list().length || unfinished().length > 0
 }
 function draw() {
  var grid = el('cleanPopGrid'); grid.textContent = ''
  var start = page * pageSize, end = Math.min(start + pageSize, supply)
  var complete = {}; CleanPopCheckout.records().forEach(function (r) { if (r.state === 'complete') complete[r.tokenNo] = true })
  for (var id = start; id < end; id++) {
   var card = document.createElement('button'), img = document.createElement('img'), meta = document.createElement('div')
   card.type = 'button'; card.className = 'phunk-card' + (selected[id] ? ' on' : '') + (complete[id] ? ' taken' : '')
   img.src = complete[id] ? '/assets/ethscriptions/clean-pop-v1/' + id + '.png' : '/assets/images/ethscription-cover.png'
   img.alt = complete[id] ? 'Confirmed Clean Pop #' + id : 'Unrevealed Clean Pop cover #' + id; img.loading = 'lazy'
   meta.className = 'meta'; meta.textContent = '#' + id + (complete[id] ? ' · MINTED' : selected[id] ? ' · SELECTED' : '')
   card.disabled = !!complete[id] || busy; card.setAttribute('aria-pressed', selected[id] ? 'true' : 'false')
   ;(function (token) { card.addEventListener('click', function () {
    if (selected[token]) delete selected[token]
    else if (list().length >= 20) { status('Select at most 20 covers.'); return }
    else selected[token] = true
    draw()
   }) })(id)
   card.appendChild(img); card.appendChild(meta); grid.appendChild(card)
  }
  el('cleanPopPage').textContent = (start + 1) + '–' + end + ' of ' + supply
  el('cleanPopPrev').disabled = page === 0; el('cleanPopNext').disabled = end === supply
  updateControls()
 }
 async function api(body) {
  var response = await fetch('/api/ethscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  var result = await response.json()
  if (!response.ok || result.ok === false) throw new Error(result.error || 'Verification unavailable. Do not mint again.')
  return result
 }
 async function verify(row) { return api({ action: 'cleanPopVerify', hash: row.hash, buyer: row.buyer, tokenNo: row.tokenNo }) }
 function recovery() {
  var host = el('cleanPopRecovery'); host.textContent = ''
  unfinished().forEach(function (row) {
   var wrap = document.createElement('div'), text = document.createElement('p'), input = document.createElement('input'), button = document.createElement('button')
   text.textContent = 'Clean Pop #' + row.tokenNo + ' · ' + row.state + '. Check wallet activity before retrying.'
   input.placeholder = '0x transaction hash'; input.value = row.hash || ''; input.setAttribute('aria-label', 'Transaction hash for Clean Pop ' + row.tokenNo)
   button.type = 'button'; button.textContent = 'CHECK SAVED MINT'
   button.onclick = async function () {
    button.disabled = true
    try {
     var candidate = Object.assign({}, row, { hash: input.value.trim() })
     await CleanPopCheckout.reconcile(candidate, verify)
     delete selected[row.tokenNo]; status('Mint #' + row.tokenNo + ' confirmed and indexed.'); recovery(); draw()
    } catch (error) { status(error.message); button.disabled = false }
   }
   wrap.appendChild(text); wrap.appendChild(input); wrap.appendChild(button); host.appendChild(wrap)
  })
 }
 async function currentContract() {
  await EthscriptionCheckout.identity(connection.provider, connection.address)
  var code = await connection.provider.request({ method: 'eth_getCode', params: [info.address, 'latest'] })
  if (String(code).toLowerCase() !== info.runtime.toLowerCase()) throw new Error('Clean Pop contract code does not match the approved deployment.')
  return new ethers.Contract(info.address, info.abi, new ethers.providers.Web3Provider(connection.provider))
 }
 async function artwork(token) {
  var entry = manifest.files[token]
  if (!entry || entry.id !== token || !entry.proof || entry.proof.length !== 14) throw new Error('Approved artwork proof unavailable for #' + token)
  var response = await fetch('/assets/ethscriptions/clean-pop-v1/' + token + '.png', { cache: 'no-store' })
  if (!response.ok) throw new Error('Approved artwork unavailable for #' + token)
  var bytes = new Uint8Array(await response.arrayBuffer()), binary = ''
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  var uri = 'data:image/png;base64,' + btoa(binary)
  var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uri))
  var sha = Array.from(new Uint8Array(digest)).map(function (v) { return v.toString(16).padStart(2, '0') }).join('')
  if (sha !== entry.contentSha256) throw new Error('Artwork hash mismatch for #' + token)
  return { uri: uri, proof: entry.proof, sha: sha }
 }
 async function preflight(token, sha) {
  var contract = await currentContract(), legacyAddress = await contract.LEGACY()
  var legacy = new ethers.Contract(legacyAddress, ['function minted(uint256) view returns (bool)'], contract.provider)
  var states = await Promise.all([contract.paused(), contract.minted(token), legacy.minted(token), contract.mintedBy(connection.address)])
  paused = states[0]
  if (paused) throw new Error('Clean Pop public mint is paused.')
  if (states[1]) throw new Error('Clean Pop #' + token + ' has already been minted.')
  if (states[2]) throw new Error('Clean Pop #' + token + ' is reserved and cannot be publicly minted.')
  if (states[3].gte(20)) throw new Error('This wallet has reached the 20-piece limit.')
  await api({ action: 'cleanPopUnique', sha: sha })
 }
 async function finish(row) {
  for (var i = 0; i < 24; i++) {
   try { return await CleanPopCheckout.reconcile(row, verify) } catch (error) {
    if (!/not confirmed|not on Ethereum|indexing is pending/i.test(error.message) || i === 23) throw error
    await new Promise(function (resolve) { setTimeout(resolve, 5000) })
   }
  }
 }
 el('cleanPopConnect').onclick = async function () {
  try {
   if (!info) throw new Error('Clean Pop configuration is still loading.')
   var settings = await fetch('/api/ethscriptions', { cache: 'no-store' }).then(function (r) { return r.json() }).catch(function () { return {} })
   EthscriptionCheckout.configure(settings.walletConnectProjectId || '')
   connection = await EthscriptionCheckout.connect(el('cleanPopWallets'))
   var contract = await currentContract(); paused = await contract.paused()
   status(paused ? 'Clean Pop public mint is paused. Your selected covers remain in the grid.' : 'Wallet connected. Select covers, then mint.')
   recovery(); draw()
  } catch (error) { status(error.message) }
 }
 el('cleanPopMint').onclick = async function () {
  busy = true; draw()
  try {
   var ids = list()
   for (var i = 0; i < ids.length; i++) {
    var token = ids[i]; status('Preparing #' + token + ' (' + (i + 1) + '/' + ids.length + ')…')
    var image = await artwork(token), iface = new ethers.utils.Interface(info.abi)
    var tx = { from: connection.address, to: info.address, value: '0x' + BigInt(info.priceWei).toString(16), data: iface.encodeFunctionData('mint', [image.uri, image.proof, token]) }
    var row = await CleanPopCheckout.send({ provider: connection.provider, from: connection.address, tokenNo: token, tx: tx,
     preflight: function () { return preflight(token, image.sha) },
     review: async function (quote) {
      if (!confirm('Mint Clean Pop #' + token + ' for ' + EthscriptionCheckout.eth(quote.price) + ' ETH plus estimated gas ' + EthscriptionCheckout.eth(quote.gas) + ' ETH?')) throw new Error('Mint cancelled. Completed mints remain confirmed.')
     } })
    status('Submitted #' + token + ': ' + row.hash + '. Waiting for confirmation and indexing.'); recovery()
    await finish(row); delete selected[token]; recovery(); draw()
   }
   status('Selected mints confirmed and indexed.')
  } catch (error) { status(error.message); recovery() } finally { busy = false; draw() }
 }
 el('cleanPopPrev').onclick = function () { if (page > 0) { page--; draw() } }
 el('cleanPopNext').onclick = function () { if ((page + 1) * pageSize < supply) { page++; draw() } }
 el('cleanPopGo').onclick = function () {
  var text = el('cleanPopJump').value.trim(), id = Number(text)
  if (!/^\d+$/.test(text) || !Number.isInteger(id) || id < 0 || id >= supply) { status('Enter a piece number from 0 to 9999.'); return }
  page = Math.floor(id / pageSize); draw()
 }
 Promise.all([fetch('/assets/data/clean-pop-minter.json', { cache: 'no-store' }), fetch('/assets/ethscriptions/clean-pop-v1/manifest.json', { cache: 'no-store' })]).then(async function (responses) {
  if (responses.some(function (r) { return !r.ok })) throw new Error('Clean Pop configuration unavailable.')
  info = await responses[0].json(); manifest = await responses[1].json()
  if (info.address.toLowerCase() !== '0x11019b7af0f833f5695a44584c5b31bb1d0baabc' || info.root !== manifest.root || manifest.count !== supply) throw new Error('Clean Pop configuration does not match.')
  recovery(); draw()
 }).catch(function (error) { status(error.message) })
 fetch('/.netlify/functions/clean-pop-status', { cache: 'no-store' }).then(function (response) {
  if (!response.ok) throw new Error('Status unavailable'); return response.json()
 }).then(function (result) {
  if (!Number.isInteger(result.minted) || result.supply !== supply) throw new Error('Invalid status')
  el('cleanPopCount').textContent = result.minted + ' / ' + supply + ' MINTED · BLOCKSCOUT INDEXED EVENTS'
 }).catch(function () { el('cleanPopCount').textContent = 'Mint count temporarily unavailable.' })
})()
