'use strict'

var snap = null
var me = null
var filter = 'all'
var catFilter = 'all'
var deptFilter = 'all'
var condFilter = 'all'
var query = ''
var selected = ''
var busy = false
var pendingTx = ''

function $(id) { return document.getElementById(id) }

function setStatus(text) {
  $('status').textContent = text || ''
}

function holdKey() {
  var key = ''
  try { key = sessionStorage.getItem('ek-hold') || '' } catch (e) { key = '' }
  if (!/^[A-Za-z0-9]{16,64}$/.test(key)) {
    var bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    key = Array.prototype.map.call(bytes, function (b) {
      return (b % 36).toString(36)
    }).join('')
    try { sessionStorage.setItem('ek-hold', key) } catch (e2) {}
  }
  return key
}

async function apiGet() {
  var res = await fetch('/api/ek', { cache: 'no-store', credentials: 'same-origin' })
  var data = await res.json().catch(function () { return {} })
  if (!res.ok || !data.ok) throw new Error(data.error || 'E.K. did not answer. Restart the local site server.')
  return data
}

async function apiPost(body) {
  var res = await fetch('/api/ek', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  var data = await res.json().catch(function () { return {} })
  if (!res.ok || !data.ok) {
    var err = new Error(data.error || 'E.K. refused that.')
    err.armed = data.armed
    throw err
  }
  return data
}

function railOf(id) {
  var rails = (snap && snap.rails) || []
  for (var i = 0; i < rails.length; i++) if (rails[i].id === id) return rails[i]
  return null
}

function knownWallet(chain) {
  var rows = (me && me.wallets) || []
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].chain === chain && rows[i].address) return rows[i].address
  }
  return ''
}

function el(tag, cls, text) {
  var node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

function jpegOk(src) {
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(src || '')
}

function money(item, amount) {
  if (item.rail === 'paypal') return '$' + amount + ' USD'
  return amount + ' ' + item.symbol
}

function dueUnits(item) {
  return item.payUnits || item.units
}

function priceLine(item) {
  return money(item, item.amount)
}

function shipFree(item) {
  return !item.shipAmount || item.shipAmount === '0' || item.shipAmount === '0.00'
}

function shipLine(item) {
  if (item.ship === 'pickup') return 'PICKUP'
  if (item.ship === 'digital') return 'DIGITAL'
  var from = item.shipFrom ? ' FROM ' + item.shipFrom : ''
  if (shipFree(item)) return 'FREE SHIPPING' + from
  return 'SHIP ' + money(item, item.shipAmount) + from
}

function syncShipFields() {
  var on = $('ship') && $('ship').value === 'ship'
  if ($('shipPriceWrap')) $('shipPriceWrap').hidden = !on
  if ($('shipPriceNote')) $('shipPriceNote').hidden = !on
}

function showGate() {
  var text = $('gateText')
  var box = $('sellBox')
  if (!me) {
    text.textContent = 'You can look. Log in before you sell.'
    box.hidden = true
    return
  }
  var how = me.method === 'email' ? 'email login' : (me.method || 'login')
  text.textContent = 'You are in with ' + how + '. You can sell.'
  box.hidden = false
  fillRails()
  fillCats()
  syncPayout()
}

function fillRails() {
  var sel = $('rail')
  if (sel.options.length) return
  ;((snap && snap.rails) || []).forEach(function (rail) {
    var opt = document.createElement('option')
    opt.value = rail.id
    opt.textContent = rail.label
    sel.appendChild(opt)
  })
}

function syncPayout() {
  var rail = railOf($('rail').value)
  var payout = $('payout')
  var again = $('againWrap')
  if (!rail) return
  if (rail.id === 'paypal') {
    $('payoutLabel').textContent = 'YOUR PAYPAL EMAIL'
    $('againLabel').textContent = 'PAYPAL EMAIL AGAIN'
    payout.readOnly = false
    payout.value = ''
    $('payoutAgain').value = ''
    again.hidden = false
    $('payoutNote').textContent = 'The buyer pays this PayPal. ' + paypalNote()
    return
  }
  var known = knownWallet(rail.chain)
  $('payoutLabel').textContent = rail.chain === 'solana' ? 'SOLANA PAYOUT' : 'ETHEREUM PAYOUT'
  if (known) {
    payout.value = known
    payout.readOnly = true
    again.hidden = true
    $('payoutNote').textContent = 'Locked to the wallet on this login. Crypto is released here later. The buyer pays the escrow wallet first.'
    return
  }
  payout.readOnly = false
  payout.value = ''
  $('payoutAgain').value = ''
  again.hidden = false
  $('againLabel').textContent = 'ADDRESS AGAIN'
  $('payoutNote').textContent = 'This login has no ' + rail.chain + ' wallet. Type the address twice. Crypto is released here later. Do not type the escrow address.'
}

function paypalNote() {
  if (!snap || !snap.paypal) return ''
  if (!snap.paypal.armed) return 'PayPal checkout is not armed on this server yet. The email still shows on the listing.'
  return 'PayPal checkout is armed in ' + snap.paypal.mode + ' mode.'
}

function passes(item) {
  if (condFilter !== 'all' && item.condition !== condFilter) return false
  if (catFilter !== 'all') {
    if (item.category !== catFilter) return false
  } else if (deptFilter !== 'all' && item.dept !== deptFilter && item.category !== deptFilter) {
    return false
  }
  if (query) {
    var hay = ((item.title || '') + ' ' + (item.description || '') + ' ' + (item.categoryLabel || '') + ' ' + (item.conditionLabel || '')).toLowerCase()
    if (hay.indexOf(query) === -1) return false
  }
  if (filter === 'all') return true
  if (filter === 'open') return item.status === 'open'
  if (filter === 'sold') return item.status === 'sold' || item.status === 'escrow' || item.status === 'refunded'
  return item.rail === filter
}

function departments() {
  return (snap && snap.categories) || []
}

function deptById(id) {
  var rows = departments()
  for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i]
  return null
}

function fillTypes() {
  var type = $('category')
  var dept = deptById($('dept') && $('dept').value)
  if (!type) return
  var keep = type.value
  type.textContent = ''
  ;((dept && dept.subs) || []).forEach(function (sub) {
    var opt = document.createElement('option')
    opt.value = sub.id
    opt.textContent = sub.label
    if (sub.id === keep) opt.selected = true
    type.appendChild(opt)
  })
}

function fillCats() {
  var sell = $('dept')
  if (sell && !sell.options.length) {
    departments().forEach(function (cat) {
      var opt = document.createElement('option')
      opt.value = cat.id
      opt.textContent = cat.label
      sell.appendChild(opt)
    })
    fillTypes()
  }
  paintBrowse()
}

