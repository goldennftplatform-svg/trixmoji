'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), ganache = require('ganache'), { ethers } = require('ethers')
const minterArtifact = require('../../assets/data/clean-pop-webp-v2-candidate.json')
const marketArtifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json')
const manifest = require('../../assets/ethscriptions/clean-pop-webp-v2/manifest.json')
const { createCleanPopRegistry } = require('../../api/lib/trixmoji-market/clean-pop-registry.cjs')
const { discoverListings } = require('../../api/lib/trixmoji-market/listing-discovery.cjs')
const { createMarketRuntime } = require('../../api/lib/trixmoji-market/market-runtime.cjs')

test('WebP mint, indexed custody, listing and purchase work with a local escrow and mocked indexer', async () => {
 const rpc = ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, hardfork: 'shanghai' }, miner: { blockGasLimit: 30000000 }, wallet: { totalAccounts: 5, defaultBalance: 100, unlockedAccounts: [minterArtifact.creator] } })
 const provider = new ethers.providers.Web3Provider(rpc); provider.pollingInterval = 20
 try {
  const accounts = Object.values(rpc.getInitialAccounts()).map(a => new ethers.Wallet(a.secretKey, provider))
  const [deployer, seller, buyer, verifier, creator] = accounts
  await rpc.request({ method: 'evm_setAccountBalance', params: [minterArtifact.creator, '0x56BC75E2D63100000'] })
  const minter = await new ethers.ContractFactory(minterArtifact.abi, minterArtifact.bytecode, provider.getSigner(minterArtifact.creator)).deploy(); await minter.deployed()
  await (await minter.setPaused(false)).wait()
  const token = 419, uri = 'data:image/webp;base64,' + fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-webp-v2/' + token + '.webp')).toString('base64')
  const minted = await (await minter.connect(seller).mint(uri, manifest.files[token].proof, token, { value: minterArtifact.priceWei })).wait()
  const id = minted.transactionHash
  const market = await new ethers.ContractFactory(marketArtifact.abi, marketArtifact.bytecode, deployer).deploy(verifier.address, creator.address); await market.deployed()
  const deposit = await (await seller.sendTransaction({ to: market.address, data: id })).wait()
  // The shared escrow can also contain V1 or unrelated assets. Their events
  // must not make V2 listing discovery fail or appear as V2 assets.
  const foreignId = ethers.utils.id('foreign-v1-asset')
  const foreignDeposit = await (await seller.sendTransaction({ to: market.address, data: foreignId })).wait()
  for (let i = 0; i < 5; i++) await provider.send('evm_mine', [])
  const price = ethers.utils.parseEther('0.01'); await (await market.connect(seller).list(id, price)).wait(); await (await market.connect(seller).list(foreignId, price)).wait()
  const asset = { transaction_hash: id, creator: minter.address, initial_owner: seller.address, current_owner: market.address, previous_owner: seller.address,
   content_uri: uri, content_sha: '0x' + manifest.files[token].contentSha256, ethscription_transfers: [{ transaction_hash: deposit.transactionHash, from_address: seller.address, to_address: market.address, block_number: deposit.blockNumber }] }
  const foreignSha = ethers.utils.id('foreign-content'), foreignAsset = { transaction_hash: foreignId, creator: seller.address, current_owner: market.address, previous_owner: seller.address, content_sha: foreignSha,
   ethscription_transfers: [{ transaction_hash: foreignDeposit.transactionHash, from_address: seller.address, to_address: market.address, block_number: foreignDeposit.blockNumber }] }
  const indexer = async p => p === '/status' ? { last_imported_block: await provider.getBlockNumber() } : p.endsWith(foreignId) ? foreignAsset : asset
  const registry = createCleanPopRegistry({ provider, indexer, minter: minter.address, abi: minterArtifact.abi, root: manifest.root, mintPriceWei: minterArtifact.priceWei, mimeType: 'image/webp' })
  assert.equal((await registry(id)).tokenNo, token)
  const board = await discoverListings({ market, indexer, registry, minter: minter.address, startBlock: deposit.blockNumber, confirmations: 1 })
  assert.equal(board.listings.length, 1); assert.equal(board.listings[0].id, id)
  const foreignBoard = await discoverListings({ market, indexer, registry: async requested => { assert.equal(requested, foreignId); return { tokenNo: 2, contentSha: foreignSha } }, minter: seller.address, startBlock: deposit.blockNumber, confirmations: 1 })
  assert.equal(foreignBoard.listings.length, 1); assert.equal(foreignBoard.listings[0].id, foreignId)
  const runtime = await createMarketRuntime({ provider, signer: verifier, indexer, authenticate: async context => context.actor, consumeQuota: async () => true,
   chainId: 31337, marketAddress: market.address, creator: creator.address, marketRuntimeHash: ethers.utils.keccak256(await provider.getCode(market.address)), marketAbi: marketArtifact.abi,
   minter: minter.address, minterRuntimeHash: ethers.utils.keccak256(await provider.getCode(minter.address)), minterAbi: minterArtifact.abi, artworkRoot: manifest.root, mintPriceWei: minterArtifact.priceWei, mintMimeType: 'image/webp', marketStartBlock: deposit.blockNumber, confirmations: 1 })
  assert.equal((await runtime.list()).listings[0].id, id)
  const signed = await runtime.issueApproval({ actor: buyer.address }, { id, seller: seller.address, buyer: buyer.address, kind: 0, amount: price, duration: 0 })
  const bought = await (await market.connect(buyer).buy(signed.approval, signed.signature, { value: price })).wait()
  assert.ok(bought.events.some(e => e.event === 'ethscriptions_protocol_TransferEthscriptionForPreviousOwner' && e.args.id === id))
 } finally { await rpc.disconnect() }
})
