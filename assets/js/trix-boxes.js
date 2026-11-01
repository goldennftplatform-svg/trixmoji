'use strict'

const BOXES_API = '/api/trix-boxes'
const BOXES_METERS = '/api/trix-boxes?meters=1'
const BOXES_FALLBACK = '/assets/data/trix-boxes.json?v=20260928holders'
let lastMeters = null

function fmtCount(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '--'
  return Math.floor(v).toLocaleString('en-US')
}

function meterValue(live, value, unpublished) {
  if (unpublished) return 'NOT PUBLISHED'
  if (value == null || value === '') return 'UNAVAILABLE'
  return fmtCount(value)
}

function fmtNum(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '--'
  if (Math.abs(v - Math.round(v)) > 0.001) return v.toFixed(2)
  return Math.round(v).toLocaleString('en-US')
}

function fmtSol(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '--'
  return v.toFixed(v >= 1 ? 2 : 3)
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtUsd(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '--'
  if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US')
  return '$' + v.toFixed(2)
}

function asBoxLabel(s) {
  return String(s == null ? '' : s).replace(/\bpacks?\b/gi, 'BOX').toUpperCase()
}

function packCard(box) {
  const id = esc(box.id || 'unknown')
  const type = esc(asBoxLabel(box.type || box.name || id))
  const color = esc(box.color || 'BLACK')
  const hex = esc(box.hex || '#111111')
  const art = box.artUrl ? esc(box.artUrl) : ''
  const live = box.inRound !== false
  const minted = live && box.minted != null ? fmtCount(box.minted) : 'NO TYPE SPLIT'
  const left = live && (box.left != null || box.available != null)
    ? fmtCount(box.left != null ? box.left : box.available)
    : 'NOT PUBLISHED'
  const price = live
    ? (fmtUsd(box.priceUsd) + ' / ' + fmtSol(box.priceSol) + ' SOL')
    : 'NOT THIS ROUND'
  const visual = art
    ? '<img src="' + art + '" alt="' + type + '" width="180" height="250">'
    : '<div class="pack-face" aria-hidden="true"></div>'
  return (
    '<article class="pack-card ' + id + '" style="--pack:' + hex + '">' +
      '<div class="pack-visual">' + visual + '<div class="pack-swatch" aria-hidden="true"></div></div>' +
      '<div class="pack-type">' + type + (box.soldOut ? ' * SOLD OUT' : '') + '</div>' +
      '<div class="pack-color">COLOR * ' + color + (box.isNew ? ' * NEW' : '') + '</div>' +
      '<div class="pack-count">' + minted + '</div>' +
      '<div class="pack-label">MINTED</div>' +
      '<div class="pack-color">LEFT * ' + left + '</div>' +
      '<div class="pack-label">' + esc(price) + '</div>' +
    '</article>'
  )
}

function typeCard(card) {
  const id = esc(String(card.id || card.type || 'card').toLowerCase())
  const type = esc(card.type || card.name || id)
  const color = esc(card.color || 'BLACK')
  const hex = esc(card.hex || '#111111')
  return (
    '<article class="pack-card type-card ' + id + '" style="--pack:' + hex + '">' +
      '<div class="pack-visual"><div class="pack-face bevel" aria-hidden="true"></div></div>' +
      '<div class="pack-type">' + type + '</div>' +
      '<div class="pack-color">COLOR * ' + color + '</div>' +
      '<div class="pack-count">' + fmtSol(card.priceSol) + '</div>' +
      '<div class="pack-label">SHOP SOL</div>' +
    '</article>'
  )
}

function rarityChip(r) {
  const hex = esc(r.hex || '#aaa')
  return (
    '<article class="rarity-chip" style="--pack:' + hex + '">' +
      '<div class="rarity-swatch" aria-hidden="true"></div>' +
      '<div class="pack-type">' + esc(r.type) + '</div>' +
      '<div class="pack-color">COLOR * ' + esc(r.color) + '</div>' +
      '<div class="pack-count">' + esc(r.oddsPct) + '%</div>' +
      '<div class="pack-label">ODDS</div>' +
    '</article>'
  )
}

function renderLiveCounts(data) {
  if (data && data.public) lastMeters = data
  const root = document.getElementById('trixLiveCounts')
  const stamp = document.getElementById('trixLiveStamp')
  const note = document.getElementById('trixLiveNote')
  const p = (data && data.public) || {}
  const minted = p.boxesMinted != null ? p.boxesMinted : data && data.mintedTotal
  const posted = p.memesPosted != null ? p.memesPosted : null
  const pulled = p.snapshotAt || data && data.metersPulledAt || data && data.updatedAt
  if (stamp) {
    const live = p.live && p.live.memesPosted && p.live.boxesMinted
    stamp.textContent = (live ? 'LIVE' : (p.unavailable && p.unavailable.length ? 'PARTIAL' : 'LIVE')) +
      (pulled ? ' * ' + new Date(pulled).toLocaleTimeString() : '')
  }
  if (root) {
    const cells = [
      ['BOXES ON-CHAIN', meterValue(true, minted, false)],
      ['BOXES LEFT', 'NOT PUBLISHED'],
      ['MEMES POSTED', meterValue(true, posted, false)],
      ['LAUNCHES', meterValue(true, p.launches, false)]
    ]
    root.className = 'kpis dense'
    root.innerHTML = cells.map(function (c) {
      const missing = c[1] === 'UNAVAILABLE' || c[1] === 'NOT PUBLISHED'
      return '<article' + (missing ? ' class="down"' : '') + '><div class="l">' + esc(c[0]) + '</div><div class="v' +
        (missing ? ' small' : '') + '">' + esc(c[1]) + '</div></article>'
    }).join('')
  }
  if (note) {
    note.innerHTML = '<strong>' + (p.stale ? 'STALE SNAPSHOT.' : 'PUBLIC METERS.') + '</strong> ' +
      esc(p.countNote || 'Memes posted is the TRiX feed sequence. Boxes left is not published.')
  }
}

function renderPublic(data) {
  renderLiveCounts(data)
  const root = document.getElementById('trixPublic')
  if (!root) return
  const p = (data && data.public) || {}
  const minted = p.boxesMinted != null ? p.boxesMinted : data && data.mintedTotal
  const cells = [
    ['ROUND', data && data.round != null ? String(data.round) : '--'],
    ['STATUS', String((data && data.roundStatus) || (p.enabled === false ? 'off' : 'live')).toUpperCase()],
    ['NETWORK', String(p.network || 'solana').toUpperCase()],
    ['BOXES ON-CHAIN', meterValue(true, minted, false)],
    ['BOXES LEFT', 'NOT PUBLISHED'],
    ['MEMES POSTED', meterValue(true, p.memesPosted, false)],
    ['MEMES COUNTED', meterValue(true, p.memesCounted, false)],
    ['LAUNCHES', meterValue(true, p.launches, false)],
    ['ROUND FLOOR', fmtUsd(p.roundFloor)],
    ['REWARD USD', fmtUsd(p.rewardValueUsd)],
    ['COVERABLE', fmtUsd(p.coverableUsd)],
    ['LIABILITY', fmtUsd(p.outstandingLiabilityUsd)],
    ['VAULT', p.vaultBacked ? 'BACKED' : 'OPEN'],
    ['STAKED BOXES', p.stakedBoxes == null ? 'UNAVAILABLE' : fmtCount(p.stakedBoxes)],
    ['POOL FUNDED', fmtUsd(p.fundedUsd)],
    ['POOL OWED', fmtUsd(p.owedUsd)],
    ['POOL PAID', fmtUsd(p.paidUsd)],
    ['TCG', p.tcg ? 'ON' : 'OFF'],
    ['SNAPSHOT', p.stale ? 'STALE' : (p.snapshotAt ? new Date(p.snapshotAt).toLocaleTimeString() : '--')],
    ['MKT STATE', p.mktStateRetired ? 'RETIRED 404' : 'LIVE'],
    ['TOP BOXES', topBoxLabel(data)]
  ]
  root.className = 'kpis dense'
  root.innerHTML = cells.map(function (c) {
    return '<article><div class="l">' + esc(c[0]) + '</div><div class="v">' + esc(c[1]) + '</div></article>'
  }).join('')

  const extra = document.getElementById('trixPublicExtra')
  if (extra) {
    extra.innerHTML =
      '<div class="pack-meta">' +
      '<span>MEME VAULT * ' + esc(p.memeVault || '--') + '</span>' +
      '<span>VESTING * ' + esc(p.vestingVault || '--') + '</span>' +
      '<span>LOCK COVER * ' + esc(p.sharedLockCoverageBps != null ? p.sharedLockCoverageBps + ' BPS' : '--') + '</span>' +
      '<span>MEME POOL FLOOR * ' + esc(fmtUsd(p.memePoolFloor)) + '</span>' +
      '</div>'
  }

  const board = document.getElementById('trixLeaders')
  if (board) {
    const rows = data && data.leaderboard ? data.leaderboard : []
    if (!rows.length) {
      board.innerHTML = '<div class="empty">NO PUBLIC LEADERBOARD YET.</div>'
    } else {
      board.innerHTML = rows.map(function (r) {
        return (
          '<div class="row">' +
          '<span class="when">#' + esc(r.rank) + '</span>' +
          esc(r.username || 'anon') +
          (r.verified ? ' * VERIFIED' : '') +
          ' * ' + esc(Number(r.points || 0).toLocaleString('en-US')) + ' PTS' +
          '</div>'
        )
      }).join('')
    }
  }

  renderBoxLeaders(data)
}

function topBoxLabel(data) {
  const rows = (data && data.collectors) || []
  const top = rows[0]
  if (!top || !top.username) return '--'
  if (top.boxes > 0) return String(top.username).toUpperCase() + ' ' + fmtCount(top.boxes)
  if (top.rips > 0) return String(top.username).toUpperCase() + ' ' + fmtCount(top.rips) + ' RIPS'
  return '--'
}

function shortWallet(addr) {
  const s = String(addr || '')
  if (s.length < 12) return s
  return s.slice(0, 4) + '...' + s.slice(-4)
}

function renderBoxLeaders(data) {
  const board = document.getElementById('trixBoxLeaders')
  if (!board) return
  const rows = (data && data.collectors) || []
  const chain = (data && data.chain) || {}
  const tcg = data && data.public && data.public.tcg
  const stamp = document.getElementById('trixBoxStamp')
  if (stamp) {
    if (chain.engine === 'receipts') {
      const counted = chain.censusBoxes != null ? chain.censusBoxes : rows.reduce(function (n, r) {
        return n + (Number(r.boxes) || 0)
      }, 0)
      stamp.textContent = 'CHAIN * RECEIPTS * ' + rows.length + ' HOLDERS * ' + fmtCount(counted) + ' BOXES'
    }
    else if (chain.engine === 'helius') {
      stamp.textContent = 'CHAIN * HELIUS * ' +
        (rows.length ? rows.length + ' BUYERS' : ((chain.censusWallets || chain.walletsScanned || 0) + ' WALLETS'))
    }
    else if (chain.engine === 'solscan') stamp.textContent = 'CHAIN * SOLSCAN * ' + (chain.walletsScanned || 0) + ' WALLETS'
    else if (chain.needSolscanUpgrade) stamp.textContent = 'CHAIN * SOLSCAN FREE * RPC SAMPLE'
    else if (chain.needSolscanKey) stamp.textContent = 'CHAIN * NEED SOLSCAN_API_KEY * RPC SAMPLE'
    else if (chain.engine === 'rpc') stamp.textContent = 'CHAIN * RPC FALLBACK'
    else stamp.textContent = 'OFFICIAL COLLECTORS'
  }
  if (!rows.length) {
    let why = 'NO BOX CAPTURES YET. TCG ' + (tcg ? 'ON' : 'OFF') + '.'
    if (chain.needSolscanUpgrade) {
      why += ' SOLSCAN FREE PLAN CANNOT READ WALLET TRANSFERS. LITE UNLOCKS THE FULL BOX SCAN.'
    } else if (chain.needSolscanKey) {
      why += ' SET SOLSCAN_API_KEY TO SCAN TRIX WALLETS ON SOLSCAN.'
    } else if (chain.timedOut) {
      why += ' CHAIN SCAN TIMED OUT. RETRY.'
    } else if (chain.error) {
      why += ' ' + String(chain.error).slice(0, 80)
    } else {
      why += ' SEALED COUNTS ARE LOGIN-ONLY ON TRIX. CHAIN SCAN FOUND NO MATCHING BOX PAYMENTS.'
    }
    board.innerHTML = '<div class="empty">' + esc(why) + '</div>'
    return
  }
  const hasBoxes = rows.some((r) => Number(r.boxes) > 0)
  board.innerHTML = rows.map(function (r) {
    let metric
    if (hasBoxes) {
      metric = fmtCount(r.boxes) + ' BOXES'
      if (r.kinds) {
        const bits = Object.keys(r.kinds).map(function (k) {
          return String(k).toUpperCase() + ' ' + fmtCount(r.kinds[k])
        })
        if (bits.length) metric += ' * ' + bits.join(' / ')
      }
      if (r.rips) metric += ' * ' + fmtCount(r.rips) + ' RIPS'
    } else {
      metric = fmtCount(r.rips) + ' RIPS'
      if (r.mythics) metric += ' * ' + fmtCount(r.mythics) + ' MYTHICS'
    }
    const wallet = r.wallet
      ? ' <a href="' + esc(r.solscan || ('https://solscan.io/account/' + r.wallet)) +
        '" target="_blank" rel="noopener">' + esc(shortWallet(r.wallet)) + '</a>'
      : ''
    return (
      '<div class="row">' +
      '<span class="when">#' + esc(r.rank) + '</span>' +
      esc(r.username || 'anon') +
      wallet +
      (r.verified ? ' * VERIFIED' : '') +
      ' * ' + esc(metric) +
      '</div>'
    )
  }).join('')
}

function renderBoxes(data, root) {
  if (!root) return
  const boxes = (data && data.boxes) || []
  const cards = (data && data.cards) || []
  const rarities = (data && data.rarities) || []
  if (!boxes.length && !cards.length) {
    root.innerHTML = '<div class="empty">NO PUBLIC BOX COUNTS YET.</div>'
    return
  }
  const liveTotal = (lastMeters && lastMeters.public && lastMeters.public.boxesMinted != null)
    ? lastMeters.public.boxesMinted
    : data.mintedTotal
  const total = meterValue(true, liveTotal, false)
  const status = esc((data.roundStatus || 'LIVE').toUpperCase())
  const round = data.round != null ? 'ROUND ' + esc(data.round) : 'ROUND'
  const source = esc(data.source || 'trix.market')
  const stamp = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : ''
  root.innerHTML =
    '<div class="pack-meta">' +
      '<span>' + round + ' * ' + status + '</span>' +
      '<span>BOXES ON-CHAIN * ' + total + '</span>' +
      '<span>PER-TYPE MINTED IS NOT PUBLISHED</span>' +
      '<span>' + source + (stamp ? ' * ' + esc(stamp) : '') + '</span>' +
    '</div>' +
    '<h3 class="pack-subhead">SEALED BOXES</h3>' +
    '<div class="pack-grid">' + boxes.map(packCard).join('') + '</div>' +
    (cards.length
      ? '<h3 class="pack-subhead">BOX TYPES</h3><div class="pack-grid types">' + cards.map(typeCard).join('') + '</div>'
      : '') +
    (rarities.length
      ? '<h3 class="pack-subhead">RARITY TIERS</h3><div class="pack-grid rarities">' + rarities.map(rarityChip).join('') + '</div>'
      : '')
}

async function loadTrixBoxes() {
  const root = document.getElementById('packBoard')
  const counts = document.getElementById('trixLiveCounts') || document.getElementById('trixPublic')
  if (!root && !counts) return
  try {
    const fast = await fetch(BOXES_METERS, { cache: 'no-store' })
    if (fast.ok) {
      const meters = await fast.json()
      renderPublic(meters)
      if (root && !root.querySelector('.pack-grid')) renderBoxes(meters, root)
    }
  } catch (e) {}
  try {
    const res = await fetch(BOXES_API, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      renderPublic(data)
      if (root) renderBoxes(data, root)
      if (memeEl('memeKpis')) renderMemeKpis()
      return
    }
  } catch (e) {}
  try {
    const res = await fetch(BOXES_FALLBACK, { cache: 'no-store' })
    if (!res.ok) throw new Error('fallback')
    const data = await res.json()
    data.source = (data.source || 'bundled') + ' (cached)'
    if (!data.public) data.public = {}
    data.public.stale = true
    renderPublic(data)
    if (root) renderBoxes(data, root)
  } catch (e) {
    if (root) root.innerHTML = '<div class="empty">BOX COUNTS OFFLINE.</div>'
    const stamp = document.getElementById('trixLiveStamp')
    if (stamp) stamp.textContent = 'API DOWN'
  }
}

const MEME_VIEWS = {
  users: {
    label: 'WHO MADE THEM',
    metrics: [
      { id: 'memes', label: 'MEMES' },
      { id: 'tokenCount', label: 'TOKENS' },
      { id: 'hearts', label: 'LIKES' },
      { id: 'avgHearts', label: 'AVG LIKES' },
      { id: 'name', label: 'A-Z' }
    ],
    columns: [
      { id: 'name', label: 'USER', kind: 'name' },
      { id: 'memes', label: 'MEMES', kind: 'num' },
      { id: 'hearts', label: 'LIKES', kind: 'num' },
      { id: 'avgHearts', label: 'AVG', kind: 'num' },
      { id: 'tokenCount', label: 'TOKENS', kind: 'num' }
    ]
  },
  tokens: {
    label: 'MEMES ON TOKENS',
    metrics: [
      { id: 'memes', label: 'MEMES' },
      { id: 'authorCount', label: 'AUTHORS' },
      { id: 'memesPerAuthor', label: 'MEMES / AUTHOR' },
      { id: 'hearts', label: 'HEARTS' },
      { id: 'creator', label: 'CREATOR A-Z' },
      { id: 'name', label: 'TOKEN A-Z' }
    ],
    columns: [
      { id: 'name', label: 'TOKEN', kind: 'name' },
      { id: 'memes', label: 'MEMES', kind: 'num' },
      { id: 'authorCount', label: 'AUTHORS', kind: 'num' },
      { id: 'memesPerAuthor', label: '/AUTHOR', kind: 'num' },
      { id: 'hearts', label: 'HEARTS', kind: 'num' },
      { id: 'creator', label: 'CREATOR', kind: 'name' }
    ]
  },
  perToken: {
    label: 'MEMES PER TOKEN',
    metrics: [
      { id: 'memesPerAuthor', label: 'MEMES / AUTHOR' },
      { id: 'memes', label: 'MEMES' },
      { id: 'authorCount', label: 'AUTHORS' },
      { id: 'hearts', label: 'HEARTS' },
      { id: 'name', label: 'TOKEN A-Z' }
    ],
    columns: [
      { id: 'name', label: 'TOKEN', kind: 'name' },
      { id: 'memes', label: 'MEMES', kind: 'num' },
      { id: 'memesPerAuthor', label: '/AUTHOR', kind: 'num' },
      { id: 'authorCount', label: 'AUTHORS', kind: 'num' },
      { id: 'hearts', label: 'HEARTS', kind: 'num' },
      { id: 'creator', label: 'CREATOR', kind: 'name' }
    ]
  },
  memes: {
    label: 'LIKES PER MEME',
    metrics: [
      { id: 'hearts', label: 'LIKES' },
      { id: 'skulls', label: 'SKULLS' },
      { id: 'replies', label: 'REPLIES' },
      { id: 'name', label: 'AUTHOR A-Z' }
    ],
    columns: [
      { id: 'name', label: 'MEME', kind: 'name' },
      { id: 'hearts', label: 'LIKES', kind: 'num' },
      { id: 'skulls', label: 'SKULLS', kind: 'num' },
      { id: 'replies', label: 'REPLIES', kind: 'num' },
      { id: 'tokenSymbol', label: 'TOKEN', kind: 'name' }
    ]
  },
  creators: {
    label: 'TOKEN CREATORS',
    metrics: [
      { id: 'memes', label: 'TOKEN MEMES' },
      { id: 'tokens', label: 'TOKENS LAUNCHED' },
      { id: 'authorCount', label: 'AUTHORS' },
      { id: 'name', label: 'A-Z' }
    ],
    columns: [
      { id: 'name', label: 'CREATOR', kind: 'name' },
      { id: 'tokens', label: 'TOKENS', kind: 'num' },
      { id: 'memes', label: 'MEMES', kind: 'num' },
      { id: 'authorCount', label: 'AUTHORS', kind: 'num' }
    ]
  }
}

let memeState = {
  data: null,
  view: 'users',
  metric: 'memes',
  sortDir: 'desc',
  top: 0,
  query: '',
  drill: null,
  selected: -1,
  rows: [],
  hits: [],
  chartSize: '',
  searchTimer: 0,
  resizeTimer: 0,
  drawing: false
}

function memeEl(id) {
  return document.getElementById(id)
}

function activeView() {
  return memeState.drill ? 'users' : memeState.view
}

function viewSpec() {
  return MEME_VIEWS[activeView()] || MEME_VIEWS.users
}

function metricValue(row, metric) {
  if (metric === 'name' || metric === 'creator') return 0
  const v = Number(row && row[metric])
  return Number.isFinite(v) ? v : 0
}

function rowLabel(row, view) {
  view = view || activeView()
  if (view === 'memes') {
    return (row.author || 'anon') + (row.tokenSymbol ? ' / $' + row.tokenSymbol : '')
  }
  if (view === 'tokens' || view === 'perToken') {
    const sym = row.symbol ? '$' + row.symbol : (row.name || 'TOKEN')
    return sym
  }
  return row.username || row.name || 'anon'
}

function tokenBits(row) {
  return (row && row.tokens) || []
}

function tokenName(t) {
  if (!t) return ''
  if (typeof t === 'string') return t
  return t.name || ''
}

function tokenMemes(t) {
  if (!t || typeof t === 'string') return 0
  return Number(t.memes) || 0
}

function markChoices(root, attr, value) {
  if (!root) return
  const buttons = root.querySelectorAll('.meme-choice')
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i]
    const on = String(btn.getAttribute(attr)) === String(value)
    if (on) btn.classList.add('on')
    else btn.classList.remove('on')
  }
}

