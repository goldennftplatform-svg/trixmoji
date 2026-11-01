'use strict'

/**
 * DOSWAPZ account login.
 * GET  /api/account
 * POST /api/account { action }
 *   challenge | verify | email-register | email-login | logout | delete
 * Wallet signatures log the user in. They do not move tokens.
 * Email passwords are stored only as scrypt hashes.
 */

const crypto = require('crypto')
const { promisify } = require('util')
const { rateLimitOrReject } = require('./lib/rate-limit')
const { withState, loadState } = require('./lib/account-store')
const {
  sessionSecret,
  readSession,
  setSessionCookie,
  clearSessionCookie
} = require('./lib/account-session')

const scrypt = promisify(crypto.scrypt)
const CHALLENGE_MS = 5 * 60 * 1000
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const DUMMY_SALT = Buffer.alloc(16, 7)
const DUMMY_HASH = crypto.randomBytes(32)

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

function fail(res, code, error) {
  res.status(code).json({ ok: false, error: error })
}

function requestHost(req) {
  const h = req.headers || {}
  let host = String(h['x-forwarded-host'] || h['X-Forwarded-Host'] || h.host || h.Host || 'doswapz.com')
  host = host.split(',')[0].trim().toLowerCase()
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return 'doswapz.com'
  return host
}

function accepted(body) {
  return !!(body && body.acceptTerms === true && body.age18 === true)
}

function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase()
  if (email.length < 6 || email.length > 254) return ''
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return ''
  return email
}

function passwordOk(raw) {
  if (typeof raw !== 'string') return false
  if (raw.length < 10 || raw.length > 128) return false
  if (raw.indexOf('\0') >= 0) return false
  return true
}

function maskEmail(email) {
  const at = String(email || '').indexOf('@')
  if (at < 1) return ''
  return email.slice(0, 1) + '***@' + email.slice(at + 1)
}

function publicUser(user) {
  if (!user) return null
  const wallets = Array.isArray(user.wallets)
    ? user.wallets.map(function (w) {
        return { chain: w.chain, address: w.address }
      })
    : []
  return {
    uid: user.uid,
    method: user.method,
    email: user.email ? maskEmail(user.email) : '',
    wallets: wallets,
    createdAt: user.createdAt || ''
  }
}

function bs58lib() {
  const mod = require('bs58')
  if (mod && typeof mod.decode === 'function') return mod
  if (mod && mod.default && typeof mod.default.decode === 'function') return mod.default
  return mod
}

function canonicalSolana(address) {
  try {
    const bs58 = bs58lib()
    const pub = Buffer.from(bs58.decode(String(address || '')))
    if (pub.length !== 32) return ''
    return bs58.encode(pub)
  } catch (e) {
    return ''
  }
}

function canonicalEthereum(address) {
  try {
    const { ethers } = require('ethers')
    return ethers.utils.getAddress(String(address || '').trim())
  } catch (e) {
    return ''
  }
}

function canonicalAddress(chain, address) {
  if (chain === 'solana') return canonicalSolana(address)
  if (chain === 'ethereum') return canonicalEthereum(address)
  return ''
}

function walletKey(chain, address) {
  if (chain === 'ethereum') return 'ethereum:' + String(address).toLowerCase()
  return chain + ':' + address
}

function loginMessage(fields) {
  return [
    'DOSWAPZ ACCOUNT LOGIN',
    'This signature only logs you in.',
    'It does not send tokens, approve a swap, or grant custody.',
    'DOSWAPZ will never ask for your seed phrase or private key.',
    'Domain: ' + fields.domain,
    'Chain: ' + fields.chain,
    'Address: ' + fields.address,
    'Nonce: ' + fields.nonce,
    'Issued: ' + fields.issued,
    'Expires: ' + fields.expires
  ].join('\n')
}

function pruneChallenges(state) {
  const now = Date.now()
  const ch = state.challenges || {}
  Object.keys(ch).forEach(function (id) {
    if (!ch[id] || ch[id].used || Number(ch[id].exp) < now) delete ch[id]
  })
  const ids = Object.keys(ch)
  if (ids.length > 400) {
    ids.sort(function (a, b) {
      return Number(ch[a].exp || 0) - Number(ch[b].exp || 0)
    })
    ids.slice(0, ids.length - 400).forEach(function (id) {
      delete ch[id]
    })
  }
  return state
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024
  })
}