function paintBrowse() {
  var box = $('browse')
  var subs = $('browseSubs')
  if (!box) return
  box.textContent = ''
  var all = el('button', deptFilter === 'all' ? 'on' : '', 'ALL')
  all.type = 'button'
  all.setAttribute('data-dept', 'all')
  box.appendChild(all)
  departments().forEach(function (cat) {
    var btn = el('button', deptFilter === cat.id ? 'on' : '', cat.label)
    btn.type = 'button'
    btn.setAttribute('data-dept', cat.id)
    box.appendChild(btn)
  })
  if (subs) {
    var dept = deptById(deptFilter)
    subs.textContent = ''
    if (!dept) {
      subs.hidden = true
    } else {
      subs.hidden = false
      var any = el('button', catFilter === 'all' ? 'on' : '', 'ALL ' + dept.label)
      any.type = 'button'
      any.setAttribute('data-cat', 'all')
      subs.appendChild(any)
      ;(dept.subs || []).forEach(function (sub) {
        var btn = el('button', catFilter === sub.id ? 'on' : '', sub.label)
        btn.type = 'button'
        btn.setAttribute('data-cat', sub.id)
        subs.appendChild(btn)
      })
    }
  }
  paintCatStage()
}

function sampleImg(id) {
  var img = document.createElement('img')
  img.src = '/assets/images/ek/samples/' + id + '.jpg'
  img.alt = ''
  img.draggable = false
  return img
}

function paintCatStage() {
  var stage = $('catStage')
  if (!stage) return
  stage.textContent = ''
  var dept = deptById(deptFilter)
  stage.appendChild(el('p', 'tag', 'SAMPLE · NOT FOR USE · NOT A LISTING PHOTO'))
  if (!dept) {
    var grid = el('div', 'cat-grid')
    departments().forEach(function (cat) {
      var fig = document.createElement('figure')
      fig.appendChild(sampleImg(cat.id))
      fig.appendChild(el('figcaption', 'tag', cat.label))
      grid.appendChild(fig)
    })
    stage.appendChild(grid)
    return
  }
  var hero = el('div', 'cat-hero')
  hero.appendChild(sampleImg(dept.id))
  stage.appendChild(el('p', 'tag', dept.label))
  stage.appendChild(hero)
  stage.appendChild(el('p', 'note', 'This picture shows the department. It is not for sale and it cannot be used as a listing photo.'))
}

function syncSale() {
  var auction = $('mode') && $('mode').value === 'auction'
  if ($('daysWrap')) $('daysWrap').hidden = !auction
  var priceLabel = document.querySelector('label[for="amount"]')
  if (priceLabel) priceLabel.textContent = auction ? 'STARTING BID' : 'PRICE'
  if ($('modeNote')) {
    $('modeNote').textContent = auction
      ? 'Bids start at the price you type and stay open for the days you pick. A bid is not a payment. When the clock ends, new bids stop. DOSWAPZ fee is zero. Crypto pays escrow.'
      : 'Buy now is a set price. Buyers can send an offer. An offer is not a payment. DOSWAPZ fee is zero. Crypto pays escrow.'
  }
}

function endLabel(iso) {
  var ms = Date.parse(iso || '') - Date.now()
  if (!iso || ms <= 0) return 'BIDDING CLOSED'
  var hours = Math.ceil(ms / 3600000)
  if (hours < 48) return 'ENDS IN ' + hours + ' H'
  return 'ENDS IN ' + Math.ceil(hours / 24) + ' DAYS'
}

function biddingClosed(item) {
  return !!(item && item.mode === 'auction' && item.ended && item.deal !== 'accepted')
}

function sortRows(rows) {
  var mode = $('sort') ? $('sort').value : 'new'
  var copy = rows.slice()
  copy.sort(function (a, b) {
    if (mode === 'low' || mode === 'high') {
      var av = Number(a.payAmount || a.amount) || 0
      var bv = Number(b.payAmount || b.amount) || 0
      return mode === 'low' ? av - bv : bv - av
    }
    if (mode === 'bids') return (b.bidCount || 0) - (a.bidCount || 0)
    if (mode === 'end') {
      var ae = a.endsAt ? Date.parse(a.endsAt) : 9e15
      var be = b.endsAt ? Date.parse(b.endsAt) : 9e15
      return ae - be
    }
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })
  return copy
}

function scoreLine(score) {
  var up = score && score.up || 0
  var mid = score && score.mid || 0
  var down = score && score.down || 0
  var total = up + mid + down
  if (!total) return ''
  return 'FEEDBACK ' + up + ' UP · ' + mid + ' MID · ' + down + ' DOWN'
}

function paintBoard() {
  var board = $('board')
  board.textContent = ''
  var rows = sortRows(((snap && snap.listings) || []).filter(passes))
  if (!rows.length) {
    board.appendChild(el('p', 'note', 'Nothing on the board for this search.'))
    return
  }
  rows.forEach(function (item) {
    var card = el('article', 'card' + (item.id === selected ? ' on' : ''))
    card.tabIndex = 0
    if (jpegOk(item.photo)) {
      var img = document.createElement('img')
      img.alt = ''
      img.src = item.photo
      card.appendChild(img)
    }
    if (item.photoCount > 1) card.appendChild(el('div', 'tag', item.photoCount + ' PHOTOS'))
    card.appendChild(el('div', 'price', priceLine(item)))
    card.appendChild(el('div', '', item.title))
    var bits = [item.categoryLabel || 'OTHER']
    if (item.conditionLabel) bits.push(item.conditionLabel)
    bits.push(item.mode === 'auction' ? 'BIDS' : 'BUY NOW')
    card.appendChild(el('div', 'tag', bits.join(' · ')))
    if (item.mode === 'auction' && item.endsAt) card.appendChild(el('div', 'tag', endLabel(item.endsAt)))
    if (item.mode === 'auction' && item.highBid) card.appendChild(el('div', 'tag', 'HIGH ' + money(item, item.highBid.amount)))
    if (item.mode !== 'auction' && item.offerCount) card.appendChild(el('div', 'tag', item.offerCount + ' OFFERS'))
    var score = scoreLine(item.sellerScore)
    if (score) card.appendChild(el('div', 'tag', score))
    var meta = el('div', 'tag', item.label + ' · ' + shipLine(item) + ' · ' + item.payoutShort)
    card.appendChild(meta)
    if (item.status === 'escrow') card.appendChild(el('div', 'sold', 'ESCROW'))
    else if (item.status === 'refunded') card.appendChild(el('div', 'sold', 'REFUNDED'))
    else if (item.status === 'sold') card.appendChild(el('div', 'sold', 'SOLD'))
    else if (item.busy) card.appendChild(el('div', 'tag', 'CHECKOUT OPEN'))
    card.addEventListener('click', function () { openItem(item.id) })
    card.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        openItem(item.id)
      }
    })
    board.appendChild(card)
  })
}

function findItem(id) {
  var rows = (snap && snap.listings) || []
  for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i]
  return null
}

function openItem(id) {
  selected = id
  pendingTx = ''
  paintBoard()
  paintDetail()
  loadPhotos(id).then(function () {
    if (selected === id) paintDetail()
  }).catch(function (e) {
    setStatus(e.message || String(e))
  })
}

function payDest(item) {
  if (!item || item.rail === 'paypal') return ''
  if (item.escrow) return item.escrow
  var pot = snap && snap.escrow
  if (!pot) return ''
  if (item.chain === 'solana') return pot.sol || ''
  if (item.chain === 'ethereum') return pot.eth || ''
  return ''
}

function chainArmed(item) {
  if (!item || item.rail === 'paypal') return true
  var pot = snap && snap.escrow
  if (!pot) return false
  if (item.chain === 'solana') return !!(pot.solArmed && pot.sol)
  if (item.chain === 'ethereum') return !!(pot.ethArmed && pot.eth)
  return false
}

