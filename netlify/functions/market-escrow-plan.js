'use strict'
const { create } = require('../../assets/js/core/escrow-deployment')
const { checkRateLimit } = require('../../api/lib/rate-limit')
const artifact = require('../../assets/data/trixmoji-escrow-artifact.json')
const { ethers } = require('ethers')
const creator = '0x915A3D363D0a4e4470B531f008F5142c540E5417'
const verifier = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4'
const bytecodeHash = '0xc18f4597e4b6f88db18ca526cefda84615bc18159f7b3545bd2029bb9c2aa468'
const allowed = new Set(['eth_chainId', 'eth_getTransactionCount', 'eth_getCode', 'eth_estimateGas', 'eth_gasPrice', 'eth_getBalance'])
async function callRpc(method, params) {
 let last
 for (const url of [process.env.ETH_RPC_URL, 'https://ethereum.publicnode.com'].filter(Boolean)) {
  try {
   const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(7000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
   if (!response.ok) throw Error('Ethereum RPC unavailable.')
   const data = await response.json(); if (data.error) throw Error(data.error.message || 'Ethereum RPC error.')
   return data.result
  } catch (error) { last = error }
 }
 throw last || Error('Ethereum RPC unavailable.')
}
async function inspect(request = callRpc, deployer = creator) {
 if (![creator.toLowerCase(), verifier.toLowerCase()].includes(String(deployer).toLowerCase())) throw Error('Invalid deploying wallet.')
 if (artifact.version !== 'trixmoji-escrow-v1' || artifact.chainId !== 1 || artifact.creator !== creator || artifact.verifier !== verifier || artifact.bytecodeHash !== bytecodeHash || ethers.utils.keccak256(artifact.bytecode) !== bytecodeHash) throw Error('Escrow artifact does not match the reviewed build.')
 const provider = { request: q => q.method === 'eth_accounts' ? Promise.resolve([deployer]) : allowed.has(q.method) ? request(q.method, q.params || []) : Promise.reject(Error('Read-only operation.')) }
 const client = create({ provider, artifact, creator, verifier, deployer, chainId: 1, expectedBytecodeHash: bytecodeHash,
  storage: { getItem: () => null }, locks: { request: () => { throw Error('Read-only operation.') } } })
 const plan = await client.plan()
 return { creator, verifier, deployer, chainId: 1, bytecodeHash, initcodeHash: plan.initcodeHash, predictedAddress: plan.predictedAddress,
  startingNonce: plan.startingNonce, estimatedGas: plan.estimatedGas, estimatedGasPriceWei: plan.estimatedGasPriceWei,
  estimatedGasCostWei: plan.estimatedGasCostWei, balanceWei: plan.balanceWei, readOnly: true, transactionSubmitted: false }
}
exports.inspect = inspect
exports.handler = async event => {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 const limit = checkRateLimit({ headers: event.headers || {} }, { prefix: 'market-escrow-plan', perMinute: 10, perDay: 250 })
 if (!limit.ok) return { statusCode: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) }, body: JSON.stringify({ ok: false, error: 'Please wait before requesting another estimate.' }) }
 try { return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...await inspect(callRpc, event.queryStringParameters && event.queryStringParameters.deployer || creator) }) } }
 catch (error) {
  const message = String(error && error.message || '')
   const safe = /^(Wallet is on the wrong network|Connect the configured deploying wallet|The deploying wallet has a pending transaction|The predicted contract address already contains code|The deploying wallet balance is below|Deployment gas estimate is unavailable|Escrow artifact does not match|Escrow constructor ABI does not match)/.test(message)
  return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: false, error: safe ? message : 'Escrow preflight unavailable. No deployment transaction was sent.' }) }
 }
}
