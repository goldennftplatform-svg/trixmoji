'use strict'

/**
 * E.K. listing board.
 * Local preview uses .data/ek.json. Hosted runs use the Netlify blob doswapz-ek.
 * The file is not served by the site server and is excluded from deploy.
 * Payments are not stored here as balances. A row only records the listing and the receipt.
 */
const fs = require('fs')
const path = require('path')

const BLOB_STORE = 'doswapz-ek'
const BLOB_KEY = 'board'
const FILE_PATH = path.join(__dirname, '..', '..', '.data', 'ek.json')

function isHosted() {
  return !!(
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV
  )
}

function emptyState() {
  return { listings: [], usedTx: {} }
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
  if (raw.usedTx && typeof raw.usedTx === 'object') {
    Object.keys(raw.usedTx).forEach(function (key) {
      if (!/^[A-Za-z0-9]{16,128}$/.test(key)) return
      s.usedTx[key] = String(raw.usedTx[key] || '')
    })
  }
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
      return getStore({ name: BLOB_STORE, consistency: blobConsistency() })
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
      const err = new Error('E.K. store is not available')
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
    const state = await loadState()
    if (!state) {
      const err = new Error('E.K. store is not available')
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
  isHosted,
  loadState,
  withBoard,
  emptyState
}