function sameWallet(a, b, chain) {
  if (!a || !b) return false
  if (chain === 'ethereum') return String(a).toLowerCase() === String(b).toLowerCase()
  return String(a) === String(b)
}

function whenLabel(iso) {
  var ms = Date.parse(iso || '')
  if (!iso || !ms) return ''
  return new Date(ms).toUTCString()
}

function paintEscrowNote() {
  var node = $('escrowLive')
  if (!node || !snap || !snap.escrow) return
  var book = snap.escrow
  node.textContent = 'SOL and USDC on Solana: ' + (book.sol || 'not armed') + '. ETH and USDC on Ethereum: ' + (book.eth || 'not armed') + '. Bitcoin ' + (book.btc || 'not published') + ' is published and is not a way to pay. DOSWAPZ fee is zero.'
}

function paintDetail() {
  var box = $('detail')
  var item = findItem(selected)
  if (!item) {
    box.hidden = true
    box.textContent = ''
    return
  }
  box.hidden = false
  box.textContent = ''
  box.appendChild(el('h2', '', item.title))
  box.appendChild(el('p', 'tag', (item.categoryLabel || 'OTHER') + (item.conditionLabel ? ' · ' + item.conditionLabel : '')))
  if (item.mode === 'auction' && item.endsAt) box.appendChild(el('p', 'tag', endLabel(item.endsAt)))
  paintGallery(box, item)
  box.appendChild(el('p', 'price', 'ITEM ' + priceLine(item)))
  if (item.ship === 'ship') {
    box.appendChild(el('p', '', 'SHIPPING ' + (shipFree(item) ? 'FREE' : money(item, item.shipAmount))))
    if (item.shipFrom) box.appendChild(el('p', 'tag', 'SHIPS FROM ' + item.shipFrom))
    box.appendChild(el('p', 'price', 'TOTAL ' + money(item, item.payAmount || item.amount)))
  }
  if (item.description) box.appendChild(el('p', '', item.description))
  box.appendChild(el('p', 'tag', shipLine(item) + (item.shipNote ? ' · ' + item.shipNote : '')))
  if (item.rail === 'paypal') {
    var paypalDest = el('p', '', '')
    paypalDest.appendChild(document.createTextNode('PAYPAL '))
    paypalDest.appendChild(el('span', '', item.payout))
    box.appendChild(paypalDest)
  } else if (item.status === 'open') {
    var pot = payDest(item)
    var escrowDest = el('p', '', '')
    escrowDest.appendChild(document.createTextNode('ESCROW '))
    escrowDest.appendChild(el('span', '', pot || 'NOT ARMED'))
    box.appendChild(escrowDest)
    var later = el('p', 'tag', '')
    later.appendChild(document.createTextNode('SELLER PAYOUT LATER '))
    later.appendChild(el('span', '', item.payout))
    box.appendChild(later)
  }
  paintTrade(box, item)
  if (item.rail !== 'paypal' && item.escrowPhase) {
    paintEscrow(box, item)
    return
  }
  if (item.status === 'sold') {
    box.appendChild(el('p', 'sold', 'SOLD' + (item.tx ? ' · ' + item.tx : '')))
    if (item.tracking) box.appendChild(el('p', '', (item.carrier || 'SHIPPED') + ' · ' + item.tracking))
    if (item.handoffNote) box.appendChild(el('p', '', 'NOTE · ' + item.handoffNote))
    if (item.mine && item.shipTo) {
      box.appendChild(el('h2', '', 'SHIP TO'))
      box.appendChild(el('p', '', item.shipTo.name))
      box.appendChild(el('p', '', item.shipTo.line1))
      if (item.shipTo.line2) box.appendChild(el('p', '', item.shipTo.line2))
      box.appendChild(el('p', '', item.shipTo.city + ', ' + item.shipTo.region + ' ' + item.shipTo.postal))
      box.appendChild(el('p', '', item.shipTo.country))
    }
    if (item.mine && item.ship === 'ship' && !item.tracking) {
      var carrier = document.createElement('select')
      carrier.id = 'carrier'
      ;['usps', 'ups', 'fedex', 'dhl', 'other'].forEach(function (id) {
        var opt = document.createElement('option')
        opt.value = id
        opt.textContent = id.toUpperCase()
        carrier.appendChild(opt)
      })
      var track = document.createElement('input')
      track.id = 'tracking'
      track.maxLength = 40
      track.placeholder = 'Tracking number'
      var note = document.createElement('input')
      note.id = 'handoffNote'
      note.maxLength = 280
      note.placeholder = 'Optional note'
      var row = el('div', 'row')
      var btn = el('button', '', 'MARK SHIPPED')
      btn.type = 'button'
      btn.addEventListener('click', function () {
        handoff(item.id, { carrier: carrier.value, tracking: track.value, note: note.value })
      })
      row.appendChild(btn)
      box.appendChild(el('label', '', 'CARRIER'))
      box.appendChild(carrier)
      box.appendChild(el('label', '', 'TRACKING'))
      box.appendChild(track)
      box.appendChild(note)
      box.appendChild(row)
    } else if (item.mine && item.ship !== 'ship') {
      var note2 = document.createElement('input')
      note2.id = 'handoffNote'
      note2.maxLength = 280
      note2.placeholder = 'Pickup time or download note'
      var row2 = el('div', 'row')
      var btn2 = el('button', '', 'MARK HANDED OFF')
      btn2.type = 'button'
      btn2.addEventListener('click', function () { handoff(item.id, { note: note2.value }) })
      row2.appendChild(btn2)
      box.appendChild(note2)
      box.appendChild(row2)
    }
    return
  }
  if (item.ship === 'ship' && !item.busy && !biddingClosed(item)) {
    box.appendChild(el('h2', '', 'SHIP TO'))
    ;[
      ['shipName', 'NAME'],
      ['shipLine1', 'STREET'],
      ['shipLine2', 'LINE 2'],
      ['shipCity', 'CITY'],
      ['shipRegion', 'STATE OR REGION'],
      ['shipPostal', 'POSTAL CODE'],
      ['shipCountry', 'COUNTRY']
    ].forEach(function (pair) {
      var lab = el('label', '', pair[1])
      lab.setAttribute('for', pair[0])
      var input = document.createElement('input')
      input.id = pair[0]
      input.maxLength = 120
      if (pair[0] === 'shipCountry') input.value = 'United States'
      box.appendChild(lab)
      box.appendChild(input)
    })
  }
  if (!biddingClosed(item)) {
    box.appendChild(el('p', 'note', item.rail === 'paypal'
      ? 'PayPal pays the seller. DOSWAPZ fee is zero.'
      : 'Mainnet. The wallet will ask you to send this amount to the escrow wallet. The seller is not paid yet. Reject it if the address does not match.'))
  }
  if (item.rail !== 'paypal' && !me) box.appendChild(el('p', 'note', 'Log in before you pay into escrow.'))
  if (item.rail !== 'paypal' && !chainArmed(item)) box.appendChild(el('p', 'note', 'Crypto escrow is not armed for this chain.'))
  if (item.busy) box.appendChild(el('p', 'tag', 'Someone is in checkout. If that is not you, wait for the hold to end.'))
  var actions = el('div', 'row')
  if (biddingClosed(item)) {
    box.appendChild(el('p', 'note', 'Bidding is closed. The seller can still accept a bid. Nothing was charged. DOSWAPZ fee is zero.'))
  } else if (!item.busy) {
    var payLabel = item.rail === 'paypal' ? 'PAY WITH PAYPAL' : (item.ship === 'ship' ? 'PAY ITEM + SHIPPING INTO ESCROW' : 'PAY INTO ESCROW')
    var pay = el('button', 'hot', payLabel)
    pay.type = 'button'
    if (item.rail !== 'paypal' && (!me || !chainArmed(item))) pay.disabled = true
    pay.addEventListener('click', function () { buy(item) })
    actions.appendChild(pay)
  }
  if (item.mine) {
    var pull = el('button', 'danger', 'PULL LISTING')
    pull.type = 'button'
    pull.addEventListener('click', function () { pullItem(item.id) })
    actions.appendChild(pull)
  }
  box.appendChild(actions)
  if (pendingTx) {
    var retry = el('button', '', 'CONFIRM THE PAYMENT AGAIN')
    retry.type = 'button'
    retry.addEventListener('click', function () { confirmPay(item, pendingTx) })
    box.appendChild(el('p', 'note', 'Wallet sent ' + pendingTx + '. The funds are not in escrow until E.K. sees that transaction on the chain.'))
    box.appendChild(retry)
  }
}

