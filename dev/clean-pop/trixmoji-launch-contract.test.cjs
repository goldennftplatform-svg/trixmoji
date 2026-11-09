'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), ganache = require('ganache'), { ethers } = require('ethers')
const artifact = require('../../assets/data/trixmoji-launch-candidate.json')
const manifest = require('../../assets/ethscriptions/trixmoji-launch/manifest.json')
const dir = path.resolve(__dirname, '../../assets/ethscriptions/trixmoji-launch')
const art = id => ['data:image/webp;base64,' + fs.readFileSync(path.join(dir, `${id}.webp`)).toString('base64'), manifest.files[id].proof, id]
test('live-on-deployment candidate enforces approved mint terms and artwork', async () => {
 const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, miner: { blockGasLimit: 30000000 }, wallet: { unlockedAccounts: [artifact.creator] } })
 const provider = new ethers.providers.Web3Provider(rpc)
 try {
  await rpc.request({ method: 'evm_setAccountBalance', params: [artifact.creator, '0x56BC75E2D63100000'] })
  const owner = provider.getSigner(artifact.creator), buyer = provider.getSigner(0)
  const c = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner).deploy(); await c.deployed()
  assert.equal(await c.paused(), false); assert.equal(await c.ROOT(), manifest.root)
  assert.equal(await c.OWNER(), artifact.creator); assert.equal(await c.SITE(), artifact.site)
  assert.equal((await c.PRICE()).toString(), artifact.priceWei)
  await assert.rejects(c.connect(buyer).estimateGas.mint(...art(0), {value: 0}), /price/)
  const wrong = art(0); wrong[0] += 'x'; await assert.rejects(c.connect(buyer).estimateGas.mint(...wrong, {value: artifact.priceWei}), /art/)
  const beforeOwner = await provider.getBalance(artifact.creator), beforeSite = await provider.getBalance(artifact.site)
  const receipt = await (await c.connect(buyer).mint(...art(0), {value: artifact.priceWei})).wait()
  const created = receipt.events.find(e => e.event === 'ethscriptions_protocol_CreateEthscription')
  assert.equal(created.args.initialOwner, await buyer.getAddress()); assert.equal(created.args.contentURI, art(0)[0])
  assert.equal((await provider.getBalance(artifact.site)).sub(beforeSite).toString(), '1000000000000')
  assert.equal((await provider.getBalance(artifact.creator)).sub(beforeOwner).toString(), '199000000000000')
  await assert.rejects(c.connect(buyer).estimateGas.mint(...art(0), {value: artifact.priceWei}), /token/)
  for (const id of [419,9999]) { await (await c.connect(buyer).mint(...art(id), {value: artifact.priceWei})).wait(); assert.equal(await c.minted(id), true) }
  await assert.rejects(c.connect(buyer).estimateGas.setPaused(true), /owner/)
  await (await c.setPaused(true)).wait(); await assert.rejects(c.connect(buyer).estimateGas.mint(...art(1), {value: artifact.priceWei}), /paused/)
 } finally { await rpc.disconnect() }
})
test('wallet limit is 20', async () => {
 const rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, miner: { blockGasLimit: 30000000 }, wallet: { unlockedAccounts: [artifact.creator] } })
 const provider = new ethers.providers.Web3Provider(rpc)
 try {
  await rpc.request({ method: 'evm_setAccountBalance', params: [artifact.creator, '0x56BC75E2D63100000'] })
  const c = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, provider.getSigner(artifact.creator)).deploy(); await c.deployed()
  const buyer = provider.getSigner(0)
  for (let id = 0; id < 20; id++) await (await c.connect(buyer).mint(...art(id), {value: artifact.priceWei})).wait()
  await assert.rejects(c.connect(buyer).estimateGas.mint(...art(20), {value: artifact.priceWei}), /wallet/)
 } finally { await rpc.disconnect() }
})
