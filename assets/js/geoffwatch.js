'use strict'

const API = '/api/geoff-watch'
const SITREP = '/assets/data/geoffwatch-sitrep.json?v=20260927live'
const $ = (id) => document.getElementById(id)
let lastChangeKey = ''
let nextScanAt = null
let cycling = false

function fmtMs(n) {
  return n == null ? '--' : Math.round(n) + ' MS'
}
function fmtPct(n) {
  return n == null ? '--' : n.toFixed(1) + '%'
}
function clock() {
  return new Date().toLocaleTimeString()
}
function countdown() {
  if (cycling) return 'SCANNING'
  if (!nextScanAt) return 'WAITING'
  const s = Math.max(0, Math.round((Date.parse(nextScanAt) - Date.now()) / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m + ':' + String(r).padStart(2, '0')
}

function drawSpark(canvas, spark) {
  const ctx = canvas.getContext('2d')
  const w = (canvas.width = Math.max(120, canvas.clientWidth * 2))
  const h = (canvas.height = 80)
  ctx.clearRect(0, 0, w, h)
  if (!spark || spark.length < 2) return
  const vals = spark.map((p) => (p.ok && p.ms != null ? p.ms : null)).filter((v) => v != null)
  const max = Math.max(200, ...(vals.length ? vals : [1]))
  const bw = Math.max(2, Math.floor((w - 8) / spark.length) - 1)
  spark.forEach((p, i) => {
    const x = 4 + i * ((w - 8) / spark.length)
    const barH = p.ok && p.ms != null ? Math.max(3, ((p.ms / max) * (h - 12)) | 0) : 3
    ctx.fillStyle = p.ok ? '#00ff00' : '#ff3232'
    ctx.fillRect(x, h - 6 - barH, bw, barH)
    if (p.changed) {
      ctx.fillStyle = '#ffff00'
      ctx.fillRect(x, 2, bw, 4)
    }
  })
}

function render(data) {
  const meta = data.meta || {}
  cycling = !!meta.cycling
  nextScanAt = meta.nextScanAt || null
  $('kpiUptime').textContent = fmtPct(data.uptime)
  $('kpiP50').textContent = fmtMs(data.p50)
  $('kpiP95').textContent = fmtMs(data.p95)
  $('kpiSamples').textContent = String(data.samples || 0)
  $('kpiNext').textContent = countdown()

  const fallback = buildClientBriefing(data.endpoints || [], data.changes || [])
  const briefing = data.briefing && (data.briefing.lines || []).length ? data.briefing : fallback
  const display = collapseChanges(data.changes || [])
  const realN = briefing.realCount != null ? briefing.realCount : display.filter((c) => !c.churn).length
  const churnN = briefing.churnCount != null ? briefing.churnCount : display.filter((c) => c.churn).reduce((n, c) => n + (c.count || 1), 0)
  const mode = cycling ? 'SCANNING PUBLIC PAGES...' : 'LIVE * WATCHING GEOFF.AI FOR UPDATES'
  $('statusLine').textContent = mode + ' * ' + realN + ' REAL * ' + churnN + ' TOKEN CHURN'

  renderBriefing(briefing)
  if ($('kpiMove')) {
    const last = briefing.lastRealChange
    $('kpiMove').textContent = last ? ageOf(last.ts) : 'NONE 24H'
  }

  $('updateCount').textContent = realN + ' REAL / ' + churnN + ' CHURN'
  const log = $('changes')
  if (!display.length) {
    log.innerHTML = '<div class="empty">NO DRIFT YET. HASH / STATUS / TITLE STAY THE SAME UNTIL A PAGE MOVES.</div>'
  } else {
    const newest = display[0].ts + display[0].id
    log.innerHTML = display
      .slice(0, 16)
      .map((c, i) => {
        const cls = [
          'row',
          c.bits.some((b) => b === 'DOWN') ? 'down' : '',
          c.churn ? 'churn' : '',
          i === 0 && !c.churn && newest !== lastChangeKey ? 'new' : ''
        ].join(' ')
        const extra = c.churn
          ? ' * TOKEN NOISE — NOT A DROP'
          : c.fromHash && c.toHash
            ? ' * ' + c.fromHash + ' -> ' + c.toHash
            : ''
        const label = c.churn && c.count > 1
          ? c.id.toUpperCase() + ' * HASH CHURN x' + c.count + ' (SAME SIZE)'
          : c.id.toUpperCase() + ' * ' + c.bits.join(' * ')
        return (
          '<div class="' + cls + '">' +
          '<span class="when">' + new Date(c.ts).toLocaleTimeString() + '</span>' +
          label + extra +
          '</div>'
        )
      })
      .join('')
    lastChangeKey = newest
  }

  const grid = $('endpoints')
  grid.innerHTML = ''
  ;(data.endpoints || []).forEach((ep) => {
    const last = ep.last || {}
    const card = document.createElement('article')
    card.className = 'card' + (last.ok === false ? ' down' : ep.changed ? ' changed' : '')
    const flag = ep.changed ? ' * UPDATED' : last.ok ? ' * STABLE' : ' * DOWN'
    card.innerHTML =
      '<div class="l">' + ep.id.toUpperCase() + flag + '</div>' +
      '<h3>' + fmtPct(ep.uptime) + ' UP  ' + fmtMs(ep.p50) + '</h3>' +
      '<div class="url">' + ep.url + '</div>' +
      '<div class="meta"><span>P95 ' + fmtMs(ep.p95) + '</span><span>' +
      (ep.contentVersions || 0) + ' HASHES</span><span>HTTP ' + (last.status ?? '--') + '</span></div>' +
      '<canvas></canvas>'
    grid.appendChild(card)
    drawSpark(card.querySelector('canvas'), ep.spark)
  })

  renderPublic(data.public)

  const tbody = $('rows')
  tbody.innerHTML = ''
  ;(data.recent || []).forEach((r) => {
    const tr = document.createElement('tr')
    if (!r.ok) tr.className = 'changed'
    tr.innerHTML =
      '<td>' + new Date(r.ts).toLocaleTimeString() + '</td>' +
      '<td>' + r.id + '</td>' +
      '<td class="' + (r.ok ? 'status-ok' : 'status-bad') + '">' + (r.status ?? 'ERR') + '</td>' +
      '<td>' + (r.ms ?? '--') + '</td>' +
      '<td>' + (r.bytes ?? '--') + '</td>' +
      '<td class="hash">' + (r.hash || '--') + '</td>' +
      '<td class="' + (r.error ? 'err' : '') + '">' + (r.error || r.title || '') + '</td>'
    tbody.appendChild(tr)
  })
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ageOf(ts) {
  const t = Date.parse(ts)
  if (!Number.isFinite(t)) return '--'
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return s + 'S AGO'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'M AGO'
  const h = Math.floor(m / 60)
  if (h < 48) return h + 'H AGO'
  return Math.floor(h / 24) + 'D AGO'
}

function isChurn(c) {
  if (!c) return false
  if (c.churn) return true
  const bits = c.bits || []
  if (bits.length === 1 && bits[0] === 'HASH CHURN (SAME SIZE)') return true
  if (bits.length === 1 && bits[0] === 'CONTENT HASH CHANGED') return true
  return false
}

function collapseChanges(changes) {
  const out = []
  ;(changes || []).forEach((c) => {
    const churn = isChurn(c)
    if (churn && out.length && out[out.length - 1].churn && out[out.length - 1].id === c.id) {
      out[out.length - 1].count += 1
      return
    }
    out.push({
      ts: c.ts,
      id: c.id,
      bits: c.bits || [],
      fromHash: c.fromHash,
      toHash: c.toHash,
      churn,
      count: 1
    })
  })
  return out
}

function buildClientBriefing(endpoints, changes) {
  const display = collapseChanges(changes)
  const real = (changes || []).filter((c) => !isChurn(c))
  const churnN = display.filter((c) => c.churn).reduce((n, c) => n + (c.count || 1), 0)
  const down = (endpoints || []).filter((e) => e.last && e.last.ok === false).map((e) => e.id.toUpperCase())
  const up = (endpoints || []).filter((e) => e.last && e.last.ok).length
  const lines = []
  if (!(endpoints || []).length) {
    lines.push('Probe has not returned a public geoff.ai page yet.')
  } else if (down.length) {
    lines.push('DOWN RIGHT NOW: ' + down.join(', ') + '.')
  } else {
    lines.push(up + '/' + endpoints.length + ' public pages answering HTTP 200.')
  }
  const home = (endpoints || []).find((e) => e.id === 'home')
  if (home && (home.contentVersions || 0) > 2) {
    const bytes = home.last && home.last.bytes
    lines.push(
      'HOME HTML hash flips almost every scan at ' +
        (bytes != null ? Number(bytes).toLocaleString() : '--') +
        ' bytes. Same size = live token in the page, not a product drop.'
    )
  }
  const others = (endpoints || []).filter((e) => e.id !== 'home')
  const quiet = others.filter((e) => (e.contentVersions || 0) <= 2)
  const noisy = others.filter((e) => (e.contentVersions || 0) > 2)
  if (quiet.length) {
    lines.push(quiet.map((e) => String(e.id).toUpperCase()).join(' / ') + ': hashes stable this window.')
  }
  noisy.forEach((e) => {
    const last = e.last || {}
    lines.push(
      String(e.id).toUpperCase() +
        ': ' +
        e.contentVersions +
        ' hashes, last size ' +
        (last.bytes != null ? Number(last.bytes).toLocaleString() : '--') +
        ' bytes. Watch size/title, not the hash.'
    )
  })
  if (real[0]) {
    lines.push('Last real move: ' + String(real[0].id).toUpperCase() + ' * ' + (real[0].bits || []).join(' * ') + '.')
  } else if (endpoints.length) {
    lines.push('No title / size / status change this window. Hash churn is treated as noise.')
  }
  lines.push('Real content moves: ' + real.length + '. Token churn events: ' + churnN + '.')
  return {
    headline: down.length ? down.join(', ') + ' DOWN' : (endpoints.length ? 'ALL ' + up + ' PAGES UP' : 'NO SAMPLES YET'),
    mood: down.length ? 'ALERT' : real.length ? 'MOVE' : 'STABLE',
    lines,
    lastRealChange: real[0] || null,
    churnCount: churnN,
    realCount: real.length
  }
}

function renderPublic(pub) {
  const box = $('publicSurface')
  const stamp = $('publicStamp')
  if (!box) return
  if (!pub) {
    box.innerHTML = '<div class="empty">NO PUBLIC SURFACE YET. HIT PROBE NOW.</div>'
    return
  }
  if (stamp) stamp.textContent = pub.fetchedAt ? new Date(pub.fetchedAt).toLocaleTimeString() : 'LIVE'
  const robots = pub.robots || {}
  const allow = (robots.allow || []).map((x) => esc(x)).join(' ') || '/'
  const deny = (robots.disallow || []).map((x) => esc(x)).join('  ') || '/api/ /connect /settings'
  const sitemap = (pub.sitemap || [])
    .map((u) => {
      return (
        '<tr>' +
        '<td><a href="' + esc(u.loc) + '" target="_blank" rel="noopener">' + esc(u.loc.replace('https://www.geoff.ai', '') || '/') + '</a></td>' +
        '<td>' + esc(u.lastmod ? new Date(u.lastmod).toLocaleString() : '--') + '</td>' +
        '<td>' + esc((u.changefreq || '').toUpperCase() || '--') + '</td>' +
        '<td>' + esc(u.priority || '--') + '</td>' +
        '</tr>'
      )
    })
    .join('')
  const pages = (pub.pages || [])
    .map((p) => {
      const note = p.description || p.ogTitle || p.title || ''
      return (
        '<div class="row">' +
        '<span class="when">' + esc((p.id || '').toUpperCase()) + '</span>' +
        (p.ok ? 'HTTP ' + (p.status ?? '--') : 'DOWN') +
        ' * ' + fmtMs(p.ms) +
        ' * ' + (p.bytes != null ? Number(p.bytes).toLocaleString() + ' B' : '--') +
        (note ? ' * ' + esc(note) : '') +
        '</div>'
      )
    })
    .join('')
  box.innerHTML =
    '<div class="head">' +
    '<div class="flag">ROBOTS.TXT * ALLOW ' + allow + ' * DISALLOW ' + deny + '</div>' +
    '<h3>' + esc((pub.pages || []).length) + ' PUBLIC PAGES * ' + esc((pub.sitemap || []).length) + ' SITEMAP URLS</h3>' +
    '</div>' +
    '<div class="watch"><h4>SITEMAP</h4>' +
    (sitemap
      ? '<div class="table-wrap"><table><thead><tr><th>PATH</th><th>LASTMOD</th><th>FREQ</th><th>PRI</th></tr></thead><tbody>' +
        sitemap +
        '</tbody></table></div>'
      : '<div class="empty">SITEMAP NOT IN LAST SCAN.</div>') +
    '</div>' +
    '<div class="log">' +
    (pages || '<div class="empty">NO PAGE META YET.</div>') +
    '</div>'
}

function renderBriefing(data) {
  const box = $('briefing')
  const stamp = $('briefStamp')
  if (!box) return
  if (!data) {
    box.innerHTML = '<div class="empty">NO LIVE READ YET.</div>'
    return
  }
  if (stamp) stamp.textContent = (data.mood || 'LIVE') + ' * ' + (data.realCount || 0) + ' REAL'
  const lines = (data.lines || []).map((line) => '<li>' + esc(line) + '</li>').join('')
  box.innerHTML =
    '<div class="head">' +
    '<div class="flag">' + esc(data.mood || 'LIVE') + ' * PUBLIC PAGES ONLY</div>' +
    '<h3>' + esc(data.headline || 'GEOFF.AI') + '</h3>' +
    '</div>' +
    (lines ? '<ul class="reads">' + lines + '</ul>' : '<div class="empty">WAITING ON FIRST SCAN.</div>')
}

function renderSitrep(data) {
  const box = $('sitrep')
  const stamp = $('sitrepStamp')
  if (!box) return
  if (!data || !data.headline) {
    box.innerHTML = '<div class="empty">SITREP FILE MISSING.</div>'
    return
  }
  if (stamp) {
    stamp.textContent = data.updatedAt
      ? 'AS OF ' + new Date(data.updatedAt).toLocaleString()
      : 'POSTED'
  }
  const now = data.now
    ? '<div class="now">NOW * ' + esc(data.now) + '</div>'
    : ''
  const watch = (data.watch || []).length
    ? '<div class="watch"><h4>WATCH NEXT</h4><ul>' +
      data.watch.map((line) => '<li>' + esc(line) + '</li>').join('') +
      '</ul></div>'
    : ''
  const reads = (data.read || [])
    .map((line) => '<li>' + esc(line) + '</li>')
    .join('')
  const links = (data.links || [])
    .map((l) => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>')
    .join('')
  const posts = (data.posts || [])
    .map((p) => {
      const when = p.ts ? new Date(p.ts).toLocaleString() : ''
      return (
        '<div class="entry">' +
        '<div class="meta"><span class="tag">' + esc(p.tag || 'NOTE') + '</span>' + esc(when) + '</div>' +
        '<h4>' + esc(p.title || '') + '</h4>' +
        '<div>' + esc(p.body || '') + '</div>' +
        '</div>'
      )
    })
    .join('')
  box.innerHTML =
    '<div class="head">' +
    now +
    '<div class="flag">' + esc(data.status || 'LIVE') + ' * PUBLIC POSTS ONLY</div>' +
    '<h3>' + esc(data.headline) + '</h3>' +
    '<div class="summary">' + esc(data.summary || '') + '</div>' +
    '</div>' +
    watch +
    (reads ? '<ul class="reads">' + reads + '</ul>' : '') +
    (links ? '<div class="linkrow">' + links + '</div>' : '') +
    posts
}

async function loadSitrep() {
  try {
    const res = await fetch(SITREP, { cache: 'no-store' })
    if (!res.ok) throw new Error('sitrep ' + res.status)
    renderSitrep(await res.json())
  } catch (e) {
    const stamp = $('sitrepStamp')
    if (stamp) stamp.textContent = 'CACHED BRIEFING'
  }
}

function markApiDown(status, detail) {
  const line = 'PROBE API DOWN' + (status ? ' * HTTP ' + status : '')
  if ($('statusLine')) $('statusLine').textContent = line
  if ($('briefStamp')) $('briefStamp').textContent = 'API DOWN'
  if ($('kpiMove')) $('kpiMove').textContent = 'API DOWN'
  const extra =
    Number(status) === 403
      ? 'HTTP 403 means Netlify blocked the watcher URL. Probe Now cannot run until /api/geoff-watch is a normal function again.'
      : detail || 'Probes fill in when /api/geoff-watch is live again.'
  renderBriefing({
    headline: 'PROBE API DOWN',
    mood: 'ALERT',
    lines: [
      'Watcher function is not answering' + (status ? ' (HTTP ' + status + ')' : '') + '.',
      'Sitrep above is still the public briefing.',
      extra
    ],
    lastRealChange: null,
    churnCount: 0,
    realCount: 0
  })
}

async function refresh() {
  try {
    const res = await fetch(API + '?hours=24', { cache: 'no-store' })
    const text = await res.text()
    let data = null
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
    if (!res.ok || !data || typeof data !== 'object') {
      markApiDown(res.status, 'Expected JSON from /api/geoff-watch.')
      return
    }
    render(data)
  } catch (e) {
    markApiDown('', String(e && e.message ? e.message : e))
  }
}

const probeBtn = $('probeBtn')
if (probeBtn) {
  probeBtn.addEventListener('click', async () => {
    probeBtn.disabled = true
    cycling = true
    $('statusLine').textContent = 'MANUAL SCAN...'
    if ($('kpiNext')) $('kpiNext').textContent = 'SCANNING'
    const ac = new AbortController()
    const kill = setTimeout(() => ac.abort(), 28000)
    try {
      const res = await fetch(API, {
        method: 'POST',
        cache: 'no-store',
        signal: ac.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{}'
      })
      const text = await res.text()
      let data = null
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }
      if (!res.ok || !data || typeof data !== 'object') {
        markApiDown(res.status, 'Manual scan did not return JSON.')
        return
      }
      render(data)
    } catch (e) {
      const msg = e && e.name === 'AbortError' ? 'Manual scan timed out.' : String(e && e.message ? e.message : e)
      markApiDown('', msg)
    } finally {
      clearTimeout(kill)
      cycling = false
      probeBtn.disabled = false
    }
  })
}

loadSitrep()
refresh()
setInterval(refresh, 15000)
setInterval(() => {
  $('clock').textContent = clock()
  $('kpiNext').textContent = countdown()
}, 1000)
