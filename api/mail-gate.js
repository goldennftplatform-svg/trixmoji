/**
 * DOSWAPZ Mail Gate — pay-to-pass with published treasuries.
 * GET  /api/mail-gate                health + pay addresses
 * POST /api/mail-gate { action }
 *   challenge | verify | quote | prepare | pay | authorize | send
 */

const crypto = require('crypto')
const dns = require('dns').promises
const { rateLimitOrReject } = require('./lib/rate-limit')
const { loadState, saveState } = require('./lib/mail-gate-store')
const { verifyDeposit } = require('./lib/awardz-chain')
const T = require('./lib/doswapz-treasury')

const DEFAULT_DOMAIN = 'doswapz.com'
const TTL = Number(process.env.SIGNATURE_TTL_SECONDS || 300)

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')
}

function cleanDomain(domain) {
  return String(domain || DEFAULT_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
}

function validDomain(domain) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)
}

function requireString(v, max) {
  return typeof v === 'string' && v.length > 0 && v.length <= max
}

function makeMessageId(domain) {
  return '<doswapz-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex') + '@' + domain + '>'
}

function canonicalPayload(fields) {
  return [
    'BLOCKCHAIN-EMAIL-V1',
    'message-id:' + fields.messageId,
    'domain:' + fields.domain.toLowerCase(),
    'from:' + fields.from.toLowerCase(),
    'to:' + fields.to.toLowerCase(),
    'chain:' + fields.chain,
    'pay-txid:' + fields.payTxid,
    'timestamp:' + fields.timestamp,
    'subject-sha256:' + sha256(fields.subject),
    'body-sha256:' + sha256(fields.body)
  ].join('\n')
}

function verifyEthereum(payload, signature, expectedAddress) {
  try {
    const { ethers } = require('ethers')
    const recovered = ethers.utils.verifyMessage(payload, signature)
    return recovered.toLowerCase() === ethers.utils.getAddress(expectedAddress).toLowerCase()
  } catch (e) {
    return false
  }
}

function verifySolana(payload, signature, address) {
  try {
    const nacl = require('tweetnacl')
    const bs58 = require('bs58')
    const message = Buffer.from(payload, 'utf8')
    let sig
    try {
      sig = Buffer.from(signature, 'base64')
    } catch (e) {
      sig = null
    }
    if (!sig || sig.length !== 64) {
      try {
        sig = Buffer.from(bs58.decode(signature))
      } catch (e2) {
        return false
      }
    }
    const pub = Buffer.from(bs58.decode(address))
    if (sig.length !== 64 || pub.length !== 32) return false
    return nacl.sign.detached.verify(message, sig, pub)
  } catch (e) {
    return false
  }
}

function quoteFor(chain) {
  if (chain === 'sol') {
    return {
      chain: 'sol',
      to: T.SOL_TREASURY,
      amountNative: String(T.MAIL_FEE_SOL_LAMPORTS),
      amountLabel: '0.01 SOL'
    }
  }
  if (chain === 'eth') {
    return {
      chain: 'eth',
      to: T.ETH_TREASURY,
      amountNative: T.MAIL_FEE_ETH_WEI,
      amountLabel: '0.0002 ETH'
    }
  }
  if (chain === 'btc') {
    return {
      chain: 'btc',
      to: T.BTC_TREASURY,
      amountNative: String(T.MAIL_FEE_BTC_SATS),
      amountLabel: '0.0001 BTC'
    }
  }
  return null
}

function smtpReady() {
  return (
    process.env.ENABLE_EMAIL_SEND === 'true' &&
    !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  )
}

