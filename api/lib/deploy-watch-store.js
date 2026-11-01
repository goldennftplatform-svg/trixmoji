'use strict'

const BLOB_STORE = 'deploy-watch'
const BLOB_KEY = 'sites'
const MAX_DEPLOYS = 40

function connectNetlifyBlobs(event) {
  if (!event) return false
  try {
    const { connectLambda, setEnvironmentContext } = require('@netlify/blobs')
    if (event.blobs && typeof connectLambda === 'function') {
      connectLambda(event)
      return true
    }
    if (process.env.NETLIFY_BLOBS_CONTEXT && typeof setEnvironmentContext === 'function') {
      try {
        var ctx = process.env.NETLIFY_BLOBS_CONTEXT
        if (typeof ctx === 'string' && ctx.charAt(0) === '{') {
          setEnvironmentContext(JSON.parse(ctx))
          return true
        }
      } catch (e2) {}
    }
  } catch (e) {}
  return false
}

async function getBlobStore() {
  try {
    const { getStore } = require('@netlify/blobs')
    if (typeof getStore !== 'function') return null
    try {
      return getStore({ name: BLOB_STORE, consistency: 'eventual' })
    } catch (e1) {
      try {
        return getStore(BLOB_STORE)
      } catch (e2) {
        return null
      }
    }
  } catch (e) {
    return null
  }
}

let memory = { sites: {} }

async function loadState() {
  const store = await getBlobStore()
  if (!store) return { sites: memory.sites || {} }
  try {
    const raw = await store.get(BLOB_KEY, { type: 'json' })
    if (!raw || typeof raw !== 'object') return { sites: memory.sites || {} }
    const sites = raw.sites && typeof raw.sites === 'object' ? raw.sites : {}
    memory = { sites }
    return { sites }
  } catch (e) {
    return { sites: memory.sites || {} }
  }
}

async function saveState(state) {
  const sites = state.sites || {}
  Object.keys(sites).forEach(function (id) {
    const s = sites[id]
    if (s && Array.isArray(s.deploys)) s.deploys = s.deploys.slice(0, MAX_DEPLOYS)
    if (s && Array.isArray(s.posts)) s.posts = s.posts.slice(0, MAX_DEPLOYS)
  })
  const next = { sites: sites, updatedAt: new Date().toISOString() }
  memory = { sites: sites }
  const store = await getBlobStore()
  if (!store) return next
  await store.setJSON(BLOB_KEY, next)
  return next
}

module.exports = { connectNetlifyBlobs, loadState, saveState }
