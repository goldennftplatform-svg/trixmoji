'use strict'

function percentile(sorted, p) {
  if (!sorted.length) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[i]
}

function diffProbes(list) {
  const changes = []
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]
    const cur = list[i]
    const bits = []
    if (prev.ok !== cur.ok) bits.push(cur.ok ? 'BACK UP' : 'DOWN')
    if (prev.status !== cur.status) bits.push('HTTP ' + prev.status + ' -> ' + cur.status)
    if (prev.hash && cur.hash && prev.hash !== cur.hash) {
      if (prev.bytes != null && cur.bytes != null && prev.bytes === cur.bytes) {
        bits.push('HASH CHURN (SAME SIZE)')
      } else {
        bits.push('CONTENT HASH CHANGED')
      }
    }
    if (prev.bytes != null && cur.bytes != null && prev.bytes !== cur.bytes) {
      bits.push('SIZE ' + prev.bytes + ' -> ' + cur.bytes)
    }
    if (prev.title && cur.title && prev.title !== cur.title) bits.push('TITLE CHANGED')
    if (!bits.length) continue
    const churn = bits.length === 1 && bits[0] === 'HASH CHURN (SAME SIZE)'
    changes.push({
      ts: cur.ts,
      id: cur.id,
      url: cur.url,
      bits,
      churn,
      fromHash: prev.hash || null,
      toHash: cur.hash || null,
      fromBytes: prev.bytes ?? null,
      toBytes: cur.bytes ?? null,
      fromTitle: prev.title || null,
      toTitle: cur.title || null,
      status: cur.status,
      ms: cur.ms
    })
  }
  return changes
}

function computeStats(rows, hours) {
  hours = hours || 24
  const cutoff = Date.now() - hours * 3600 * 1000
  const window = (rows || []).filter((r) => Date.parse(r.ts) >= cutoff)
  const byId = {}
  for (const r of window) {
    if (!byId[r.id]) byId[r.id] = []
    byId[r.id].push(r)
  }

  const endpoints = Object.keys(byId)
    .sort()
    .map((id) => {
      const list = byId[id]
      const last = list[list.length - 1]
      const ok = list.filter((r) => r.ok).length
      const lat = list
        .filter((r) => r.ok && Number.isFinite(r.ms))
        .map((r) => r.ms)
        .sort((a, b) => a - b)
      const hashes = new Set(list.map((r) => r.hash).filter(Boolean))
      const changes = diffProbes(list)
      const lastChange = changes.length ? changes[changes.length - 1] : null
      const slice = list.slice(-40)
      return {
        id,
        url: last.url,
        samples: list.length,
        uptime: list.length ? Math.round((ok / list.length) * 1000) / 10 : null,
        ok,
        fail: list.length - ok,
        p50: percentile(lat, 50),
        p95: percentile(lat, 95),
        last,
        contentVersions: hashes.size,
        lastChange,
        changed: !!(lastChange && last && lastChange.ts === last.ts && !isChurnChange(lastChange)),
        spark: slice.map((r, i) => ({
          ts: r.ts,
          ok: r.ok,
          ms: r.ms,
          status: r.status,
          changed: i > 0 && slice[i - 1].hash && r.hash && slice[i - 1].hash !== r.hash
        }))
      }
    })

  const allOk = window.filter((r) => r.ok).length
  const allLat = window
    .filter((r) => r.ok && Number.isFinite(r.ms))
    .map((r) => r.ms)
    .sort((a, b) => a - b)
  const changes = endpoints
    .flatMap((ep) => diffProbes(byId[ep.id] || []))
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))

  return {
    hours,
    samples: window.length,
    uptime: window.length ? Math.round((allOk / window.length) * 1000) / 10 : null,
    p50: percentile(allLat, 50),
    p95: percentile(allLat, 95),
    endpoints,
    briefing: buildBriefing(endpoints, changes),
    changes: changes.slice(0, 80),
    recent: window.slice(-80).reverse()
  }
}

function isChurnChange(c) {
  if (!c) return false
  if (c.churn) return true
  const bits = c.bits || []
  if (bits.length === 1 && bits[0] === 'HASH CHURN (SAME SIZE)') return true
  if (bits.length === 1 && bits[0] === 'CONTENT HASH CHANGED' && c.fromBytes != null && c.fromBytes === c.toBytes) {
    return true
  }
  return false
}

function fmtBytes(n) {
  if (n == null) return '--'
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function buildBriefing(endpoints, changes) {
  const churn = (changes || []).filter(isChurnChange)
  const real = (changes || []).filter((c) => !isChurnChange(c))
  const down = (endpoints || [])
    .filter((e) => e.last && e.last.ok === false)
    .map((e) => String(e.id || '').toUpperCase())
  const up = (endpoints || []).filter((e) => e.last && e.last.ok).length
  const lastReal = real[0] || null
  const lines = []

  if (!(endpoints || []).length) {
    return {
      headline: 'NO SAMPLES YET',
      mood: 'WAIT',
      lines: ['Probe has not returned a public geoff.ai page yet.'],
      lastRealChange: null,
      churnCount: 0,
      realCount: 0
    }
  }

  if (down.length) lines.push('DOWN RIGHT NOW: ' + down.join(', ') + '.')
  else lines.push(up + '/' + endpoints.length + ' public pages answering HTTP 200.')

  const home = endpoints.find((e) => e.id === 'home')
  if (home && (home.contentVersions || 0) > 2) {
    const bytes = home.last && home.last.bytes
    lines.push(
      'HOME HTML hash flips almost every scan at ' +
        fmtBytes(bytes) +
        ' bytes. Same size = live token in the page, not a product drop.'
    )
  }

  const others = endpoints.filter((e) => e.id !== 'home')
  const noisy = others.filter((e) => (e.contentVersions || 0) > 2)
  const quiet = others.filter((e) => (e.contentVersions || 0) <= 2)
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
        fmtBytes(last.bytes) +
        ' bytes. Watch size/title, not the hash.'
    )
  })

  if (lastReal) {
    lines.push(
      'Last real move: ' +
        String(lastReal.id).toUpperCase() +
        ' * ' +
        (lastReal.bits || []).join(' * ') +
        '.'
    )
  } else {
    lines.push('No title / size / status change this window. Hash churn is treated as noise.')
  }

  lines.push(
    'Real content moves: ' + real.length + '. Token churn events: ' + churn.length + '.'
  )

  return {
    headline: down.length ? down.join(', ') + ' DOWN' : 'ALL ' + up + ' PAGES UP',
    mood: down.length ? 'ALERT' : real.length ? 'MOVE' : 'STABLE',
    lines,
    lastRealChange: lastReal,
    churnCount: churn.length,
    realCount: real.length
  }
}

module.exports = { computeStats, diffProbes, buildBriefing, isChurnChange }