async function passwordMatches(password, pass) {
  const salt = pass && pass.salt ? Buffer.from(pass.salt, 'base64') : DUMMY_SALT
  const expect = pass && pass.hash ? Buffer.from(pass.hash, 'base64') : DUMMY_HASH
  let got
  try {
    if (pass && (pass.n !== SCRYPT_N || pass.r !== SCRYPT_R || pass.p !== SCRYPT_P)) {
      got = Buffer.alloc(32, 1)
    } else {
      got = await hashPassword(password, salt.length === 16 ? salt : DUMMY_SALT)
    }
  } catch (e) {
    got = Buffer.alloc(32, 2)
  }
  if (!Buffer.isBuffer(got) || got.length !== expect.length) return false
  return crypto.timingSafeEqual(got, expect)
}

function newUser(method) {
  const now = new Date().toISOString()
  return {
    uid: 'u_' + crypto.randomBytes(16).toString('hex'),
    method: method,
    email: '',
    pass: null,
    wallets: [],
    createdAt: now,
    acceptTermsAt: now,
    age18: true
  }
}

function verifySolana(message, signature, address) {
  try {
    const nacl = require('tweetnacl')
    const bs58 = bs58lib()
    const msg = Buffer.from(message, 'utf8')
    let sig = null
    try {
      sig = Buffer.from(String(signature || ''), 'base64')
    } catch (e) {
      sig = null
    }
    if (!sig || sig.length !== 64) {
      try {
        sig = Buffer.from(bs58.decode(String(signature || '')))
      } catch (e2) {
        return false
      }
    }
    const pub = Buffer.from(bs58.decode(address))
    if (sig.length !== 64 || pub.length !== 32) return false
    return nacl.sign.detached.verify(msg, sig, pub)
  } catch (e) {
    return false
  }
}

function verifyEthereum(message, signature, address) {
  try {
    const { ethers } = require('ethers')
    const recovered = ethers.utils.verifyMessage(message, signature)
    return recovered.toLowerCase() === String(address).toLowerCase()
  } catch (e) {
    return false
  }
}

function currentUser(state, req) {
  const session = readSession(req)
  if (!session) return null
  const user = state.users[session.uid]
  if (!user || user.uid !== session.uid) return null
  return user
}