function syncChoiceButtons() {
  const spec = viewSpec()
  const keep =
    spec.metrics.some((m) => m.id === memeState.metric) ||
    (spec.columns || []).some((c) => c.id === memeState.metric)
  if (!keep) {
    memeState.metric = spec.metrics[0].id
    memeState.sortDir = 'desc'
  }
  const metricRoot = memeEl('memeMetric')
  if (metricRoot) {
    const html = spec.metrics.map(function (m) {
      const on = m.id === memeState.metric ? ' on' : ''
      return (
        '<button type="button" class="meme-choice' + on + '" data-metric="' + esc(m.id) + '">' +
        esc(m.label) +
        '</button>'
      )
    }).join('')
    if (metricRoot._html !== html) {
      metricRoot.innerHTML = html
      metricRoot._html = html
    } else {
      markChoices(metricRoot, 'data-metric', memeState.metric)
    }
  }
  markChoices(memeEl('memeView'), 'data-view', memeState.view)
  markChoices(memeEl('memeTop'), 'data-top', memeState.top)
  const back = memeEl('memeBack')
  if (back) back.hidden = !memeState.drill
}

function sourceRows() {
  const data = memeState.data
  if (!data) return []
  if (memeState.drill) {
    const mint = memeState.drill.mint
    const tokens = ((data.views && data.views.tokens) || []).concat((data.views && data.views.perToken) || [])
    const hit = tokens.find((t) => t.mint === mint) || tokens.find((t) => t.symbol === memeState.drill.symbol)
    return (hit && hit.authors) || []
  }
  const views = data.views || {}
  if (memeState.view === 'tokens') return views.tokens || []
  if (memeState.view === 'perToken') return views.perToken || views.tokens || []
  if (memeState.view === 'creators') return views.creators || []
  if (memeState.view === 'memes') return views.memes || []
  if (views.users && views.users.length) return views.users
  return data.ranking || []
}

