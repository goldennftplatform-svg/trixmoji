'use strict'
const crypto = require('crypto')
const { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-minter.json')
const { validatePayload } = require('../../api/lib/clean-pop-verify')
const sources = () => [process.env.ETH_RPC_URL, 'https://ethereum.publicnode.com'].filter(Boolean)
async function rpc(url, method, params) {
 const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(7000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
 if (!response.ok) throw Error('Ethereum RPC unavailable')
 const data = await response.json(); if (data.error) throw Error(data.error.message || 'RPC error'); return data.result
}
async function inspect(query, deps = {}) {
 const tokenNo = Number(query.token), buyer = String(query.buyer || '')
 if (!/^\d{1,4}$/.test(String(query.token == null ? '' : query.token)) || !Number.isInteger(tokenNo) || tokenNo < 0 || tokenNo >= 10000 || !ethers.utils.isAddress(buyer) || /^0x0{40}$/i.test(buyer)) throw Error('Specify a token number 0–9999 and an Ethereum buyer address.')
 const get = deps.fetch || fetch, request = deps.rpc || rpc
 const base = String(process.env.URL || 'https://trixmoji.netlify.app').replace(/\/$/, '')
 const [manifestResponse, imageResponse] = await Promise.all([get(base + '/assets/ethscriptions/clean-pop-v1/manifest.json', { signal: AbortSignal.timeout(15000) }), get(base + '/assets/ethscriptions/clean-pop-v1/' + tokenNo + '.png', { signal: AbortSignal.timeout(15000) })])
 if (!manifestResponse.ok || !imageResponse.ok) throw Error('Artwork or manifest unavailable.')
 const manifest = await manifestResponse.json(), entry = manifest.files[tokenNo]
 if (manifest.root !== info.root || !entry || entry.id !== tokenNo) throw Error('Artwork manifest mismatch.')
 const uri = 'data:image/png;base64,' + Buffer.from(await imageResponse.arrayBuffer()).toString('base64')
 validatePayload(uri, entry.proof, tokenNo)
 const contentSha = crypto.createHash('sha256').update(uri).digest('hex')
 const indexResponse = await get('https://api.ethscriptions.com/v2/ethscriptions/exists/0x' + contentSha, { signal: AbortSignal.timeout(8000) })
 if (!indexResponse.ok) throw Error('Ethscriptions uniqueness check unavailable.')
 const index = await indexResponse.json()
 if (!index.result || typeof index.result.exists !== 'boolean') throw Error('Ethscriptions uniqueness response invalid.')
 const iface = new ethers.utils.Interface(info.abi)
 let lastError
 for (const url of sources()) {
  try {
   const call = (to, data) => request(url, 'eth_call', [{ to, data }, 'latest'])
   const [network, code, pausedRaw, mintedRaw, legacyRaw, countRaw] = await Promise.all([
    request(url, 'eth_chainId', []), request(url, 'eth_getCode', [info.address, 'latest']),
    call(info.address, iface.encodeFunctionData('paused')), call(info.address, iface.encodeFunctionData('minted', [tokenNo])),
    call('0x64A0CA6fE1f944De3210a64bD1DAb0619725281d', iface.encodeFunctionData('minted', [tokenNo])),
    call(info.address, iface.encodeFunctionData('mintedBy', [buyer]))
   ])
   if (BigInt(network) !== 1n || String(code).toLowerCase() !== info.runtime.toLowerCase()) throw Error('Wrong network or deployed runtime mismatch.')
   const paused = iface.decodeFunctionResult('paused', pausedRaw)[0], minted = iface.decodeFunctionResult('minted', mintedRaw)[0], reserved = iface.decodeFunctionResult('minted', legacyRaw)[0], count = iface.decodeFunctionResult('mintedBy', countRaw)[0].toNumber()
   const tx = { from: buyer, to: info.address, value: '0x' + BigInt(info.priceWei).toString(16), data: iface.encodeFunctionData('mint', [uri, entry.proof, tokenNo]) }
   let gas = null, gasPrice = null, estimateError = null
   if (!paused && !minted && !reserved && count < 20 && !index.result.exists) {
    try {
     const values = await Promise.all([request(url, 'eth_estimateGas', [tx]), request(url, 'eth_gasPrice', [])])
     gas = BigInt(values[0]).toString(); gasPrice = BigInt(values[1]).toString()
    } catch (error) { estimateError = String(error.message || error).slice(0, 400) }
   }
   return { tokenNo, buyer, contract: info.address, chainId: 1, paused, minted, reserved, walletMintCount: count, contentAlreadyInscribed: index.result.exists, artworkProofValid: true, contentSha256: contentSha, estimatedGas: gas, estimatedGasPriceWei: gasPrice, estimateError, readOnly: true, readyToRequestWallet: !!gas && !!gasPrice }
  } catch (error) { lastError = error }
 }
 throw lastError || Error('Ethereum RPC unavailable.')
}
exports.inspect = inspect
exports.handler = async event => {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 try { return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...await inspect(event.queryStringParameters || {}) }) } }
 catch (error) { return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: false, error: String(error.message || error).slice(0, 400) }) } }
}