function paintShipTo(box, item) {
  if (!item.mine || !item.shipTo) return
  box.appendChild(el('h2', '', 'SHIP TO'))
  box.appendChild(el('p', '', item.shipTo.name))
  box.appendChild(el('p', '', item.shipTo.line1))
  if (item.shipTo.line2) box.appendChild(el('p', '', item.shipTo.line2))
  box.appendChild(el('p', '', item.shipTo.city + ', ' + item.shipTo.region + ' ' + item.shipTo.postal))
  box.appendChild(el('p', '', item.shipTo.country))
}

function paintProofForm(box, item) {
  if (item.ship === 'ship') {
    var carrier = document.createElement('select')
    carrier.id = 'carrier'
    ;['usps', 'ups', 'fedex', 'dhl', 'other'].forEach(function (id) {
      var opt = document.createElement('option')
      opt.value = id
      opt.textContent = id.toUpperCase()
      carrier.appendChild(opt)
    })
    var track = document.createElement('input')
    track.id = 'tracking'
    track.maxLength = 40
    track.placeholder = 'Tracking number'
    var note = document.createElement('input')
    note.id = 'handoffNote'
    note.maxLength = 280
    note.placeholder = 'Optional note'
    var row = el('div', 'row')
    var btn = el('button', '', 'POST SHIPPING PROOF')
    btn.type = 'button'
    btn.addEventListener('click', function () {
      handoff(item.id, { carrier: carrier.value, tracking: track.value, note: note.value })
    })
    row.appendChild(btn)
    box.appendChild(el('label', '', 'CARRIER'))
    box.appendChild(carrier)
    box.appendChild(el('label', '', 'TRACKING'))
    box.appendChild(track)
    box.appendChild(note)
    box.appendChild(row)
    return
  }
  var note2 = document.createElement('input')
  note2.id = 'handoffNote'
  note2.maxLength = 280
  note2.placeholder = 'Pickup time or download note'
  var row2 = el('div', 'row')
  var btn2 = el('button', '', 'POST HANDOFF NOTE')
  btn2.type = 'button'
  btn2.addEventListener('click', function () { handoff(item.id, { note: note2.value }) })
  row2.appendChild(btn2)
  box.appendChild(note2)
  box.appendChild(row2)
}

function paintSettle(box, item) {
  var word = item.releaseTo === 'buyer' ? 'REFUND' : 'RELEASE'
  box.appendChild(el('h2', '', word + ' THE FULL AMOUNT'))
  box.appendChild(el('p', '', word + ' TO ' + (item.releaseAddress || '')))
  box.appendChild(el('p', 'price', money(item, item.payAmount || item.amount)))
  box.appendChild(el('p', 'tag', 'EXACT UNITS ' + (item.releaseUnits || '')))
  box.appendChild(el('p', 'note', 'The escrow wallet pays the network fee. The recipient gets this full amount. DOSWAPZ fee is zero. Anything left in the escrow wallet is DOSWAPZ. This page checks the chain. It does not hold the key.'))
  var send = el('button', 'hot', 'SEND FROM THE ESCROW WALLET')
  send.type = 'button'
  send.addEventListener('click', function () { settleEscrow(item, '') })
  var paste = document.createElement('input')
  paste.maxLength = 120
  paste.placeholder = 'Or paste a transaction the escrow wallet already sent'
  var check = el('button', '', 'CHECK THAT PAYOUT')
  check.type = 'button'
  check.addEventListener('click', function () { settleEscrow(item, paste.value.trim()) })
  box.appendChild(send)
  box.appendChild(el('label', '', 'PAYOUT ALREADY SENT'))
  box.appendChild(paste)
  box.appendChild(check)
}

function paintEscrow(box, item) {
  if (item.escrowNotice) box.appendChild(el('p', 'note', item.escrowNotice))
  if (item.escrowPhase) box.appendChild(el('p', 'tag', 'ESCROW · ' + String(item.escrowPhase).toUpperCase()))
  if (item.dispute) box.appendChild(el('p', 'sold', item.dispute))
  if (item.shipBy) box.appendChild(el('p', 'tag', 'SHIPPING PROOF BY ' + whenLabel(item.shipBy)))
  if (item.quietUntil) box.appendChild(el('p', 'tag', 'QUIET UNTIL ' + whenLabel(item.quietUntil) + ' · THEN THE FULL AMOUNT IS RELEASED IF THERE IS NO DISPUTE'))
  if (item.tx) box.appendChild(el('p', 'tag', 'DEPOSIT · ' + item.tx))
  if (item.settleTx) box.appendChild(el('p', 'tag', 'PAYOUT · ' + item.settleTx))
  if (item.tracking) box.appendChild(el('p', '', (item.carrier || 'SHIPPED') + ' · ' + item.tracking))
  if (item.handoffNote) box.appendChild(el('p', '', 'NOTE · ' + item.handoffNote))
  paintShipTo(box, item)
  if (item.mine && item.escrowPhase === 'locked' && !item.proofAt) paintProofForm(box, item)
  if (item.buyerSide && item.escrowPhase === 'shipped') {
    var got = el('button', 'hot', 'I RECEIVED IT')
    got.type = 'button'
    got.addEventListener('click', function () { escrowAct('escrow-received', item.id) })
    box.appendChild(got)
  }
  if (item.buyerSide && (item.escrowPhase === 'locked' || item.escrowPhase === 'shipped')) {
    var reason = document.createElement('select')
    ;[['not-received', 'NOT RECEIVED'], ['not-as-described', 'NOT AS DESCRIBED'], ['damaged', 'DAMAGED']].forEach(function (pair) {
      var opt = document.createElement('option')
      opt.value = pair[0]
      opt.textContent = pair[1]
      reason.appendChild(opt)
    })
    var problemNote = document.createElement('input')
    problemNote.maxLength = 280
    problemNote.placeholder = 'What is wrong'
    var problem = el('button', 'danger', 'OPEN A DISPUTE')
    problem.type = 'button'
    problem.addEventListener('click', function () {
      escrowAct('escrow-problem', item.id, { reason: reason.value, note: problemNote.value })
    })
    box.appendChild(el('p', 'note', 'A dispute freezes the full amount. It moves only if you drop it or the seller accepts a full refund.'))
    box.appendChild(reason)
    box.appendChild(problemNote)
    box.appendChild(problem)
  }
  if (item.buyerSide && item.escrowPhase === 'disputed') {
    var drop = el('button', '', 'DROP THE DISPUTE')
    drop.type = 'button'
    drop.addEventListener('click', function () { escrowAct('escrow-drop', item.id) })
    box.appendChild(el('p', 'note', 'Dropping the dispute puts the sale back on the written clock. DOSWAPZ does not pick a winner.'))
    box.appendChild(drop)
  }
  if (item.mine && item.escrowPhase === 'disputed') {
    var refund = el('button', '', 'ACCEPT A FULL REFUND')
    refund.type = 'button'
    refund.addEventListener('click', function () { escrowAct('escrow-refund', item.id) })
    box.appendChild(el('p', 'note', 'This sends the full amount back to the buyer. There is no partial split.'))
    box.appendChild(refund)
  }
  if (!me && item.escrowPhase && item.escrowPhase !== 'settled' && item.escrowPhase !== 'release' && item.escrowPhase !== 'refund') {
    box.appendChild(el('p', 'note', 'Log in with the buyer account to mark received or to open a dispute. The seller account posts proof and can accept a full refund.'))
  }
  if (item.escrowPhase === 'release' || item.escrowPhase === 'refund') paintSettle(box, item)
}