function nameValue(row, metric) {
  if (metric === 'creator') return String(row.creator || '')
  return rowLabel(row)
}

function filteredRows() {
  const q = String(memeState.query || '').trim().toLowerCase()
  let rows = sourceRows().slice()
  if (q) {
    rows = rows.filter((r) => {
      const blob = [
        r.username, r.name, r.symbol, r.creator,
        tokenBits(r).map(tokenName).join(' '),
        (r.symbols || []).join(' '),
        (r.authors || []).map((a) => a.username).join(' ')
      ].join(' ').toLowerCase()
      return blob.indexOf(q) !== -1
    })
  }
  const metric = memeState.metric
  const dir = memeState.sortDir === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    if (metric === 'name' || metric === 'creator') {
      return dir * nameValue(a, metric).localeCompare(nameValue(b, metric))
    }
    const d = metricValue(a, metric) - metricValue(b, metric)
    if (d) return dir * d
    return rowLabel(a).localeCompare(rowLabel(b))
  })
  const cap = memeState.top
  return cap > 0 ? rows.slice(0, cap) : rows
}

function cellValue(row, col, view) {
  if (col.id === 'name') return rowLabel(row, view)
  if (col.id === 'creator') return row.creator || '--'
  const v = row[col.id]
  if (v == null || v === '') return '--'
  return v
}

