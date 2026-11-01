'use strict'

const fs = require('fs')
const path = require('path')
const diagnostics = require('./ethscriptions-diagnostics')
const { storeOptions } = require('./ethscriptions-blobs')

const BLOB_STORE = 'doswapz-ethscriptions'
const BLOB_KEY = 'board'
const FILE_PATH = path.join(__dirname, '..', '..', '.data', 'ethscriptions.json')

function isHosted() {
  return !!(
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV
  )
}

function emptyState() {
  return { listings: [], collections: [], usedTx: {} }
}

function normalize(raw) {
  const s = emptyState()
  if (!raw || typeof raw !== 'object') return s
  if (Array.isArray(raw.listings)) {
    raw.listings.forEach(function (row) {
      if (!row || typeof row !== 'object') return
      if (!/^[a-f0-9]{16}$/.test(String(row.id || ''))) return
      s.listings.push(row)
    })
  }
  if (Array.isArray(raw.collections)) {
    raw.collections.forEach(function (row) {
      if (!row || typeof row !== 'object') return
      if (!/^[a-f0-9]{16}$/.test(String(row.id || ''))) return
      s.collections.push(row)
    })
  }
  if (raw.usedTx && typeof raw.usedTx === 'object') {
    Object.keys(raw.usedTx).forEach(function (key) {
      if (!/^0x[a-f0-9]{64}$/.test(key)) return
      s.usedTx[key] = String(raw.usedTx[key] || '')
    })
  }
  if (typeof raw.phunkReset === 'string' && raw.phunkReset.length <= 40) s.phunkReset = raw.phunkReset
  if (/^0x[a-fA-F0-9]{40}$/.test(String(raw.phunkMinter || ''))) s.phunkMinter = String(raw.phunkMinter).toLowerCase()
  return s
}

function blobConsistency() {
  try {
    const raw = process.env.NETLIFY_BLOBS_CONTEXT
    if (!raw || typeof raw !== 'string' || raw.charAt(0) === '{') return 'eventual'
    const data = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    if (data && data.uncachedEdgeURL && data.edgeURL) return 'strong'
  } catch (e) {}
  return 'eventual'
}

async function getBlobStore() {
  if (!isHosted()) return null
  try {
    const { getStore } = require('@netlify/blobs')
    if (typeof getStore !== 'function') return null
    try {
      // Explicit siteID/token tell the SDK to bypass ambient runtime context.
      // That context can retain a legacy cached edge with no strong-read URL.
      return getStore({ ...storeOptions(), name: BLOB_STORE, consistency: 'strong' })
    } catch (e1) {
      diagnostics.report('blob-store-init', e1)
      throw e1
    }
  } catch (e) {
    diagnostics.report('blob-sdk-load', e)
    throw e
  }
}

async function readFileState() {
  try {
    return JSON.parse(await fs.promises.readFile(FILE_PATH, 'utf8'))
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

let memory = null
let queue = Promise.resolve()

async function loadState() {
  if (isHosted()) {
    const store = await getBlobStore()
    if (!store) return null
    try {
      memory = normalize(await store.get(BLOB_KEY, { type: 'json' }))
      return memory
    } catch (e) {
      return null
    }
  }
  if (memory) return memory
  memory = normalize(await readFileState())
  return memory
}

async function saveState(state) {
  memory = normalize(state)
  if (isHosted()) {
    const store = await getBlobStore()
    if (!store) {
      const err = new Error('Ethscriptions store is not available')
      err.code = 'NO_STORE'
      throw err
    }
    await store.setJSON(BLOB_KEY, memory)
    return memory
  }
  await writeFileState(memory)
  return memory
}

function withBoard(mutator) {
  const run = queue.then(async function () {
    if (isHosted()) {
      const store = await getBlobStore()
      if (!store) throw new Error('Ethscriptions store is not available')
      // Conditional writes protect orders across separate serverless instances.
      // Mutators may run again after a conflict; they must not send transactions.
      for (let attempt = 0; attempt < 8; attempt++) {
        const current = await store.getWithMetadata(BLOB_KEY, { type: 'json', consistency: 'strong' })
        const state = normalize(current && current.data)
        const next = await mutator(JSON.parse(JSON.stringify(state)))
        if (!next) return state
        const result = await store.setJSON(BLOB_KEY, normalize(next), current ? { onlyIfMatch: current.etag } : { onlyIfNew: true })
        if (result.modified) return normalize(next)
      }
      throw new Error('Checkout is busy. Please retry; no transaction was sent by this server.')
    }
    const state = await loadState()
    if (!state) {
      const err = new Error('Ethscriptions store is not available')
      err.code = 'NO_STORE'
      throw err
    }
    // A rejected mutation must not leak partially changed rows into memory.
    const draft = JSON.parse(JSON.stringify(state))
    const next = await mutator(draft)
    if (next) await saveState(next)
    return next || state
  })
  queue = run.then(function () {}, function () {})
  return run
}

module.exports = {
  BLOB_STORE,
  isHosted,
  loadState,
  withBoard,
  emptyState
}
