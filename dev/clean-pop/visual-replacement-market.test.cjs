'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { ethers } = require('ethers')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json')
const deployment = require('../../assets/data/trixmoji-escrow-replacement-deployment.json')
const seller = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', id = ethers.utils.id('visual-asset')
test('replacement visual market deposits first and lists only from the indexed escrow view', async () => {
 const ids = ['walletGrid','marketStatus','moreWallet','marketReview','marketRecovery','myWallet','myEscrow','forSale','auctions','refreshWallet','withdrawCredit']
 function element() { return { children: [], hidden: false, textContent: '', appendChild(x) { this.children.push(x); return x }, append(...xs) { this.children.push(...xs) }, setAttribute() {}, focus() {} } }
 const els = Object.fromEntries(ids.map(x => [x, element()])); let submitted, reviewCallback
 const provider = { on() {}, removeListener() {} }, connection = { address: seller, provider }
 const market = { marketAddress: deployment.address, tradingReady: true, deposits: [], auctions: [], listings: [] }
 const fetch = async url => { const s = String(url); let value
  if (s.includes('replacement-artifact')) value = artifact
  else if (s.includes('replacement-deployment')) value = deployment
  else if (s.includes('market-wallet-inventory')) value = { items: [{ id, tokenNo: 6 }], nextPageKey: null }
  else if (s.includes('trixmoji-market-replacement')) value = market
  else throw Error('unexpected fetch ' + s)
  return { ok: true, json: async () => value }
 }
 const client = { records: () => [], run: async (kind, args, review) => { submitted = { kind, args }; reviewCallback = review; throw Error('review test stop') } }
 const context = { document: { getElementById: id => els[id], createElement: () => element() }, window: { prompt: () => '0.012', addEventListener() {} }, location: { search: '', origin: 'https://example.test' }, URL, URLSearchParams, AbortSignal, fetch, ethers, localStorage: {}, navigator: { locks: {} }, MarketWalletConnector: { current: () => connection }, TrixmojiMarketWallet: { create: options => { assert.equal(options.combinedDepositEnabled, true); assert.equal(options.market, deployment.address); return client } }, CleanPopTransferCheckout: { records: () => [] }, setTimeout, console }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/trixmoji-market-inventory.js'), 'utf8'), context)
 els.myWallet.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 const walletCard = els.walletGrid.children[0], depositButton = walletCard.children.find(x => x.textContent === 'MOVE TO ESCROW')
 assert.ok(depositButton); assert.equal(walletCard.children.some(x => x.textContent === 'LIST FOR SALE'), false)
 depositButton.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 assert.equal(submitted.kind, 'deposit'); assert.equal(submitted.args.id, id)
 const depositReview = walletCard.children.find(x => x.className === 'market-review')
 const depositPending = reviewCallback({ action: 'deposit', assetId: id, to: deployment.address, valueWei: '0', estimatedGas: '50000', approve: () => { throw Error('must not request wallet') } })
  assert.match(depositReview.children[0].textContent, /indexer must confirm/); assert.doesNotMatch(depositReview.children[0].textContent, /uncheck|settings/i)
 depositReview.children.find(x => x.textContent === 'CANCEL').onclick(); await assert.rejects(depositPending, /Cancelled/)
 els.walletGrid.children = []; els.myEscrow.onclick(); await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(els.walletGrid.children.length, 0)
 market.deposits = [{ id, tokenNo: 6, seller, cooldown: 0 }]; els.myEscrow.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 const card = els.walletGrid.children[0], listForm = card.children.find(x => x.children.some(child => child.textContent === 'LIST FOR SALE'))
 assert.ok(listForm); const input = listForm.children[0].children[0], cardReview = card.children.find(x => x.className === 'market-review')
 assert.ok(input); assert.ok(cardReview); input.value = 'invalid'; listForm.onsubmit({ preventDefault() {} }); assert.equal(submitted.kind, 'deposit')
 input.value = '0.012'; listForm.onsubmit({ preventDefault() {} }); await new Promise(resolve => setTimeout(resolve, 30))
 assert.equal(submitted.kind, 'list'); assert.equal(submitted.args.id, id); assert.equal(submitted.args.amountWei, ethers.utils.parseEther('0.012').toString()); assert.equal(typeof reviewCallback, 'function')
 const pending = reviewCallback({ action: 'list', assetId: id, to: deployment.address, valueWei: '0', estimatedGas: '50000', approve: () => { throw Error('must not request wallet') } })
 assert.match(cardReview.children[0].textContent, /listing price 0\.012 ETH/)
 assert.match(els.marketStatus.textContent, /CONTINUE TO WALLET/)
 assert.ok(cardReview.children.some(x => x.textContent === 'CONTINUE TO WALLET'))
  cardReview.children.find(x => x.textContent === 'CANCEL').onclick()
  await assert.rejects(pending, /Cancelled/)
  const toggle = card.children.find(x => x.textContent === 'SET UP AUCTION'), auctionForm = card.children.find(x => x.className === 'auction-form')
  assert.ok(toggle); assert.equal(auctionForm.hidden, true); toggle.onclick(); assert.equal(auctionForm.hidden, false)
  const reserve = auctionForm.children.find(x => x.textContent === 'MINIMUM BID · ETH').children[0], hours = auctionForm.children.find(x => x.textContent === 'DURATION · HOURS').children[0]
  reserve.value = '0.02'; hours.value = '169'; auctionForm.onsubmit({ preventDefault() {} }); assert.equal(submitted.kind, 'list')
  assert.match(auctionForm.children.find(x => x.className === 'auction-error').textContent, /between 1 and 168/)
  hours.value = '48'; auctionForm.onsubmit({ preventDefault() {} }); await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(submitted.kind, 'auction'); assert.equal(submitted.args.amountWei, ethers.utils.parseEther('0.02').toString()); assert.equal(submitted.args.duration, 172800)
  cardReview.children = [] // Real DOM textContent assignment clears previous review children.
  const auctionReview = reviewCallback({ action: 'auction', assetId: id, to: deployment.address, valueWei: '0', estimatedGas: '50000', approve: () => { throw Error('must not request wallet') } })
  assert.match(cardReview.children[0].textContent, /minimum bid 0\.02 ETH · duration 48 hours/)
  cardReview.children.find(x => x.textContent === 'CANCEL').onclick(); await assert.rejects(auctionReview, /Cancelled/)
  market.listings = [{ id, seller, priceWei: ethers.utils.parseEther('1').toString() }]; els.walletGrid.children = []; els.myEscrow.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
  const listedCard = els.walletGrid.children[0], listedForm = listedCard.children.find(x => x.children.some(child => child.textContent === 'UPDATE SALE PRICE'))
  assert.ok(listedForm); assert.equal(listedForm.children[0].children[0].value, '1.0')
  assert.match(listedCard.children.find(x => x.className === 'auction-form').children[1].textContent, /replaces your current fixed-price listing/)
  assert.ok(listedCard.children.some(x => x.textContent === 'REMOVE LISTING & RETURN'))
 })
