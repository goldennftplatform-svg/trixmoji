'use strict'
const { ethers } = require('ethers')
const { checkRateLimit } = require('../../api/lib/rate-limit')
const { createEthscriptionsIndexer } = require('../../api/lib/trixmoji-market/ethscriptions-indexer.cjs')
const { createCleanPopRegistry } = require('../../api/lib/trixmoji-market/clean-pop-registry.cjs')
const { walletInventory } = require('../../api/lib/trixmoji-market/wallet-inventory.cjs')
const { createHistoryReader } = require('../../api/lib/trixmoji-market/history-reader.cjs')
const minter = require('../../assets/data/clean-pop-webp-v2-candidate.json')

exports.handler = async event => {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 const limit = checkRateLimit({ headers: event.headers || {} }, { prefix: 'market-wallet-inventory-webp-v2', perMinute: 15, perDay: 500 })
 if (!limit.ok) return { statusCode: 429, body: JSON.stringify({ ok: false, error: 'Please wait before refreshing.' }) }
 const query = event.queryStringParameters || {}, wallet = query.wallet, pageKey = query.pageKey
 if (!ethers.utils.isAddress(wallet || '') || (pageKey && !/^0x[a-f0-9]{64}$/i.test(pageKey))) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid wallet or page key.' }) }
 try {
  const provider = new ethers.providers.JsonRpcProvider({ url: process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com', timeout: 10000 }, 1)
  const [network, code] = await Promise.all([provider.getNetwork(), provider.getCode(minter.address)])
  if (network.chainId !== 1 || !code || code === '0x' || ethers.utils.keccak256(code).toLowerCase() !== minter.runtimeHash.toLowerCase()) throw Error('WebP minter is not deployed with the reviewed runtime.')
  const indexer = createEthscriptionsIndexer()
  const fallback = new ethers.providers.JsonRpcProvider({ url: 'https://eth.drpc.org', timeout: 10000 }, 1)
  const historyProvider = createHistoryReader(provider, fallback, 1)
  const registry = createCleanPopRegistry({ provider, historyProvider, indexer, minter: minter.address, abi: minter.abi, root: minter.root, mintPriceWei: minter.priceWei, mimeType: 'image/webp', allowWrappedMints: true })
  const fetchPage = async ({ wallet: address, minter: creator, pageKey: cursor }) => {
   const url = new URL('https://api.ethscriptions.com/v2/ethscriptions')
   url.searchParams.set('current_owner', address); url.searchParams.set('creator', creator); url.searchParams.set('per_page', '20')
   if (cursor) url.searchParams.set('page_key', cursor)
   const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } })
   if (!response.ok) throw Error('Indexer unavailable.')
   return response.json()
  }
  const result = await walletInventory({ wallet, minter: minter.address, registry, fetchPage, pageKey })
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, ...result }) }
 } catch (_) { return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: false, error: 'WebP wallet inventory is unavailable or its minter is not deployed.' }) } }
}