async function handler(req, res) {
  noStore(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET' || req.method === 'HEAD') {
    const secret = sessionSecret()
    let state = null
    try {
      state = await loadState()
    } catch (e) {
      state = null
    }
    const user = state ? currentUser(state, req) : null
    return res.status(200).json({
      ok: true,
      configured: !!(secret && state),
      user: publicUser(user),
      login: {
        wallet: ['solana', 'ethereum'],
        email: true,
        custody: false,
        movesFunds: false,
        seedPhrase: false
      }
    })
  }

  if (req.method !== 'POST') return fail(res, 405, 'GET or POST')
  if (rateLimitOrReject(req, res, { prefix: 'account', perMinute: 30, perDay: 300 })) return

  const secret = sessionSecret()
  if (!secret) return fail(res, 503, 'Account login is not armed on this host.')

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const action = String(body.action || '')

  if (action === 'logout') {
    clearSessionCookie(req, res)
    return res.status(200).json({ ok: true, user: null })
  }

  try {
    if (action === 'delete') {
      if (body.confirm !== 'DELETE') return fail(res, 400, 'Confirm account deletion.')
      const session = readSession(req)
      if (!session) return fail(res, 401, 'You are not logged in.')
      let removed = false
      await withState(async function (state) {
        const user = state.users[session.uid]
        if (!user) return null
        if (user.email && state.emailIndex[user.email] === user.uid) delete state.emailIndex[user.email]
        ;(user.wallets || []).forEach(function (w) {
          const key = walletKey(w.chain, w.address)
          if (state.walletIndex[key] === user.uid) delete state.walletIndex[key]
        })
        delete state.users[user.uid]
        removed = true
        return state
      })
      clearSessionCookie(req, res)
      return res.status(200).json({ ok: true, deleted: removed, user: null })
    }

    if (action === 'challenge') {
      if (!accepted(body)) return fail(res, 400, 'Confirm you are 18 or older and accept the terms.')
      const chain = body.chain === 'solana' || body.chain === 'ethereum' ? body.chain : ''
      if (!chain) return fail(res, 400, 'Choose Solana or Ethereum.')
      const address = canonicalAddress(chain, body.address)
      if (!address) return fail(res, 400, 'That address is not valid.')
      const nonce = crypto.randomBytes(16).toString('hex')
      const issued = new Date()
      const expires = new Date(issued.getTime() + CHALLENGE_MS)
      const message = loginMessage({
        domain: requestHost(req),
        chain: chain,
        address: address,
        nonce: nonce,
        issued: issued.toISOString(),
        expires: expires.toISOString()
      })
      await withState(async function (state) {
        pruneChallenges(state)
        state.challenges[nonce] = {
          chain: chain,
          address: address,
          message: message,
          exp: expires.getTime(),
          used: false
        }
        return state
      })
      return res.status(200).json({
        ok: true,
        challengeId: nonce,
        message: message,
        expires: expires.toISOString(),
        custody: false,
        movesFunds: false
      })
    }

    if (action === 'verify') {
      if (!accepted(body)) return fail(res, 400, 'Confirm you are 18 or older and accept the terms.')
      const challengeId = String(body.challengeId || '')
      const signature = String(body.signature || '')
      if (!/^[a-f0-9]{32}$/.test(challengeId)) return fail(res, 400, 'Unknown login challenge.')
      if (!signature || signature.length > 300) return fail(res, 400, 'Signature did not match this login.')
      let created = null
      let matched = false
      await withState(async function (state) {
        pruneChallenges(state)
        const ch = state.challenges[challengeId]
        if (!ch || ch.used || Date.now() > Number(ch.exp)) return state
        const ok =
          ch.chain === 'solana'
            ? verifySolana(ch.message, signature, ch.address)
            : verifyEthereum(ch.message, signature, ch.address)
        if (!ok) return state
        matched = true
        delete state.challenges[challengeId]
        const key = walletKey(ch.chain, ch.address)
        let user = state.users[state.walletIndex[key]] || null
        if (!user) {
          user = newUser(ch.chain)
          user.wallets = [{ chain: ch.chain, address: ch.address }]
          state.users[user.uid] = user
          state.walletIndex[key] = user.uid
        } else {
          user.acceptTermsAt = new Date().toISOString()
          user.age18 = true
        }
        created = user
        return state
      })
      if (!matched || !created) return fail(res, 401, 'Signature did not match this login.')
      setSessionCookie(req, res, created)
      return res.status(200).json({ ok: true, user: publicUser(created) })
    }

    if (action === 'email-register' || action === 'email-login') {
      if (!accepted(body)) return fail(res, 400, 'Confirm you are 18 or older and accept the terms.')
      const email = normalizeEmail(body.email)
      if (!email) return fail(res, 400, 'Enter a valid email.')
      if (!passwordOk(body.password)) return fail(res, 400, 'Password must be 10 to 128 characters.')
      if (String(body.password).toLowerCase() === email) return fail(res, 400, 'Use a password that is not your email.')

      if (action === 'email-register') {
        const salt = crypto.randomBytes(16)
        const hash = await hashPassword(body.password, salt)
        let user = null
        let taken = false
        await withState(async function (state) {
          if (state.emailIndex[email]) {
            taken = true
            return null
          }
          user = newUser('email')
          user.email = email
          user.pass = {
            alg: 'scrypt',
            n: SCRYPT_N,
            r: SCRYPT_R,
            p: SCRYPT_P,
            salt: salt.toString('base64'),
            hash: hash.toString('base64')
          }
          state.users[user.uid] = user
          state.emailIndex[email] = user.uid
          return state
        })
        if (taken) return fail(res, 409, 'That email is already registered.')
        setSessionCookie(req, res, user)
        return res.status(201).json({ ok: true, user: publicUser(user) })
      }

      let user = null
      await withState(async function (state) {
        const uid = state.emailIndex[email]
        const found = uid ? state.users[uid] : null
        const ok = await passwordMatches(body.password, found && found.pass)
        if (!found || !ok) return null
        found.acceptTermsAt = new Date().toISOString()
        found.age18 = true
        user = found
        return state
      })
      if (!user) return fail(res, 401, 'Email or password is wrong.')
      setSessionCookie(req, res, user)
      return res.status(200).json({ ok: true, user: publicUser(user) })
    }

    return fail(res, 400, 'Unknown action.')
  } catch (e) {
    if (e && e.code === 'NO_STORE') return fail(res, 503, 'Account login is not armed on this host.')
    return fail(res, 500, 'Could not save the account.')
  }
}

module.exports = handler