function renderLikeDesk(data) {
  const root = document.getElementById('likeDesk')
  if (!root) return
  const likes = (data && data.likes) || {}
  const topU = likes.topUser
  const topM = likes.topMeme
  const cells = [
    ['TOTAL LIKES', fmtCount(likes.hearts)],
    ['MEMES WITH LIKES', fmtCount(likes.withLikes)],
    ['AVG LIKES / MEME', likes.avgHearts != null ? String(likes.avgHearts) : '--'],
    ['MOST LIKED USER', topU ? topU.username + ' ' + fmtCount(topU.hearts) : '--'],
    ['MOST LIKED MEME', topM ? (topM.author || 'anon') + ' ' + fmtCount(topM.hearts) : '--']
  ]
  root.className = 'kpis dense'
  root.innerHTML = cells.map(function (c) {
    return '<article><div class="l">' + esc(c[0]) + '</div><div class="v' + (String(c[1]).length > 12 ? ' small' : '') + '">' + esc(c[1]) + '</div></article>'
  }).join('')
}

function renderMemeKpis() {
  const root = memeEl('memeKpis')
  if (!root) return
  const data = memeState.data || {}
  const s = data.stats || {}
  const all = sourceRows()
  const memesSum = all.reduce((n, r) => n + metricValue(r, 'memes'), 0)
  const view = activeView()
  const posted = lastMeters && lastMeters.public ? lastMeters.public.memesPosted : null
  const cells = [
    ['MEMES POSTED', posted != null ? posted : (s.memes != null ? s.memes : data.sampledMemes || 0), null, 'memes'],
    ['CENSUS SAMPLE', s.memes != null ? s.memes : data.sampledMemes || 0, 'users', 'memes'],
    ['WHO MADE THEM', s.users != null ? s.users : all.length, 'users', 'memes'],
    ['TOKENS', s.tokens != null ? s.tokens : data.sampledTokens || 0, 'tokens', 'memes'],
    ['TOKEN CREATORS', s.creators != null ? s.creators : 0, 'creators', 'memes'],
    ['TOTAL LIKES', s.hearts != null ? s.hearts : ((data.likes && data.likes.hearts) || 0), 'memes', 'hearts'],
    ['AVG LIKES', s.avgHearts != null ? s.avgHearts : ((data.likes && data.likes.avgHearts) || 0), 'memes', 'hearts']
  ]
  if (memeState.drill) {
    cells.push(['ON THIS TOKEN', memesSum, null, 'memes'])
    cells.push(['AUTHORS HERE', all.length, null, 'memes'])
  }
  root.innerHTML = cells.map(function (c) {
    const on = c[2] && c[2] === view && !memeState.drill ? ' on' : ''
    const go = c[2] ? ' data-view="' + c[2] + '" data-metric="' + c[3] + '"' : ''
    return (
      '<button type="button" class="meme-kpi' + on + '"' + go + '>' +
      '<div class="l">' + esc(c[0]) + '</div>' +
      '<div class="v">' + esc(fmtCount(c[1])) + '</div>' +
      '</button>'
    )
  }).join('')
}

