'use strict'

const { AsyncLocalStorage } = require('async_hooks')
const connection = new AsyncLocalStorage()

function decode(value) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value) return {}
  try { return JSON.parse(value.charAt(0) === '{' ? value : Buffer.from(value, 'base64').toString('utf8')) } catch (_) { return {} }
}

function connect(event) {
  const blobs = require('@netlify/blobs')
  const runtime = decode(process.env.NETLIFY_BLOBS_CONTEXT)
  const incoming = decode(event && event.blobs)
  const headers = Object.fromEntries(Object.entries(event && event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]))
  // Preserve the modern runtime's uncached endpoint when the legacy event has
  // only a cached edge URL. Do not overwrite a complete runtime with that event.
  const context = {
    apiURL: runtime.apiURL || incoming.apiURL || incoming.api_url || 'https://api.netlify.com',
    siteID: headers['x-nf-site-id'] || incoming.siteID || runtime.siteID,
    deployID: headers['x-nf-deploy-id'] || incoming.deployID || runtime.deployID,
    token: incoming.token || runtime.token
  }
  const uncached = runtime.uncachedEdgeURL || incoming.uncachedEdgeURL || incoming.uncached_edge_url
  if (uncached) {
    context.uncachedEdgeURL = uncached
    context.edgeURL = runtime.edgeURL || incoming.edgeURL || incoming.url
  }
  // Without an uncached edge, the SDK uses its direct API path. Never downgrade
  // order reads to eventual consistency just to suppress a consistency error.
  if (!context.siteID || !context.token) {
    const error = new Error('Netlify Blobs runtime credentials are missing')
    error.name = 'MissingBlobsEnvironmentError'
    throw error
  }
  blobs.setEnvironmentContext(context)
  return context
}

function withConnection(context, run) { return connection.run(context, run) }
function storeOptions() {
  const context = connection.getStore()
  return context ? { ...context } : {}
}

module.exports = { connect, withConnection, storeOptions }
