'use strict'
const { ethers } = require('ethers')
const { getStore } = require('@netlify/blobs')
const { storeOptions } = require('./lib/ethscriptions-blobs')
const { readSession, sessionSecret } = require('./lib/account-session')
const { loadState } = require('./lib/account-store')
const { checkRateLimit } = require('./lib/rate-limit')
const { createQuota } = require('./lib/market-approval-quota')
const { createEthscriptionsIndexer } = require('./lib/trixmoji-market/ethscriptions-indexer.cjs')
const { createMarketRuntime } = require('./lib/trixmoji-market/market-runtime.cjs')
const marketArtifact = require('../assets/data/trixmoji-escrow-artifact.json')
const deployment = require('../assets/data/trixmoji-escrow-deployment.json')
const minter = require('../assets/data/clean-pop-minter.json')

async function authenticatedWallet(req) {
 const session = readSession(req)
 if (!session || !session.uid) throw Error('Sign in with your Ethereum wallet before requesting an authorization.')
 const state = await loadState(), user = state && state.users && state.users[session.uid]
 const wallet = user && Array.isArray(user.wallets) && user.wallets.find(w => w && w.chain === 'ethereum' && ethers.utils.isAddress(w.address || ''))
 if (!wallet || !state.walletIndex || state.walletIndex['ethereum:' + wallet.address.toLowerCase()] !== session.uid) throw Error('A verified Ethereum wallet login is required.')
 return wallet.address
}

async function runtime(readOnly) {
 if (process.env.TRIXMOJI_MARKET_ENABLED !== 'true') throw Error('MARKET_NOT_CONFIGURED')
 const rpc = String(process.env.ETH_RPC_URL || ''), marketAddress = deployment.address, runtimeHash = deployment.runtimeHash, start = String(deployment.deploymentBlock), key = String(process.env.TRIXMOJI_MARKET_VERIFIER_KEY || '')
 if (!/^https:\/\//i.test(rpc) || !ethers.utils.isAddress(marketAddress) || !/^0x[a-f0-9]{64}$/i.test(runtimeHash) || !/^\d+$/.test(start) || !Number.isSafeInteger(Number(start)) || (!readOnly && !/^0x[a-f0-9]{64}$/i.test(key))) throw Error('MARKET_NOT_CONFIGURED')
 const provider = new ethers.providers.JsonRpcProvider({ url: rpc, timeout: 10000 }, 1)
 const signer = readOnly ? { address: marketArtifact.verifier } : new ethers.Wallet(key, provider)
 if (signer.address.toLowerCase() !== marketArtifact.verifier.toLowerCase()) throw Error('MARKET_NOT_CONFIGURED')
 const quota = readOnly ? async () => false : createQuota({ store: getStore({ ...storeOptions(), name: 'trixmoji-market-approval-quota', consistency: 'strong' }), perMinute: 8 })
 const indexer = createEthscriptionsIndexer({ baseUrl: process.env.ETHSCRIPTIONS_INDEXER_URL || 'https://api.ethscriptions.com/v2/' })
 return createMarketRuntime({ provider, signer, indexer, registry: undefined, authenticate: authenticatedWallet, consumeQuota: quota,
  chainId: 1, marketAddress, creator: marketArtifact.creator, marketRuntimeHash: runtimeHash, marketAbi: marketArtifact.abi,
  minter: minter.address, minterRuntimeHash: minter.runtimeHash, minterAbi: minter.abi, artworkRoot: minter.root, mintPriceWei: minter.priceWei,
  marketStartBlock: Number(start), confirmations: 2, blockChunk: 2000, maxCandidates: 1000 })
}

async function handler(req, res) {
 if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only.' })
 const limit = checkRateLimit(req, { prefix: 'trixmoji-market', perMinute: 30, perDay: 1000 })
 if (!limit.ok) return res.status(429).json({ ok: false, error: 'Please wait before retrying.' })
 try {
  if (req.method === 'POST' && process.env.TRIXMOJI_MARKET_LIVE !== 'true') throw Error('MARKET_NOT_CONFIGURED')
  const service = await runtime(req.method === 'GET')
  if (req.method === 'GET') {
   const key = String(process.env.TRIXMOJI_MARKET_VERIFIER_KEY || '')
   let tradingReady = false
   try {
    tradingReady = process.env.TRIXMOJI_MARKET_LIVE === 'true' && !!sessionSecret() && /^0x[a-f0-9]{64}$/i.test(key) && new ethers.Wallet(key).address.toLowerCase() === marketArtifact.verifier.toLowerCase()
    if (tradingReady) {
     const store = getStore({ ...storeOptions(), name: 'trixmoji-market-approval-quota', consistency: 'strong' })
     await store.getWithMetadata('readiness-probe', { type: 'json', consistency: 'strong' })
    }
   } catch (_) { tradingReady = false }
   return res.status(200).json({ ok: true, tradingReady, ...await service.list() })
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  if (body.action !== 'authorize') return res.status(400).json({ ok: false, error: 'Unknown market action.' })
  return res.status(200).json({ ok: true, ...await service.issueApproval(req, { id: body.id, seller: body.seller, buyer: body.buyer, kind: body.kind, amount: body.amount, duration: body.duration }) })
 } catch (error) {
  const message = String(error && error.message || '')
  const safe = /^(Sign in with your Ethereum wallet|A verified Ethereum wallet login|Authenticated wallet does not match|Authorization rate limit exceeded|Invalid market authorization request|Listing price changed|Invalid market amount|Market amount must be positive|Invalid auction duration|Indexer is behind|Ethscriptions indexer is behind)/.test(message)
  return res.status(message === 'MARKET_NOT_CONFIGURED' ? 503 : 400).json({ ok: false, error: message === 'MARKET_NOT_CONFIGURED' ? 'The forked market is not configured yet.' : safe ? message : 'Market verification is unavailable. No authorization was issued.' })
 }
}
module.exports = handler
