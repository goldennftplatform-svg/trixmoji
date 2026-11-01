'use strict'

const BLOB_STORE = 'geoff-watch'
const BLOB_KEY = 'probes'
const MAX_ROWS = 4000

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

let memory = { rows: [], lastCycle: null }

async function loadState() {
  const store = await getBlobStore()
  if (!store) return { rows: memory.rows || [], lastCycle: memory.lastCycle || null }
  try {
    const raw = await store.get(BLOB_KEY, { type: 'json' })
    if (!raw || typeof raw !== 'object') return { rows: memory.rows || [], lastCycle: memory.lastCycle || null }
    const next = {
      rows: Array.isArray(raw.rows) ? raw.rows : [],
      lastCycle: raw.lastCycle || null
    }
    memory = next
    return next
  } catch (e) {
    return { rows: memory.rows || [], lastCycle: memory.lastCycle || null }
  }
}

async function saveState(state) {
  const rows = (state.rows || []).slice(-MAX_ROWS)
  const next = { rows, lastCycle: state.lastCycle || null }
  memory = next
  const store = await getBlobStore()
  if (!store) return next
  await store.setJSON(BLOB_KEY, {
    rows,
    lastCycle: state.lastCycle || null,
    updatedAt: new Date().toISOString()
  })
  return next
}

module.exports = {
  connectNetlifyBlobs,
  loadState,
  saveState
}
