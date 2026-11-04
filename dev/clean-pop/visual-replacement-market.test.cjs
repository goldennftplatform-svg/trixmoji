'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { ethers } = require('ethers')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json')
const deployment = require('../../assets/data/trixmoji-escrow-replacement-deployment.json')
const seller = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', id = ethers.utils.id('visual-asset')
test('replacement visual wallet card creates an explicit combined listing with the selected price', async () => {
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
 const card = els.walletGrid.children[0], button = card.children.find(x => x.textContent === 'LIST FOR SALE')
 assert.ok(button); await button.onclick(); await new Promise(resolve => setTimeout(resolve, 30))
 assert.equal(submitted.kind, 'depositAndList'); assert.equal(submitted.args.id, id); assert.equal(submitted.args.amountWei, ethers.utils.parseEther('0.012').toString()); assert.equal(typeof reviewCallback, 'function')
 const pending = reviewCallback({ action: 'depositAndList', assetId: id, to: deployment.address, valueWei: '0', estimatedGas: '50000', approve: () => { throw Error('must not request wallet') } })
 assert.match(els.marketReview.children[0].textContent, /optional Added protection checkbox/)
 assert.match(els.marketStatus.textContent, /CONTINUE TO WALLET/)
 assert.ok(els.marketReview.children.some(x => x.textContent === 'CONTINUE TO WALLET'))
 els.marketReview.children.find(x => x.textContent === 'CANCEL').onclick()
 await assert.rejects(pending, /Cancelled/)
})
