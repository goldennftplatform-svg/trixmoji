/**
 * Solscan Pro v2 client.
 * Key: SOLSCAN_API_KEY or SOLSCAN_TOKEN (header name is `token`).
 */

const BASE = 'https://pro-api.solscan.io/v2.0'
const WSOL = 'So11111111111111111111111111111111111111112'
const NATIVE_SOL = 'So11111111111111111111111111111111111111111'

function apiKey() {
  return String(process.env.SOLSCAN_API_KEY || process.env.SOLSCAN_TOKEN || '').trim()
}

function hasKey() {
  return apiKey().length > 8
}

function qs(params) {
  const u = new URLSearchParams()
  Object.keys(params || {}).forEach((k) => {
    const v = params[k]
    if (v == null || v === '') return
    if (Array.isArray(v)) {
      v.forEach((item) => u.append(k, String(item)))
      return
    }
    u.set(k, String(v))
  })
  return u.toString()
}

async function solscanGet(path, params) {
  const key = apiKey()
  if (!key) {
    const err = new Error('SOLSCAN_API_KEY missing')
    err.code = 'NO_KEY'
    throw err
  }
  const url = BASE + path + (params ? '?' + qs(params) : '')
  const res = await fetch(url, {
    headers: {
      token: key,
      Accept: 'application/json'
    }
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch (e) {
    body = { raw: text }
  }
  if (!res.ok) {
    const err = new Error('Solscan HTTP ' + res.status + ' ' + path)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

async function accountTransfers(address, extra) {
  return solscanGet('/account/transfer', Object.assign({
    address,
    page: 1,
    page_size: 100,
    sort_by: 'block_time',
    sort_order: 'desc',
    exclude_amount_zero: true
  }, extra || {}))
}

async function accountTransactions(address, extra) {
  return solscanGet('/account/transactions', Object.assign({
    address,
    limit: 40
  }, extra || {}))
}

async function accountTokenAccounts(address, extra) {
  return solscanGet('/account/token-accounts', Object.assign({
    address,
    type: 'nft',
    page: 1,
    page_size: 40
  }, extra || {}))
}

function isUpgradeError(err) {
  const blob = [
    err && err.message,
    err && err.body && err.body.errors && err.body.errors.message,
    err && err.body && JSON.stringify(err.body)
  ].join(' ').toLowerCase()
  return blob.indexOf('upgrade') >= 0 || blob.indexOf('api key level') >= 0
}

async function probePlan() {
  if (!hasKey()) return { ok: false, plan: 'none', reason: 'no_key' }
  try {
    await accountTransfers('7MDYL3w9mBHdGYEoh4kFvEXeLjkm13fHypNry2nqGwGA', {
      page: 1,
      page_size: 10,
      flow: 'out'
    })
    return { ok: true, plan: 'pro' }
  } catch (err) {
    if (isUpgradeError(err)) {
      return { ok: false, plan: 'free', reason: 'upgrade_required' }
    }
    return {
      ok: false,
      plan: 'unknown',
      reason: String(err && err.message ? err.message : err)
    }
  }
}

module.exports = {
  BASE,
  WSOL,
  NATIVE_SOL,
  apiKey,
  hasKey,
  solscanGet,
  accountTransfers,
  accountTransactions,
  accountTokenAccounts,
  isUpgradeError,
  probePlan
}
