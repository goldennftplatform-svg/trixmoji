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
 assert.ok(els.marketRecovery.children.some(x => /No transaction or gas was used/.test(x.textContent)))
})