function renderMemeList(rows) {
  const root = memeEl('trixMemes')
  if (!root) return
  const view = activeView()
  const spec = viewSpec()
  const cols = spec.columns || []
  if (!rows.length) {
    root.innerHTML = '<div class="empty">NO ROWS IN THIS FILTER.</div>'
    return
  }
  const canDrill = !memeState.drill && (view === 'tokens' || view === 'perToken')
  const head = cols.map(function (col) {
    const on = memeState.metric === col.id ? ' on' : ''
    const arrow = memeState.metric === col.id ? (memeState.sortDir === 'asc' ? ' ^' : ' v') : ''
    return (
      '<th><button type="button" class="meme-sort' + on + '" data-sort="' + esc(col.id) + '">' +
      esc(col.label) + esc(arrow) +
      '</button></th>'
    )
  }).join('')
  const body = rows.map(function (r, i) {
    const on = i === memeState.selected ? ' on' : ''
    const drill = canDrill ? ' data-drill="1"' : ''
    const tds = cols.map(function (col) {
      const raw = cellValue(r, col, view)
      const cls = col.kind === 'num' ? ' class="num"' : ''
      const shown = col.kind === 'num' && raw !== '--' ? fmtNum(raw) : raw
      return '<td' + cls + '>' + esc(shown) + '</td>'
    }).join('')
    return (
      '<tr class="meme-row' + on + '" data-i="' + i + '"' + drill + '>' +
      '<td class="rank">#' + (i + 1) + '</td>' +
      tds +
      '</tr>'
    )
  }).join('')
  const sumMemes = rows.reduce((n, r) => n + metricValue(r, 'memes'), 0)
  root.innerHTML =
    '<table class="meme-table">' +
    '<thead><tr><th>#</th>' + head + '</tr></thead>' +
    '<tbody>' + body + '</tbody>' +
    '<tfoot><tr><td colspan="' + (cols.length + 1) + '">SHOWING ' +
    esc(fmtCount(rows.length)) + '  *  ' + esc(fmtCount(sumMemes)) + ' MEMES IN THIS CUT</td></tr></tfoot>' +
    '</table>'
}

