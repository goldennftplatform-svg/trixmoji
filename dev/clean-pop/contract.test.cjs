'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), ganache = require('ganache'), solc = require('solc')
const { ethers } = require('ethers')
const root = path.resolve(__dirname, '../..')
const artifact = require('../../assets/data/clean-pop-minter.json')
const manifest = require('../../assets/ethscriptions/clean-pop-v1/manifest.json')
function art(id) {
 const uri = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/ethscriptions/clean-pop-v1', id + '.png')).toString('base64')
 return [uri, manifest.files[id].proof, id]
}
test('paused deployment, exact artwork mint, reserved legacy IDs and project-paid delivery', async () => {
 const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' },
  miner: { blockGasLimit: 30000000 }, wallet: { unlockedAccounts: [artifact.creator] } })
 const provider = new ethers.providers.Web3Provider(rpc)
 try {
  const owner = provider.getSigner(artifact.creator), buyer = provider.getSigner(0)
  await rpc.request({ method: 'evm_setAccountBalance', params: [artifact.creator, '0x56BC75E2D63100000'] })
  const legacy = '0x64A0CA6fE1f944De3210a64bD1DAb0619725281d'
  const input = { language: 'Solidity', sources: { 'Mock.sol': { content: 'pragma solidity 0.8.20; contract Mock { function minted(uint256 id) external pure returns(bool) { return id == 419; } }' } }, settings: { outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } }
  const compiled = JSON.parse(solc.compile(JSON.stringify(input)))
  await rpc.request({ method: 'evm_setAccountCode', params: [legacy, '0x' + compiled.contracts['Mock.sol'].Mock.evm.deployedBytecode.object] })
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner).deploy()
  await contract.deployed()
  assert.equal(await contract.paused(), true)
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(0), { value: artifact.priceWei }), /paused/)
  await assert.rejects(contract.connect(buyer).estimateGas.setPaused(false), /owner/)
  await (await contract.setPaused(false)).wait()
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(419), { value: artifact.priceWei }), /legacy reserved/)
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(0), { value: 0 }), /price/)
  const bad = art(0); bad[0] += 'bad'
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...bad, { value: artifact.priceWei }), /art/)
  const receipt = await (await contract.connect(buyer).mint(...art(0), { value: artifact.priceWei })).wait()
  const creation = receipt.events.find(e => e.event === 'ethscriptions_protocol_CreateEthscription')
  assert.equal(creation.args.initialOwner, await buyer.getAddress())
  assert.equal(creation.args.contentURI, art(0)[0])
  assert.equal(await contract.minted(0), true)
  await assert.rejects(contract.connect(buyer).estimateGas.mint(...art(0), { value: artifact.priceWei }), /token/)
  await (await contract.setPaused(true)).wait()
  const legacyId = ethers.utils.id('mock legacy ethscription')
  const replacement = [...art(419), legacyId, await buyer.getAddress()]
  await assert.rejects(contract.connect(buyer).estimateGas.deliverReplacement(...replacement), /owner/)
  const delivered = await (await contract.deliverReplacement(...replacement)).wait()
  const event = delivered.events.find(e => e.event === 'ethscriptions_protocol_CreateEthscription')
  assert.equal(event.args.initialOwner, await buyer.getAddress())
  assert.equal(event.args.contentURI, art(419)[0])
  assert.equal(await contract.replaced(legacyId), true)
  await assert.rejects(contract.estimateGas.deliverReplacement(...replacement), /legacy id/)
  console.log(JSON.stringify({ simulatedMintGas: receipt.gasUsed.toString(), simulatedReplacementGas: delivered.gasUsed.toString(), realTransactions: 0 }))
 } finally { await rpc.disconnect() }
})