function fieldRow(label, id, placeholder) {
  var lab = el('label', '', label)
  lab.setAttribute('for', id)
  var input = document.createElement('input')
  input.id = id
  input.maxLength = 160
  input.placeholder = placeholder || ''
  return { lab: lab, input: input }
}

function paintEntries(box, title, rows, item, kind) {
  if (!rows || !rows.length) return
  box.appendChild(el('h2', '', title))
  rows.forEach(function (entry) {
    var line = entry.state.toUpperCase() + ' · ' + money(item, entry.amount)
    if (entry.mine) line += ' · YOURS'
    if (entry.note) line += ' · ' + entry.note
    box.appendChild(el('p', '', line))
    if (item.mine && item.status === 'open' && entry.state === 'open' && !item.busy && item.deal !== 'accepted') {
      var row = el('div', 'row')
      var yes = el('button', '', 'ACCEPT')
      var no = el('button', 'danger', 'DECLINE')
      yes.type = 'button'
      no.type = 'button'
      yes.addEventListener('click', function () { answer(item.id, kind, entry.id, 'accept') })
      no.addEventListener('click', function () { answer(item.id, kind, entry.id, 'decline') })
      row.appendChild(yes)
      row.appendChild(no)
      box.appendChild(row)
    }
  })
}

function paintTrade(box, item) {
  var deal = item.deal === 'accepted' ? 'ACCEPTED PRICE ' + priceLine(item) + '. Crypto pays that amount plus shipping into escrow. PayPal pays the seller. DOSWAPZ fee is zero.' : ''
  if (deal) box.appendChild(el('p', 'tag', deal))
  if (item.mode === 'auction') {
    box.appendChild(el('p', 'tag', 'BIDS · ' + (item.bidCount || 0) + ' OPEN'))
    paintEntries(box, 'BIDS', item.bids, item, 'bid')
    if (item.ended && item.status === 'open' && item.deal !== 'accepted') {
      box.appendChild(el('p', 'note', 'Bidding is closed. The seller can still accept a bid. A bid is not a payment. DOSWAPZ fee is zero.'))
    } else if (me && !item.mine && item.status === 'open' && item.deal !== 'accepted' && !item.busy) {
      var bid = fieldRow('YOUR BID', 'bidAmount', 'Higher than the current bid')
      var bidNote = fieldRow('BID NOTE', 'bidNote', 'Optional')
      var bidBtn = el('button', '', 'PLACE BID')
      bidBtn.type = 'button'
      bidBtn.addEventListener('click', function () {
        trade('bid', item.id, bid.input.value, bidNote.input.value)
      })
      box.appendChild(bid.lab)
      box.appendChild(bid.input)
      box.appendChild(bidNote.lab)
      box.appendChild(bidNote.input)
      box.appendChild(el('p', 'note', 'A bid is not a payment. If the seller accepts, crypto pays escrow and PayPal pays the seller. DOSWAPZ fee is zero.'))
      box.appendChild(bidBtn)
    } else if (!me && item.status === 'open') {
      box.appendChild(el('p', 'note', 'Log in to place a bid.'))
    }
  } else {
    box.appendChild(el('p', 'tag', 'OFFERS · ' + (item.offerCount || 0) + ' OPEN'))
    paintEntries(box, 'OFFERS', item.offers, item, 'offer')
    if (me && !item.mine && item.status === 'open' && item.deal !== 'accepted' && !item.busy) {
      var offer = fieldRow('YOUR OFFER', 'offerAmount', 'A different price')
      var offerNote = fieldRow('OFFER NOTE', 'offerNote', 'Optional')
      var offerBtn = el('button', '', 'SEND OFFER')
      offerBtn.type = 'button'
      offerBtn.addEventListener('click', function () {
        trade('offer', item.id, offer.input.value, offerNote.input.value)
      })
      box.appendChild(offer.lab)
      box.appendChild(offer.input)
      box.appendChild(offerNote.lab)
      box.appendChild(offerNote.input)
      box.appendChild(el('p', 'note', 'An offer is not a payment. If the seller accepts, crypto pays escrow and PayPal pays the seller. DOSWAPZ fee is zero.'))
      box.appendChild(offerBtn)
    } else if (!me && item.status === 'open') {
      box.appendChild(el('p', 'note', 'Log in to send an offer.'))
    }
  }
  if (item.feedback && item.feedback.length) {
    box.appendChild(el('h2', '', 'FEEDBACK'))
    item.feedback.forEach(function (entry) {
      var word = entry.score === 'up' ? 'UP' : (entry.score === 'down' ? 'DOWN' : 'MID')
      var who = entry.role === 'seller' ? 'SELLER' : 'BUYER'
      box.appendChild(el('p', '', who + ' · ' + word + (entry.note ? ' · ' + entry.note : '')))
    })
  }
  if (item.canFeedback) {
    box.appendChild(el('h2', '', 'LEAVE FEEDBACK'))
    var note = fieldRow('FEEDBACK NOTE', 'feedbackNote', 'Optional')
    var row = el('div', 'row')
    ;[['up', 'UP'], ['mid', 'MID'], ['down', 'DOWN']].forEach(function (pair) {
      var btn = el('button', '', pair[1])
      btn.type = 'button'
      btn.addEventListener('click', function () { feedback(item.id, pair[0], note.input.value) })
      row.appendChild(btn)
    })
    box.appendChild(note.lab)
    box.appendChild(note.input)
    box.appendChild(el('p', 'note', 'One note on this sale. No feedback fee.'))
    box.appendChild(row)
  }
  if (me && !item.mine && !item.reported) {
    box.appendChild(el('h2', '', 'REPORT A VIOLATION'))
    var reason = document.createElement('select')
    reason.id = 'reportReason'
    ;((snap && snap.reasons) || []).forEach(function (opt) {
      var choice = document.createElement('option')
      choice.value = opt.id
      choice.textContent = opt.label
      reason.appendChild(choice)
    })
    var reportNote = fieldRow('WHAT HAPPENED', 'reportNote', 'Optional')
    var reportBtn = el('button', 'danger', 'REPORT')
    reportBtn.type = 'button'
    reportBtn.addEventListener('click', function () { report(item.id, reason.value, reportNote.input.value) })
    box.appendChild(reason)
    box.appendChild(reportNote.lab)
    box.appendChild(reportNote.input)
    box.appendChild(el('p', 'note', 'The report is not public. It does not pull the listing and it does not move money.'))
    box.appendChild(reportBtn)
  } else if (item.reported) {
    box.appendChild(el('p', 'note', 'You already reported this listing.'))
  }
}

