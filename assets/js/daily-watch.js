'use strict'

;(function () {
  const API = '/api/daily-watch'

  function $(el, sel) {
    return el.querySelector(sel)
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function pad(n) {
    return String(n).padStart(2, '0')
  }

  function fmtRemain(ms) {
    const s = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const r = s % 60
    return pad(h) + ':' + pad(m) + ':' + pad(r)
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

  function mount(root) {
    const desk = (root.getAttribute('data-desk') || 'geoff').toLowerCase()
    root.innerHTML =
      '<div class="dw-head">' +
      '<div class="dw-flag">HOURLY CHECK</div>' +
      '<h3 class="dw-title" data-dw="title">NEXT AUTO CHECK</h3>' +
      '<div class="dw-count" data-dw="count">--:--:--</div>' +
      '<div class="dw-sub" data-dw="sub">LOADING TIMER...</div>' +
      '</div>' +
      '<div class="dw-meta">' +
      '<span>LAST AUTO <b data-dw="last">--</b></span>' +
      '<span>LAST MANUAL <b data-dw="manual">--</b></span>' +
      '<span data-dw="status">WAITING</span>' +
      '</div>' +
      '<div class="dw-actions">' +
      '<button type="button" data-dw="check">[ CHECK NOW ]</button>' +
      '<span class="dw-hint">MANUAL CHECK ANY TIME. TIMER STILL FIRES EVERY HOUR.</span>' +
      '</div>' +
      '<div class="dw-log" data-dw="log"><div class="empty">NO DIGEST YET.</div></div>'

    const state = { nextAt: null, cycling: false, data: null }

    function paintTimer() {
      const count = $(root, '[data-dw="count"]')
      if (!count) return
      if (state.cycling) {
        count.textContent = 'SCANNING'
        return
      }
      if (!state.nextAt) {
        count.textContent = 'WAITING'
        return
      }
      count.textContent = fmtRemain(Date.parse(state.nextAt) - Date.now())
    }

    function render(deskData) {
      if (!deskData) return
      state.data = deskData
      state.nextAt = deskData.nextDailyAt || null
      const title = $(root, '[data-dw="title"]')
      const sub = $(root, '[data-dw="sub"]')
      if (title) title.textContent = (deskData.label || desk.toUpperCase()) + ' * NEXT AUTO CHECK'
      if (sub) sub.textContent = deskData.subtitle || ''
      const last = $(root, '[data-dw="last"]')
      const manual = $(root, '[data-dw="manual"]')
      const status = $(root, '[data-dw="status"]')
      if (last) last.textContent = deskData.lastDailyAt ? ageOf(deskData.lastDailyAt) : 'NEVER'
      if (manual) manual.textContent = deskData.lastManualAt ? ageOf(deskData.lastManualAt) : 'NONE'
      if (status) {
        const n = (deskData.changes || []).length
        status.textContent = n ? n + ' MOVES ON FILE' : 'STABLE THIS WINDOW'
      }
      const log = $(root, '[data-dw="log"]')
      if (!log) return
      const rows = ((deskData.current && deskData.current.rows) || [])
        .map(function (r) {
          const flag = !r.ok ? 'DOWN' : 'OK'
          const extra = r.title ? ' * ' + esc(r.title) : r.error ? ' * ' + esc(r.error) : ''
          const gh =
            r.github && r.github.newest
              ? ' * GH ' + esc(r.github.newest.name || '') + ' ' + esc(r.github.newest.pushedAt || '')
              : ''
          return (
            '<div class="dw-row' +
            (r.ok ? '' : ' down') +
            '"><span class="when">' +
            esc((r.id || '').toUpperCase()) +
            '</span>HTTP ' +
            esc(r.status ?? flag) +
            extra +
            gh +
            (r.hash ? ' * ' + esc(r.hash) : '') +
            '</div>'
          )
        })
        .join('')
      const changes = (deskData.changes || [])
        .slice(0, 12)
        .map(function (c) {
          return (
            '<div class="dw-row new"><span class="when">' +
            (c.ts ? new Date(c.ts).toLocaleString() : '') +
            '</span>' +
            esc((c.id || '').toUpperCase()) +
            ' * ' +
            esc((c.bits || []).join(' * ')) +
            '</div>'
          )
        })
        .join('')
      const notices = (deskData.notices || [])
        .slice(0, 8)
        .map(function (c) {
          return (
            '<div class="dw-row new"><span class="when">' +
            (c.ts ? new Date(c.ts).toLocaleString() : '') +
            '</span>' +
            esc((c.id || '').toUpperCase()) +
            ' * ' +
            esc((c.bits || []).join(' * ')) +
            '</div>'
          )
        })
        .join('')
      const hw = deskData.hwonder || {}
      const posts = (hw.posts || [])
        .map(function (p) {
          return (
            '<a class="dw-post" href="' +
            esc(p.url) +
            '" target="_blank" rel="noopener">/' +
            esc(p.slug || p.path) +
            '</a>'
          )
        })
        .join(' ')
      const ev = hw.newestEvent
      const repo = hw.newestRepo
      const newestLabel = ev
        ? String(ev.description || 'EVENT') + ' ' + String(ev.name || '')
        : repo
          ? String(repo.name || '')
          : ''
      const newestWhen = (ev && ev.pushedAt) || (repo && repo.pushedAt) || ''
      const newest = newestLabel
        ? '<div class="dw-row">GH NEWEST * ' + esc(newestLabel) + (newestWhen ? ' * ' + esc(newestWhen) : '') + '</div>'
        : ''
      log.innerHTML =
        '<div class="dw-h">HWONDER NOTICES</div>' +
        (notices || '<div class="empty">NO GH PUSH / HWONDER POST MOVES ON FILE.</div>') +
        '<div class="dw-h">HWONDER.COM POSTS  ' +
        esc(hw.postCount != null ? hw.postCount + ' INDEXED' : '') +
        '</div>' +
        (posts ? '<div class="dw-posts">' + posts + '</div>' : '<div class="empty">INDEX WAITING.</div>') +
        newest +
        (changes
          ? '<div class="dw-h">WHAT MOVED</div>' + changes
          : '<div class="empty">NO HASH / TITLE / GH PUSH SINCE THE LAST SAMPLE.</div>') +
        '<div class="dw-h">LIVE FINGERPRINTS</div>' +
        (rows || '<div class="empty">NO SAMPLES YET. HIT CHECK NOW.</div>')
      paintTimer()
    }

    async function refresh(force) {
      state.cycling = !!force
      paintTimer()
      const status = $(root, '[data-dw="status"]')
      if (status && force) status.textContent = 'MANUAL SCAN...'
      try {
        const res = await fetch(API + '?desk=' + encodeURIComponent(desk), {
          method: force ? 'POST' : 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        })
        const data = await res.json()
        if (!data || !data.ok || !data.desk) {
          if (status) status.textContent = 'API DOWN' + (res.status ? ' * HTTP ' + res.status : '')
          return
        }
        render(data.desk)
      } catch (e) {
        if (status) status.textContent = 'API DOWN'
      } finally {
        state.cycling = false
        paintTimer()
      }
    }

    const btn = $(root, '[data-dw="check"]')
    if (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true
        try {
          await refresh(true)
        } finally {
          btn.disabled = false
        }
      })
    }

    refresh(false)
    setInterval(paintTimer, 1000)
    setInterval(function () {
      refresh(false)
    }, 30000)
  }

  function boot() {
    document.querySelectorAll('.daily-watch[data-desk]').forEach(mount)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
