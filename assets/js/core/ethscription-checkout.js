(function (root) {
 'use strict'
 var KEY = 'doswapz.phunk.checkout.v1'
 var active = null
 var projectId = ''
 var providerInfo = new WeakMap()
 function records() {
  var rows = JSON.parse(root.localStorage.getItem(KEY) || '[]')
  if (!Array.isArray(rows)) throw new Error('Saved checkout data is invalid. Keep it for recovery; do not pay again.')
  return rows
 }
 function save(rows) { root.localStorage.setItem(KEY, JSON.stringify(rows)) }
 function update(row) {
  var rows = records().filter(function (x) { return x.id !== row.id })
  rows.push(row)
  save(rows)
 }
 function remove(id) { save(records().filter(function (x) { return x.id !== id })) }
 function same(a, b) { return String(a).toLowerCase() === String(b).toLowerCase() }
 function walletRequest(provider, payload, timeout) {
  return new Promise(function (resolve, reject) {
   var timer = setTimeout(function () {
    reject(new Error('Wallet did not respond. Open your wallet extension, unlock it, and finish or reject its pending connection request. No mint transaction has been requested at this step.'))
   }, timeout || 60000)
   try {
    Promise.resolve(provider.request(payload)).then(function (value) { clearTimeout(timer); resolve(value) }, function (error) {
     clearTimeout(timer)
     var code = Number(error && (error.code || error.data && error.data.originalError && error.data.originalError.code))
     if (code === -32002) reject(new Error('Your wallet already has a pending request. Open its extension icon and approve or reject that request, then try again. No new mint was submitted.'))
     else reject(error)
    })
   } catch (error) { clearTimeout(timer); reject(error) }
   })
 }
 async function requestAccounts(provider) {
  var accounts = await walletRequest(provider, { method: 'eth_requestAccounts' })
  if (!accounts || !accounts[0]) throw new Error('No Ethereum account connected. Unlock your wallet and select an account.')
  return accounts
 }
 async function ensureChain(provider) {
  if (BigInt(await walletRequest(provider, { method: 'eth_chainId' })) !== 1n) {
   await walletRequest(provider, { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] })
  }
  if (BigInt(await walletRequest(provider, { method: 'eth_chainId' })) !== 1n) throw new Error('Switch to Ethereum mainnet before continuing.')
 }
 async function identity(provider, from) {
  await ensureChain(provider)
  var accounts = await provider.request({ method: 'eth_accounts' })
  if (!accounts[0] || !same(accounts[0], from)) throw new Error('Wallet changed. Reconnect the original purchasing wallet.')
 }
  async function choose(host, report) {
   report = report || function () {}
  var rows = []
   function add(provider, name, id, rdns) {
    if (provider && provider.request && !rows.some(function (r) { return r.provider === provider || id && r.id === id })) { rows.push({ provider: provider, name: name, id: id }); providerInfo.set(provider, { name: name, rdns: rdns || '' }) }
  }
  function announce(event) {
    if (event.detail) { var info = event.detail.info || {}; add(event.detail.provider, info.name || 'Ethereum wallet', info.uuid || info.rdns, info.rdns) }
  }
  root.addEventListener('eip6963:announceProvider', announce)
  root.dispatchEvent(new Event('eip6963:requestProvider'))
  await new Promise(function (resolve) { setTimeout(resolve, 250) })
  root.removeEventListener('eip6963:announceProvider', announce)
  // Prefer announced identities. Legacy globals can wrap the same provider and
  // competing extensions may all advertise isMetaMask for compatibility.
  if (!rows.length) {
   var injected = root.ethereum && (root.ethereum.providers || [root.ethereum]) || []
   injected.forEach(function (p) { add(p, p.isRabby ? 'Rabby Wallet' : p.isCoinbaseWallet ? 'Coinbase Wallet' : p.isPhantom ? 'Phantom' : p.isMetaMask ? 'MetaMask' : 'Browser wallet') })
   add(root.phantom && root.phantom.ethereum, 'Phantom')
  }
  return new Promise(function (resolve, reject) {
   var box = document.createElement('div')
   box.className = 'row'
   box.setAttribute('aria-label', 'Choose Ethereum wallet')
   var status = document.createElement('p'); status.setAttribute('role', 'status'); box.appendChild(status)
   function button(label, run) {
    var b = document.createElement('button')
    b.type = 'button'; b.textContent = label
    b.onclick = async function () {
     Array.from(box.querySelectorAll('button')).forEach(function (x) { x.disabled = true })
      status.textContent = 'Connecting ' + label + '… Open its extension icon if no window appears.'
      report(status.textContent)
     try { var p = await run(); active = p; box.remove(); resolve(p) }
     catch (e) { box.remove(); reject(e) }
    }
    box.appendChild(b)
   }
   rows.forEach(function (r) { button(r.name, async function () {
    // Ask for accounts inside the wallet-button click, before network RPCs.
     var accounts = await requestAccounts(r.provider)
     report(r.name + ' returned account ' + accounts[0] + '. Checking Ethereum mainnet…')
    return r.provider
   }) })
   if (projectId) button('WalletConnect / mobile wallets', async function () {
    var mod = await import('https://esm.sh/@walletconnect/ethereum-provider@2.21.1')
    var Provider = mod.EthereumProvider || mod.default
    var p = await Provider.init({ projectId: projectId, chains: [1], showQrModal: true,
     methods: ['eth_sendTransaction', 'personal_sign'],
     events: ['chainChanged', 'accountsChanged'],
     metadata: { name: 'DOSWAPZ', description: 'Ethereum Ethscriptions mint', url: location.origin, icons: [location.origin + '/og.jpg'] } })
    await p.connect()
    return p
   })
   if (!rows.length && !projectId) {
    var help = document.createElement('p')
    help.textContent = 'Open this page in MetaMask, Phantom’s Ethereum browser, Coinbase Wallet, or another Ethereum wallet browser. Mobile QR connection is not configured yet.'
    box.appendChild(help)
   }
   button('Cancel', function () { throw new Error('Wallet connection cancelled. No payment sent.') })
   host.appendChild(box)
  })
 }
  async function connect(host, report) {
   report = report || function () {}
   var p = active || await choose(host, report)
   report('Wallet selected. Checking Ethereum mainnet…')
   await ensureChain(p)
   var accounts = await walletRequest(p, { method: 'eth_accounts' }, 20000)
   if (!accounts || !accounts[0]) accounts = await requestAccounts(p)
   if (!accounts[0]) throw new Error('No Ethereum account connected.')
   report('Connected wallet: ' + accounts[0])
  return { provider: p, address: accounts[0] }
 }
 function eth(wei) {
  var n = BigInt(wei)
  var frac = (n % 1000000000000000000n).toString().padStart(18, '0').replace(/0+$/, '')
  return (n / 1000000000000000000n).toString() + (frac ? '.' + frac : '')
 }
 async function send(options) {
  var p = options.provider, from = options.from, picture = options.picture
  async function run() {
   var unfinished = records().find(function (r) { return same(r.buyer, from) && r.state !== 'complete' && r.state !== 'failed' })
   if (unfinished) throw new Error('A previous mint needs checking. Use CHECK SAVED MINTS below before paying again.')
   await identity(p, from)
   var tx = { from: from, to: options.info.address, value: '0x' + BigInt(picture.wei).toString(16), data: options.data }
   if (BigInt(picture.wei) !== BigInt(options.info.priceWei)) throw new Error('Mint price does not match the contract configuration.')
   var code = await p.request({ method: 'eth_getCode', params: [tx.to, 'latest'] })
   if (!code || code === '0x' || code === '0x0') throw new Error('The mint contract is not deployed. No payment sent.')
   var estimate = BigInt(await p.request({ method: 'eth_estimateGas', params: [tx] }))
   var gasPrice = BigInt(await p.request({ method: 'eth_gasPrice' }))
   tx.gas = '0x' + (estimate + estimate / 5n).toString(16)
   // Let the wallet populate current fee fields; do not impose an arbitrary tip floor.
   await options.review({ price: eth(picture.wei), gas: eth(estimate * gasPrice), total: eth(BigInt(picture.wei) + estimate * gasPrice) })
   await identity(p, from)
   var record = { id: picture.id, tokenNo: picture.tokenNo, buyer: from, chainId: 1, minter: tx.to, state: 'awaiting-wallet', hash: '', at: new Date().toISOString() }
   update(record) // Verify durable storage BEFORE opening the wallet confirmation.
   var hash
   try {
    hash = await p.request({ method: 'eth_sendTransaction', params: [tx] })
   } catch (e) {
    if (Number(e.code) === 4001 || Number(e.code) === 4100) remove(record.id)
    // Other errors can be ambiguous: keep the intent, so a retry cannot double-pay.
    throw e
   }
   record.hash = hash; record.state = 'submitted'
   try { update(record) } catch (e) { throw new Error('Transaction sent: ' + hash + '. Save this hash; browser storage failed. Do not pay again.') }
   options.onHash(hash)
   return record
  }
  if (!root.navigator.locks) throw new Error('This browser cannot safely coordinate checkout tabs. Use a current browser with Web Locks support.')
  return root.navigator.locks.request('doswapz-phunk-checkout', { ifAvailable: true }, function (lock) {
   if (!lock) throw new Error('Checkout is already running in another tab.')
   return run()
  })
 }
 async function reconcile(record, api) {
  if (!/^0x[a-f0-9]{64}$/i.test(record.hash)) throw new Error('No transaction hash was returned. Check wallet activity and paste its hash below; do not pay again.')
  var result = await api({ action: 'phunkReveal', id: record.id, mintTx: record.hash, buyer: record.buyer })
  if (!result || !result.ok) {
   if (result && /transaction reverted/i.test(result.error || '')) { record.state = 'failed'; update(record) }
   throw new Error(result && result.error || 'Confirmation is pending. Check again; no additional payment is needed.')
  }
  record.state = 'complete'; record.preview = result.listing && result.listing.preview; update(record)
  return result
 }
 async function finish(record, api) {
  for (var attempt = 0; attempt < 24; attempt++) {
   try { return await reconcile(record, api) }
   catch (e) {
    if (!/not confirmed|not on Ethereum|indexing is pending/i.test(e.message) || attempt === 23) throw e
    await new Promise(function (resolve) { setTimeout(resolve, 5000) })
   }
  }
 }
 function recovery(host, api) {
  host.innerHTML = ''
  var rows
  try { rows = records() } catch (e) { host.textContent = e.message; return }
  if (!rows.length) return
  var title = document.createElement('h2'); title.textContent = 'YOUR SAVED MINTS'; host.appendChild(title)
  var galleryLink = document.createElement('a'); galleryLink.href = '/ethscriptions/past#mine'; galleryLink.textContent = 'OPEN MY COLLECTION · CONNECT WALLET'; galleryLink.className = 'btn'; host.appendChild(galleryLink)
  var note = document.createElement('p'); note.textContent = 'Saved in this browser. Checking never submits a payment. Keep transaction hashes if you change devices.'; host.appendChild(note)
  rows.forEach(function (r) {
   var card = document.createElement('div'); card.className = 'card'
   var status = document.createElement('p'); status.textContent = '#' + r.tokenNo + ' · ' + r.state.toUpperCase(); card.appendChild(status)
   if (r.hash) {
    var link = document.createElement('a'); link.href = 'https://etherscan.io/tx/' + r.hash; link.textContent = 'View transaction'; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.appendChild(link)
   }
   if (r.state === 'complete' && r.preview) {
    var img = document.createElement('img'); img.src = r.preview; img.alt = 'Minted Phunk #' + r.tokenNo; card.appendChild(img)
   } else if (r.state !== 'failed') {
    var input = document.createElement('input'); input.placeholder = '0x transaction hash from your wallet'; input.setAttribute('aria-label', 'Transaction hash for Phunk ' + r.tokenNo)
    input.value = r.hash || ''; card.appendChild(input)
    var check = document.createElement('button'); check.type = 'button'; check.textContent = 'CHECK SAVED MINT'
    check.onclick = async function () {
     check.disabled = true
     try {
      var hash = input.value.trim()
      if (!/^0x[a-f0-9]{64}$/i.test(hash)) throw new Error('Paste a valid transaction hash from your wallet.')
      // Do not persist a user-supplied replacement until the server verifies it.
      var candidate = Object.assign({}, r, { hash: hash })
      await reconcile(candidate, api)
      recovery(host, api)
     } catch (e) { status.textContent = e.message; check.disabled = false }
    }
    card.appendChild(check)
   }
   host.appendChild(card)
  })
 }
 var exported = { choose: choose, connect: connect, requestAccounts: requestAccounts, walletRequest: walletRequest, ensureChain: ensureChain, identity: identity, send: send, reconcile: reconcile, finish: finish, recovery: recovery, records: records, eth: eth,
   configure: function (id) { projectId = id || '' }, walletInfo: function (provider) { return providerInfo.get(provider) || null } }
 if (typeof module !== 'undefined' && module.exports) module.exports = exported
 else root.EthscriptionCheckout = exported
})(typeof window !== 'undefined' ? window : globalThis)
