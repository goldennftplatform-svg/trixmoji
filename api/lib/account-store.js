'use strict'

const fs = require('fs')
const path = require('path')

const BLOB_STORE = 'doswapz-accounts'
const BLOB_KEY = 'state'
const FILE_PATH = path.join(__dirname, '..', '..', '.data', 'accounts.json')

function isHosted() {
  return !!(
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV
  )
}

function header(event, name) {
  const headers = (event && event.headers) || {}
  const want = name.toLowerCase()
  const keys = Object.keys(headers)
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === want) return headers[keys[i]]
  }
  return ''
}

let linkedEvent = null

function decodedBlobs(event) {
  if (!event) return null
  if (event.blobs && typeof event.blobs === 'object') return event.blobs
  if (typeof event.blobs !== 'string' || !event.blobs) return null
  try {
    return JSON.parse(Buffer.from(event.blobs, 'base64').toString('utf8'))
  } catch (e) {
    return null
  }
}

function applyAccountBlobs(event) {
  const blobs = require('@netlify/blobs')
  const raw = decodedBlobs(event)
  if (raw && raw.token && typeof blobs.setEnvironmentContext === 'function') {
    const uncached = raw.uncachedEdgeURL || raw.uncached_edge_url || ''
    const ctx = {
      apiURL: raw.apiURL || raw.api_url || 'https://api.netlify.com',
      deployID: header(event, 'x-nf-deploy-id') || raw.deployID || '',
      siteID: header(event, 'x-nf-site-id') || raw.siteID || '',
      token: raw.token
    }
    // The edge URL is a cached read. Skip it unless an uncached URL is present,
    // so the client uses the Netlify API and the next request sees the write.
    if (uncached) {
      ctx.edgeURL = raw.edgeURL || raw.url || ''
      ctx.uncachedEdgeURL = uncached
    }
    if (ctx.siteID && ctx.token) {
      blobs.setEnvironmentContext(ctx)
      return true
    }
  }
  if (event && typeof event.blobs === 'string' && event.blobs && typeof blobs.connectLambda === 'function') {
    blobs.connectLambda(event)
    return true
  }
  if (process.env.NETLIFY_BLOBS_CONTEXT && typeof blobs.setEnvironmentContext === 'function') {
    const ctx = process.env.NETLIFY_BLOBS_CONTEXT
    if (typeof ctx === 'string' && ctx.charAt(0) === '{') {
      blobs.setEnvironmentContext(JSON.parse(ctx))
      return true
    }
  }
  return false
}

function connectNetlifyBlobs(event) {
  if (!event) return false
  linkedEvent = event
  try {
    return applyAccountBlobs(event)
  } catch (e) {
    return false
  }
}

function accountConsistency() {
  try {
    const raw = process.env.NETLIFY_BLOBS_CONTEXT
    if (!raw || typeof raw !== 'string' || raw.charAt(0) === '{') return 'eventual'
    const data = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    if (data && data.uncachedEdgeURL && data.edgeURL) return 'strong'
  } catch (e) {}
  return 'eventual'
}

function emptyState() {
  return { users: {}, emailIndex: {}, walletIndex: {}, challenges: {} }
}

function normalize(raw) {
  const s = emptyState()
  if (!raw || typeof raw !== 'object') return s
  if (raw.users && typeof raw.users === 'object') s.users = raw.users
  if (raw.emailIndex && typeof raw.emailIndex === 'object') s.emailIndex = raw.emailIndex
  if (raw.walletIndex && typeof raw.walletIndex === 'object') s.walletIndex = raw.walletIndex
  if (raw.challenges && typeof raw.challenges === 'object') s.challenges = raw.challenges
  return s
}

let memory = null
let queue = Promise.resolve()

async function getBlobStore() {
  try {
    if (linkedEvent) {
      try {
        applyAccountBlobs(linkedEvent)
      } catch (e0) {}
    }
    const { getStore } = require('@netlify/blobs')
    if (typeof getStore !== 'function') return null
    try {
      return getStore({ name: BLOB_STORE, consistency: accountConsistency() })
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

async function readFileState() {
  try {
    const raw = await fs.promises.readFile(FILE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

async function writeFileState(state) {
  const dir = path.dirname(FILE_PATH)
  await fs.promises.mkdir(dir, { recursive: true })
  const tmp = FILE_PATH + '.tmp'
  await fs.promises.writeFile(tmp, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 })
  try {
    await fs.promises.rename(tmp, FILE_PATH)
  } catch (e) {
    await fs.promises.unlink(FILE_PATH).catch(function () {})
    await fs.promises.rename(tmp, FILE_PATH)
  }
}

async function loadState() {
  const store = await getBlobStore()
  if (store) {
    try {
      const raw = await store.get(BLOB_KEY, { type: 'json' })
      memory = normalize(raw)
      return memory
    } catch (e) {
      if (isHosted()) return null
    }
  } else if (isHosted()) {
    return null
  }
  if (memory) return memory
  memory = normalize(await readFileState())
  return memory
}

async function saveState(state) {
  memory = normalize(state)
  const store = await getBlobStore()
  if (store) {
    await store.setJSON(BLOB_KEY, Object.assign({ updatedAt: new Date().toISOString() }, memory))
    return memory
  }
  if (isHosted()) {
    const err = new Error('Account store is not available')
    err.code = 'NO_STORE'
    throw err
  }
  await writeFileState(memory)
  return memory
}

function withState(mutator) {
  const run = queue.then(async function () {
    const state = await loadState()
    if (!state) {
      const err = new Error('Account store is not available')
      err.code = 'NO_STORE'
      throw err
    }
    const next = await mutator(state)
    if (next) await saveState(next)
    return next || state
  })
  queue = run.then(
    function () {},
    function () {}
  )
  return run
}

module.exports = {
  BLOB_STORE,
  connectNetlifyBlobs,
  isHosted,
  loadState,
  saveState,
  withState,
  emptyState
}
