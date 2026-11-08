'use strict'

// Fixed at server startup. Callers can request only the status or one ID; a
// browser cannot supply an arbitrary upstream URL to this client.
function createEthscriptionsIndexer(options = {}) {
 const base = new URL(options.baseUrl || 'https://api.ethscriptions.com/v2/')
 if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Indexer URL must be an HTTPS base URL without credentials or query parameters.')
 const fetcher = options.fetch || globalThis.fetch, timeoutMs = options.timeoutMs || 8000
 if (typeof fetcher !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw Error('Invalid indexer client configuration.')
 async function indexer(endpoint) {
  if (endpoint !== '/status' && !/^\/ethscriptions\/0x[a-f0-9]{64}$/i.test(String(endpoint))) throw Error('Unsupported indexer endpoint.')
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
   const url = new URL(endpoint.slice(1), base.href.endsWith('/') ? base : new URL(base.href + '/'))
   const response = await fetcher(url.toString(), { signal: controller.signal, headers: { Accept: 'application/json' } })
   // A potential escrow deposit can name an ID that does not exist. It must
   // not break discovery for unrelated valid listings; outages still fail shut.
   if (endpoint !== '/status' && response.status === 404) return null
   if (!response.ok) throw Error('Ethscriptions indexer unavailable.')
   const body = await response.json(), result = endpoint === '/status' ? body : body && body.result
   if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('Ethscriptions indexer returned an invalid response.')
   if (endpoint === '/status' && !Number.isSafeInteger(Number(result.last_imported_block))) throw Error('Ethscriptions indexer height is unavailable.')
   if (endpoint !== '/status' && String(result.transaction_hash || '').toLowerCase() !== endpoint.slice('/ethscriptions/'.length).toLowerCase()) throw Error('Ethscriptions indexer returned a different asset.')
   return result
  } finally { clearTimeout(timer) }
 }
 // Fixed-parameter custody discovery; results are hints and must still pass
 // the registry, on-chain deposit, receipt and indexed-custody checks.
 indexer.listOwned = async function ({ owner, creator, pageKey }) {
  if (!/^0x[a-f0-9]{40}$/i.test(String(owner || '')) || !/^0x[a-f0-9]{40}$/i.test(String(creator || '')) || (pageKey && !/^0x[a-f0-9]{64}$/i.test(String(pageKey)))) throw Error('Invalid escrow discovery query.')
  const url = new URL('ethscriptions', base.href.endsWith('/') ? base : new URL(base.href + '/'))
  url.searchParams.set('current_owner', owner); url.searchParams.set('creator', creator); url.searchParams.set('transaction_hash_only', '1')
  if (pageKey) url.searchParams.set('page_key', pageKey)
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
   const response = await fetcher(url.toString(), { signal: controller.signal, headers: { Accept: 'application/json' } })
   if (!response.ok) throw Error('Ethscriptions custody discovery unavailable.')
   const body = await response.json()
   if (!body || !Array.isArray(body.result) || body.result.length > 1000 || !body.pagination || typeof body.pagination.has_more !== 'boolean') throw Error('Invalid Ethscriptions custody discovery response.')
   const ids = body.result.map(row => row && row.transaction_hash)
   if (ids.some(id => !/^0x[a-f0-9]{64}$/i.test(String(id || '')))) throw Error('Invalid Ethscriptions custody discovery item.')
   const next = body.pagination.has_more ? body.pagination.page_key : null
   if (body.pagination.has_more && !/^0x[a-f0-9]{64}$/i.test(String(next || ''))) throw Error('Invalid Ethscriptions custody discovery cursor.')
   return { ids, nextPageKey: next }
  } finally { clearTimeout(timer) }
 }
 return indexer
}
module.exports = { createEthscriptionsIndexer }
