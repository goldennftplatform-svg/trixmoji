'use strict'

;(function () {
  const SRC = '/assets/media/poolvoid-intro.mp4?v=20261022pv'
  const DEST = '/pool-void/past'
  const SEEN = 'poolvoid-gate-seen'
  const onPage = /\/pool-void(?:\.html|\/|$)/i.test(location.pathname)

  function css() {
    if (document.getElementById('poolvoidGateCss')) return
    const style = document.createElement('style')
    style.id = 'poolvoidGateCss'
    style.textContent =
      '.pool-video-gate{position:fixed;inset:0;z-index:80;background:#000;display:flex;align-items:center;justify-content:center}' +
      '.pool-video-gate[hidden]{display:none !important}' +
      '.pool-video-gate video{width:min(100vw,960px);height:min(100vh,540px);max-width:100%;max-height:100%;object-fit:contain;background:#000}' +
      '.pool-video-skip{position:absolute;bottom:18px;left:0;right:0;text-align:center;color:#ffff00;letter-spacing:3px;font-size:16px;font-family:VT323,monospace;text-shadow:0 0 8px rgba(255,255,0,.35);pointer-events:none}' +
      'body.pool-video-on{overflow:hidden}'
    document.head.appendChild(style)
  }

  function gate() {
    css()
    let el = document.getElementById('poolVideoGate')
    if (el) return el
    el = document.createElement('div')
    el.id = 'poolVideoGate'
    el.className = 'pool-video-gate'
    el.hidden = true
    el.innerHTML =
      '<video id="poolVideo" playsinline webkit-playsinline></video>' +
      '<div class="pool-video-skip">CLICK / ESC TO OPEN</div>'
    document.body.appendChild(el)
    return el
  }

  function seen() {
    try { return window.sessionStorage.getItem(SEEN) === '1' }
    catch (e) { return false }
  }

  function mark() {
    try { window.sessionStorage.setItem(SEEN, '1') }
    catch (e) {}
  }

  function clearSeen() {
    try { window.sessionStorage.removeItem(SEEN) }
    catch (e) {}
  }

  function go() {
    const wrap = document.getElementById('poolVideoGate')
    const vid = document.getElementById('poolVideo')
    if (vid) {
      try { vid.pause() } catch (e) {}
      vid.removeAttribute('src')
      vid.load()
    }
    if (wrap) wrap.hidden = true
    document.body.classList.remove('pool-video-on')
    mark()
    if (!onPage) window.location.href = DEST
  }

  function play(ev) {
    if (ev) {
      ev.preventDefault()
      ev.stopPropagation()
    }
    const wrap = gate()
    const vid = document.getElementById('poolVideo')
    if (!vid) return go()
    wrap.hidden = false
    document.body.classList.add('pool-video-on')
    vid.muted = false
    vid.controls = false
    vid.src = SRC
    const kick = vid.play()
    if (kick && typeof kick.catch === 'function') {
      kick.catch(function () {
        vid.muted = true
        return vid.play()
      }).catch(function () {
        go()
      })
    }
  }

  function bind() {
    const wrap = gate()
    const vid = document.getElementById('poolVideo')
    if (vid && !vid._poolBound) {
      vid._poolBound = true
      vid.addEventListener('ended', go)
      vid.addEventListener('error', go)
    }
    if (wrap && !wrap._poolBound) {
      wrap._poolBound = true
      wrap.addEventListener('click', go)
    }
    if (!document.documentElement._poolEsc) {
      document.documentElement._poolEsc = true
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && document.body.classList.contains('pool-video-on')) go()
      })
    }
    const links = document.querySelectorAll('a.pool-void')
    for (let i = 0; i < links.length; i++) {
      if (links[i]._poolBound) continue
      links[i]._poolBound = true
      links[i].addEventListener('click', play, true)
    }
    if (onPage && !seen()) play()
    else if (onPage) clearSeen()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind)
  } else {
    bind()
  }
})()