async function trade(action, id, amount, note) {
  if (busy) return
  busy = true
  try {
    setStatus(action === 'bid' ? 'Saving the bid…' : 'Saving the offer…')
    await apiPost({ action: action, id: id, amount: String(amount || '').trim(), note: note || '' })
    setStatus(action === 'bid' ? 'Bid placed. It is not a payment.' : 'Offer sent. It is not a payment.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
  }
}

async function answer(id, kind, entry, decision) {
  if (busy) return
  busy = true
  try {
    await apiPost({ action: 'answer', id: id, kind: kind, entry: entry, decision: decision })
    setStatus(decision === 'accept' ? 'Accepted. Crypto pays escrow. PayPal pays you. DOSWAPZ fee is zero.' : 'Declined.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
  }
}

async function feedback(id, score, note) {
  if (busy) return
  busy = true
  try {
    await apiPost({ action: 'feedback', id: id, score: score, note: note || '' })
    setStatus('Feedback saved.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
  }
}

async function report(id, reason, note) {
  if (busy) return
  busy = true
  try {
    var data = await apiPost({ action: 'report', id: id, reason: reason, note: note || '' })
    setStatus(data.already ? 'You already reported this listing.' : 'Report received. It is not public.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
  }
}

function itemPhotos(item) {
  if (!item) return []
  if (item.photos && item.photos.length) return item.photos.filter(jpegOk)
  if (jpegOk(item.photo)) return [item.photo]
  return []
}

function paintGallery(box, item) {
  var pics = itemPhotos(item)
  if (!pics.length) return
  var wrap = el('div', 'gallery')
  var main = document.createElement('img')
  main.className = 'main'
  main.alt = ''
  main.src = pics[0]
  wrap.appendChild(main)
  if (pics.length > 1) {
    var row = el('div', 'thumbs')
    pics.forEach(function (src, i) {
      var btn = document.createElement('button')
      btn.type = 'button'
      if (i === 0) btn.className = 'on'
      var thumb = document.createElement('img')
      thumb.alt = 'Photo ' + (i + 1)
      thumb.src = src
      btn.appendChild(thumb)
      btn.addEventListener('click', function () {
        main.src = src
        var all = row.querySelectorAll('button')
        for (var n = 0; n < all.length; n++) all[n].classList.toggle('on', all[n] === btn)
      })
      row.appendChild(btn)
    })
    wrap.appendChild(row)
  }
  box.appendChild(wrap)
}

async function loadPhotos(id) {
  var item = findItem(id)
  if (!item || item.photos) return item
  if (!item.photoCount && !jpegOk(item.photo)) {
    item.photos = []
    return item
  }
  var res = await fetch('/api/ek?id=' + encodeURIComponent(id), { cache: 'no-store', credentials: 'same-origin' })
  var data = await res.json().catch(function () { return {} })
  if (!item) return null
  if (data && data.listing && Array.isArray(data.listing.photos)) {
    item.photos = data.listing.photos
    item.photo = data.listing.photo || item.photo
    item.photoCount = data.listing.photoCount || item.photos.length
  } else if (jpegOk(item.photo)) {
    item.photos = [item.photo]
  } else {
    item.photos = []
  }
  return item
}

async function refresh() {
  var keep = selected
  snap = await apiGet()
  me = snap.me || null
  paintEscrowNote()
  showGate()
  fillCats()
  paintBoard()
  paintDetail()
  if (keep && findItem(keep)) {
    await loadPhotos(keep)
    if (selected === keep) paintDetail()
  }
}

var pendingPhotos = []

function paintPhotoPreview() {
  var box = $('photoPreview')
  if (!box) return
  box.textContent = ''
  pendingPhotos.forEach(function (src, i) {
    if (!jpegOk(src)) return
    var img = document.createElement('img')
    img.alt = i === 0 ? 'Cover' : ('Photo ' + (i + 1))
    img.src = src
    box.appendChild(img)
  })
}

async function readPhotos() {
  var input = $('photo')
  var files = input && input.files ? Array.prototype.slice.call(input.files) : []
  if (files.length > 12) {
    pendingPhotos = []
    paintPhotoPreview()
    throw new Error('12 photos is the max. The first one is the cover.')
  }
  var out = []
  for (var i = 0; i < files.length; i++) out.push(await fileToJpeg(files[i]))
  pendingPhotos = out.filter(Boolean)
  paintPhotoPreview()
  return pendingPhotos
}

function encodeImage(img) {
  var max = 480
  var scale = Math.min(1, max / Math.max(img.width, img.height))
  var canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  var ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  var q = 0.72
  var data = canvas.toDataURL('image/jpeg', q)
  while (data.length > 48000 && q > 0.4) {
    q -= 0.08
    data = canvas.toDataURL('image/jpeg', q)
  }
  if (data.length > 50000) throw new Error('That photo is still too big. Use a simpler picture.')
  return data
}

function fileToJpeg(file) {
  return new Promise(function (resolve, reject) {
    if (!file) return resolve('')
    var img = new Image()
    var url = URL.createObjectURL(file)
    img.onload = function () {
      URL.revokeObjectURL(url)
      try { resolve(encodeImage(img)) }
      catch (e) { reject(e) }
    }
    img.onerror = function () {
      URL.revokeObjectURL(url)
      reject(new Error('That photo could not be read.'))
    }
    img.src = url
  })
}

function showTab(name) {
  Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (panel) {
    panel.hidden = panel.getAttribute('data-panel') !== name
  })
  var tabs = $('shopTabs')
  if (!tabs) return
  Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (btn) {
    btn.classList.toggle('on', btn.getAttribute('data-tab') === name)
  })
}

async function listItem(ev) {
  ev.preventDefault()
  if (busy) return
  busy = true
  $('listBtn').disabled = true
  try {
    var photos = pendingPhotos.slice()
    if ($('photo') && $('photo').files && $('photo').files.length && photos.length !== $('photo').files.length) {
      photos = await readPhotos()
    }
    setStatus('Saving the listing…')
    var data = await apiPost({
      action: 'list',
      title: $('title').value,
      description: $('description').value,
      rail: $('rail').value,
      amount: $('amount').value.trim(),
      payout: $('payout').value.trim(),
      payoutAgain: $('payoutAgain').value.trim(),
      ship: $('ship').value,
      shipAmount: $('shipAmount') ? $('shipAmount').value.trim() : '',
      shipFrom: $('shipFrom') ? $('shipFrom').value.trim() : '',
      shipNote: $('shipNote').value,
      category: $('category') ? $('category').value : '',
      condition: $('condition') ? $('condition').value : '',
      days: $('days') ? $('days').value : '',
      mode: $('mode') ? $('mode').value : 'fixed',
      photos: photos,
      mine: $('mine').checked,
      direct: $('direct').checked
    })
    $('title').value = ''
    $('description').value = ''
    $('amount').value = ''
    $('shipNote').value = ''
    if ($('shipFrom')) $('shipFrom').value = ''
    if ($('shipAmount')) $('shipAmount').value = '0'
    $('photo').value = ''
    pendingPhotos = []
    paintPhotoPreview()
    $('mine').checked = false
    $('direct').checked = false
    selected = data.listing && data.listing.id
    setStatus('Listed. Crypto pays the escrow wallet. PayPal pays you.')
    showTab('')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
    $('listBtn').disabled = false
  }
}

async function pullItem(id) {
  if (busy) return
  if (!window.confirm('Pull this listing?')) return
  busy = true
  try {
    await apiPost({ action: 'pull', id: id })
    if (selected === id) selected = ''
    setStatus('Listing pulled.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
  }
}

async function handoff(id, fields) {
  if (busy) return
  busy = true
  try {
    await apiPost({
      action: 'handoff',
      id: id,
      note: fields.note || '',
      carrier: fields.carrier || '',
      tracking: fields.tracking || ''
    })
    var row = findItem(id)
    var crypto = row && row.rail !== 'paypal'
    if (fields.tracking) setStatus(crypto ? 'Shipping proof posted. The seller has not been paid yet.' : 'Marked shipped.')
    else setStatus(crypto ? 'Handoff note saved. The seller has not been paid yet.' : 'Handoff note saved.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
  }
}

function solProvider() {
  var phantom = window.phantom && window.phantom.solana
  if (phantom) return phantom
  return window.solana || null
}

async function connectSol() {
  var provider = solProvider()
  if (!provider) throw new Error('No Solana wallet. Open Phantom.')
  var resp = await provider.connect()
  var key = resp && resp.publicKey ? resp.publicKey : provider.publicKey
  return { provider: provider, address: key.toString() }
}

async function connectEth() {
  if (!window.ethereum) throw new Error('No Ethereum wallet. Open MetaMask.')
  var acc = await window.ethereum.request({ method: 'eth_requestAccounts' })
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] })
  } catch (e) {
    throw new Error('Switch the wallet to Ethereum mainnet.')
  }
  return { address: acc[0] }
}

