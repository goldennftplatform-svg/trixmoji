'use strict'
// Read-only V2 mint verification. Does not issue transactions.
const chain = require('../../api/lib/ethscriptions-chain')
const { verify } = require('../../api/lib/clean-pop-webp-v2-verify.cjs')
const { checkRateLimit } = require('../../api/lib/rate-limit')
async function inspect(query, source = chain) {
 const token = String(query.token == null ? '' : query.token), hash = String(query.hash || ''), buyer = String(query.buyer || '')
 if (!/^\d{1,4}$/.test(token) || Number(token) >= 10000 || !source.isHash(hash) || !source.isAddr(buyer)) throw Error('Invalid WebP mint verification request.')
 return verify(source, hash, buyer, Number(token))
}
exports.inspect = inspect
exports.handler = async event => {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 const limit = checkRateLimit({ headers: event.headers || {} }, { prefix: 'clean-pop-webp-v2-verify', perMinute: 15, perDay: 500 })
 if (!limit.ok) return { statusCode: 429, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Please wait before retrying.' }) }
 try { return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...await inspect(event.queryStringParameters || {}) }) } }
 catch (error) {
  const message = String(error.message || error)
  const safe = /^(Invalid WebP|Transaction does not match this WebP|Transaction is not a supported WebP|Transaction is not a WebP mint|WebP creation event|WebP artwork proof|Minted WebP number|That transaction is not confirmed|Ethscriptions indexing is pending|The indexed Ethscription does not match)/.test(message)
  return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: false, error: safe ? message : 'WebP mint verification is unavailable. Check the saved transaction before retrying.' }) }
 }
}
