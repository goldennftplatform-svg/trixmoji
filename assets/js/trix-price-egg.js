'use strict'

;(function () {
  function bind() {
    var btn = document.getElementById('priceEggBtn')
    var panel = document.getElementById('priceEgg')
    if (!btn || !panel || btn._priceEgg) return
    btn._priceEgg = true
    btn.setAttribute('aria-expanded', 'false')
    btn.setAttribute('aria-controls', 'priceEgg')
    btn.addEventListener('click', function () {
      var open = panel.hidden
      panel.hidden = !open
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
      if (open) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind)
  else bind()
})()
