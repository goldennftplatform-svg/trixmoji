'use strict'

/**
 * DOSWAPZ account session. HMAC cookie only.
 * Payload is account id, method, and expiry. Never email, password, seed, or private key.
 */
const crypto = require('crypto')

const SESSION_COOKIE = 'dz_acct'
const SESSION_DAYS = 14
const METHODS = { email: 1, solana: 1, ethereum: 1 }

function isHosted() {
  return !!(
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV
  )
}

function sessionSecret() {
  const explicit = String(process.env.ACCOUNT_SESSION_SECRET || process.env.X_SESSION_SECRET || '').trim()
  if (explicit) return explicit
  const clientSecret = String(process.env.X_CLIENT_SECRET || '').trim()
  if (clientSecret) {
    return crypto.createHash('sha256').update('dz|account|' + clientSecret).digest('hex')
  }
  if (isHosted()) return ''
  return crypto.createHash('sha256').update('dz|account|local-preview-only|not-for-production').digest('hex')
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function sign(payload, secret) {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest())
  return body + '.' + sig
}

function verify(token, secret) {
  if (!token || !secret || typeof token !== 'string') return null
  const i = token.lastIndexOf('.')
  if (i < 1) return null
  const body = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expect = b64url(crypto.createHmac('sha256', secret).update(body).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null
  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch (e) {
    return null
  }
}

function parseCookies(req) {
  const raw = (req.headers && (req.headers.cookie || req.headers.Cookie)) || ''
  const out = {}
  String(raw)
    .split(';')
    .forEach(function (part) {
      const i = part.indexOf('=')
      if (i < 1) return
      const k = part.slice(0, i).trim()
      let v = part.slice(i + 1).trim()
      try {
        v = decodeURIComponent(v)
      } catch (e) {}
      if (k) out[k] = v
    })
  return out
}

function isHttpsReq(req) {
  const h = req.headers || {}
  const proto = String(h['x-forwarded-proto'] || h['X-Forwarded-Proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  if (proto === 'https') return true
  const host = String(h.host || h.Host || '')
  return host.indexOf('localhost') < 0 && host.indexOf('127.0.0.1') < 0 && proto !== 'http'
}

function cookieHeader(name, value, opts) {
  opts = opts || {}
  const parts = [name + '=' + encodeURIComponent(value)]
  parts.push('Path=' + (opts.path || '/'))
  parts.push('HttpOnly')
  parts.push('SameSite=Lax')
  if (opts.maxAge != null) parts.push('Max-Age=' + String(opts.maxAge))
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

function clearCookieHeader(name, secure) {
  return cookieHeader(name, '', { maxAge: 0, secure: !!secure })
}

function readSession(req) {
  const secret = sessionSecret()
  if (!secret) return null
  const cookies = parseCookies(req)
  const payload = verify(cookies[SESSION_COOKIE], secret)
  if (!payload || payload.v !== 1 || !payload.uid || !METHODS[payload.method]) return null
  if (!payload.exp || Date.now() > Number(payload.exp)) return null
  return {
    uid: String(payload.uid),
    method: String(payload.method)
  }
}

function setSessionCookie(req, res, user) {
  const secret = sessionSecret()
  if (!secret || !user || !user.uid || !METHODS[user.method]) return false
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const token = sign({ v: 1, uid: user.uid, method: user.method, exp: exp }, secret)
  res.setHeader(
    'Set-Cookie',
    cookieHeader(SESSION_COOKIE, token, {
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      secure: isHttpsReq(req)
    })
  )
  return true
}

function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', clearCookieHeader(SESSION_COOKIE, isHttpsReq(req)))
}

module.exports = {
  SESSION_COOKIE,
  sessionSecret,
  readSession,
  setSessionCookie,
  clearSessionCookie
}
