(() => {
 'use strict'
 const SIZE = 40, el = id => document.getElementById(id)
 let catalog, page = 0, matches = [], chosen = new Set(), currentArt = null
 const cleanPop = document.body.dataset.collection === 'clean-pop-v1'
 const pieceName = cleanPop ? 'CLEAN POP' : 'PHUNK'
 if (cleanPop) {
  const nav = document.querySelector('header nav')
  if (nav) { const link = document.createElement('a'); link.href = '/classic/pages/clean-pop-transfer.html'; link.textContent = 'SEND TO FRIEND ↗'; nav.appendChild(link) }
 }
 const mintImage = id => (cleanPop ? '/assets/ethscriptions/clean-pop-v1/' : '/assets/ethscriptions/phunks/img/') + id + '.png'
 const image = mintImage
 const traits = item => item.t.map(index => catalog.dictionary[index])
 const visualCount = item => traits(item).filter(t => !['Token', 'Type', 'Skin'].includes(t.group)).length
 function filter() {
  page = 0
  const query = el('search').value.trim().toLowerCase().replace(/^#/, '')
  const byGroup = new Map()
  for (const index of chosen) { const group = catalog.dictionary[index].group; if (!byGroup.has(group)) byGroup.set(group, []); byGroup.get(group).push(index) }
  matches = catalog.items.filter(item => {
   if (/^\d+$/.test(query) && item.id !== Number(query)) return false
   if (query && !/^\d+$/.test(query) && !traits(item).some(t => t.value.toLowerCase().includes(query) || t.group.toLowerCase().includes(query))) return false
   return [...byGroup.values()].every(values => values.some(index => item.t.includes(index)))
  })
  const order = el('sort').value
  matches.sort(order === 'desc' ? (a,b) => b.id-a.id : order === 'traits' ? (a,b) => visualCount(b)-visualCount(a) || a.id-b.id : (a,b) => a.id-b.id)
  draw()
 }
 function toggle(index) {
  chosen.has(index) ? chosen.delete(index) : chosen.add(index)
  const input = document.querySelector('input[data-trait="' + index + '"]'); if (input) input.checked = chosen.has(index)
  filter()
 }
 function open(id) {
  const item = catalog.items.find(i => i.id === id); if (!item) return
   currentArt = id; el('artTitle').textContent = pieceName + ' #' + id
   el('largeArt').src = image(id); el('largeArt').alt = pieceName + ' artwork #' + id; el('openArt').href = image(id)
  el('copyLink').textContent = 'COPY ARTWORK LINK'; el('artTraits').innerHTML = ''
  for (const index of item.t) {
   const trait = catalog.dictionary[index], b = document.createElement('button'), group = document.createElement('b')
   group.textContent = trait.group; b.append(group, document.createTextNode(trait.value + ' · ' + (trait.count / catalog.supply * 100).toFixed(2) + '%'))
   b.onclick = () => { el('artDialog').close(); if (!chosen.has(index)) toggle(index) }
   el('artTraits').appendChild(b)
  }
  el('artDialog').showModal()
 }
 function draw() {
  el('grid').innerHTML = ''; el('activeFilters').innerHTML = ''
  for (const index of chosen) { const t = catalog.dictionary[index], b = document.createElement('button'); b.textContent = t.group + ': ' + t.value + ' ×'; b.onclick = () => toggle(index); el('activeFilters').appendChild(b) }
  for (const item of matches.slice(page * SIZE, (page + 1) * SIZE)) {
   const card = document.createElement('article'); card.className = 'card'
    const button = document.createElement('button'); button.className = 'artButton'; button.setAttribute('aria-label', 'View ' + pieceName + ' ' + item.id); button.onclick = () => open(item.id)
    const img = document.createElement('img'); img.src = image(item.id); img.alt = pieceName + ' artwork #' + item.id; img.loading = 'lazy'; img.decoding = 'async'; img.width = 256; img.height = 256; button.appendChild(img)
    const heading = document.createElement('h2'); heading.textContent = pieceName + ' #' + item.id
   const arrow = document.createElement('span'); arrow.textContent = '↗'; heading.appendChild(arrow)
   const type = document.createElement('p'); type.className = 'card-trait'; type.textContent = traits(item).find(t=>t.group==='Type')?.value || 'PHUNK'
   const note = document.createElement('p'); note.textContent = visualCount(item) + ' VISUAL TRAITS · PREVIEW'
   img.onerror = () => { note.textContent = 'IMAGE UNAVAILABLE'; img.alt = 'Unavailable artwork #' + item.id }
   card.append(button, heading, type, note); el('grid').appendChild(card)
  }
  if (!matches.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'No Phunks match these traits. Clear a filter or try another search.'; el('grid').appendChild(p) }
  el('range').textContent = matches.length.toLocaleString() + ' / ' + catalog.supply.toLocaleString() + ' ARTWORKS'
  el('pageLabel').textContent = matches.length ? 'PAGE ' + (page + 1) + ' / ' + Math.ceil(matches.length / SIZE) : 'NO RESULTS'
  el('previous').disabled = page === 0; el('next').disabled = (page + 1) * SIZE >= matches.length
 }
 function groups() {
  const map = new Map()
  catalog.dictionary.forEach((trait,index) => { if (!map.has(trait.group)) map.set(trait.group, []); map.get(trait.group).push({ ...trait, index }) })
  for (const [name, values] of map) {
   const details = document.createElement('details'); details.open = name === 'Type'
   const summary = document.createElement('summary'); summary.textContent = name.toUpperCase() + ' · ' + values.length
   const options = document.createElement('div'); options.className = 'trait-options'
   for (const t of values.sort((a,b)=>b.count-a.count || a.value.localeCompare(b.value))) {
    const label = document.createElement('label'), input = document.createElement('input'), count = document.createElement('span')
    input.type='checkbox'; input.dataset.trait=t.index; input.onchange=()=>toggle(t.index)
    count.textContent=t.count.toLocaleString(); label.append(input,document.createTextNode(t.value),count); options.appendChild(label)
   }
   details.append(summary,options); el('filterGroups').appendChild(details)
  }
 }
 el('previous').onclick=()=>{if(page>0){page--;draw()}}
 el('next').onclick=()=>{if((page+1)*SIZE<matches.length){page++;draw()}}
 el('sort').onchange=()=>{if(catalog)filter()}
 let timer; el('search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(catalog)filter()},150)}
 el('clear').onclick=()=>{chosen.clear();el('search').value='';el('sort').value='asc';document.querySelectorAll('[data-trait]').forEach(i=>i.checked=false);if(catalog)filter()}
 el('toggleFilters').onclick=()=>{const hidden=document.querySelector('.workspace').classList.toggle('filters-hidden');el('toggleFilters').setAttribute('aria-expanded',String(!hidden))}
 el('closeDialog').onclick=()=>el('artDialog').close()
 el('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname+'?id='+currentArt);el('copyLink').textContent='LINK COPIED'}catch(_){el('copyLink').textContent='COPY FROM ADDRESS BAR';history.replaceState(null,'',location.pathname+'?id='+currentArt)}}
 if (matchMedia('(max-width:760px)').matches) {document.querySelector('.workspace').classList.add('filters-hidden');el('toggleFilters').setAttribute('aria-expanded','false')}
 fetch('/assets/data/phunk-catalog.json').then(async response=>{if(!response.ok)throw new Error('Trait catalogue unavailable. Refresh or retry after deployment.');return response.json()}).then(data=>{
  if(data.supply!==10000 || data.items.length!==10000)throw new Error('Incomplete trait catalogue')
  catalog=data;el('traitTotal').textContent=data.dictionary.length;groups();filter()
  const id=new URLSearchParams(location.search).get('id');if(id!==null && /^\d+$/.test(id) && Number(id)<10000)open(Number(id))
 }).catch(e=>{el('status').textContent=e.message;el('range').textContent='CATALOGUE UNAVAILABLE';el('previous').disabled=true;el('next').disabled=true})
})()