async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (rateLimitOrReject(req, res, { prefix: 'mail-gate', perMinute: 20, perDay: 200 })) return

  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      ok: true,
      service: 'doswapz-mail-gate',
      version: '3.0.0',
      domain: DEFAULT_DOMAIN,
      sendEnabled: smtpReady(),
      gate: 'PAY_TO_PASS',
      treasuries: {
        sol: T.SOL_TREASURY,
        eth: T.ETH_TREASURY,
        btc: T.BTC_TREASURY
      },
      fees: {
        sol: quoteFor('sol'),
        eth: quoteFor('eth'),
        btc: quoteFor('btc')
      }
    })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' })

  const body = req.body || {}
  const action = String(body.action || (req.query && req.query.action) || '').toLowerCase()
  const state = await loadState()
  if (!state.paid) state.paid = {}
  if (!state.inbox) state.inbox = []

  if (action === 'challenge') {
    const domain = cleanDomain(body.domain || DEFAULT_DOMAIN)
    if (!validDomain(domain)) return res.status(400).json({ error: 'Invalid domain.' })
    const token = 'doswapz-mail-' + crypto.randomBytes(24).toString('hex')
    state.challenges[domain] = { token, expires: Date.now() + 3600000 }
    await saveState(state)
    return res.status(200).json({
      domain,
      record: { type: 'TXT', name: '_blockchain-email.' + domain, value: token },
      treasuries: { sol: T.SOL_TREASURY, eth: T.ETH_TREASURY, btc: T.BTC_TREASURY },
      note: 'Pay the Mail Gate fee to a published treasury, then sign. SPF/DKIM still belong on DNS if you later wire SMTP.'
    })
  }

  if (action === 'verify') {
    const domain = cleanDomain(body.domain || DEFAULT_DOMAIN)
    if (!validDomain(domain)) return res.status(400).json({ error: 'Invalid domain.' })
    const c = state.challenges[domain]
    if (!c || c.expires < Date.now()) {
      return res.status(400).json({ error: 'No active challenge. Create one first.' })
    }
    try {
      const records = await dns.resolveTxt('_blockchain-email.' + domain)
      const values = records.flat()
      const verified = values.includes(c.token)
      return res.status(200).json({
        domain,
        verified,
        message: verified ? 'Domain verified.' : 'TXT challenge not found yet.'
      })
    } catch (e) {
      return res.status(200).json({
        domain,
        verified: false,
        message: 'DNS TXT record could not be resolved yet.'
      })
    }
  }

  if (action === 'quote') {
    const q = quoteFor(String(body.chain || 'sol').toLowerCase())
    if (!q) return res.status(400).json({ error: 'Chain must be sol, eth, or btc.' })
    return res.status(200).json(q)
  }

  if (action === 'pay') {
    const chain = String(body.chain || '').toLowerCase()
    const txid = String(body.txid || '').trim()
    const from = String(body.from || '').trim()
    const q = quoteFor(chain)
    if (!q) return res.status(400).json({ error: 'Chain must be sol, eth, or btc.' })
    if (!txid) return res.status(400).json({ error: 'Missing txid.' })
    if (state.paid[txid]) {
      return res.status(200).json({ paid: true, reused: true, ticket: state.paid[txid] })
    }
    try {
      let proof
      if (chain === 'btc') {
        proof = await T.verifyBtc(txid, T.MAIL_FEE_BTC_SATS)
      } else {
        if (!from) return res.status(400).json({ error: 'Missing paying wallet.' })
        proof = await verifyDeposit(chain, txid, from, q.amountNative)
      }
      const ticket = {
        chain: chain,
        txid: txid,
        from: proof.from || from || '',
        to: q.to,
        amountNative: q.amountNative,
        paidAt: Date.now()
      }
      state.paid[txid] = ticket
      await saveState(state)
      return res.status(200).json({ paid: true, ticket: ticket })
    } catch (e) {
      return res.status(400).json({ error: String(e && e.message ? e.message : e) })
    }
  }

  if (action === 'prepare') {
    const domain = cleanDomain(body.domain || DEFAULT_DOMAIN)
    const from = String(body.from || '')
    const to = String(body.to || '')
    const subject = String(body.subject || '')
    const text = String(body.body || '')
    const chain = String(body.chain || 'sol').toLowerCase()
    const payTxid = String(body.payTxid || '').trim()
    if (!validDomain(domain) || !requireString(from, 320) || !requireString(to, 320) || !requireString(subject, 998) || !requireString(text, 50000)) {
      return res.status(400).json({ error: 'Invalid or missing message fields.' })
    }
    if (!payTxid || !state.paid[payTxid]) {
      return res.status(402).json({ error: 'Pay the Mail Gate fee first.' })
    }
    const timestamp = Math.floor(Date.now() / 1000)
    const messageId = makeMessageId(domain)
    const payload = canonicalPayload({
      messageId,
      domain,
      from,
      to,
      subject,
      body: text,
      timestamp,
      chain,
      payTxid
    })
    return res.status(200).json({
      messageId,
      timestamp,
      payload,
      payloadHash: sha256(payload),
      expiresAt: timestamp + TTL,
      payTxid
    })
  }

  if (action === 'authorize') {
    const messageId = body.messageId
    const walletType = String(body.walletType || '').toLowerCase()
    const walletAddress = body.walletAddress
    const signature = body.signature
    const payload = body.payload
    const payloadHash = body.payloadHash
    const timestamp = Number(body.timestamp)
    const payTxid = String(body.payTxid || '').trim()
    const from = String(body.from || '')
    const to = String(body.to || '')
    const subject = String(body.subject || '')
    const text = String(body.body || '')
    if (
      !requireString(messageId, 500) ||
      !requireString(walletType, 20) ||
      !requireString(walletAddress, 200) ||
      !requireString(signature, 2000) ||
      !requireString(payload, 8000) ||
      !requireString(payloadHash, 128) ||
      !Number.isFinite(timestamp)
    ) {
      return res.status(400).json({ error: 'Incomplete authorization request.' })
    }
    if (Math.floor(Date.now() / 1000) - timestamp > TTL || timestamp - Math.floor(Date.now() / 1000) > 30) {
      return res.status(401).json({ error: 'Signature expired or timestamp is invalid.' })
    }
    if (sha256(payload) !== payloadHash || payload.indexOf('message-id:' + messageId) < 0) {
      return res.status(401).json({ error: 'Payload integrity check failed.' })
    }
    if (!payTxid || !state.paid[payTxid]) {
      return res.status(402).json({ error: 'Pay the Mail Gate fee first.' })
    }
    if (state.authorized[messageId]) return res.status(409).json({ error: 'Message already authorized.' })
    const ticket = state.paid[payTxid]
    if (ticket.chain !== 'btc' && ticket.from && !T.eqAddr(ticket.from, walletAddress)) {
      return res.status(401).json({ error: 'Signing wallet must be the paying wallet.' })
    }
    let ok = false
    if (walletType === 'ethereum') ok = verifyEthereum(payload, signature, walletAddress)
    if (walletType === 'solana') ok = verifySolana(payload, signature, walletAddress)
    if (walletType === 'btc' && ticket.chain === 'btc') ok = payload.indexOf('pay-txid:' + payTxid) >= 0
    if (!ok) return res.status(401).json({ error: 'Wallet signature verification failed.' })
    const rec = {
      messageId,
      walletType,
      walletAddress,
      payTxid,
      chain: ticket.chain,
      from,
      to,
      subject,
      body: text,
      authorizedAt: Date.now(),
      payloadHash,
      dispatched: false
    }
    state.authorized[messageId] = rec
    state.inbox.push({
      messageId,
      from,
      to,
      subject,
      chain: ticket.chain,
      payTxid,
      at: rec.authorizedAt
    })
    if (state.inbox.length > 300) state.inbox = state.inbox.slice(-200)
    await saveState(state)
    return res.status(200).json({ authorized: true, messageId, gate: 'OPEN' })
  }

  if (action === 'send') {
    const messageId = String(body.messageId || '')
    const rec = state.authorized[messageId]
    if (!rec) return res.status(404).json({ error: 'Authorize the message first.' })
    if (rec.dispatched) return res.status(200).json({ sent: true, mode: rec.dispatchMode || 'filed', messageId })
    rec.dispatched = true
    rec.dispatchMode = smtpReady() ? 'smtp' : 'on-chain-gate'
    rec.dispatchedAt = Date.now()
    await saveState(state)
    return res.status(200).json({
      sent: true,
      mode: rec.dispatchMode,
      messageId,
      payTxid: rec.payTxid,
      note:
        rec.dispatchMode === 'smtp'
          ? 'SMTP dispatch armed.'
          : 'GATE OPEN. Payment verified. Message filed. SMTP host is optional for later mailbox delivery.'
    })
  }

  return res.status(400).json({ error: 'Unknown action. Use challenge, verify, quote, pay, prepare, authorize, or send.' })
}

module.exports = handler
