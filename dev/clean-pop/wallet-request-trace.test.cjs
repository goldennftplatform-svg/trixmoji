'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const { create } = require('../../assets/js/core/wallet-request-trace')
test('trace forwards requests immediately and omits request and response payloads', async () => {
 let invoked = false
 const trace = create({ request(q) { invoked = true; assert.equal(q.params[0], 'secret-request'); return 'secret-response' } })
 const result = trace.provider.request({ method: 'eth_sendTransaction', params: ['secret-request'] })
 assert.equal(invoked, true); assert.equal(await result, 'secret-response')
 assert.equal(trace.snapshot()[0].state, 'answered'); assert.doesNotMatch(JSON.stringify(trace.snapshot()), /secret/)
})
test('trace reports unresolved requests without timing out or enabling duplicates', async () => {
 let finish
 const trace = create({ request: () => new Promise(resolve => { finish = resolve }) }, null, { waitMs: 1 })
 const result = trace.provider.request({ method: 'eth_sendTransaction' })
 await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(trace.snapshot()[0].state, 'waiting-for-wallet')
 finish('hash'); assert.equal(await result, 'hash'); assert.equal(trace.snapshot()[0].state, 'answered')
})
test('synchronous and asynchronous wallet rejections retain codes without arbitrary error data', async () => {
 for (const request of [() => { throw Object.assign(Error('private detail'), { code: -32002 }) }, () => Promise.reject(Object.assign(Error('private detail'), { code: 4001 }))]) {
  const trace = create({ request }); await assert.rejects(trace.provider.request({ method: 'eth_sendTransaction' }))
  assert.equal(trace.snapshot()[0].state, 'rejected'); assert.ok(trace.snapshot()[0].code); assert.doesNotMatch(JSON.stringify(trace.snapshot()), /private detail/)
 }
})
