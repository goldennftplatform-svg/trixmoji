'use strict'
const { ethers } = require('ethers')
const { verifiedApproval } = require('./verified-approval.cjs')
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

/**
 * Server-side boundary for issuing fork-market authorizations. Dependencies are
 * fixed at service startup; the requesting browser cannot choose a signer, RPC,
 * indexer, collection registry, chain, or market. Authentication and atomic
 * quota enforcement must be supplied by the hosting application.
 */
function createApprovalService(config) {
 if (!config || !config.market || !config.signer || typeof config.indexer !== 'function' || typeof config.registry !== 'function' || typeof config.authenticate !== 'function' || typeof config.consumeQuota !== 'function' || !Number.isSafeInteger(config.chainId) || !ethers.utils.isAddress(config.marketAddress || '') || !ethers.utils.isAddress(config.minter || '')) throw Error('Protected approval service is not configured.')
 const fixed = { market: config.market, signer: config.signer, indexer: config.indexer, manifest: config.registry, historyProvider: config.historyProvider,
  expectedChainId: config.chainId, expectedMarket: config.marketAddress, minter: config.minter }
 return {
  async issue(context, body) {
   if (!body || !/^0x[a-f0-9]{64}$/i.test(String(body.id || '')) || !ethers.utils.isAddress(body.seller || '') || ![0, 1].includes(body.kind)) throw Error('Invalid market authorization request.')
   const actor = await config.authenticate(context)
   if (!ethers.utils.isAddress(actor || '')) throw Error('Wallet authentication required.')
   const buyer = body.kind === 0 ? body.buyer : ethers.constants.AddressZero
   if (!ethers.utils.isAddress(buyer || '') || (body.kind === 0 && !same(actor, buyer)) || (body.kind === 1 && !same(actor, body.seller))) throw Error('Authenticated wallet does not match the requested market action.')
   if (!(await config.consumeQuota(actor))) throw Error('Authorization rate limit exceeded.')
   let amount
   try { amount = ethers.BigNumber.from(body.amount) } catch (_) { throw Error('Invalid market amount.') }
   if (amount.lte(0)) throw Error('Market amount must be positive.')
   const duration = body.kind === 1 ? Number(body.duration) : 0
   if (body.kind === 1 && (!Number.isInteger(duration) || duration < 3600 || duration > 604800)) throw Error('Invalid auction duration.')
   if (body.kind === 0) {
    const offer = await fixed.market.listings(body.seller, body.id)
    if (!offer || !offer.price.eq(amount)) throw Error('Listing price changed; refresh before buying.')
   }
   return verifiedApproval(fixed, { id: body.id, seller: body.seller, buyer, kind: body.kind, amount, duration })
  }
 }
}
module.exports = { createApprovalService }
