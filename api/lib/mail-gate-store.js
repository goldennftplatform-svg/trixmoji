'use strict'

const BLOB_STORE = 'mail-gate'
const BLOB_KEY = 'state'

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

let memory = { challenges: {}, authorized: {}, paid: {}, inbox: [] }

async function getBlobStore() {
  try {
    const { getStore } = require('@netlify/blobs')
    if (typeof getStore === 'function') {
      try {
        return getStore({ name: BLOB_STORE, consistency: 'eventual' })
      } catch (e1) {
        try {
          return getStore(BLOB_STORE)
        } catch (e2) {}
      }
    }
    return null
  } catch (e) {
    return null
  }
}

async function loadState() {
  const store = await getBlobStore()
  if (!store) return memory
  try {
    const raw = await store.get(BLOB_KEY, { type: 'json' })
    if (!raw || typeof raw !== 'object') return memory
    memory = {
      challenges: raw.challenges || {},
      authorized: raw.authorized || {},
      paid: raw.paid || {},
      inbox: Array.isArray(raw.inbox) ? raw.inbox : []
    }
    return memory
  } catch (e) {
    return memory
  }
}

async function saveState(state) {
  memory = {
    challenges: state.challenges || {},
    authorized: state.authorized || {},
    paid: state.paid || {},
    inbox: Array.isArray(state.inbox) ? state.inbox : []
  }
  const store = await getBlobStore()
  if (!store) return memory
  await store.setJSON(BLOB_KEY, Object.assign({ updatedAt: new Date().toISOString() }, memory))
  return memory
}

module.exports = { connectNetlifyBlobs, loadState, saveState }
