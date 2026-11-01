'use strict'

const BLOB_STORE = 'trix-live'
const BLOB_KEY = 'hourly'

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

let memory = { boxes: null, memes: null, at: null }

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

async function loadLive() {
  const store = await getBlobStore()
  if (!store) return memory
  try {
    const raw = await store.get(BLOB_KEY, { type: 'json' })
    if (!raw || typeof raw !== 'object') return memory
    memory = {
      boxes: raw.boxes || null,
      memes: raw.memes || null,
      at: raw.at || null
    }
    return memory
  } catch (e) {
    return memory
  }
}

async function saveLive(next) {
  memory = {
    boxes: next.boxes || memory.boxes,
    memes: next.memes || memory.memes,
    at: new Date().toISOString()
  }
  const store = await getBlobStore()
  if (!store) return memory
  await store.setJSON(BLOB_KEY, memory)
  return memory
}

module.exports = { connectNetlifyBlobs, loadLive, saveLive, HOUR_MS: 60 * 60 * 1000 }
