'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), ganache = require('ganache'), solc = require('solc'), { ethers } = require('ethers')
const artifact = require('../../assets/data/clean-pop-webp-v2-candidate.json')
const manifest = require('../../assets/ethscriptions/clean-pop-webp-v2/manifest.json')
const root = path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-webp-v2')
function art(id) { return ['data:image/webp;base64,' + fs.readFileSync(path.join(root, id + '.webp')).toString('base64'), manifest.files[id].proof, id] }

test('candidate creation and runtime bytecode reproduce from normalized Solidity source', () => {
 const source = fs.readFileSync(path.resolve(__dirname, '../../api/lib/clean-pop-webp-minter.sol'), 'utf8').replace(/\r\n/g, '\n')
 const input = { language: 'Solidity', sources: { 'clean-pop-webp-minter.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['evm.bytecode.object', 'evm.deployedBytecode.object'] } } } }
 const output = JSON.parse(solc.compile(JSON.stringify(input)))
 assert.equal('0x' + output.contracts['clean-pop-webp-minter.sol'].CleanPopWebpMinter.evm.bytecode.object, artifact.bytecode)
 assert.equal('0x' + output.contracts['clean-pop-webp-minter.sol'].CleanPopWebpMinter.evm.deployedBytecode.object, artifact.runtime)
})

test('WebP candidate preserves sale terms, accepts all numbers without legacy reservations and commits exact artwork', async () => {
 const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, miner: { blockGasLimit: 30000000 }, wallet: { unlockedAccounts: [artifact.creator] } })
 const provider = new ethers.providers.Web3Provider(rpc)
 try {
  await rpc.request({ method: 'evm_setAccountBalance', params: [artifact.creator, '0x56BC75E2D63100000'] })
  const owner = provider.getSigner(artifact.creator), buyer = provider.getSigner(0)
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner).deploy(); await contract.deployed()
  assert.equal(await contract.paused(), true)
  assert.equal(await contract.OWNER(), artifact.creator); assert.equal(await contract.SITE(), artifact.site)
  assert.equal((await contract.PRICE()).toString(), '200000000000000'); assert.equal(await contract.ROOT(), manifest.root)
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(0), { value: artifact.priceWei }), /paused/)
  await assert.rejects(contract.connect(buyer).estimateGas.setPaused(false), /owner/)
  await (await contract.setPaused(false)).wait()
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(0), { value: 0 }), /price/)
  const bad = art(0); bad[0] += 'x'; await assert.rejects(contract.connect(buyer).estimateGas.mint(...bad, { value: artifact.priceWei }), /art/)
  const wrongProof = art(0); wrongProof[1] = manifest.files[1].proof; await assert.rejects(contract.connect(buyer).estimateGas.mint(...wrongProof, { value: artifact.priceWei }), /art/)
  const beforeOwner = await provider.getBalance(artifact.creator), beforeSite = await provider.getBalance(artifact.site)
  const receipt = await (await contract.connect(buyer).mint(...art(0), { value: artifact.priceWei })).wait()
  const created = receipt.events.find(e => e.event === 'ethscriptions_protocol_CreateEthscription')
  assert.equal(created.args.initialOwner, await buyer.getAddress()); assert.equal(created.args.contentURI, art(0)[0])
  assert.equal((await provider.getBalance(artifact.site)).sub(beforeSite).toString(), '1000000000000')
  assert.equal((await provider.getBalance(artifact.creator)).sub(beforeOwner).toString(), '199000000000000')
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(0), { value: artifact.priceWei }), /token/)
  // #419 was a reserved legacy number; it is deliberately available here.
  for (const id of [419, 9999]) { await (await contract.connect(buyer).mint(...art(id), { value: artifact.priceWei })).wait(); assert.equal(await contract.minted(id), true) }
  assert.equal((await contract.mintedBy(await buyer.getAddress())).toNumber(), 3)
  const outOfRange = art(0); outOfRange[2] = 10000; await assert.rejects(contract.connect(buyer).estimateGas.mint(...outOfRange, { value: artifact.priceWei }), /token/)
  console.log(JSON.stringify({ simulatedMintGas: receipt.gasUsed.toString(), testedIds: [0, 419, 9999], realTransactions: 0 }))
 } finally { await rpc.disconnect() }
})

test('candidate enforces the retained 20-piece per-wallet limit', async () => {
 const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, miner: { blockGasLimit: 30000000 }, wallet: { unlockedAccounts: [artifact.creator] } })
 const provider = new ethers.providers.Web3Provider(rpc)
 try {
  await rpc.request({ method: 'evm_setAccountBalance', params: [artifact.creator, '0x56BC75E2D63100000'] })
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, provider.getSigner(artifact.creator)).deploy(); await contract.deployed()
  await (await contract.setPaused(false)).wait()
  const buyer = provider.getSigner(0)
  for (let id = 0; id < 20; id++) await (await contract.connect(buyer).mint(...art(id), { value: artifact.priceWei })).wait()
  assert.equal((await contract.mintedBy(await buyer.getAddress())).toNumber(), 20)
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(20), { value: artifact.priceWei }), /wallet/)
 } finally { await rpc.disconnect() }
})
