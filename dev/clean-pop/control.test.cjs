'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const creator = '0x' + '1'.repeat(40), address = '0x' + '2'.repeat(40), hash = '0x' + 'a'.repeat(64)
function setup(overrides = {}) {
 const values = new Map(), root = { localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }, navigator: { locks: { request: async (_, __, fn) => fn({}) } } }
 const module = { exports: {} }, info = { creator, address, runtime: '0x6000' }, calls = []
 vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../assets/js/core/clean-pop-control.js'), 'utf8'), { module, window: root, BigInt, Date, Error, setTimeout, clearTimeout })
 const provider = { request: async q => {
  calls.push(q)
  if (overrides[q.method]) return overrides[q.method](q)
  return { eth_chainId: '0x1', eth_accounts: [creator], eth_getCode: '0x6000', eth_call: '0x' + '0'.repeat(63) + '1', eth_estimateGas: '0x100', eth_gasPrice: '0x10', eth_sendTransaction: hash }[q.method]
 } }
 return { api: module.exports, info, provider, calls, root }
}
test('opening asks for review and sends only the creator setPaused(false) transaction', async () => {
 const x = setup(), row = await x.api.open(x.provider, x.info, async q => assert.equal(q.estimatedGasWei, 4096n))
 const sent = x.calls.find(q => q.method === 'eth_sendTransaction').params[0]
 assert.equal(sent.to, address); assert.equal(sent.from, creator); assert.equal(sent.value, '0x0')
 assert.equal(sent.data, '0x16c38b3c' + '0'.repeat(64)); assert.equal(row.hash, hash)
 await assert.rejects(x.api.open(x.provider, x.info, async () => {}), /transaction saved/)
})
test('two-step preparation is read-only; explicit approval submits the reviewed transaction', async () => {
 const x = setup()
 const plan = await x.api.prepare(x.provider, x.info)
 assert.equal(x.calls.some(q => q.method === 'eth_sendTransaction'), false)
 const before = x.calls.length
 const result = await x.api.submit(x.provider, x.info, plan)
 assert.equal(result.hash, hash)
 assert.deepEqual(x.calls.slice(before).map(q => q.method), ['eth_sendTransaction'])
 const tx = x.calls[before].params[0]
 assert.equal(tx.chainId, '0x1'); assert.equal(tx.value, '0x0'); assert.equal(tx.to, address)
 await assert.rejects(x.api.submit(x.provider, x.info, plan), /saved/)
})
test('expired or altered opening plans never reach the wallet', async () => {
 const x = setup(), plan = await x.api.prepare(x.provider, x.info)
 await assert.rejects(x.api.submit(x.provider, x.info, { ...plan, preparedAt: Date.now() - 61000 }), /expired/)
 await assert.rejects(x.api.submit(x.provider, x.info, { ...plan, tx: { ...plan.tx, to: creator } }), /does not match/)
 assert.equal(x.calls.some(q => q.method === 'eth_sendTransaction'), false)
})
test('wrong creator, wrong chain, wrong runtime and cancelled review never submit', async () => {
 for (const override of [ { eth_accounts: () => ['0x' + '3'.repeat(40)] }, { eth_chainId: () => '0xaa36a7' }, { eth_getCode: () => '0x6001' } ]) {
  const x = setup(override); await assert.rejects(x.api.open(x.provider, x.info, async () => {}))
  assert.equal(x.calls.some(q => q.method === 'eth_sendTransaction'), false)
 }
 const x = setup(); await assert.rejects(x.api.open(x.provider, x.info, async () => { throw Error('cancelled') }), /cancelled/)
 assert.equal(x.calls.some(q => q.method === 'eth_sendTransaction'), false)
})
test('ambiguous wallet failure keeps an intent that blocks retry', async () => {
 const x = setup({ eth_sendTransaction: () => { throw Error('wallet disconnected') } })
 await assert.rejects(x.api.open(x.provider, x.info, async () => {}), /disconnected/)
 assert.equal(x.api.saved().state, 'awaiting-wallet')
 await assert.rejects(x.api.open(x.provider, x.info, async () => {}), /unknown outcome/)
})
test('opening transaction verification checks sender, calldata and current pause state', async () => {
 let checks = 0
 const x = setup({
  eth_call: () => '0x' + '0'.repeat(63) + (++checks > 1 ? '0' : '1'),
  eth_getTransactionByHash: () => ({ from: creator, to: address, value: '0x0', input: '0x16c38b3c' + '0'.repeat(64) }),
  eth_getTransactionReceipt: () => ({ status: '0x1' })
 })
 const result = await x.api.check(x.provider, x.info, hash)
 assert.equal(result.state, 'confirmed'); assert.equal(x.api.saved().hash, hash)
 const wrong = setup({ eth_getTransactionByHash: () => ({ from: creator, to: address, value: '0x0', input: '0x' }) })
 await assert.rejects(wrong.api.check(wrong.provider, wrong.info, hash), /not the creator/)
})
function unsent(x, extra = {}) {
 x.root.localStorage.setItem('trixmoji.clean-pop-v1.open-sale', JSON.stringify({ state: 'awaiting-wallet', contract: address, creator, ...extra }))
}
test('unsent opening recovery archives only the opening intent after creator and nonce checks', async () => {
 const x = setup({ eth_getTransactionCount: () => '0x10' }); unsent(x)
 x.root.localStorage.setItem('trixmoji.clean-pop-v1.deployment', 'keep-deployment')
 const result = await x.api.recoverUnsent(x.provider, x.info, true)
 assert.equal(result.recovered, true); assert.equal(x.api.saved(), null)
 assert.equal(x.root.localStorage.getItem('trixmoji.clean-pop-v1.deployment'), 'keep-deployment')
 assert.equal(x.calls.some(q => q.method === 'eth_sendTransaction'), false)
 const plan = await x.api.prepare(x.provider, x.info)
 assert.equal(plan.tx.to, address)
})
test('recovery refuses known hashes, pending transactions, wrong creators and unchecked confirmation', async () => {
 const known = setup(); unsent(known, { hash })
 await assert.rejects(known.api.recoverUnsent(known.provider, known.info, true), /unsent opening request/)
 const pending = setup({ eth_getTransactionCount: q => q.params[1] === 'pending' ? '0x11' : '0x10' }); unsent(pending)
 await assert.rejects(pending.api.recoverUnsent(pending.provider, pending.info, true), /pending transactions/)
 assert.equal(pending.api.saved().state, 'awaiting-wallet')
 const wrong = setup({ eth_accounts: () => [address] }); unsent(wrong)
 await assert.rejects(wrong.api.recoverUnsent(wrong.provider, wrong.info, true), /creator wallet/)
 const unchecked = setup(); unsent(unchecked)
 await assert.rejects(unchecked.api.recoverUnsent(unchecked.provider, unchecked.info, false), /Confirm/)
})