function renderMemeDetail(rows) {
  const root = memeEl('memeDetail')
  if (!root) return
  const row = rows[memeState.selected]
  if (!row) {
    root.innerHTML = '<div class="empty">CLICK A ROW TO SEE WHO MADE HOW MANY.</div>'
    return
  }
  const view = activeView()
  const title = rowLabel(row, view)
  let lines = []
  if (view === 'users') {
    lines.push(fmtCount(row.memes) + ' MEMES MADE')
    if (row.tokenCount != null) lines.push('ON ' + fmtCount(row.tokenCount) + ' TOKENS')
    const parts = tokenBits(row).slice().sort((a, b) => tokenMemes(b) - tokenMemes(a))
    if (parts.length) {
      lines = lines.concat(parts.map(function (t) {
        const n = tokenMemes(t)
        const name = tokenName(t)
        return n ? (fmtCount(n) + '  ON  ' + name) : name
      }))
    }
  } else if (view === 'tokens' || view === 'perToken') {
    lines.push(fmtCount(row.memes) + ' MEMES ON THIS TOKEN')
    if (row.authorCount != null) lines.push(fmtCount(row.authorCount) + ' PEOPLE MADE THEM')
    if (row.memesPerAuthor != null) lines.push(row.memesPerAuthor + ' MEMES / AUTHOR')
    if (row.creator) lines.push('TOKEN CREATOR  ' + row.creator)
    const authors = (row.authors || []).slice().sort((a, b) => (b.memes || 0) - (a.memes || 0))
    lines = lines.concat(authors.slice(0, 20).map(function (a) {
      return fmtCount(a.memes) + '  BY  ' + (a.username || 'anon')
    }))
    if (!memeState.drill) {
      lines.push('<button type="button" class="meme-open" data-open="token">OPEN WHO MADE THESE</button>')
    }
  } else if (view === 'creators') {
    lines.push(fmtCount(row.tokens) + ' TOKENS LAUNCHED')
    lines.push(fmtCount(row.memes) + ' MEMES ON THOSE TOKENS')
    if (row.authorCount != null) lines.push(fmtCount(row.authorCount) + ' AUTHORS COOKED ON THEM')
    const coins = row.symbols || []
    if (coins.length) lines.push('TOKENS  ' + coins.join(', '))
  }
  root.innerHTML =
    '<div class="meme-detail-head">' + esc(title) + '</div>' +
    lines.map(function (line) {
      if (line.charAt(0) === '<') return '<div class="meme-detail-line">' + line + '</div>'
      return '<div class="meme-detail-line">' + esc(line) + '</div>'
    }).join('')
}

function rowKey(row) {
  if (!row) return ''
  return String(row.mint || row.username || row.symbol || row.name || '')
}

function selectMemeRow(i, redrawChart) {
  const rows = memeState.rows
  if (!rows.length) return
  if (i < 0 || i >= rows.length) i = 0
  memeState.selected = i
  const list = memeEl('trixMemes')
  if (list) {
    const trs = list.querySelectorAll('tr[data-i]')
    for (let n = 0; n < trs.length; n++) {
      if (String(trs[n].getAttribute('data-i')) === String(i)) trs[n].classList.add('on')
      else trs[n].classList.remove('on')
    }
  }
  renderMemeDetail(rows)
  if (redrawChart !== false) drawMemeChart(rows, true)
}