test('known recovered wrapped request is automatically verified without a wallet transaction', async () => {
 const ids = ['walletGrid','marketStatus','moreWallet','marketReview','marketRecovery','myWallet','myEscrow','forSale','auctions','refreshWallet','withdrawCredit']
 function element() { return { children: [], hidden: false, textContent: '', appendChild(x) { this.children.push(x); return x }, append(...xs) { this.children.push(...xs) }, setAttribute() {}, focus() {} } }
 const els = Object.fromEntries(ids.map(x => [x, element()])), calls = []
 const original = '0x9de253efbaeb700b2947630706ce0234c19b23a8eb3ab16d1adb40db0e5a57c5', cancel = '0x430a0f0cafa463ab9d8b075b68d88ec4bc9639a9490132f164dfb08d801e93db'
 const row = { key: 'saved', action: 'depositAndList', hash: original, to: deployment.address, state: 'submitted' }
 const client = { records: () => [row], reconcileClearedWrapped: async (key, hash) => { calls.push({ key, hash }); row.state = 'failed' } }
 const fetch = async url => { const s = String(url); let value
  if (s.includes('replacement-artifact')) value = artifact
  else if (s.includes('replacement-deployment')) value = deployment
  else if (s.includes('market-wallet-inventory')) value = { items: [{ id, tokenNo: 6 }], nextPageKey: null }
  else if (s.includes('trixmoji-market-replacement')) value = { marketAddress: deployment.address, tradingReady: true, deposits: [], auctions: [], listings: [] }
  else throw Error('unexpected fetch ' + s)
  return { ok: true, json: async () => value }
 }
 const context = { document: { getElementById: id => els[id], createElement: () => element() }, window: { addEventListener() {} }, location: { search: '', origin: 'https://example.test' }, URL, URLSearchParams, AbortSignal, fetch, ethers, localStorage: {}, navigator: { locks: {} }, MarketWalletConnector: { current: () => ({ address: seller, provider: {} }) }, TrixmojiMarketWallet: { create: () => client }, CleanPopTransferCheckout: { records: () => [] }, setTimeout, console }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/trixmoji-market-inventory.js'), 'utf8'), context)
 els.myWallet.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 assert.equal(calls.length, 1); assert.equal(calls[0].key, 'saved'); assert.equal(calls[0].hash, cancel); assert.equal(row.state, 'failed')
  assert.ok(els.marketRecovery.children.some(x => /No gas used/.test(x.textContent)))
})
test('confirmed submitted listing is checked on load without sending a transaction', async () => {
 const ids = ['walletGrid','marketStatus','moreWallet','marketReview','marketRecovery','myWallet','myEscrow','forSale','auctions','refreshWallet','withdrawCredit']
 function element() { return { children: [], hidden: false, textContent: '', appendChild(x) { this.children.push(x); return x }, append(...xs) { this.children.push(...xs) }, setAttribute() {}, focus() {} } }
 const els = Object.fromEntries(ids.map(x => [x, element()])), calls = []
 const row = { key: 'listing', action: 'list', hash: ethers.utils.id('list'), from: seller, to: deployment.address, state: 'submitted' }
 const client = { records: () => [row], reconcile: async item => { calls.push(item.hash); item.state = 'complete'; return { complete: true } } }
 const fetch = async url => { const s = String(url); let value
  if (s.includes('replacement-artifact')) value = artifact
  else if (s.includes('replacement-deployment')) value = deployment
  else if (s.includes('market-wallet-inventory')) value = { items: [], nextPageKey: null }
  else if (s.includes('trixmoji-market-replacement')) value = { marketAddress: deployment.address, tradingReady: true, deposits: [], auctions: [], listings: [] }
  else throw Error('unexpected fetch ' + s)
  return { ok: true, json: async () => value }
 }
 const context = { document: { getElementById: id => els[id], createElement: () => element() }, window: { addEventListener() {} }, location: { search: '', origin: 'https://example.test' }, URL, URLSearchParams, AbortSignal, fetch, ethers, localStorage: {}, navigator: { locks: {} }, MarketWalletConnector: { current: () => ({ address: seller, provider: {} }) }, TrixmojiMarketWallet: { create: () => client }, CleanPopTransferCheckout: { records: () => [] }, setTimeout, console }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/trixmoji-market-inventory.js'), 'utf8'), context)
 els.myWallet.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 assert.deepEqual(calls, [row.hash]); assert.equal(row.state, 'complete')
})
test('escrow button rechecks service on click and never requests a wallet while unavailable', async () => {
 const ids = ['walletGrid','marketStatus','moreWallet','marketReview','marketRecovery','myWallet','myEscrow','forSale','auctions','refreshWallet','withdrawCredit']
 function element() { return { children: [], hidden: false, textContent: '', appendChild(x) { this.children.push(x); return x }, append(...xs) { this.children.push(...xs) }, setAttribute() {}, focus() {} } }
 const els = Object.fromEntries(ids.map(x => [x, element()])), market = { marketAddress: deployment.address, tradingReady: false, deposits: [], auctions: [], listings: [] }
 let requested = 0
 const client = { records: () => [], run: async () => { requested++; throw Error('test stop before wallet') } }
 const fetch = async url => { const s = String(url); let value
  if (s.includes('replacement-artifact')) value = artifact
  else if (s.includes('replacement-deployment')) value = deployment
  else if (s.includes('market-wallet-inventory')) value = { items: [{ id, tokenNo: 6 }], nextPageKey: null }
  else if (s.includes('trixmoji-market-replacement')) value = market
  else throw Error('unexpected fetch ' + s)
  return { ok: true, json: async () => value }
 }
 const context = { document: { getElementById: id => els[id], createElement: () => element() }, window: { addEventListener() {} }, location: { search: '', origin: 'https://example.test' }, URL, URLSearchParams, AbortSignal, fetch, ethers, localStorage: {}, navigator: { locks: {} }, MarketWalletConnector: { current: () => ({ address: seller, provider: {} }) }, TrixmojiMarketWallet: { create: () => client }, CleanPopTransferCheckout: { records: () => [] }, setTimeout, console }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/trixmoji-market-inventory.js'), 'utf8'), context)
 els.myWallet.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 const card = els.walletGrid.children[0], button = card.children.find(x => x.textContent === 'MOVE TO ESCROW'), review = card.children.find(x => x.className === 'market-review')
 assert.equal(button.disabled, false); button.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 assert.equal(requested, 0); assert.match(review.textContent, /market is not ready/i); assert.equal(review.hidden, false)
 market.tradingReady = true; button.onclick(); await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(requested, 1)
})
