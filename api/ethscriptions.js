'use strict'

/**
 * ETHSCRIPTIONS marketplace. Open to everyone.
 * The buyer pays the E.K. escrow address.
 * A mint keeps a 0.5% site fee in the escrow. The seller receives 99.5% of the mint price.
 * A resale has no DOSWAPZ fee. The price includes 2.5% for the creator.
 * The buyer pays that price. The seller receives 97.5%.
 * If the creator chose 5%, the buyer pays the ask plus 5% and a 0.5% site fee. The seller receives that ask.
 * A refund returns the full amount the buyer paid.
 * The launchpad sells a collection one piece at a time. That mint is a primary sale.
 * A collection mint is random. The cover stays blank until the piece is in the buyer's wallet.
 * The page never sees a seed or the escrow key.
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { rateLimitOrReject } = require('./lib/rate-limit')
const { loadState: loadAccounts } = require('./lib/account-store')
const { readSession } = require('./lib/account-session')
const { withBoard } = require('./lib/ethscriptions-store')
const chain = require('./lib/ethscriptions-chain')
const phunkMerkle = require('./lib/phunk-merkle')
const diagnostics = require('./lib/ethscriptions-diagnostics')
const cleanPopVerify = require('./lib/clean-pop-verify')

const HOLD_MS = 15 * 60 * 1000
const COVER = '/assets/images/ethscription-cover.png'
const PHUNK_ID = '45b48eca99f938b7'
const PHUNK_LIVE = process.env.PHUNK_MINT_ENABLED === 'true'
const PHUNK_CREATOR = '0x915A3D363D0a4e4470B531f008F5142c540E5417'
const PHUNK_FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C'

function phunkMinterInfo() {
  return phunkMerkle.info()
}
function defaultPhunkCollection() {
  const info = phunkMinterInfo()
  return { id: PHUNK_ID, name: 'TRIXMOJI PHUNKS', symbol: 'PHUNK', supply: 10000,
    description: 'Select a cover. Artwork reveals on this site after a confirmed direct mint.',
    mintPriceWei: info.priceWei, mintPriceEth: chain.weiToEth(info.priceWei), maxPerWallet: 20,
    royalty: 'standard', creator: info.creator, creatorUid: '', state: 'open' }
}
const FEES = {
  primary: { siteBps: 50, creatorBps: 0, added: false },
  standard: { siteBps: 0, creatorBps: 250, added: false },
  premium: { siteBps: 50, creatorBps: 500, added: true }
}

function feeSchedule() {
  return {
    open: true,
    site: '0%',
    primary: '0.5%',
    standard: '0%',
    premium: '0.5%',
    creatorStandard: '2.5%',
    creatorPremium: '5%',
    sellerPrimary: '99.5%',
    sellerStandard: '97.5%',
    sellerPremium: '100%',
    buyerStandard: '100%',
    buyerPremium: '105.5%'
  }
}

function splitWei(priceWei, kind) {
  const spec = FEES[kind] || FEES.standard
  const ask = BigInt(priceWei)
  const site = (ask * BigInt(spec.siteBps)) / 10000n
  const royalty = (ask * BigInt(spec.creatorBps)) / 10000n
  const seller = spec.added ? ask : ask - site - royalty
  const buyer = spec.added ? ask + royalty + site : ask
  return {
    kind: FEES[kind] ? kind : 'standard',
    siteWei: site.toString(),
    royaltyWei: royalty.toString(),
    sellerWei: seller.toString(),
    buyerWei: buyer.toString()
  }
}

function storedResaleMode(board, ethscriptionId) {
  const list = (board && board.listings) || []
  for (let i = 0; i < list.length; i++) {
    if (list[i].ethscriptionId === ethscriptionId && (list[i].resaleMode === 'premium' || list[i].resaleMode === 'standard')) {
      return list[i].resaleMode
    }
  }
  return ''
}

function resolveResaleMode(board, created, seller, body, drop) {
  if (drop) return drop.royalty === 'premium' ? 'premium' : 'standard'
  const stored = storedResaleMode(board, created.id)
  if (stored) return stored
  const wantPremium = body.premium === true || body.lane === 'premium'
  if (wantPremium && chain.same(seller, created.creator)) return 'premium'
  return 'standard'
}

function saleKind(board, created, seller, wantPremium) {
  const soldHere = (board.listings || []).some(function (item) {
    return item.ethscriptionId === created.id && item.state === 'settled'
  })
  if (chain.same(seller, created.creator) && !soldHere) return 'primary'
  return wantPremium ? 'premium' : 'standard'
}

function shares(row) {
  if (row && row.sellerWei) {
    return {
      sellerWei: String(row.sellerWei),
      royaltyWei: String(row.royaltyWei || '0'),
      creator: row.creator || row.seller
    }
  }
  return { sellerWei: String(row.priceWei), royaltyWei: '0', creator: row.seller }
}

function txFree(state, hash, listingId) {
  const key = String(hash || '').toLowerCase()
  return !(state.usedTx[key] && state.usedTx[key] !== listingId)
}

function fail(res, code, error) {
  res.status(code).json({ ok: false, error: error })
}

function ethWallet(user) {
  const rows = (user && user.wallets) || []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].chain === 'ethereum' && rows[i].address) return rows[i].address
  }
  return ''
}

async function currentUser(req) {
  const session = readSession(req)
  if (!session) return null
  const state = await loadAccounts()
  if (!state || !state.users) return null
  return state.users[session.uid] || null
}

function shortAddr(addr) {
  const s = String(addr || '')
  if (s.length < 12) return s
  return s.slice(0, 6) + '…' + s.slice(-4)
}

function findRow(state, id) {
  const list = state.listings || []
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i]
  }
  return null
}

function revealed(row) {
  return !row.collectionId || row.state === 'settled'
}

function publicRow(row) {
  const show = revealed(row)
  return {
    id: row.id,
    ethscriptionId: show ? row.ethscriptionId : '',
    priceEth: row.priceEth,
    priceWei: row.priceWei,
    buyerWei: row.buyerWei || row.priceWei,
    buyerEth: chain.weiToEth(row.buyerWei || row.priceWei),
    kind: row.kind || 'primary',
    sellerEth: row.sellerWei ? chain.weiToEth(row.sellerWei) : row.priceEth,
    royaltyEth: row.royaltyWei ? chain.weiToEth(row.royaltyWei) : '0',
    siteEth: row.siteWei ? chain.weiToEth(row.siteWei) : '0',
    seller: shortAddr(row.seller),
    creator: shortAddr(row.creator || ''),
    buyer: row.buyer ? shortAddr(row.buyer) : '',
    state: row.state,
    mime: show ? (row.mime || '') : '',
    preview: show ? (row.preview || '') : '',
    collectionId: row.collectionId || '',
    tokenNo: show ? Number(row.tokenNo || 0) : 0,
    at: row.at
  }
}

function findCollection(state, id) {
  const list = (state && state.collections) || []
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i]
  }
  return null
}

function collectionDrop(board, ethscriptionId) {
  const list = (board && board.listings) || []
  for (let i = 0; i < list.length; i++) {
    if (list[i].ethscriptionId === ethscriptionId && list[i].collectionId) {
      return findCollection(board, list[i].collectionId)
    }
  }
  return null
}

function intIn(raw, min, max) {
  const s = String(raw == null ? '' : raw).trim()
  if (!/^\d+$/.test(s)) return 0
  const n = Number(s)
  if (!Number.isSafeInteger(n) || n < min || n > max) return 0
  return n
}

function cleanCollection(body) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ')
  if (name.length < 1 || name.length > 32) throw new Error('Collection name has to be 1 to 32 characters.')
  if (/[\u0000-\u001f]/.test(name)) throw new Error('Collection name has control characters.')
  const symbol = String(body.symbol || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) throw new Error('Symbol has to be 1 to 10 letters or numbers.')
  const description = String(body.description || '').trim()
  if (description.length > 280) throw new Error('Description has to be 280 characters or less.')
  const supply = intIn(body.supply, 1, 10000)
  if (!supply) throw new Error('Supply has to be from 1 to 10000.')
  const maxPerWallet = intIn(body.maxPerWallet, 1, 20)
  if (!maxPerWallet) throw new Error('Max per wallet has to be from 1 to 20.')
  if (maxPerWallet > supply) throw new Error('Max per wallet cannot be higher than the supply.')
  const priceWei = chain.parseEthToWei(body.priceEth)
  if (!priceWei) throw new Error('Mint price has to be from 0.0002 ETH to 100 ETH.')
  const royalty = body.lane === 'premium' || body.royalty === 'premium' ? 'premium' : 'standard'
  return {
    name: name,
    symbol: symbol,
    description: description,
    supply: supply,
    maxPerWallet: maxPerWallet,
    priceWei: priceWei,
    mintPriceEth: chain.weiToEth(priceWei),
    royalty: royalty
  }
}

function liveSlots(listings, drop) {
  const supply = Number(drop.supply) || 0
  const chars = new Array(supply)
  for (let i = 0; i < supply; i++) chars[i] = '0'
  ;(listings || []).forEach(function (item) {
    if (item.collectionId !== drop.id) return
    if (item.state !== 'open' && item.state !== 'held' && item.state !== 'paid' && item.state !== 'settled') return
    const n = Number(item.tokenNo)
    if (n >= 0 && n < supply) chars[n] = '1'
  })
  return chars.join('')
}

function livePreviews(listings, collectionId) {
  const out = {}
  ;(listings || []).forEach(function (item) {
    if (item.collectionId === collectionId && item.state === 'settled' && item.preview) out[String(item.tokenNo)] = item.preview
  })
  return out
}

function dropStats(listings, collectionId) {
  const rows = (listings || []).filter(function (item) { return item.collectionId === collectionId })
  return {
    deposited: rows.filter(function (item) {
      return item.state === 'open' || item.state === 'held' || item.state === 'paid' || item.state === 'settled'
    }).length,
    minted: rows.filter(function (item) { return item.state === 'settled' }).length,
    left: rows.filter(function (item) { return item.state === 'open' || item.state === 'held' }).length
  }
}

function mintCount(listings, collectionId, buyer, exceptId) {
  return (listings || []).filter(function (item) {
    return item.collectionId === collectionId && item.id !== exceptId && chain.same(item.buyer, buyer) && (item.state === 'held' || item.state === 'paid' || item.state === 'settled')
  }).length
}

function nextTokenNo(listings, collectionId) {
  let n = 0
  ;(listings || []).forEach(function (item) {
    if (item.collectionId === collectionId && Number(item.tokenNo) > n) n = Number(item.tokenNo)
  })
  return n + 1
}

function hasMint(listings, collectionId, user) {
  const rows = listings || []
  const now = Date.now()
  if (user) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.collectionId === collectionId && row.state === 'held' && row.holdUid === user.uid && Number(row.holdUntil || 0) > now) return row
    }
  }
  for (let j = 0; j < rows.length; j++) {
    if (rows[j].collectionId === collectionId && rows[j].state === 'open') return rows[j]
  }
  return null
}

function pickMintRow(listings, collectionId, user, buyer) {
  const rows = listings || []
  const now = Date.now()
  rows.forEach(function (row) { clearHold(row, now) })
  if (user) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].collectionId === collectionId && rows[i].state === 'held' && rows[i].holdUid === user.uid) return rows[i]
    }
  }
  const open = []
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    if (row.collectionId !== collectionId || row.state !== 'open') continue
    if (buyer && chain.same(row.seller, buyer)) continue
    open.push(row)
  }
  if (!open.length) return null
  return open[crypto.randomInt(open.length)]
}

function activityRows(state) {
  return (state.listings || []).filter(function (row) {
    if (row.state === 'returned') return false
    if (row.collectionId && row.state !== 'settled') return false
    return row.state === 'open' || row.state === 'paid' || row.state === 'settled' || row.state === 'refunded'
  }).slice(-40).reverse().map(publicRow)
}

function myDesk(state, user, wallet) {
  const empty = { collections: [], owned: [], incoming: [], selling: [] }
  if (!user) return empty
  const listings = state.listings || []
  const owned = []
  const incoming = []
  const selling = []
  listings.forEach(function (row) {
    const buyer = row.buyerUid === user.uid || (wallet && chain.same(row.buyer, wallet))
    const seller = row.sellerUid === user.uid || (wallet && chain.same(row.seller, wallet))
    if (row.state === 'settled' && buyer) owned.push(publicRow(row))
    if ((row.state === 'paid' || row.state === 'held') && buyer) incoming.push(publicRow(row))
    if (seller && row.state !== 'settled' && row.state !== 'returned' && row.state !== 'refunded') selling.push(publicRow(row))
  })
  return {
    collections: (state.collections || []).filter(function (drop) {
      return drop.creatorUid === user.uid
    }).map(function (drop) {
      return publicCollection(drop, listings, user)
    }),
    owned: owned.slice(-40).reverse(),
    incoming: incoming.slice(-40).reverse(),
    selling: selling.slice(-40).reverse()
  }
}

function publicCollection(drop, listings, user) {
  const stats = dropStats(listings, drop.id)
  const live = drop.id === PHUNK_ID
  const phunkOff = drop.id === PHUNK_ID && !PHUNK_LIVE
  const slots = live ? liveSlots(listings, drop) : ''
  if (live) {
    let taken = 0
    for (let i = 0; i < slots.length; i++) if (slots.charAt(i) === '1') taken += 1
    stats.deposited = Number(drop.supply) || 0
    stats.minted = (listings || []).filter(function (item) {
      return item.collectionId === drop.id && item.state === 'settled'
    }).length
    stats.left = Math.max(0, stats.deposited - taken)
  }
  const coming = hasMint(listings, drop.id, user)
  const revealedRows = []
  ;(listings || []).forEach(function (item) {
    if (item.collectionId === drop.id && item.state === 'settled') revealedRows.push(item)
  })
  return {
    id: drop.id,
    name: drop.name,
    symbol: drop.symbol,
    description: drop.description || '',
    supply: drop.supply,
    deposited: stats.deposited,
    minted: stats.minted,
    left: stats.left,
    mintPriceEth: drop.mintPriceEth,
    mintPriceWei: drop.mintPriceWei,
    maxPerWallet: drop.maxPerWallet,
    royalty: drop.royalty,
    creator: shortAddr(drop.creator),
    state: phunkOff ? 'closed' : drop.state,
    mine: !!(user && drop.creatorUid === user.uid),
    preview: COVER,
    live: live,
    slots: slots,
    next: phunkOff ? null : (coming ? { state: coming.state === 'held' ? 'held' : 'open' } : (live && stats.left > 0 ? { state: 'open' } : null)),
    previews: live ? livePreviews(listings, drop.id) : {},
    revealed: revealedRows.slice(-12).reverse().map(publicRow),
    at: drop.at
  }
}

function clearHold(row, now) {
  if (row.state === 'held' && Number(row.holdUntil || 0) <= now) {
    row.state = 'open'
    row.holdUid = ''
    row.holdUntil = 0
    // Retain the original buyer for reconciliation of a late-confirming mint.
    if (row.collectionId !== PHUNK_ID) row.buyer = ''
  }
}

function claimTx(state, hash, listingId) {
  const key = String(hash || '').toLowerCase()
  if (state.usedTx[key] && state.usedTx[key] !== listingId) return false
  state.usedTx[key] = listingId
  return true
}

async function walletGallery(state, wallet, page) {
  // These are public, settled purchase receipts, not account authentication.
  // Never disclose pending reservations or claim purchase history is current ownership.
  const receipts = state.listings.filter(function (row) {
    return row.collectionId === PHUNK_ID && row.state === 'settled' && chain.same(row.buyer, wallet)
  }).slice().reverse()
  const rows = receipts.slice(page * 20, page * 20 + 20)
  const items = await Promise.all(rows.map(async function (row) {
    const item = publicRow(row)
    try {
      const check = await chain.indexedOwnership(row.ethscriptionId, wallet)
      item.ownership = check.owned ? 'owned' : 'transferred'
      item.currentOwner = check.currentOwner
    } catch (_) {
      item.ownership = 'unavailable'
      item.currentOwner = ''
    }
    return item
  }))
  return { address: wallet, page, total: receipts.length, hasMore: (page + 1) * 20 < receipts.length, items,
    note: 'Purchase history from this mint site. Current ownership is checked against the Ethscriptions indexer. Incoming transfers and purchases on other sites are not included.' }
}

async function handler(req, res) {
  if (req.method === 'GET') {
    if (rateLimitOrReject(req, res, { prefix: 'es-read', perMinute: 60, perDay: 4000 })) return
    let stage = 'account-session'
    try {
      if (req.query && req.query.wallet !== undefined) {
        const wallet = String(req.query.wallet).trim()
        const page = Number(req.query.page || 0)
        if (!chain.isAddr(wallet) || !Number.isSafeInteger(page) || page < 0 || page > 500) return fail(res, 400, 'Enter a valid Ethereum wallet and page.')
        stage = 'wallet-gallery-storage'
        const state = await withBoard(async function () { return null })
        stage = 'wallet-gallery-indexer'
        return res.status(200).json({ ok: true, gallery: await walletGallery(state, wallet, page) })
      }
      const user = await currentUser(req)
      stage = 'board-storage'
      const state = await withBoard(async function (board) {
        const now = Date.now()
        let changed = false
        board.listings.forEach(function (row) {
          const before = row.state
          clearHold(row, now)
          if (row.state !== before) changed = true
        })
        return changed ? board : null
      })
      stage = 'minter-manifest'
      const minter = phunkMinterInfo()
      stage = 'board-response'
      const wallet = ethWallet(user)
      return res.status(200).json({
        ok: true,
        name: 'ETHSCRIPTIONS',
        fee: feeSchedule(),
        escrow: chain.escrowEth(),
        phunkMinter: minter.address,
        walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || '',
        me: user ? { uid: user.uid, wallet: wallet } : null,
        collections: (findCollection(state, PHUNK_ID) ? state.collections : state.collections.concat([defaultPhunkCollection()])).slice(-40).reverse().map(function (drop) {
          return publicCollection(drop, state.listings, user)
        }),
        listings: state.listings.filter(function (row) {
          return row.state !== 'returned' && !row.collectionId
        }).slice(-80).reverse().map(publicRow),
        activity: activityRows(state),
        mine: myDesk(state, user, wallet)
      })
    } catch (e) {
      const diagnostic = diagnostics.report(stage, e)
      return res.status(503).json({ ok: false, error: 'The ethscriptions board is not available on this server.', diagnostic })
    }
  }

  if (req.method !== 'POST') return fail(res, 405, 'GET or POST')
  if (rateLimitOrReject(req, res, { prefix: 'es-post', perMinute: 80, perDay: 800 })) return
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const action = String(body.action || '')

  try {
    if (action === 'cleanPopVerify') return res.status(200).json(await cleanPopVerify.verify(chain, String(body.hash || ''), String(body.buyer || ''), Number(body.tokenNo)))
    if (action === 'cleanPopUnique') {
      const sha = String(body.sha || '')
      if (!/^[a-f0-9]{64}$/i.test(sha)) throw new Error('Invalid artwork hash.')
      await chain.requireUniqueContent(sha)
      return res.status(200).json({ ok: true })
    }
    if (action === 'list') return await postList(req, res, body)
    if (action === 'createCollection') return await postCreate(req, res, body)
    if (action === 'deposit') return await postDeposit(req, res, body)
    if (action === 'closeCollection') return await postClose(req, res, body)
    if (action === 'hold') return await postHold(req, res, body)
    if (action === 'pay') return await postPay(req, res, body)
    if (action === 'release') return await postRelease(req, res, body)
    if (action === 'refund') return await postRefund(req, res, body)
    if (action === 'pull') return await postPull(req, res, body)
    if (action === 'phunkHold') return await postPhunkHold(req, res, body)
    if (action === 'phunkPay') return fail(res, 410, 'Separate escrow payments are no longer used for Phunks. Use the mint contract checkout.')
    if (action === 'phunkReveal') return await postPhunkReveal(req, res, body)
    return fail(res, 400, 'Unknown action')
  } catch (e) {
    return fail(res, 400, String(e && e.message ? e.message : 'That did not check out.'))
  }
}

async function postList(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in on the account page before you list.')
  const seller = ethWallet(user)
  if (!chain.isAddr(seller)) return fail(res, 400, 'Add an Ethereum wallet to your DOSWAPZ account. The lock transaction has to come from that wallet.')
  const id = String(body.ethscriptionId || '').trim()
  const priceWei = chain.parseEthToWei(body.priceEth)
  if (!priceWei) return fail(res, 400, 'Price has to be from 0.0002 ETH to 100 ETH.')
  const created = await chain.readCreation(id)
  const lock = await chain.readTransfer(body.lockTx)
  const escrow = chain.escrowEth()
  if (!chain.same(lock.id, created.id)) return fail(res, 400, 'That lock transaction is for a different ethscription.')
  if (!chain.same(lock.to, escrow)) return fail(res, 400, 'The ethscription was not sent to the escrow address.')
  if (lock.value !== '0') return fail(res, 400, 'The lock transfer has to be 0 ETH.')
  if (!chain.same(lock.from, seller)) return fail(res, 400, 'The lock transaction was not sent by your Ethereum wallet.')
  const row = {
    id: crypto.randomBytes(8).toString('hex'),
    ethscriptionId: created.id,
    priceEth: chain.weiToEth(priceWei),
    priceWei: priceWei,
    seller: seller,
    sellerUid: user.uid,
    buyer: '',
    buyerUid: '',
    state: 'open',
    mime: created.mime || '',
    preview: created.contentUri && created.contentUri.indexOf('data:image/') === 0 ? created.contentUri : '',
    lockTx: lock.hash,
    payTx: '',
    deliverTx: '',
    payoutTx: '',
    creatorTx: '',
    holdUid: '',
    holdUntil: 0,
    at: new Date().toISOString()
  }
  let note = ''
  const state = await withBoard(async function (board) {
    const open = board.listings.some(function (item) {
      return item.ethscriptionId === created.id && item.state !== 'returned' && item.state !== 'settled' && item.state !== 'refunded'
    })
    if (open) {
      const err = new Error('That ethscription is already listed.')
      throw err
    }
    const drop = collectionDrop(board, created.id)
    const wantPremium = body.premium === true || body.lane === 'premium'
    const isPrimary = saleKind(board, created, seller, false) === 'primary'
    const resaleMode = resolveResaleMode(board, created, seller, body, drop)
    const kind = isPrimary ? 'primary' : resaleMode
    const parts = splitWei(priceWei, kind)
    if (isPrimary && resaleMode === 'premium') {
      note = 'This mint keeps 0.5% in escrow. Later resales pay you 5% and DOSWAPZ 0.5% on top of the ask.'
    } else if (isPrimary) {
      note = 'This mint keeps 0.5% in escrow. A later resale builds 2.5% for you into the price. DOSWAPZ takes 0.'
    } else if (wantPremium && resaleMode !== 'premium') {
      note = 'Only the creator can choose 5%. This price includes 2.5% for the creator. The seller receives 97.5%. DOSWAPZ takes 0.'
    } else if (!wantPremium && resaleMode === 'premium') {
      note = 'The creator chose 5%. The seller still receives the ask. The buyer pays the 5% and the 0.5% site fee.'
    }
    row.kind = parts.kind
    row.resaleMode = resaleMode
    row.creator = created.creator
    row.siteWei = parts.siteWei
    row.royaltyWei = parts.royaltyWei
    row.sellerWei = parts.sellerWei
    row.buyerWei = parts.buyerWei
    if (!claimTx(board, lock.hash, row.id)) {
      const err = new Error('That lock transaction was already used.')
      throw err
    }
    board.listings.push(row)
    return board
  })
  const saved = findRow(state, row.id)
  return res.status(200).json({ ok: true, listing: publicRow(saved), note: note })
}

async function postCreate(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in on the account page before you launch a collection.')
  const creator = ethWallet(user)
  if (!chain.isAddr(creator)) return fail(res, 400, 'Add an Ethereum wallet to your DOSWAPZ account.')
  const fields = cleanCollection(body)
  const drop = {
    id: crypto.randomBytes(8).toString('hex'),
    name: fields.name,
    symbol: fields.symbol,
    description: fields.description,
    supply: fields.supply,
    mintPriceEth: fields.mintPriceEth,
    mintPriceWei: fields.priceWei,
    maxPerWallet: fields.maxPerWallet,
    royalty: fields.royalty,
    creator: creator,
    creatorUid: user.uid,
    state: 'open',
    at: new Date().toISOString()
  }
  const state = await withBoard(async function (board) {
    if (!Array.isArray(board.collections)) board.collections = []
    const same = board.collections.some(function (item) {
      return item.creatorUid === user.uid && item.symbol === drop.symbol
    })
    if (same) throw new Error('You already used that symbol.')
    const openCount = board.collections.filter(function (item) {
      return item.creatorUid === user.uid && item.state === 'open'
    }).length
    if (openCount >= 20) throw new Error('Close a collection before you launch another. The cap is 20 open drops.')
    board.collections.push(drop)
    return board
  })
  return res.status(200).json({ ok: true, collection: publicCollection(findCollection(state, drop.id), state.listings, user) })
}

async function postDeposit(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in before you add a piece.')
  const seller = ethWallet(user)
  if (!chain.isAddr(seller)) return fail(res, 400, 'Add an Ethereum wallet to your DOSWAPZ account. The lock transaction has to come from that wallet.')
  const created = await chain.readCreation(body.ethscriptionId)
  const lock = await chain.readTransfer(body.lockTx)
  const escrow = chain.escrowEth()
  if (!chain.same(lock.id, created.id)) return fail(res, 400, 'That lock transaction is for a different ethscription.')
  if (!chain.same(lock.to, escrow)) return fail(res, 400, 'The ethscription was not sent to the escrow address.')
  if (lock.value !== '0') return fail(res, 400, 'The lock transfer has to be 0 ETH.')
  if (!chain.same(lock.from, seller)) return fail(res, 400, 'The lock transaction was not sent by your Ethereum wallet.')
  if (!chain.same(created.creator, seller)) return fail(res, 400, 'A drop only accepts ethscriptions created by your wallet.')
  const row = {
    id: crypto.randomBytes(8).toString('hex'),
    ethscriptionId: created.id,
    seller: seller,
    sellerUid: user.uid,
    buyer: '',
    buyerUid: '',
    state: 'open',
    mime: created.mime || '',
    preview: created.contentUri && created.contentUri.indexOf('data:image/') === 0 ? created.contentUri : '',
    lockTx: lock.hash,
    payTx: '',
    deliverTx: '',
    payoutTx: '',
    creatorTx: '',
    holdUid: '',
    holdUntil: 0,
    at: new Date().toISOString()
  }
  const state = await withBoard(async function (board) {
    const drop = findCollection(board, String(body.collectionId || ''))
    if (!drop || drop.creatorUid !== user.uid) throw new Error('That collection is not yours.')
    if (drop.state !== 'open') throw new Error('That collection is closed to new pieces.')
    if (!chain.same(drop.creator, seller)) throw new Error('The collection wallet has to lock the piece.')
    if (saleKind(board, created, seller, false) !== 'primary') throw new Error('That ethscription was already sold. Resale it on the board.')
    const open = board.listings.some(function (item) {
      return item.ethscriptionId === created.id && item.state !== 'returned' && item.state !== 'settled' && item.state !== 'refunded'
    })
    if (open) throw new Error('That ethscription is already listed.')
    const stats = dropStats(board.listings, drop.id)
    if (stats.deposited >= drop.supply) throw new Error('That collection is already full.')
    const parts = splitWei(drop.mintPriceWei, 'primary')
    row.collectionId = drop.id
    row.tokenNo = nextTokenNo(board.listings, drop.id)
    row.priceEth = drop.mintPriceEth
    row.priceWei = drop.mintPriceWei
    row.kind = 'primary'
    row.resaleMode = drop.royalty === 'premium' ? 'premium' : 'standard'
    row.creator = created.creator
    row.siteWei = parts.siteWei
    row.royaltyWei = parts.royaltyWei
    row.sellerWei = parts.sellerWei
    row.buyerWei = parts.buyerWei
    if (!claimTx(board, lock.hash, row.id)) throw new Error('That lock transaction was already used.')
    board.listings.push(row)
    return board
  })
  return res.status(200).json({ ok: true, listing: publicRow(findRow(state, row.id)), collection: publicCollection(findCollection(state, row.collectionId), state.listings, user) })
}

async function postClose(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to close a collection.')
  const id = String(body.id || '')
  const state = await withBoard(async function (board) {
    const drop = findCollection(board, id)
    if (!drop || drop.creatorUid !== user.uid) throw new Error('That collection is not yours.')
    drop.state = 'closed'
    return board
  })
  return res.status(200).json({ ok: true, collection: publicCollection(findCollection(state, id), state.listings, user) })
}

async function postHold(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in before you buy.')
  const buyer = ethWallet(user)
  if (!chain.isAddr(buyer)) return fail(res, 400, 'Add an Ethereum wallet to your DOSWAPZ account.')
  const collectionId = String(body.collectionId || '')
  if (collectionId) return holdRandom(res, user, buyer, collectionId)
  const id = String(body.id || '')
  const now = Date.now()
  const state = await withBoard(async function (board) {
    const row = findRow(board, id)
    if (!row) throw new Error('That listing is not on the board.')
    if (row.collectionId) throw new Error('A collection mint is random. Open the collection and click Mint.')
    clearHold(row, now)
    if (row.state !== 'open' && !(row.state === 'held' && row.holdUid === user.uid)) {
      throw new Error('That listing is not open.')
    }
    if (chain.same(row.seller, buyer)) throw new Error('You cannot buy your own listing.')
    if (row.collectionId) {
      const drop = findCollection(board, row.collectionId)
      if (!drop) throw new Error('That collection is not on the launchpad.')
      if (mintCount(board.listings, drop.id, buyer, row.id) >= Number(drop.maxPerWallet || 1)) {
        throw new Error('That wallet is at the mint limit for this collection.')
      }
    }
    row.state = 'held'
    row.holdUid = user.uid
    row.buyer = buyer
    row.buyerUid = user.uid
    row.holdUntil = now + HOLD_MS
    return board
  })
  return res.status(200).json({ ok: true, listing: publicRow(findRow(state, id)), escrow: chain.escrowEth() })
}

async function holdRandom(res, user, buyer, collectionId) {
  let heldId = ''
  const state = await withBoard(async function (board) {
    if (collectionId === PHUNK_ID && !PHUNK_LIVE) throw new Error('This mint is offline.')
    const drop = findCollection(board, collectionId)
    if (!drop) throw new Error('That collection is not on the launchpad.')
    const row = pickMintRow(board.listings, collectionId, user, buyer)
    if (!row) throw new Error('No piece is ready. The creator still has to lock one into escrow.')
    if (chain.same(row.seller, buyer)) throw new Error('You cannot mint your own piece.')
    if (row.state === 'open' && mintCount(board.listings, drop.id, buyer, row.id) >= Number(drop.maxPerWallet || 1)) {
      throw new Error('That wallet is at the mint limit for this collection.')
    }
    if (row.state === 'open') {
      row.state = 'held'
      row.holdUid = user.uid
      row.buyer = buyer
      row.buyerUid = user.uid
      row.holdUntil = Date.now() + HOLD_MS
    }
    heldId = row.id
    return board
  })
  return res.status(200).json({ ok: true, listing: publicRow(findRow(state, heldId)), escrow: chain.escrowEth() })
}

async function postPay(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in before you buy.')
  const buyer = ethWallet(user)
  const id = String(body.id || '')
  const pay = await chain.readPayment(body.payTx)
  const escrow = chain.escrowEth()
  if (!chain.same(pay.to, escrow)) throw new Error('That ETH was not sent to the escrow address.')
  if (!chain.same(pay.from, buyer)) throw new Error('That payment was not sent by your Ethereum wallet.')
  const state = await withBoard(async function (board) {
    const row = findRow(board, id)
    if (!row) throw new Error('That listing is not on the board.')
    clearHold(row, Date.now())
    if (row.state !== 'held' || row.buyerUid !== user.uid) throw new Error('Hold the listing, then pay within 15 minutes.')
    if (pay.value !== String(row.buyerWei || row.priceWei)) throw new Error('The payment is not the exact amount the buyer owes.')
    if (!claimTx(board, pay.hash, row.id)) throw new Error('That payment was already used.')
    row.state = 'paid'
    row.payTx = pay.hash
    row.holdUntil = 0
    return board
  })
  return res.status(200).json({ ok: true, listing: publicRow(findRow(state, id)) })
}

async function postRelease(req, res, body) {
  const id = String(body.id || '')
  const deliver = await chain.readTransfer(body.deliverTx)
  const payout = await chain.readPayment(body.payoutTx)
  let creatorPay = null
  if (body.creatorTx) creatorPay = await chain.readPayment(body.creatorTx)
  const escrow = chain.escrowEth()
  const state = await withBoard(async function (board) {
    const row = findRow(board, id)
    if (!row || (row.state !== 'paid' && row.state !== 'disputed')) throw new Error('That sale is not waiting on a release.')
    const share = shares(row)
    const royalty = BigInt(share.royaltyWei)
    const sellerDue = BigInt(share.sellerWei)
    const combined = chain.same(share.creator, row.seller) || royalty === 0n
    if (!chain.same(deliver.id, row.ethscriptionId)) throw new Error('That transfer is a different ethscription.')
    if (!chain.same(deliver.from, escrow) || !chain.same(deliver.to, row.buyer)) throw new Error('The ethscription was not sent from escrow to the buyer.')
    if (deliver.value !== '0') throw new Error('The ethscription transfer has to be 0 ETH.')
    if (!chain.same(payout.from, escrow) || !chain.same(payout.to, row.seller)) throw new Error('The seller payment was not sent from escrow to the seller.')
    if (combined) {
      if (payout.value !== (sellerDue + royalty).toString()) throw new Error('The seller was not paid the seller share.')
      if (creatorPay) throw new Error('That sale pays the creator share inside the seller payment.')
    } else {
      if (!creatorPay) throw new Error('This resale also pays the creator.')
      if (payout.value !== sellerDue.toString()) throw new Error('The seller was not paid the ask.')
      if (!chain.same(creatorPay.from, escrow) || !chain.same(creatorPay.to, share.creator)) throw new Error('The creator royalty was not sent from escrow to the creator.')
      if (creatorPay.value !== royalty.toString()) throw new Error('The creator royalty is the wrong amount.')
      if (chain.same(creatorPay.hash, payout.hash) || chain.same(creatorPay.hash, deliver.hash)) throw new Error('The creator royalty has to be its own transaction.')
    }
    const hashes = [deliver.hash, payout.hash]
    if (creatorPay) hashes.push(creatorPay.hash)
    for (let i = 0; i < hashes.length; i++) {
      if (!txFree(board, hashes[i], row.id)) throw new Error('One of those transactions was already used.')
    }
    for (let j = 0; j < hashes.length; j++) claimTx(board, hashes[j], row.id)
    row.state = 'settled'
    row.deliverTx = deliver.hash
    row.payoutTx = payout.hash
    if (creatorPay) row.creatorTx = creatorPay.hash
    return board
  })
  return res.status(200).json({ ok: true, listing: publicRow(findRow(state, id)) })
}

async function postRefund(req, res, body) {
  const id = String(body.id || '')
  const back = await chain.readTransfer(body.returnTx)
  const refund = await chain.readPayment(body.refundTx)
  const escrow = chain.escrowEth()
  const state = await withBoard(async function (board) {
    const row = findRow(board, id)
    if (!row || row.state !== 'paid') throw new Error('That sale is not waiting on a refund.')
    if (!chain.same(back.id, row.ethscriptionId)) throw new Error('That transfer is a different ethscription.')
    if (!chain.same(back.from, escrow) || !chain.same(back.to, row.seller)) throw new Error('The ethscription was not sent back to the seller.')
    if (!chain.same(refund.from, escrow) || !chain.same(refund.to, row.buyer)) throw new Error('The ETH was not sent back to the buyer.')
    if (refund.value !== String(row.buyerWei || row.priceWei)) throw new Error('The refund is not the full amount the buyer paid.')
    if (!claimTx(board, back.hash, row.id) || !claimTx(board, refund.hash, row.id)) throw new Error('One of those transactions was already used.')
    row.state = 'refunded'
    return board
  })
  return res.status(200).json({ ok: true, listing: publicRow(findRow(state, id)) })
}

async function postPull(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to pull a listing.')
  const id = String(body.id || '')
  const back = await chain.readTransfer(body.returnTx)
  const escrow = chain.escrowEth()
  const state = await withBoard(async function (board) {
    const row = findRow(board, id)
    if (!row || row.sellerUid !== user.uid) throw new Error('That listing is not yours.')
    if (row.state !== 'open') throw new Error('A listing can be pulled only before anyone pays.')
    if (!chain.same(back.id, row.ethscriptionId)) throw new Error('That transfer is a different ethscription.')
    if (!chain.same(back.from, escrow) || !chain.same(back.to, row.seller)) throw new Error('The ethscription was not sent back to you from escrow.')
    if (!claimTx(board, back.hash, row.id)) throw new Error('That return transaction was already used.')
    row.state = 'returned'
    return board
  })
  return res.status(200).json({ ok: true, listing: publicRow(findRow(state, id)) })
}

handler.feeSchedule = feeSchedule
handler.splitWei = splitWei
handler.saleKind = saleKind
handler.cleanCollection = cleanCollection
handler.dropStats = dropStats
handler.mintCount = mintCount
handler.publicRow = publicRow
handler.pickMintRow = pickMintRow
function phunkBuyer(value) {
  const buyer = String(value || '').trim()
  if (!chain.isAddr(buyer)) throw new Error('Connect an Ethereum wallet. A DOSWAPZ login is not required for this mint.')
  return buyer
}

function phunkTokens(value) {
  const raw = Array.isArray(value) ? value : []
  const seen = {}
  const out = []
  raw.forEach(function (item) {
    const n = Number(item)
    if (!Number.isInteger(n) || n < 0 || n > 9999 || seen[n]) return
    seen[n] = true
    out.push(n)
  })
  out.sort(function (a, b) { return a - b })
  if (!out.length || out.length > 20) throw new Error('Select up to 20 covers.')
  return out
}

function phunkActive(row, now) {
  if (!row) return false
  if (row.state === 'paid' || row.state === 'settled') return true
  return row.state === 'held' && Number(row.holdUntil || 0) > now
}

function phunkTaken(listings, tokenNo, now) {
  return (listings || []).find(function (row) {
    return row.collectionId === PHUNK_ID && Number(row.tokenNo) === tokenNo && phunkActive(row, now)
  }) || null
}

function phunkCount(listings, buyer, now) {
  return (listings || []).filter(function (row) {
    return row.collectionId === PHUNK_ID && chain.same(row.buyer, buyer) && phunkActive(row, now)
  }).length
}

async function phunkPng(tokenNo) {
  const rel = '/assets/ethscriptions/phunks/img/' + tokenNo + '.png'
  const local = path.join(__dirname, '..', 'assets', 'ethscriptions', 'phunks', 'img', tokenNo + '.png')
  if (fs.existsSync(local)) return { png: await fs.promises.readFile(local), preview: rel }
  const base = String(process.env.URL || 'https://doswapz.com').replace(/\/$/, '')
  const response = await fetch(base + rel, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('That phunk picture is not on the site yet.')
  return { png: Buffer.from(await response.arrayBuffer()), preview: rel }
}

function phunkCalldata(png) {
  const uri = Buffer.from('data:image/png;base64,' + png.toString('base64'), 'utf8')
  const gz = zlib.gzipSync(uri)
  const body = gz.length < uri.length && gz.length <= 110000 ? gz : uri
  if (body.length > 110000) throw new Error('That picture is too big to write on Ethereum.')
  return { data: '0x' + body.toString('hex'), sha: crypto.createHash('sha256').update(uri).digest('hex'), uri: uri.toString('utf8') }
}

function decodePhunkInput(input) {
  const hex = String(input || '')
  if (!/^0x[a-f0-9]*$/i.test(hex) || hex.length < 4) throw new Error('That transaction has no picture.')
  let raw = Buffer.from(hex.slice(2), 'hex')
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
    const opened = zlib.gunzipSync(raw)
    if (opened.length > raw.length * 10) throw new Error('That picture data is not valid.')
    raw = opened
  }
  const head = raw.slice(0, 15).toString('utf8')
  if (head.indexOf('data:image/') !== 0) throw new Error('That transaction is not the phunk picture.')
  return crypto.createHash('sha256').update(raw).digest('hex')
}

async function postPhunkHold(req, res, body) {
  if (!PHUNK_LIVE) return fail(res, 400, 'This mint is offline.')
  const buyer = phunkBuyer(body.buyer)
  const tokens = phunkTokens(body.tokenNos)
  if (String(body.collectionId || '') !== PHUNK_ID) return fail(res, 400, 'That mint is not this collection.')
  await chain.requireMinter(phunkMinterInfo().address)
  const ready = {}
  await Promise.all(tokens.map(async function (token) {
    const file = await phunkPng(token)
    const packed = phunkCalldata(file.png)
    if (!phunkMerkle.matches(token, packed.sha)) throw new Error('Artwork does not match the deployed collection manifest.')
    ready[token] = packed
  }))
  await Promise.all(tokens.map(function (token) { return chain.requireUniqueContent(ready[token].sha) }))
  const now = Date.now()
  const state = await withBoard(async function (board) {
    let drop = findCollection(board, PHUNK_ID)
    if (!drop) { drop = defaultPhunkCollection(); board.collections.push(drop) }
    if (!drop || drop.state !== 'open') throw new Error('This mint is not open.')
    if (String(drop.mintPriceWei) !== String(phunkMinterInfo().priceWei)) throw new Error('Collection price does not match the mint contract.')
    const max = Number(drop.maxPerWallet || 20)
    tokens.forEach(function (token) {
      const hit = phunkTaken(board.listings, token, now)
      if (hit && !chain.same(hit.buyer, buyer)) throw new Error('Cover #' + token + ' was just taken.')
    })
    const owned = phunkCount(board.listings, buyer, now)
    const fresh = tokens.filter(function (token) { return !phunkTaken(board.listings, token, now) })
    if (owned + fresh.length > max) throw new Error('This wallet can mint ' + max + ' of this collection.')
    const split = splitWei(drop.mintPriceWei, 'primary')
    fresh.forEach(function (token) {
      board.listings.push({
        id: crypto.randomBytes(8).toString('hex'),
        ethscriptionId: '',
        collectionId: PHUNK_ID,
        tokenNo: token,
        priceEth: drop.mintPriceEth,
        priceWei: drop.mintPriceWei,
        buyerWei: split.buyerWei,
        sellerWei: split.sellerWei,
        royaltyWei: split.royaltyWei,
        siteWei: split.siteWei,
        kind: 'primary',
        seller: drop.creator || PHUNK_CREATOR,
        sellerUid: drop.creatorUid || '',
        creator: drop.creator || PHUNK_CREATOR,
        buyer: buyer,
        buyerUid: '',
        holdUid: 'wallet:' + buyer.toLowerCase(),
        holdUntil: now + HOLD_MS,
        state: 'held',
        preview: '/assets/ethscriptions/phunks/img/' + token + '.png',
        contentSha: ready[token].sha,
        at: new Date().toISOString()
      })
    })
    tokens.forEach(function (token) {
      const hit = phunkTaken(board.listings, token, Date.now())
      if (hit && hit.state === 'held' && chain.same(hit.buyer, buyer)) {
        hit.holdUntil = Date.now() + HOLD_MS
        if (!hit.contentSha && ready[token]) hit.contentSha = ready[token].sha
      }
    })
    return board
  })
  let due = 0n
  tokens.forEach(function (token) {
    const row = phunkTaken(state.listings, token, Date.now())
    if (row && row.state === 'held') due += BigInt(row.buyerWei || row.priceWei)
  })
  const mints = tokens.map(function (token) {
    const row = phunkTaken(state.listings, token, Date.now())
    return {
      id: row && row.id,
      tokenNo: token,
      uri: ready[token].uri,
      proof: phunkMerkle.proof(token),
      wei: row && row.state === 'held' ? String(row.buyerWei || row.priceWei || '0') : '0'
    }
  })
  return res.status(200).json({ ok: true, escrow: chain.escrowEth(), totalWei: due.toString(), mints: mints, login: false })
}

async function postPhunkPay(req, res, body) {
  if (!PHUNK_LIVE) return fail(res, 400, 'This mint is offline.')
  const buyer = phunkBuyer(body.buyer)
  const tokens = phunkTokens(body.tokenNos)
  let due = 0n
  await withBoard(async function (board) {
    const now = Date.now()
    tokens.forEach(function (token) {
      const row = phunkTaken(board.listings, token, now)
      if (!row || !chain.same(row.buyer, buyer)) throw new Error('Hold the cover again, then pay.')
      if (row.state === 'held') due += BigInt(row.buyerWei || row.priceWei)
    })
    return null
  })
  let pay = null
  if (due > 0n) {
    pay = await chain.readPayment(body.payTx)
    if (!chain.same(pay.to, chain.escrowEth())) throw new Error('That ETH was not sent to the escrow address.')
    if (!chain.same(pay.from, buyer)) throw new Error('That payment was not sent by the connected wallet.')
    if (pay.value !== due.toString()) throw new Error('The payment is not the mint total.')
  }
  const payloads = {}
  for (let i = 0; i < tokens.length; i++) {
    const file = await phunkPng(tokens[i])
    payloads[tokens[i]] = Object.assign(phunkCalldata(file.png), { preview: file.preview })
  }
  const mints = []
  const paidBoard = await withBoard(async function (board) {
    const now = Date.now()
    const first = phunkTaken(board.listings, tokens[0], now)
    if (pay && first && !claimTx(board, pay.hash, first.id)) throw new Error('That payment was already used.')
    tokens.forEach(function (token) {
      const row = phunkTaken(board.listings, token, now)
      if (!row || !chain.same(row.buyer, buyer)) throw new Error('That cover is not held by this wallet.')
      if (row.state === 'held') {
        if (!pay) throw new Error('The mint payment was not sent.')
        row.state = 'paid'
        row.payTx = pay.hash
        row.holdUntil = 0
      }
      row.contentSha = payloads[token].sha
      row.preview = payloads[token].preview
      if (row.state === 'paid') mints.push({ id: row.id, tokenNo: token, uri: payloads[token].uri })
    })
    return board
  })
  return res.status(200).json({ ok: true, mints: mints, minter: paidBoard.phunkMinter || '' })
}

async function postPhunkReveal(req, res, body) {
  // Reconciliation must remain available even while new sales are paused.
  const buyer = phunkBuyer(body.buyer)
  const sent = await chain.readPhunkMint(body.mintTx)
  if (!chain.same(sent.from, buyer)) throw new Error('The mint has to be signed by your wallet.')
  if (!sent.uri || !chain.same(sent.owner, buyer)) throw new Error('That transaction did not mint the picture into your wallet.')
  await chain.requireIndexedMint(sent)
  const id = String(body.id || '')
  const state = await withBoard(async function (board) {
    const row = findRow(board, id)
    if (!row || row.collectionId !== PHUNK_ID) throw new Error('That mint is not on the board.')
    if (!chain.same(row.buyer, buyer)) throw new Error('That mint belongs to a different wallet.')
    if (row.state === 'settled' && chain.same(row.ethscriptionId, sent.hash)) return board
    const minter = phunkMinterInfo().address
    if (chain.same(sent.to, PHUNK_FACTORY)) throw new Error('That mint was sent to the factory. A mint has to call the minter contract.')
    if (!chain.same(sent.to, minter)) throw new Error('That mint was not sent to the minter contract.')
    if (sent.contractAddress && !chain.same(sent.contractAddress, minter)) throw new Error('That mint was not written by the minter contract.')
    const price = BigInt(row.buyerWei || row.priceWei || '0')
    const value = BigInt(sent.value || '0')
    if (!['open', 'held', 'paid'].includes(row.state)) throw new Error('That order cannot be reconciled.')
    if (value !== price) throw new Error('The mint payment does not match.')
    const sha = crypto.createHash('sha256').update(Buffer.from(sent.uri, 'utf8')).digest('hex')
    if (!row.contentSha || sha !== row.contentSha || !phunkMerkle.matches(row.tokenNo, sha)) throw new Error('That transaction is a different picture.')
    const duplicate = board.listings.some(function (other) {
      return other.id !== row.id && other.collectionId === PHUNK_ID && Number(other.tokenNo) === Number(row.tokenNo) && other.state === 'settled'
    })
    if (duplicate) throw new Error('This piece already has a reconciled mint.')
    if (!claimTx(board, sent.hash, row.id)) throw new Error('That picture transaction was already used.')
    board.phunkMinter = minter.toLowerCase()
    row.state = 'settled'
    row.ethscriptionId = sent.hash
    row.pictureTx = sent.hash
    row.deliverTx = sent.hash
    row.holdUntil = 0
    board.listings.forEach(function (other) {
      if (other.id !== row.id && other.collectionId === PHUNK_ID && Number(other.tokenNo) === Number(row.tokenNo) && ['open', 'held'].includes(other.state)) {
        other.state = 'superseded'
        other.holdUntil = 0
      }
    })
    return board
  })
  const row = findRow(state, id)
  return res.status(200).json({ ok: true, where: 'wallet', ethscriptionId: row && row.ethscriptionId, minter: state.phunkMinter || '', listing: publicRow(row) })
}

module.exports = handler
