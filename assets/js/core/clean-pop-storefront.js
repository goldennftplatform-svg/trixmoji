(function () {
 'use strict'
 var grid = document.getElementById('cleanPopGrid')
 var label = document.getElementById('cleanPopPage')
 var previous = document.getElementById('cleanPopPrev')
 var next = document.getElementById('cleanPopNext')
 var jump = document.getElementById('cleanPopJump')
 var page = 0, pageSize = 40, supply = 10000
 function draw() {
  grid.textContent = ''
  var start = page * pageSize, end = Math.min(start + pageSize, supply)
  for (var id = start; id < end; id++) {
   var card = document.createElement('div'), img = document.createElement('img'), meta = document.createElement('div')
   card.className = 'phunk-card'
   img.src = '/assets/images/ethscription-cover.png'; img.alt = 'Unrevealed Clean Pop cover #' + id; img.loading = 'lazy'
   meta.className = 'meta'; meta.textContent = '#' + id
   card.appendChild(img); card.appendChild(meta); grid.appendChild(card)
  }
  label.textContent = (start + 1) + '–' + end + ' of ' + supply
  previous.disabled = page === 0; next.disabled = end === supply
 }
 previous.addEventListener('click', function () { if (page > 0) { page--; draw() } })
 next.addEventListener('click', function () { if ((page + 1) * pageSize < supply) { page++; draw() } })
 document.getElementById('cleanPopGo').addEventListener('click', function () {
  var text = jump.value.trim(), id = Number(text)
  if (!/^\d+$/.test(text) || !Number.isInteger(id) || id < 0 || id >= supply) {
   label.textContent = 'Enter a piece number from 0 to 9999.'; return
  }
  page = Math.floor(id / pageSize); draw()
 })
 draw()
 fetch('/.netlify/functions/clean-pop-status', { cache: 'no-store' }).then(function (response) {
  if (!response.ok) throw new Error('Status unavailable')
  return response.json()
 }).then(function (status) {
  if (!Number.isInteger(status.minted) || status.supply !== supply) throw new Error('Invalid status')
  document.getElementById('cleanPopCount').textContent = status.minted + ' / ' + supply + ' MINTED · BLOCKSCOUT INDEXED EVENTS'
 }).catch(function () {
  document.getElementById('cleanPopCount').textContent = 'Mint count temporarily unavailable.'
 })
})()
