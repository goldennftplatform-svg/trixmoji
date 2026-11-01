(() => {
 'use strict'
 const COUNT = 1000, SIZE = 40
 const el = id => document.getElementById(id)
 let page = 0, selected = null
 const image = id => '/assets/ethscriptions/phunks/img/' + id + '.png'
 function open(id) {
  el('artTitle').textContent = 'PHUNK #' + id
  el('largeArt').src = image(id); el('largeArt').alt = 'Artwork preview for Phunk ' + id
  el('openArt').href = image(id)
  el('artDialog').showModal()
 }
 function draw() {
  el('grid').innerHTML = ''
  const start = selected === null ? page * SIZE : selected
  const end = selected === null ? Math.min(start + SIZE, COUNT) : selected + 1
  for (let id = start; id < end; id++) {
   const card = document.createElement('article'); card.className = 'card'
   const button = document.createElement('button'); button.className = 'artButton'; button.setAttribute('aria-label', 'View artwork for Phunk ' + id); button.onclick = () => open(id)
   const img = document.createElement('img'); img.src = image(id); img.alt = 'Phunk #' + id; img.loading = 'lazy'; img.decoding = 'async'; img.width = 256; img.height = 256
   img.onerror = () => { img.alt = 'Artwork unavailable for #' + id; card.querySelector('p').textContent = 'IMAGE UNAVAILABLE' }
   button.appendChild(img)
   const title = document.createElement('h2'); title.textContent = 'PHUNK #' + id
   const note = document.createElement('p'); note.textContent = 'ARTWORK PREVIEW · NOT LISTED'
   card.append(button, title, note); el('grid').appendChild(card)
  }
  el('range').textContent = '#' + start + '–#' + (end - 1) + ' · 1,000 artwork previews'
  el('pageLabel').textContent = selected === null ? 'PAGE ' + (page + 1) + ' OF ' + Math.ceil(COUNT / SIZE) : 'PHUNK #' + selected
  el('previous').disabled = page === 0; el('next').disabled = page === Math.ceil(COUNT / SIZE) - 1
  const params = new URLSearchParams(); if (selected !== null) params.set('id', selected); else params.set('page', page + 1)
  history.replaceState(null, '', location.pathname + '?' + params)
 }
 function find() {
  const raw = el('search').value.trim(), id = Number(raw)
  if (!raw || !Number.isInteger(id) || id < 0 || id >= COUNT) { el('status').textContent = 'Enter an artwork number from 0 to 999.'; return }
  el('status').textContent = ''; selected = id; page = Math.floor(id / SIZE); draw()
 }
 el('go').onclick = find
 el('search').addEventListener('keydown', e => { if (e.key === 'Enter') find() })
 el('all').onclick = () => { selected = null; el('status').textContent = ''; draw() }
 el('previous').onclick = () => { page = Math.max(0, page - 1); selected = null; draw() }
 el('next').onclick = () => { page = Math.min(Math.ceil(COUNT / SIZE) - 1, page + 1); selected = null; draw() }
 el('closeDialog').onclick = () => el('artDialog').close()
 const params = new URLSearchParams(location.search)
 if (params.has('id') && /^\d+$/.test(params.get('id')) && Number(params.get('id')) < COUNT) { selected = Number(params.get('id')); page = Math.floor(selected / SIZE); el('search').value = selected }
 else if (/^\d+$/.test(params.get('page') || '') && Number(params.get('page')) >= 1 && Number(params.get('page')) <= 25) page = Number(params.get('page')) - 1
 draw()
})()
