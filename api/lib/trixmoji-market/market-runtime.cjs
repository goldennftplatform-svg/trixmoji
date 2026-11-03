'use strict'
const { ethers } = require('ethers')
const { createCleanPopRegistry } = require('./clean-pop-registry.cjs')
const { createApprovalService } = require('./approval-service.cjs')
const { discoverListings } = require('./listing-discovery.cjs')
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

/**
 * Server-side composition only. The host must supply fixed deployment details,
 * a protected signer, trusted indexer, wallet authentication and an atomic quota.
 * No component is selected using browser-provided URLs, addresses or keys.
 */
async function createMarketRuntime(config) {
 if (!config || !config.provider || !config.signer || typeof config.indexer !== 'function' || typeof config.authenticate !== 'function' || typeof config.consumeQuota !== 'function' || !Number.isSafeInteger(config.chainId) || !Number.isSafeInteger(config.marketStartBlock) || config.marketStartBlock < 0 || !ethers.utils.isAddress(config.marketAddress || '') || !ethers.utils.isAddress(config.creator || '') || !ethers.utils.isAddress(config.minter || '') || !/^0x[a-f0-9]{64}$/i.test(String(config.marketRuntimeHash || '')) || !/^0x[a-f0-9]{64}$/i.test(String(config.minterRuntimeHash || '')) || !config.marketAbi || !config.minterAbi) throw Error('Market runtime is not configured.')
 const network = await config.provider.getNetwork()
 if (network.chainId !== config.chainId) throw Error('Market runtime connected to the wrong network.')
 const [marketCode, minterCode] = await Promise.all([config.provider.getCode(config.marketAddress), config.provider.getCode(config.minter)])
 if (!marketCode || marketCode === '0x' || !same(ethers.utils.keccak256(marketCode), config.marketRuntimeHash)) throw Error('Market runtime bytecode mismatch.')
 if (!minterCode || minterCode === '0x' || !same(ethers.utils.keccak256(minterCode), config.minterRuntimeHash)) throw Error('Clean Pop minter bytecode mismatch.')
 const market = new ethers.Contract(config.marketAddress, config.marketAbi, config.provider)
 const [creator, verifier] = await Promise.all([market.creator(), market.verifier()])
 if (!same(creator, config.creator) || !same(verifier, config.signer.address)) throw Error('Market creator or protected verifier does not match configuration.')
 const registry = createCleanPopRegistry({ provider: config.provider, indexer: config.indexer, minter: config.minter,
  abi: config.minterAbi, root: config.artworkRoot, mintPriceWei: config.mintPriceWei })
 const approvals = createApprovalService({ market, signer: config.signer, indexer: config.indexer, registry, minter: config.minter,
  chainId: config.chainId, marketAddress: config.marketAddress, authenticate: config.authenticate, consumeQuota: config.consumeQuota })
 return {
  list: () => discoverListings({ market, indexer: config.indexer, registry, minter: config.minter,
   startBlock: config.marketStartBlock, confirmations: config.confirmations || 2, blockChunk: config.blockChunk || 2000, maxCandidates: config.maxCandidates || 1000 }),
  issueApproval: (context, body) => approvals.issue(context, body)
 }
}
module.exports = { createMarketRuntime }
