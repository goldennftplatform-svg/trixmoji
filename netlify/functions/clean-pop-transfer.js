'use strict'
const chain = require('../../api/lib/ethscriptions-chain')
const transfer = require('../../api/lib/clean-pop-transfer')
const { checkRateLimit } = require('../../api/lib/rate-limit')
async function rpc(method, params) {
 let last
 for (const url of [process.env.ETH_RPC_URL, 'https://ethereum.publicnode.com'].filter(Boolean)) {
  try {
   const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(7000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
   if (!response.ok) throw Error('Ethereum RPC unavailable.')
   const data = await response.json(); if (data.error) throw Error(data.error.message || 'Ethereum RPC error.'); return data.result
  } catch (error) { last = error }
 }
 throw last || Error('Ethereum RPC unavailable.')
}
exports.handler = async function (event) {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 const limit = checkRateLimit({ headers: event.headers || {} }, { prefix: 'clean-pop-transfer', perMinute: 30, perDay: 1000 })
 if (!limit.ok) return { statusCode: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) }, body: JSON.stringify({ ok: false, error: 'Please wait before checking again.' }) }
 const q = event.queryStringParameters || {}
 try {
  let result
  if (q.action === 'ownership') result = await transfer.ownership(chain, String(q.id || ''), String(q.wallet || ''))
  else if (q.action === 'plan') result = await transfer.plan(chain, rpc, String(q.id || ''), String(q.from || ''), String(q.to || ''))
  else if (q.action === 'verify') result = await transfer.verify(chain, String(q.id || ''), String(q.hash || ''), String(q.from || ''), String(q.to || ''))
  else throw Error('Unknown read-only transfer check.')
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...result }) }
 } catch (error) {
  const message = String(error && error.message || '')
  const safe = /^(Enter a valid|This is not a verified|The Ethscriptions indexer|Ethereum mainnet RPC required|Transfer gas estimate unavailable|Invalid transfer verification request|Transaction does not match|That transaction is not confirmed|That transaction is not on Ethereum|Ethscriptions indexing is pending|Unknown read-only transfer check)/.test(message)
  return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: false, error: safe ? message : 'Transfer check unavailable. Keep any transaction hash and do not resend until its status is known.' }) }
 }
}
