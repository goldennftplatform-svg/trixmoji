'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path')
function setup() {
 const values = new Map(), root = { localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) }, navigator: { locks: { request: async (_, __, fn) => fn({}) } } }
 const module = { exports: {} }
 vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../assets/js/core/clean-pop-checkout.js'), 'utf8'), { module, window: root, BigInt, Date, Error, setTimeout, clearTimeout })
 let sent = 0
 const provider = { request: async ({ method }) => { if (method === 'eth_estimateGas') return '0x100'; if (method === 'eth_gasPrice') return '0x10'; if (method === 'eth_sendTransaction') { sent++; return '0x' + 'a'.repeat(64) } } }
 const options = { provider, from: '0x1111111111111111111111111111111111111111', tokenNo: 3, tx: { to: '0x2222222222222222222222222222222222222222', value: '0x1' }, preflight: async () => {}, review: async quote => quote.approve() }
 return { api: module.exports, options, root, sent: () => sent }
}
test('persists a submitted hash and blocks a duplicate while pending', async () => {
 const x = setup(), row = await x.api.send(x.options)
 assert.equal(row.state, 'submitted'); assert.equal(x.api.records()[0].hash, row.hash)
 await assert.rejects(x.api.send(x.options), /previous Clean Pop mint/); assert.equal(x.sent(), 1)
 await assert.rejects(x.api.reconcile(row, async () => ({ complete: false })), /pending/)
 await x.api.reconcile(row, async () => ({ complete: true })); assert.equal(x.api.records()[0].state, 'complete')
})
test('WebP checkout keeps its saved requests separate from V1', async () => {
 const x = setup(), webp = x.api.createWebpV2()
 await webp.send(x.options)
 assert.equal(webp.records().length, 1); assert.equal(x.api.records().length, 0)
 await x.api.send({ ...x.options, tokenNo: 4 })
 assert.equal(webp.records()[0].tokenNo, 3); assert.equal(x.api.records()[0].tokenNo, 4)
})
test('preflight failure never submits', async () => {
 const x = setup(); x.options.preflight = async () => { throw Error('paused') }
 await assert.rejects(x.api.send(x.options), /paused/); assert.equal(x.sent(), 0)
})
test('storage failure and review cancellation never submit', async () => {
 const x = setup(); x.root.localStorage.setItem = () => { throw Error('storage full') }
 await assert.rejects(x.api.send(x.options), /storage full/); assert.equal(x.sent(), 0)
 const y = setup(); y.options.review = async () => { throw Error('cancelled') }
 await assert.rejects(y.api.send(y.options), /cancelled/); assert.equal(y.sent(), 0)
})
test('two selected pieces submit sequentially only after indexer confirmation', async () => {
 const x = setup(), first = await x.api.send(x.options)
 await assert.rejects(x.api.send({ ...x.options, tokenNo: 4 }), /previous Clean Pop mint/)
 await x.api.reconcile(first, async () => ({ complete: true }))
 const second = await x.api.send({ ...x.options, tokenNo: 4 })
 assert.equal(second.state, 'submitted'); assert.equal(x.sent(), 2)
})
test('account switch does not overwrite an unresolved transaction', async () => {
 const x = setup(); await x.api.send(x.options)
 await assert.rejects(x.api.send({ ...x.options, from: '0x3333333333333333333333333333333333333333' }), /previous Clean Pop mint/)
 assert.equal(x.sent(), 1); assert.equal(x.api.records()[0].buyer, x.options.from)
})
test('ambiguous wallet failure blocks a second submission', async () => {
 const x = setup(), request = x.options.provider.request
 x.options.provider.request = q => q.method === 'eth_sendTransaction' ? Promise.reject(Error('wallet disconnected')) : request(q)
 await assert.rejects(x.api.send(x.options), /wallet disconnected/)
 assert.equal(x.api.records()[0].state, 'awaiting-wallet')
 await assert.rejects(x.api.send(x.options), /previous Clean Pop mint/)
})
test('wallet transaction request occurs synchronously inside explicit approval callback', async () => {
 const x = setup(), request = x.options.provider.request
 let insideClick = false
 x.options.provider.request = q => {
  if (q.method === 'eth_sendTransaction') { assert.equal(insideClick, true); assert.equal(q.params[0].chainId, '0x1') }
  return request(q)
 }
 x.options.review = quote => { insideClick = true; const pending = quote.approve(); insideClick = false; return pending }
 await x.api.send(x.options)
 assert.equal(x.sent(), 1)
})
test('account or network change while review is open blocks wallet request', async () => {
 const x = setup(), listeners = {}
 x.options.provider.on = (event, handler) => { listeners[event] = handler }
 x.options.provider.removeListener = event => { delete listeners[event] }
 x.options.review = quote => { listeners.accountsChanged(); return quote.approve() }
 await assert.rejects(x.api.send(x.options), /Wallet, network, or quote changed/)
 assert.equal(x.sent(), 0)
})
test('stalled wallet gas estimate uses a read-only fallback before explicit approval', async () => {
 const x = setup(), original = x.options.provider.request
 x.options.provider.request = q => q.method === 'eth_estimateGas' ? new Promise(() => {}) : original(q)
 x.options.rpcTimeoutMs = 2
 x.options.gasFallback = async () => ({ gas: '3000000', gasPrice: '100' })
 const row = await x.api.send(x.options)
 assert.equal(row.state, 'submitted'); assert.equal(x.sent(), 1)
})
test('a rejected gas estimate does not fall back or send', async () => {
 const x = setup(), original = x.options.provider.request
 let fallback = false
 x.options.provider.request = q => q.method === 'eth_estimateGas' ? Promise.reject(Error('execution reverted')) : original(q)
 x.options.gasFallback = async () => { fallback = true; return { gas: '1', gasPrice: '1' } }
 await assert.rejects(x.api.send(x.options), /execution reverted/)
 assert.equal(fallback, false); assert.equal(x.sent(), 0)
})
test('server-first estimate does not wait for the wallet gas estimator', async () => {
 const x = setup(), original = x.options.provider.request
 x.options.provider.request = q => q.method === 'eth_estimateGas' || q.method === 'eth_gasPrice' ? new Promise(() => {}) : original(q)
 x.options.preferServerGas = true
 x.options.gasFallback = async () => ({ gas: '5301966', gasPrice: '300000000' })
 const result = await x.api.send(x.options)
 assert.equal(result.state, 'submitted'); assert.equal(x.sent(), 1)
})
test('insufficient-funds preflight opens wallet without inventing a gas estimate', async () => {
 const x = setup(), original = x.options.provider.request
 x.options.preferServerGas = true; x.options.gasFallback = async () => ({ insufficientFunds: true, gas: null, gasPrice: null })
 x.options.provider.request = q => { if (q.method === 'eth_sendTransaction') assert.equal('gas' in q.params[0], false); return original(q) }
 x.options.review = async quote => { assert.equal(quote.gas, null); assert.equal(quote.insufficientFunds, true); return quote.approve() }
 await x.api.send(x.options); assert.equal(x.sent(), 1)
})
function recoverFixture(overrides = {}) {
 const x = setup(), buyer = x.options.from, address = x.options.tx.to
 const row = { id: '2', tokenNo: 2, buyer, contract: address, state: 'awaiting-wallet', hash: '' }
 x.root.localStorage.setItem('trixmoji.clean-pop.checkout.v1', JSON.stringify([{ id: '1', tokenNo: 1, state: 'complete', hash: '0x' + 'f'.repeat(64) }, row]))
 const original = x.options.provider.request
 x.options.provider.request = async q => {
  if (overrides[q.method]) return overrides[q.method](q)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [buyer]
  if (q.method === 'eth_getCode') return '0x6000'
  if (q.method === 'eth_call') return '0x' + '0'.repeat(64)
  if (q.method === 'eth_getTransactionCount') return '0x12'
  return original(q)
 }
 return { ...x, recovery: { provider: x.options.provider, from: buyer, info: { address, runtime: '0x6000' }, tokenNo: 2, confirmed: true } }
}
test('no-hash mint recovery clears only the verified unsent intent and preserves completed records', async () => {
 const x = recoverFixture(), result = await x.api.recoverUnsent(x.recovery)
 assert.equal(result.recovered, true); assert.equal(result.tokenNo, 2)
 assert.equal(x.api.records().length, 1); assert.equal(x.api.records()[0].state, 'complete')
 assert.equal(x.sent(), 0)
})
test('no-hash mint recovery refuses pending transactions, minted tokens, wrong wallets, and missing confirmation', async () => {
 for (const [overrides, expected] of [
  [{ eth_getTransactionCount: q => q.params[1] === 'pending' ? '0x13' : '0x12' }, /pending transaction/],
  [{ eth_call: () => '0x' + '0'.repeat(63) + '1' }, /already minted/],
  [{ eth_accounts: () => ['0x3333333333333333333333333333333333333333'] }, /original minting wallet/],
  [{ eth_chainId: () => '0xaa36a7' }, /mainnet/],
  [{ eth_getCode: () => '0x6001' }, /contract code/]
 ]) {
  const x = recoverFixture(overrides)
  await assert.rejects(x.api.recoverUnsent(x.recovery), expected)
  assert.equal(x.api.records().length, 2); assert.equal(x.sent(), 0)
 }
 const x = recoverFixture()
 await assert.rejects(x.api.recoverUnsent({ ...x.recovery, confirmed: false }), /Confirm/)
})
test('recovery cannot clear a saved transaction hash', async () => {
 const x = recoverFixture(), rows = x.api.records()
 rows[1].hash = '0x' + 'a'.repeat(64)
 x.root.localStorage.setItem('trixmoji.clean-pop.checkout.v1', JSON.stringify(rows))
 await assert.rejects(x.api.recoverUnsent(x.recovery), /no-hash mint request/)
})
test('recovery cannot clear a request while the wallet promise is still active', async () => {
 const x = setup(), original = x.options.provider.request
 let resolveWallet
 x.options.provider.request = q => q.method === 'eth_sendTransaction' ? new Promise(resolve => { resolveWallet = resolve }) : original(q)
 const sending = x.api.send(x.options)
 await new Promise(resolve => setImmediate(resolve))
 await assert.rejects(x.api.recoverUnsent({ provider: x.options.provider, from: x.options.from, info: { address: x.options.tx.to, runtime: '0x6000' }, tokenNo: 3, confirmed: true }), /still running/)
 resolveWallet('0x' + 'b'.repeat(64))
 assert.equal((await sending).state, 'submitted')
})
