'use strict'
const crypto = require('crypto')
const { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-minter.json')
const { validatePayload } = require('../../api/lib/clean-pop-verify')
const { legacyRecord } = require('../../api/lib/clean-pop-delivery-verify')
const { checkRateLimit } = require('../../api/lib/rate-limit')
const legacyContract = '0x64A0CA6fE1f944De3210a64bD1DAb0619725281d'
async function rpc(url, method, params) {
 const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(7000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
 if (!response.ok) throw Error('Ethereum RPC unavailable.')
 const data = await response.json(); if (data.error) throw Error(data.error.message || 'Ethereum RPC error.'); return data.result
}
async function inspect(query, deps = {}) {
 if (!/^\d{1,4}$/.test(String(query.token == null ? '' : query.token))) throw Error('Invalid token number.')
 const tokenNo = Number(query.token), legacyId = String(query.legacy || ''), recipient = String(query.recipient || '')
 legacyRecord(tokenNo, legacyId)
 if (!ethers.utils.isAddress(recipient) || /^0x0{40}$/i.test(recipient) || recipient.toLowerCase() === info.address.toLowerCase()) throw Error('Enter a valid recipient wallet.')
 const get = deps.fetch || fetch, request = deps.rpc || rpc, base = String(process.env.URL || 'https://trixmoji.netlify.app').replace(/\/$/, '')
 const [m, image] = await Promise.all([get(base + '/assets/ethscriptions/clean-pop-v1/manifest.json', { signal: AbortSignal.timeout(15000) }), get(base + '/assets/ethscriptions/clean-pop-v1/' + tokenNo + '.png', { signal: AbortSignal.timeout(15000) })])
 if (!m.ok || !image.ok) throw Error('Approved artwork or manifest unavailable.')
 const manifest = await m.json(), entry = manifest.files[tokenNo]
 if (manifest.root !== info.root || !entry || entry.id !== tokenNo) throw Error('Artwork manifest mismatch.')
 const uri = 'data:image/png;base64,' + Buffer.from(await image.arrayBuffer()).toString('base64')
 validatePayload(uri, entry.proof, tokenNo)
 const sha = crypto.createHash('sha256').update(uri).digest('hex')
 const index = await get('https://api.ethscriptions.com/v2/ethscriptions/exists/0x' + sha, { signal: AbortSignal.timeout(8000) })
 if (!index.ok) throw Error('Ethscriptions uniqueness check unavailable.')
 const indexed = await index.json()
 if (!indexed.result || typeof indexed.result.exists !== 'boolean') throw Error('Ethscriptions uniqueness response invalid.')
 const iface = new ethers.utils.Interface(info.abi), urls = [process.env.ETH_RPC_URL, 'https://ethereum.publicnode.com'].filter(Boolean)
 let lastError
 for (const url of urls) {
  try {
   const call = (to, data) => request(url, 'eth_call', [{ to, data }, 'latest'])
   const [network, code, pausedRaw, mintedRaw, replacedRaw, legacyRaw] = await Promise.all([
    request(url, 'eth_chainId', []), request(url, 'eth_getCode', [info.address, 'latest']),
    call(info.address, iface.encodeFunctionData('paused')), call(info.address, iface.encodeFunctionData('minted', [tokenNo])),
    call(info.address, iface.encodeFunctionData('replaced', [legacyId])), call(legacyContract, iface.encodeFunctionData('minted', [tokenNo]))
   ])
   if (BigInt(network) !== 1n || String(code).toLowerCase() !== info.runtime.toLowerCase()) throw Error('Wrong network or deployed runtime mismatch.')
   const paused = iface.decodeFunctionResult('paused', pausedRaw)[0], minted = iface.decodeFunctionResult('minted', mintedRaw)[0], replaced = iface.decodeFunctionResult('replaced', replacedRaw)[0], legacyMinted = iface.decodeFunctionResult('minted', legacyRaw)[0]
   const tx = { from: info.creator, to: info.address, value: '0x0', data: iface.encodeFunctionData('deliverReplacement', [uri, entry.proof, tokenNo, legacyId, recipient]) }
   let gas = null, gasPrice = null, estimateError = null
   if (!minted && !replaced && legacyMinted && !indexed.result.exists) {
    try { const values = await Promise.all([request(url, 'eth_estimateGas', [tx]), request(url, 'eth_gasPrice', [])]); gas = BigInt(values[0]).toString(); gasPrice = BigInt(values[1]).toString() }
    catch (error) { estimateError = String(error.message || error).slice(0, 300) }
   }
   return { tokenNo, legacyId: legacyId.toLowerCase(), recipient, creator: info.creator, contract: info.address, chainId: 1, paused, minted, replaced, legacyMinted, contentAlreadyInscribed: indexed.result.exists, artworkProofValid: true, contentSha256: sha, estimatedGas: gas, estimatedGasPriceWei: gasPrice, estimateError, readOnly: true, readyToRequestWallet: !!gas && !!gasPrice }
  } catch (error) { lastError = error }
 }
 throw lastError || Error('Ethereum RPC unavailable.')
}
exports.inspect = inspect
exports.handler = async event => {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 const limit = checkRateLimit({ headers: event.headers || {} }, { prefix: 'clean-pop-delivery-preflight', perMinute: 12, perDay: 500 })
 if (!limit.ok) return { statusCode: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) }, body: JSON.stringify({ ok: false, error: 'Please wait before requesting another delivery estimate.' }) }
 try { return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...await inspect(event.queryStringParameters || {}) }) } }
 catch (error) { return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: false, error: String(error.message || error).slice(0, 300) }) } }
}
