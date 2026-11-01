(function () {
 'use strict'
 var host = document.getElementById('walletGallery')
 if (!host) return
 var address = '', provider = null, page = 0, generation = 0
 var connect = document.createElement('button'); connect.type = 'button'; connect.textContent = 'CONNECT WALLET · VIEW MY PHUNKS'
 var refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'REFRESH'; refresh.hidden = true
 var change = document.createElement('button'); change.type = 'button'; change.textContent = 'CHANGE WALLET'; change.hidden = true
 var choices = document.createElement('div')
 var note = document.createElement('p'); note.setAttribute('role', 'status')
 note.textContent = 'Connect the Ethereum wallet you minted with. No DOSWAPZ account or payment is required to view public purchase history.'
 var grid = document.createElement('div'); grid.className = 'board'
 var pager = document.createElement('div'); pager.className = 'row'
 host.append(connect, refresh, change, choices, note, grid, pager)
 function clear(message) { generation++; grid.innerHTML = ''; pager.innerHTML = ''; note.textContent = message }
 function link(card, label, href) {
  var a = document.createElement('a'); a.textContent = label; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'btn'; card.appendChild(a)
 }
 async function load() {
  if (!address) return
  var request = ++generation
  grid.innerHTML = ''; pager.innerHTML = ''; refresh.disabled = true
  note.textContent = 'Checking purchases for ' + address + '…'
  try {
   var response = await fetch('/api/ethscriptions?wallet=' + encodeURIComponent(address) + '&page=' + page, { cache: 'no-store' })
   var data = await response.json()
   if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load wallet purchases. Try refresh.')
   if (request !== generation) return
   var gallery = data.gallery
   note.textContent = address + ' · ' + gallery.total + ' purchase(s). ' + gallery.note
   if (!gallery.items.length) {
    var empty = document.createElement('p'); empty.textContent = 'No confirmed purchases found for this wallet on this site. For a pending mint, use YOUR SAVED MINTS below.'; grid.appendChild(empty)
   }
   gallery.items.forEach(function (item) {
    var card = document.createElement('article'); card.className = 'card'
    var title = document.createElement('h3'); title.textContent = 'PHUNK #' + item.tokenNo; card.appendChild(title)
    var img = document.createElement('img'); img.src = item.preview || '/assets/images/ethscription-cover.png'; img.alt = 'Purchased Phunk #' + item.tokenNo; img.loading = 'lazy'; card.appendChild(img)
    var status = document.createElement('p')
    status.textContent = item.ownership === 'owned' ? 'IN THIS WALLET · INDEXER VERIFIED' : item.ownership === 'transferred' ? 'PURCHASED HERE · NOW IN ANOTHER WALLET' : 'PURCHASE CONFIRMED · CURRENT OWNERSHIP UNAVAILABLE'
    card.appendChild(status)
    if (item.ownership === 'transferred') { var owner = document.createElement('p'); owner.className = 'mono'; owner.textContent = 'Current owner: ' + item.currentOwner; card.appendChild(owner) }
    link(card, 'OPEN ARTWORK', img.src)
    if (/^0x[a-f0-9]{64}$/i.test(item.ethscriptionId)) {
     link(card, 'TRANSACTION', 'https://etherscan.io/tx/' + item.ethscriptionId)
     link(card, 'ETHSCRIPTION', 'https://ethscriptions.com/ethscriptions/' + item.ethscriptionId)
    }
    grid.appendChild(card)
   })
   function nav(label, next) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = function () { page = next; load() }; pager.appendChild(b) }
   if (page > 0) nav('PREVIOUS PURCHASES', page - 1)
   if (gallery.hasMore) nav('MORE PURCHASES', page + 1)
  } catch (e) { if (request === generation) note.textContent = e.message }
  finally { if (request === generation) refresh.disabled = false }
 }
 function accountsChanged(accounts) {
  address = accounts && accounts[0] || ''; page = 0
  if (!/^0x[a-f0-9]{40}$/i.test(address)) { address = ''; clear('Wallet disconnected. Connect your minting wallet to view purchases.'); connect.hidden = false; return }
  connect.hidden = true; refresh.hidden = false; change.hidden = false; load()
 }
 function disconnected() { accountsChanged([]) }
 async function choose() {
  connect.disabled = true; change.disabled = true
  try {
   var next = await EthscriptionCheckout.choose(choices)
   await EthscriptionCheckout.ensureChain(next)
   var accounts = await next.request({ method: 'eth_requestAccounts' })
   if (provider && provider.removeListener) { provider.removeListener('accountsChanged', accountsChanged); provider.removeListener('disconnect', disconnected) }
   provider = next
   if (provider.on) { provider.on('accountsChanged', accountsChanged); provider.on('disconnect', disconnected) }
   accountsChanged(accounts)
  } catch (e) { note.textContent = e.message }
  finally { connect.disabled = false; change.disabled = false }
 }
 connect.onclick = choose; change.onclick = choose
 refresh.onclick = async function () {
  try { accountsChanged(await provider.request({ method: 'eth_accounts' })) } catch (e) { clear(e.message) }
 }
})()