function chartSummary(rows) {
  const view = memeState.drill ? 'users' : memeState.view
  const spec = MEME_VIEWS[view] || MEME_VIEWS.users
  const metric = spec.metrics.find((m) => m.id === memeState.metric) || spec.metrics[0]
  const names = rows.slice(0, 5).map((r) => rowLabel(r, view) + ' ' + metricValue(r, memeState.metric))
  const scope = memeState.drill ? ('TOKEN MEMES ON ' + (memeState.drill.symbol ? '$' + memeState.drill.symbol : 'TOKEN')) : spec.label
  return scope + ' BY ' + (metric ? metric.label : 'MEMES') + (names.length ? '. TOP: ' + names.join(', ') : '.')
}

function drawMemeChart(rows, highlightOnly) {
  const canvas = memeEl('memeChart')
  const hint = memeEl('memeChartHint')
  if (!canvas || memeState.drawing) return
  memeState.drawing = true
  const view = activeView()
  const metric = (memeState.metric === 'name' || memeState.metric === 'creator') ? 'memes' : memeState.metric
  const chartRows = (rows || []).slice(0, 25)
  const wrap = canvas.parentNode
  const cssW = Math.max(320, Math.floor((wrap && wrap.clientWidth) || canvas.clientWidth || 640))
  const rowH = 22
  const padL = 118
  const padR = 52
  const padT = 8
  const padB = 8
  const cssH = Math.max(160, padT + padB + Math.max(chartRows.length, 4) * rowH)
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const sizeKey = cssW + 'x' + cssH + 'x' + dpr
  const needResize = memeState.chartSize !== sizeKey
  if (needResize) {
    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    memeState.chartSize = sizeKey
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cssW, cssH)
  memeState.hits = []
  if (!chartRows.length) {
    if (hint) hint.textContent = 'NO CHART DATA FOR THIS FILTER.'
    canvas.setAttribute('aria-label', 'Empty meme chart')
    memeState.drawing = false
    return
  }
  const max = Math.max.apply(null, chartRows.map((r) => metricValue(r, metric))) || 1
  const barW = Math.max(40, cssW - padL - padR)
  ctx.font = '14px VT323, monospace'
  chartRows.forEach(function (row, i) {
    const y = padT + i * rowH
    const val = metricValue(row, metric)
    const w = Math.max(2, Math.round((val / max) * barW))
    const selected = i === memeState.selected
    ctx.fillStyle = selected ? '#ffff00' : '#00aa00'
    ctx.fillRect(padL, y + 4, w, 12)
    ctx.fillStyle = selected ? '#ffff00' : '#00ff00'
    ctx.textAlign = 'right'
    ctx.fillText(String(rowLabel(row, view)).slice(0, 14), padL - 8, y + 15)
    ctx.textAlign = 'left'
    ctx.fillStyle = selected ? '#ffff00' : '#00aa00'
    ctx.fillText(fmtNum(val), padL + w + 6, y + 15)
    memeState.hits.push({ y0: y, y1: y + rowH, i: i })
  })
  canvas.setAttribute('aria-label', chartSummary(rows))
  if (hint && !highlightOnly) {
    hint.textContent = memeState.drill
      ? 'NUMBERS ON THIS TOKEN * CLICK A BAR TO PICK A USER'
      : 'CHART SHOWS TOP 25. PICK A ROW FOR THE BREAKDOWN. OPEN TOKEN IN THE PANE BELOW.'
  }
  memeState.drawing = false
}

function renderMemeBoard() {
  syncChoiceButtons()
  const keep = rowKey(memeState.rows[memeState.selected])
  const rows = filteredRows()
  memeState.rows = rows
  let next = 0
  if (keep) {
    const idx = rows.findIndex(function (r) { return rowKey(r) === keep })
    if (idx >= 0) next = idx
  } else if (memeState.selected >= 0 && memeState.selected < rows.length) {
    next = memeState.selected
  }
  memeState.selected = rows.length ? next : -1
  renderMemeKpis()
  renderMemeList(rows)
  renderMemeDetail(rows)
  requestAnimationFrame(function () { drawMemeChart(rows, false) })
}

function setStamp() {
  const stamp = memeEl('memeStamp')
  if (!stamp) return
  if (memeState.drill) {
    stamp.textContent = 'TOKEN MEMES * $' + (memeState.drill.symbol || memeState.drill.name || 'TOKEN')
    return
  }
  const data = memeState.data
  if (!data) return
  const s = data.stats || {}
  stamp.textContent =
    (s.memes != null ? s.memes : data.sampledMemes || 0) + ' MEMES / ' +
    (s.tokens != null ? s.tokens : data.sampledTokens || 0) + ' TOKENS' +
    (s.users != null ? ' / ' + s.users + ' USERS' : '')
}

function drillInto(row) {
  if (!row || !(row.mint || row.symbol)) return
  memeState.drill = { mint: row.mint, symbol: row.symbol, name: row.name }
  memeState.metric = 'memes'
  memeState.sortDir = 'desc'
  memeState.selected = 0
  memeState.query = ''
  const search = memeEl('memeSearch')
  if (search) search.value = ''
  setStamp()
  renderMemeBoard()
}

function clearDrill() {
  memeState.drill = null
  memeState.selected = 0
  setStamp()
  renderMemeBoard()
}

function setMemeView(view) {
  if (!view || !MEME_VIEWS[view]) return
  memeState.view = view
  memeState.metric = MEME_VIEWS[view].metrics[0].id
  memeState.sortDir = 'desc'
  memeState.selected = 0
  memeState.drill = null
  setStamp()
  renderMemeBoard()
}

