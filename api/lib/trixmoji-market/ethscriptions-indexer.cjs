'use strict'

// Fixed at server startup. Callers can request only the status or one ID; a
// browser cannot supply an arbitrary upstream URL to this client.
function createEthscriptionsIndexer(options = {}) {
 const base = new URL(options.baseUrl || 'https://api.ethscriptions.com/v2/')
 if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Indexer URL must be an HTTPS base URL without credentials or query parameters.')
 const fetcher = options.fetch || globalThis.fetch, timeoutMs = options.timeoutMs || 8000
 if (typeof fetcher !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw Error('Invalid indexer client configuration.')
 return async function indexer(endpoint) {
  if (endpoint !== '/status' && !/^\/ethscriptions\/0x[a-f0-9]{64}$/i.test(String(endpoint))) throw Error('Unsupported indexer endpoint.')
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
   const url = new URL(endpoint.slice(1), base.href.endsWith('/') ? base : new URL(base.href + '/'))
   const response = await fetcher(url.toString(), { signal: controller.signal, headers: { Accept: 'application/json' } })
   if (!response.ok) throw Error('Ethscriptions indexer unavailable.')
   const body = await response.json(), result = endpoint === '/status' ? body : body && body.result
   if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('Ethscriptions indexer returned an invalid response.')
   if (endpoint === '/status' && !Number.isSafeInteger(Number(result.last_imported_block))) throw Error('Ethscriptions indexer height is unavailable.')
   if (endpoint !== '/status' && String(result.transaction_hash || '').toLowerCase() !== endpoint.slice('/ethscriptions/'.length).toLowerCase()) throw Error('Ethscriptions indexer returned a different asset.')
   return result
  } finally { clearTimeout(timer) }
 }
}
module.exports = { createEthscriptionsIndexer }
