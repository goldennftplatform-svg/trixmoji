'use strict'

;(function () {
  const API = '/api/deploy-watch'

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
    const m = Math.floor(s / 60)
    const r = s % 60
    return pad(m) + ':' + pad(r)
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
    const site = (root.getAttribute('data-site') || 'pond').toLowerCase()
    root.innerHTML =
      '<div class="dw-head">' +
      '<div class="dw-flag">DEPLOY TRACKER</div>' +
      '<h3 class="dw-title" data-dw="title">NEXT SCAN</h3>' +
      '<div class="dw-count" data-dw="count">--:--</div>' +
      '<div class="dw-sub" data-dw="sub">WHEN THE SITE SHIPS A NEW BUILD, DOSWAPZ POSTS IT HERE.</div>' +
      '</div>' +
      '<div class="dw-meta">' +
      '<span>LAST SCAN <b data-dw="last">--</b></span>' +
      '<span>LAST DEPLOY <b data-dw="deploy">NONE</b></span>' +
      '<span data-dw="status">WAITING</span>' +
      '</div>' +
      '<div class="dw-actions">' +
      '<button type="button" data-dw="check">[ SCAN NOW ]</button>' +
      '<span class="dw-hint">CRON EVERY 15 MIN. NEW BUILD = ON-SITE POST + X DRAFT.</span>' +
      '</div>' +
      '<div class="dw-log" data-dw="log"><div class="empty">NO DEPLOYS LOGGED YET.</div></div>'

    const state = { nextAt: null, cycling: false }

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

    function render(data) {
      if (!data) return
      state.nextAt = data.nextScanAt || null
      const title = $(root, '[data-dw="title"]')
      const sub = $(root, '[data-dw="sub"]')
      if (title) title.textContent = (data.label || site.toUpperCase()) + ' * DEPLOY TRACKER'
      if (sub) sub.textContent = 'Watching ' + (data.host || '') + ' * posts land on this page'
      const last = $(root, '[data-dw="last"]')
      const deploy = $(root, '[data-dw="deploy"]')
      const status = $(root, '[data-dw="status"]')
      if (last) last.textContent = data.lastScanAt ? ageOf(data.lastScanAt) : 'NEVER'
      if (deploy) deploy.textContent = data.lastDeploy && data.lastDeploy.at ? ageOf(data.lastDeploy.at) : 'NONE YET'
      if (status) {
        const n = (data.deploys || []).length
        status.textContent = n ? n + ' DEPLOYS ON FILE' : 'WAITING FOR FIRST BUILD CHANGE'
      }
      const log = $(root, '[data-dw="log"]')
      if (!log) return
      const posts = (data.posts || [])
        .slice(0, 8)
        .map(function (p) {
          return (
            '<div class="dw-row new"><span class="when">' +
            (p.at ? new Date(p.at).toLocaleString() : '') +
            '</span>' +
            esc(p.headline || 'DEPLOY') +
            (p.fingerprint ? ' * ' + esc(p.fingerprint) : '') +
            '</div>'
          )
        })
        .join('')
      const rows = ((data.current && data.current.rows) || [])
        .map(function (r) {
          return (
            '<div class="dw-row' +
            (r.ok ? '' : ' down') +
            '"><span class="when">' +
            esc((r.url || '').replace(/^https:\/\//, '')) +
            '</span>HTTP ' +
            esc(r.status ?? (r.ok ? 'OK' : 'DOWN')) +
            (r.buildId ? ' * BUILD ' + esc(r.buildId) : '') +
            (r.fingerprint ? ' * ' + esc(r.fingerprint) : '') +
            (r.error ? ' * ' + esc(r.error) : '') +
            '</div>'
          )
        })
        .join('')
      log.innerHTML =
        (posts ? '<div class="dw-h">POSTED DEPLOYS</div>' + posts : '<div class="empty">NO DEPLOY POSTS YET. FIRST CHANGE GETS LOGGED HERE.</div>') +
        '<div class="dw-h">LIVE BUILD FINGERPRINTS</div>' +
        (rows || '<div class="empty">NO SAMPLE YET. HIT SCAN NOW.</div>')
      paintTimer()
    }

    async function refresh(force) {
      state.cycling = !!force
      paintTimer()
      const status = $(root, '[data-dw="status"]')
      if (status && force) status.textContent = 'SCANNING...'
      try {
        const res = await fetch(API + '?site=' + encodeURIComponent(site), {
          method: force ? 'POST' : 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        })
        const data = await res.json()
        if (!data || !data.ok || !data.site) {
          if (status) status.textContent = 'API DOWN' + (res.status ? ' * HTTP ' + res.status : '')
          return
        }
        render(data.site)
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
    document.querySelectorAll('.deploy-watch[data-site]').forEach(mount)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
