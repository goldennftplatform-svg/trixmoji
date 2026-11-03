'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const handler = require('../../api/trixmoji-market')
async function request(method = 'GET', body) {
 let status, json
 await handler({ method, body, headers: {} }, { status(code) { status = code; return this }, json(value) { json = value } })
 return { status, json }
}
test('forked marketplace service stays closed when deployment is not explicitly configured', async () => {
 const old = process.env.TRIXMOJI_MARKET_ENABLED
 try { delete process.env.TRIXMOJI_MARKET_ENABLED; const result = await request(); assert.equal(result.status, 503); assert.match(result.json.error, /not configured/) }
 finally { if (old === undefined) delete process.env.TRIXMOJI_MARKET_ENABLED; else process.env.TRIXMOJI_MARKET_ENABLED = old }
})
test('invalid verifier configuration fails without returning secret values', async () => {
  const names = ['TRIXMOJI_MARKET_ENABLED', 'TRIXMOJI_MARKET_LIVE', 'TRIXMOJI_MARKET_VERIFIER_KEY', 'ETH_RPC_URL', 'TRIXMOJI_ESCROW_ADDRESS', 'TRIXMOJI_ESCROW_RUNTIME_HASH', 'TRIXMOJI_ESCROW_START_BLOCK']
 const old = Object.fromEntries(names.map(name => [name, process.env[name]]))
 try {
   process.env.TRIXMOJI_MARKET_ENABLED = 'true'; process.env.TRIXMOJI_MARKET_LIVE = 'true'; process.env.TRIXMOJI_MARKET_VERIFIER_KEY = 'not-a-real-secret'; process.env.ETH_RPC_URL = 'https://example.invalid/private-token'
  process.env.TRIXMOJI_ESCROW_ADDRESS = '0x' + '1'.repeat(40); process.env.TRIXMOJI_ESCROW_RUNTIME_HASH = '0x' + '2'.repeat(64); process.env.TRIXMOJI_ESCROW_START_BLOCK = '1'
   const result = await request('POST', { action: 'authorize' }); assert.equal(result.status, 503); assert.doesNotMatch(JSON.stringify(result.json), /not-a-real-secret|private-token/)
 } finally { names.forEach(name => { if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name] }) }
})
