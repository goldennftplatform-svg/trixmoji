(function () {
 'use strict'
 var catalogue = document.getElementById('catalogSection'), panel = document.getElementById('tradePanel'), title = document.getElementById('tradeTitle')
 var tabs = { browseCollection: 'EXPLORE COLLECTION', myWallet: 'MY WALLET', myEscrow: 'MY ESCROW', forSale: 'FOR SALE', auctions: 'AUCTIONS' }
 function show(id) {
  var browse = id === 'browseCollection'; catalogue.hidden = !browse; panel.hidden = browse
  if (!browse) title.textContent = tabs[id]
  Object.keys(tabs).forEach(function (key) { var b = document.getElementById(key), selected = key === id; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)) })
 }
 Object.keys(tabs).forEach(function (key) { document.getElementById(key).addEventListener('click', function () { show(key) }) })
 document.getElementById('backToCollection').addEventListener('click', function () { show('browseCollection') })
})()
