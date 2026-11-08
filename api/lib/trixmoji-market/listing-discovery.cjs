'use strict'
const { ethers } = require('ethers')
const { isDepositCalldata } = require('./deposit-calldata.cjs')
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

/**
 * Read-only discovery for the forked market. The indexer and collection
 * registry are trusted server-side dependencies, never browser-supplied URLs.
 * Re-scanning canonical logs avoids treating an orphaned event as a listing.
 * A protected verifier must still approve a purchase against fresh state.
 */
async function discoverListings({ market, indexer, registry, minter, startBlock, confirmations = 2, blockChunk = 2000, maxCandidates = 1000, historyProvider }) {
 if (!market || !market.provider || typeof indexer !== 'function' || typeof registry !== 'function' || !ethers.utils.isAddress(minter)) throw Error('Market, indexer, registry and collection minter are required.')
 if (!Number.isSafeInteger(startBlock) || startBlock < 0 || !Number.isInteger(confirmations) || confirmations < 1 || !Number.isInteger(blockChunk) || blockChunk < 1 || blockChunk > 10000 || !Number.isInteger(maxCandidates) || maxCandidates < 1) throw Error('Invalid listing discovery limits.')
 const latest = await market.provider.getBlockNumber(), confirmedHead = latest - confirmations + 1
 const status = await indexer('/status'), indexed = Number(status && status.last_imported_block)
 if (!Number.isSafeInteger(indexed) || indexed < 0 || latest - indexed > 2) throw Error('Ethscriptions indexer is behind the confirmed chain head.')
 // Restrict discovery to the newest block that is both confirmed and indexed.
 const head = Math.min(confirmedHead, indexed)
 if (head < startBlock) return { blockNumber: head, listings: [], auctions: [], deposits: [], candidateCount: 0 }
 const block = await market.provider.getBlock(head)
 if (!block || !block.hash) throw Error('Confirmed chain head is unavailable.')
 const candidates = new Map(), filters = [market.filters.Listed(), market.filters.AuctionStarted(), market.filters.Deposited()]
 let discoverySource = 'escrow-logs'
 try {
  for (let from = startBlock; from <= head; from += blockChunk) {
   const batches = await Promise.all(filters.map(filter => market.provider.getLogs({ ...filter, fromBlock: from, toBlock: Math.min(head, from + blockChunk - 1) })))
   for (const log of batches.flat()) {
    if (log.removed) continue
    const event = market.interface.parseLog(log), seller = event.args.seller, id = event.args.id
    candidates.set(seller.toLowerCase() + ':' + id.toLowerCase(), { seller, id })
    if (candidates.size > maxCandidates) throw Error('Listing candidate limit exceeded; use a persistent indexer before increasing this bound.')
   }
  }
 } catch (error) {
  if (typeof indexer.listOwned !== 'function' || /candidate limit exceeded/i.test(String(error.message || ''))) throw error
  candidates.clear(); discoverySource = 'indexed-custody'
  let pageKey = null, pages = 0; const cursors = new Set()
  do {
   if (++pages > maxCandidates + 1) throw Error('Escrow discovery pagination limit exceeded.')
   const page = await indexer.listOwned({ owner: market.address, creator: minter, pageKey })
   if (!page || !Array.isArray(page.ids)) throw Error('Invalid escrow discovery page.')
   for (const id of page.ids) {
    if (!/^0x[a-f0-9]{64}$/i.test(String(id || ''))) throw Error('Invalid escrow discovery asset.')
    candidates.set(id.toLowerCase(), { id })
    if (candidates.size > maxCandidates) throw Error('Listing candidate limit exceeded; use a persistent indexer before increasing this bound.')
   }
   pageKey = page.nextPageKey || null
   if (pageKey) { if (cursors.has(pageKey)) throw Error('Escrow discovery repeated a page cursor.'); cursors.add(pageKey) }
  } while (pageKey)
 }
 const listings = [], auctions = [], deposits = []
 for (const hint of candidates.values()) {
  // The same escrow can contain other collections. Filter their indexed
  // creator before invoking this collection's strict provenance registry.
  const asset = await indexer('/ethscriptions/' + hint.id)
  if (!asset || !same(asset.creator, minter)) continue
  const candidate = { id: hint.id, seller: hint.seller || asset.previous_owner }
  if (!ethers.utils.isAddress(candidate.seller || '') || !same(asset.current_owner, market.address) || !same(asset.previous_owner, candidate.seller)) continue
  const [offer, auction] = await Promise.all([market.listings(candidate.seller, candidate.id, { blockTag: head }), market.auctions(candidate.seller, candidate.id, { blockTag: head })])
  const activeAuction = !auction.end.isZero() && !auction.settled
  const committed = await registry(candidate.id)
  if (!asset || !committed || !/^0x[a-f0-9]{64}$/i.test(String(committed.contentSha || '')) || !same(asset.transaction_hash, candidate.id) || !same(asset.creator, minter) || !same(asset.content_sha, committed.contentSha) || !same(asset.current_owner, market.address) || !same(asset.previous_owner, candidate.seller)) continue
  const depositBlock = await market.depositBlock(candidate.seller, candidate.id, { blockTag: head })
  if (depositBlock.isZero()) continue
  const transfers = (asset.ethscription_transfers || []).filter(t => same(t.from_address, candidate.seller) && same(t.to_address, market.address) && Number(t.block_number) === depositBlock.toNumber())
  if (transfers.length !== 1 || !/^0x[a-f0-9]{64}$/i.test(String(transfers[0].transaction_hash || ''))) continue
  const history = historyProvider || market.provider
  const [tx, receipt] = await Promise.all([history.getTransaction(transfers[0].transaction_hash), history.getTransactionReceipt(transfers[0].transaction_hash)])
  if (!tx || !receipt) throw Error('Escrow deposit transaction history is unavailable; listings cannot be verified.')
  if (!same(tx.hash, transfers[0].transaction_hash) || !same(receipt.transactionHash, transfers[0].transaction_hash) || receipt.status !== 1 || receipt.blockNumber !== depositBlock.toNumber() || !same(tx.from, candidate.seller) || !same(tx.to, market.address) || !isDepositCalldata(tx.data, candidate.id) || !tx.value.isZero()) continue
  const cooldown = Math.max(0, 5 - (head - depositBlock.toNumber()))
  deposits.push({ id: candidate.id, tokenNo: committed.tokenNo, seller: candidate.seller, depositBlock: depositBlock.toNumber(), cooldown })
  if (cooldown) continue
  if (!offer.price.isZero()) listings.push({ id: candidate.id, tokenNo: committed.tokenNo, seller: candidate.seller, priceWei: offer.price.toString(), nonce: offer.nonce.toString(), depositBlock: depositBlock.toNumber() })
  if (activeAuction) auctions.push({ id: candidate.id, tokenNo: committed.tokenNo, seller: candidate.seller, reserveWei: auction.reserve.toString(), amountWei: auction.amount.toString(), bidder: auction.bidder, end: auction.end.toNumber(), nonce: auction.nonce.toString(), depositBlock: depositBlock.toNumber() })
 }
 const recheck = await market.provider.getBlock(head)
 if (!recheck || recheck.hash !== block.hash) throw Error('Chain reorganized during listing discovery; retry.')
 return { blockNumber: head, blockHash: block.hash, indexedBlock: indexed, discoverySource, candidateCount: candidates.size, listings, auctions, deposits }
}
module.exports = { discoverListings }