function setMemeSort(metric) {
  if (!metric) return
  if (memeState.metric === metric) {
    memeState.sortDir = memeState.sortDir === 'desc' ? 'asc' : 'desc'
  } else {
    memeState.metric = metric
    memeState.sortDir = metric === 'name' || metric === 'creator' ? 'asc' : 'desc'
  }
  renderMemeBoard()
}

function bindMemeControls() {
  const viewSel = memeEl('memeView')
  const metricSel = memeEl('memeMetric')
  const topSel = memeEl('memeTop')
  const search = memeEl('memeSearch')
  const back = memeEl('memeBack')
  const list = memeEl('trixMemes')
  const kpis = memeEl('memeKpis')
  const detail = memeEl('memeDetail')
  const canvas = memeEl('memeChart')
  if (viewSel && !viewSel._bound) {
    viewSel._bound = true
    viewSel.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-view]')
      if (btn) setMemeView(btn.getAttribute('data-view'))
    })
  }
  if (metricSel && !metricSel._bound) {
    metricSel._bound = true
    metricSel.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-metric]')
      if (btn) setMemeSort(btn.getAttribute('data-metric'))
    })
  }
  if (topSel && !topSel._bound) {
    topSel._bound = true
    topSel.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-top]')
      if (!btn) return
      const n = parseInt(btn.getAttribute('data-top'), 10)
      memeState.top = Number.isFinite(n) ? n : 0
      renderMemeBoard()
    })
  }
  if (search && !search._bound) {
    search._bound = true
    search.addEventListener('input', function () {
      const value = search.value
      clearTimeout(memeState.searchTimer)
      memeState.searchTimer = setTimeout(function () {
        memeState.query = value
        memeState.selected = 0
        renderMemeBoard()
      }, 160)
    })
  }
  if (back && !back._bound) {
    back._bound = true
    back.addEventListener('click', clearDrill)
  }
  if (kpis && !kpis._bound) {
    kpis._bound = true
    kpis.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-view]')
      if (btn) setMemeView(btn.getAttribute('data-view'))
    })
  }
  if (detail && !detail._bound) {
    detail._bound = true
    detail.addEventListener('click', function (ev) {
      const open = ev.target.closest('[data-open="token"]')
      if (!open) return
      const row = memeState.rows[memeState.selected]
      if (row) drillInto(row)
    })
  }
  if (list && !list._bound) {
    list._bound = true
    list.addEventListener('click', function (ev) {
      const sortBtn = ev.target.closest('[data-sort]')
      if (sortBtn) {
        setMemeSort(sortBtn.getAttribute('data-sort'))
        return
      }
      const row = ev.target.closest('[data-i]')
      if (!row) return
      const i = parseInt(row.getAttribute('data-i'), 10)
      if (!Number.isFinite(i)) return
      selectMemeRow(i, true)
    })
  }
  if (canvas && !canvas._bound) {
    canvas._bound = true
    canvas.addEventListener('click', function (ev) {
      const rect = canvas.getBoundingClientRect()
      const y = ev.clientY - rect.top
      const hit = memeState.hits.find(function (h) { return y >= h.y0 && y < h.y1 })
      if (hit) selectMemeRow(hit.i, true)
    })
    canvas.addEventListener('mousemove', function (ev) {
      const rect = canvas.getBoundingClientRect()
      const y = ev.clientY - rect.top
      const hit = memeState.hits.find(function (h) { return y >= h.y0 && y < h.y1 })
      canvas.style.cursor = hit ? 'pointer' : 'default'
    })
    window.addEventListener('resize', function () {
      clearTimeout(memeState.resizeTimer)
      memeState.resizeTimer = setTimeout(function () {
        memeState.chartSize = ''
        if (memeState.rows && memeState.rows.length) drawMemeChart(memeState.rows, false)
      }, 140)
    })
  }
}

function userCount(data) {
  if (!data) return 0
  if (data.views && Array.isArray(data.views.users)) return data.views.users.length
  if (Array.isArray(data.ranking)) return data.ranking.length
  return 0
}

function applyMemeData(data, root) {
  if (!data) return false
  if (memeState.data && userCount(data) < userCount(memeState.data)) return false
  if (memeState.data && memeState.data.updatedAt && data.updatedAt === memeState.data.updatedAt) {
    return true
  }
  memeState.data = data
  renderLikeDesk(data)
  setStamp()
  const has = userCount(data) || (data.views && (data.views.tokens || []).length)
  if (!has) {
    if (root && !root.querySelector('.meme-table')) {
      root.innerHTML = '<div class="empty">NO PUBLIC TOKEN MEMES IN THIS SAMPLE.</div>'
    }
    return false
  }
  renderMemeBoard()
  return true
}

async function loadTrixMemes() {
  const root = memeEl('trixMemes')
  if (!root) return
  bindMemeControls()
  syncChoiceButtons()
  try {
    const meters = await fetch(BOXES_METERS, { cache: 'no-store' })
    if (meters.ok) {
      lastMeters = await meters.json()
      renderLiveCounts(lastMeters)
      renderMemeKpis()
    }
  } catch (e) {}
  try {
    const res = await fetch('/api/trix-memes', { cache: 'no-store' })
    if (res.ok) {
    const bag = await res.json()
    applyMemeData(bag, root)
    renderLikeDesk(bag)
  }
  } catch (e) {
    try {
      const bundled = await fetch('/assets/data/trix-memes.json?v=20260927live', { cache: 'no-store' })
      if (bundled.ok) applyMemeData(await bundled.json(), root)
    } catch (e2) {
      if (!root.querySelector('.meme-table')) {
        root.innerHTML = '<div class="empty">MEME SAMPLE OFFLINE.</div>'
      }
    }
  }
  if (lastMeters) renderMemeKpis()
}

loadTrixBoxes()
loadTrixMemes()
setInterval(loadTrixBoxes, 20000)
setInterval(loadTrixMemes, 120000)
