'use strict'
const { ethers } = require('ethers')
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

// Indexer results are discovery hints. Every returned item must also pass the
// collection provenance registry and still be owned by the requested wallet.
async function walletInventory({ wallet, minter, registry, fetchPage, pageKey }) {
 if (!ethers.utils.isAddress(wallet || '') || !ethers.utils.isAddress(minter || '') || typeof registry !== 'function' || typeof fetchPage !== 'function') throw Error('Invalid wallet inventory request.')
 if (pageKey && !/^0x[a-f0-9]{64}$/i.test(pageKey)) throw Error('Invalid inventory page key.')
 const page = await fetchPage({ wallet, minter, pageKey })
 if (!page || !Array.isArray(page.result) || !page.pagination || typeof page.pagination.has_more !== 'boolean' || page.result.length > 100) throw Error('Invalid inventory response.')
 const items = []
 for (const row of page.result) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(row.transaction_hash || '')) || !same(row.current_owner, wallet) || !same(row.creator, minter)) continue
  const verified = await registry(row.transaction_hash)
  if (!verified || !same(verified.id, row.transaction_hash) || !same(verified.contentSha, row.content_sha) || !Number.isInteger(verified.tokenNo) || verified.tokenNo < 0 || verified.tokenNo >= 10000) throw Error('Inventory provenance verification failed.')
  items.push({ id: verified.id, tokenNo: verified.tokenNo, owner: ethers.utils.getAddress(wallet) })
 }
 const nextPageKey = page.pagination.has_more ? page.pagination.page_key : null
 if (nextPageKey && !/^0x[a-f0-9]{64}$/i.test(nextPageKey)) throw Error('Invalid next inventory page key.')
 if (page.pagination.has_more && !nextPageKey) throw Error('Missing next inventory page key.')
 return { items, nextPageKey }
}
module.exports = { walletInventory }