function u64(n) {
  var x = BigInt(n)
  var out = new Uint8Array(8)
  for (var i = 0; i < 8; i++) {
    out[i] = Number(x & 255n)
    x >>= 8n
  }
  return out
}

async function ata(owner, mint) {
  var token = new solanaWeb3.PublicKey(snap.tokenProgram)
  var program = new solanaWeb3.PublicKey(snap.assocProgram)
  var found = await solanaWeb3.PublicKey.findProgramAddress(
    [owner.toBuffer(), token.toBuffer(), mint.toBuffer()],
    program
  )
  return found[0]
}

async function sendSol(item, from, provider, dest, units) {
  if (!window.solanaWeb3) throw new Error('Solana library failed to load.')
  var conn = new solanaWeb3.Connection(location.origin + '/api/solana-rpc', 'confirmed')
  var payer = new solanaWeb3.PublicKey(from)
  var tx = new solanaWeb3.Transaction()
  if (item.rail === 'sol') {
    if (!Number.isSafeInteger(Number(units))) throw new Error('That SOL amount is too large for this page.')
    tx.add(solanaWeb3.SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new solanaWeb3.PublicKey(dest),
      lamports: Number(units)
    }))
  } else {
    var mint = new solanaWeb3.PublicKey(snap.usdcSol)
    var source = await ata(payer, mint)
    var destOwner = new solanaWeb3.PublicKey(dest)
    var dest = await ata(destOwner, mint)
    var sourceInfo = await conn.getAccountInfo(source)
    if (!sourceInfo) throw new Error('This Solana wallet has no USDC account.')
    var tokenProgram = new solanaWeb3.PublicKey(snap.tokenProgram)
    tx.add(new solanaWeb3.TransactionInstruction({
      programId: new solanaWeb3.PublicKey(snap.assocProgram),
      data: new Uint8Array([1]),
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: destOwner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: tokenProgram, isSigner: false, isWritable: false }
      ]
    }))
    var data = new Uint8Array(10)
    data[0] = 12
    data.set(u64(units), 1)
    data[9] = 6
    tx.add(new solanaWeb3.TransactionInstruction({
      programId: tokenProgram,
      data: data,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false }
      ]
    }))
  }
  tx.feePayer = payer
  var block = await conn.getLatestBlockhash()
  tx.recentBlockhash = block.blockhash
  var sig
  if (typeof provider.signAndSendTransaction === 'function') {
    var out = await provider.signAndSendTransaction(tx)
    sig = typeof out === 'string' ? out : (out.signature || (out.signature && out.signature.toString()) || '')
    if (sig && typeof sig !== 'string' && sig.toString) sig = sig.toString()
  } else {
    var signed = await provider.signTransaction(tx)
    sig = await conn.sendRawTransaction(signed.serialize())
  }
  try { await conn.confirmTransaction(sig, 'confirmed') } catch (e) {}
  return sig
}

async function sendEth(item, from, dest, units) {
  if (typeof ethers === 'undefined') throw new Error('ETH library failed to load.')
  var provider = new ethers.providers.Web3Provider(window.ethereum)
  var net = await provider.getNetwork()
  if (Number(net.chainId) !== 1) throw new Error('Switch to Ethereum mainnet.')
  var signer = provider.getSigner()
  var tx
  if (item.rail === 'eth') {
    tx = await signer.sendTransaction({
      to: dest,
      value: ethers.BigNumber.from(units)
    })
  } else {
    var iface = new ethers.utils.Interface(['function transfer(address to, uint256 amount)'])
    tx = await signer.sendTransaction({
      to: snap.usdcEth,
      data: iface.encodeFunctionData('transfer', [dest, ethers.BigNumber.from(units)])
    })
  }
  try { await tx.wait(1) } catch (e) {}
  return tx.hash
}

async function confirmPay(item, tx) {
  var wallet = item.chain === 'solana' ? await connectSol() : await connectEth()
  var data = await apiPost({
    action: 'confirm',
    id: item.id,
    tx: tx,
    buyer: wallet.address,
    holdKey: holdKey()
  })
  pendingTx = ''
  setStatus(item.rail === 'paypal' ? 'Sold. The seller was paid directly.' : 'Funds are in escrow. The seller has not been paid.')
  if (data.listing) selected = data.listing.id
  await refresh()
}

