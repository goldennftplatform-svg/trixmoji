'use strict'

;(function () {
  const SRC = '/assets/video/geoffwatch/black-box.mp4?v=20260906egg'
  const DEST = '/classic/pages/geoffwatch-box.html'
  const onEggPage = /geoffwatch-box\.html/i.test(location.pathname)

  function gate() {
    let el = document.getElementById('eggVideoGate')
    if (el) return el
    el = document.createElement('div')
    el.id = 'eggVideoGate'
    el.className = 'egg-video-gate'
    el.hidden = true
    el.innerHTML =
      '<video id="eggVideo" playsinline webkit-playsinline></video>' +
      '<div class="egg-video-skip">CLICK / ESC TO OPEN</div>'
    document.body.appendChild(el)
    return el
  }

  function go() {
    const wrap = document.getElementById('eggVideoGate')
    const vid = document.getElementById('eggVideo')
    if (vid) {
      try { vid.pause() } catch (e) {}
      vid.removeAttribute('src')
      vid.load()
    }
    if (wrap) wrap.hidden = true
    document.body.classList.remove('egg-video-on')
    if (!onEggPage) window.location.href = DEST
  }

  function play(ev) {
    if (ev) {
      ev.preventDefault()
      ev.stopPropagation()
    }
    const wrap = gate()
    const vid = document.getElementById('eggVideo')
    if (!vid) return go()
    wrap.hidden = false
    document.body.classList.add('egg-video-on')
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
    const vid = document.getElementById('eggVideo')
    if (vid && !vid._eggBound) {
      vid._eggBound = true
      vid.addEventListener('ended', go)
      vid.addEventListener('error', go)
    }
    if (wrap && !wrap._eggBound) {
      wrap._eggBound = true
      wrap.addEventListener('click', go)
    }
    if (!document.body._eggEsc) {
      document.body._eggEsc = true
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && document.body.classList.contains('egg-video-on')) go()
      })
    }
    const eggs = document.querySelectorAll('a.egg-box')
    for (let i = 0; i < eggs.length; i++) {
      if (eggs[i]._eggBound) continue
      eggs[i]._eggBound = true
      eggs[i].addEventListener('click', play)
    }
    const hero = document.querySelector('.box-hero')
    if (hero && !hero._eggBound) {
      hero._eggBound = true
      hero.style.cursor = 'pointer'
      hero.addEventListener('click', play)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind)
  } else {
    bind()
  }
})()
