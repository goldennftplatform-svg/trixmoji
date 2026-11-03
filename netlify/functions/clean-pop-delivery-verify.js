'use strict'
const chain = require('../../api/lib/ethscriptions-chain')
const { verify } = require('../../api/lib/clean-pop-delivery-verify')
const { checkRateLimit } = require('../../api/lib/rate-limit')
exports.handler = async function (event) {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 const limit = checkRateLimit({ headers: event.headers || {} }, { prefix: 'clean-pop-delivery-verify', perMinute: 30, perDay: 1000 })
 if (!limit.ok) return { statusCode: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) }, body: JSON.stringify({ ok: false, error: 'Please wait before checking the delivery again.' }) }
 const q = event.queryStringParameters || {}
 try {
  if (!/^\d{1,4}$/.test(String(q.token == null ? '' : q.token))) throw Error('Invalid token number.')
  const result = await verify(chain, String(q.hash || ''), Number(q.token), String(q.legacy || ''), String(q.recipient || ''))
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...result }) }
 } catch (error) {
  return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: false, error: String(error.message || error).slice(0, 300) }) }
 }
}