async function escrowAct(action, id, extra) {
  if (busy) return
  busy = true
  try {
    await apiPost(Object.assign({ action: action, id: id }, extra || {}))
    if (action === 'escrow-received') setStatus('Received. Release of the full amount is authorized. The seller is paid when the escrow wallet sends it.')
    else if (action === 'escrow-problem') setStatus('The full amount is frozen until both sides accept the same outcome.')
    else if (action === 'escrow-refund') setStatus('A full refund is authorized. The buyer is paid when the escrow wallet sends it.')
    else setStatus('Dispute dropped. The written clock applies again.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  } finally {
    busy = false
  }
}

async function sendFromEscrow(item) {
  var dest = item.releaseAddress
  var units = item.releaseUnits
  var pot = item.escrow || payDest(item)
  if (!dest || !units || !pot) throw new Error('This sale has no payout yet.')
  if (sameWallet(dest, pot, item.chain)) throw new Error('The payout cannot go back to the escrow wallet.')
  if (item.chain === 'solana') {
    var sol = await connectSol()
    if (!sameWallet(sol.address, pot, 'solana')) throw new Error('Connect the escrow wallet. This page will not sign from another wallet.')
    return sendSol(item, sol.address, sol.provider, dest, units)
  }
  var eth = await connectEth()
  if (!sameWallet(eth.address, pot, 'ethereum')) throw new Error('Connect the escrow wallet. This page will not sign from another wallet.')
  return sendEth(item, eth.address, dest, units)
}

async function settleEscrow(item, existing) {
  if (busy) return
  busy = true
  try {
    var sig = existing
    if (!sig) {
      setStatus('Connect the escrow wallet and approve the full amount.')
      sig = await sendFromEscrow(item)
    }
    if (!sig) throw new Error('The wallet did not return a transaction.')
    setStatus('Checking the payout on the chain…')
    await apiPost({ action: 'escrow-settle', id: item.id, tx: sig })
    setStatus(item.releaseTo === 'buyer' ? 'The buyer was paid the full amount back.' : 'The seller was paid the full amount.')
    await refresh()
  } catch (e) {
    var msg = e && e.message ? e.message : String(e)
    if (/reject|denied|cancel/i.test(msg)) msg = 'The escrow wallet did not sign. Nothing was released.'
    setStatus(msg)
  } finally {
    busy = false
  }
}

async function buy(item) {
  if (busy || biddingClosed(item)) return
  busy = true
  try {
    var shipTo = null
    if (item.ship === 'ship') {
      shipTo = {
        name: $('shipName').value,
        line1: $('shipLine1').value,
        line2: $('shipLine2').value,
        city: $('shipCity').value,
        region: $('shipRegion').value,
        postal: $('shipPostal').value,
        country: $('shipCountry').value
      }
    }
    if (item.rail !== 'paypal' && !me) {
      setStatus('Log in before you pay into escrow.')
      return
    }
    if (item.rail !== 'paypal' && !chainArmed(item)) {
      setStatus('Crypto escrow is not armed for this chain.')
      return
    }
    setStatus('Holding the listing…')
    await apiPost({ action: 'hold', id: item.id, holdKey: holdKey(), shipTo: shipTo })
    if (item.rail === 'paypal') {
      if (!snap.paypal || !snap.paypal.armed) {
        var total = item.payAmount || item.amount
        setStatus('PayPal checkout is not armed. Pay ' + item.payout + ' yourself for ' + money(item, total) + '. E.K. will not mark it sold until PayPal confirms.')
        return
      }
      setStatus('Opening PayPal…')
      var order = await apiPost({ action: 'paypal-order', id: item.id, holdKey: holdKey() })
      location.href = order.approve
      return
    }
    var dest = payDest(item)
    if (!dest) throw new Error('Crypto escrow is not armed for this chain.')
    setStatus('Approve the payment in your wallet. It goes to the escrow wallet. The seller is not paid yet.')
    var sig
    if (item.chain === 'solana') {
      var sol = await connectSol()
      sig = await sendSol(item, sol.address, sol.provider, dest, dueUnits(item))
    } else {
      var eth = await connectEth()
      sig = await sendEth(item, eth.address, dest, dueUnits(item))
    }
    if (!sig) throw new Error('The wallet did not return a transaction.')
    pendingTx = sig
    setStatus('Checking the chain…')
    await confirmPay(item, sig)
  } catch (e) {
    var msg = e && e.message ? e.message : String(e)
    if (/reject|denied|cancel/i.test(msg)) msg = 'The wallet did not sign. Nothing was locked in escrow.'
    setStatus(msg)
    paintDetail()
  } finally {
    busy = false
  }
}

async function resumePaypal() {
  var params = new URLSearchParams(location.search)
  var mode = params.get('ekpaypal')
  if (!mode) return
  var id = params.get('listing') || ''
  var token = params.get('token') || ''
  history.replaceState({}, '', location.pathname)
  if (mode === 'cancel') {
    setStatus('PayPal checkout was cancelled. The listing stays open.')
    return
  }
  if (mode !== '1' || !id || !token) return
  try {
    setStatus('Confirming PayPal…')
    await apiPost({ action: 'paypal-capture', id: id, orderId: token, holdKey: holdKey() })
    selected = id
    setStatus('PayPal completed. The seller was paid directly.')
    await refresh()
  } catch (e) {
    setStatus(e.message || String(e))
  }
}

$('filters').addEventListener('click', function (ev) {
  var btn = ev.target.closest('button')
  if (!btn) return
  filter = btn.getAttribute('data-filter')
  Array.prototype.forEach.call($('filters').querySelectorAll('button'), function (node) {
    node.classList.toggle('on', node === btn)
  })
  paintBoard()
})

if ($('dept')) $('dept').addEventListener('change', fillTypes)
if ($('mode')) $('mode').addEventListener('change', syncSale)
if ($('q')) {
  $('q').addEventListener('input', function () {
    query = $('q').value.trim().toLowerCase()
    paintBoard()
  })
}
if ($('sort')) $('sort').addEventListener('change', paintBoard)
if ($('condFilter')) {
  $('condFilter').addEventListener('change', function () {
    condFilter = $('condFilter').value || 'all'
    paintBoard()
  })
}
var browse = $('browse')
if (browse) {
  browse.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button')
    if (!btn) return
    deptFilter = btn.getAttribute('data-dept') || 'all'
    catFilter = 'all'
    paintBrowse()
    paintBoard()
  })
}
var browseSubs = $('browseSubs')
if (browseSubs) {
  browseSubs.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button')
    if (!btn) return
    catFilter = btn.getAttribute('data-cat') || 'all'
    paintBrowse()
    paintBoard()
  })
}
$('rail').addEventListener('change', syncPayout)
$('ship').addEventListener('change', syncShipFields)
var shopTabs = $('shopTabs')
if (shopTabs) {
  shopTabs.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button')
    if (!btn) return
    var name = btn.getAttribute('data-tab') || ''
    showTab(btn.classList.contains('on') ? '' : name)
  })
}
if (location.hash === '#legal') showTab('legal')
else if (location.hash === '#sell') showTab('sell')
else if (location.hash === '#how') showTab('how')
if ($('photo')) {
  $('photo').addEventListener('change', function () {
    readPhotos().catch(function (e) {
      if ($('photo')) $('photo').value = ''
      pendingPhotos = []
      paintPhotoPreview()
      setStatus(e.message || String(e))
    })
  })
}
$('sellBox').addEventListener('submit', listItem)
syncShipFields()
syncSale()

refresh().then(function () {
  document.documentElement.setAttribute('data-ek', 'ready')
  return resumePaypal()
}).catch(function (e) {
  setStatus(e.message || String(e))
  $('gateText').textContent = 'E.K. did not load. Restart the local site server and open this page again.'
})
