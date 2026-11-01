'use strict'

const BLOB_STORE = 'daily-watch'
const BLOB_KEY = 'desks'
const MAX_CHANGES = 80

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
    if (typeof connectLambda === 'function') {
      try {
        connectLambda(event)
        return true
      } catch (e3) {}
    }
  } catch (e) {}
  return false
}

async function getBlobStore() {
  try {
    const { getStore, getDeployStore } = require('@netlify/blobs')
    if (typeof getStore === 'function') {
      try {
        return getStore({ name: BLOB_STORE, consistency: 'eventual' })
      } catch (e1) {
        try {
          return getStore(BLOB_STORE)
        } catch (e2) {}
      }
    }
    if (typeof getDeployStore === 'function') {
      try {
        return getDeployStore({ name: BLOB_STORE, consistency: 'eventual' })
      } catch (e3) {}
    }
    return null
  } catch (e) {
    return null
  }
}

function emptyState() {
  return { desks: {} }
}

let memory = emptyState()

async function loadState() {
  const store = await getBlobStore()
  if (!store) return { desks: memory.desks || {} }
  try {
    const raw = await store.get(BLOB_KEY, { type: 'json' })
    if (!raw || typeof raw !== 'object') return { desks: memory.desks || {} }
    const desks = raw.desks && typeof raw.desks === 'object' ? raw.desks : {}
    memory = { desks }
    return { desks }
  } catch (e) {
    return { desks: memory.desks || {} }
  }
}

async function saveState(state) {
  const desks = state.desks || {}
  Object.keys(desks).forEach((id) => {
    const d = desks[id]
    if (d && Array.isArray(d.changes)) d.changes = d.changes.slice(0, MAX_CHANGES)
  })
  const next = { desks, updatedAt: new Date().toISOString() }
  memory = { desks }
  const store = await getBlobStore()
  if (!store) return next
  await store.setJSON(BLOB_KEY, next)
  return next
}

module.exports = {
  connectNetlifyBlobs,
  loadState,
  saveState
}
