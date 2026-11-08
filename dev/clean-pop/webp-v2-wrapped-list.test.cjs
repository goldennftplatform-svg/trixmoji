'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { create } = require('../../assets/js/core/market-wallet-adapter')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json'), iface = new ethers.utils.Interface(artifact.abi)
const market = '0x21c1A938d06f87A039abfC48d1cCB459f55b1685', creator = '0x915A3D363D0a4e4470B531f008F5142c540E5417', verifier = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4', sender = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', manager = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3', id = ethers.utils.id('asset'), hash = ethers.utils.id('listing')
const wrapper = new ethers.utils.Interface(['function redeemDelegations(bytes[] permissionContexts,bytes32[] modes,bytes[] executionCallDatas)'])
function fixture(options = {}) {
 const data = iface.encodeFunctionData('list', [id, 1]), inner = ethers.utils.hexConcat([options.target || market, ethers.constants.HashZero, data])
 const wrapped = wrapper.encodeFunctionData('redeemDelegations', [['0x'], [options.mode || ethers.constants.HashZero], [inner]])
 const row = { key: 'test', state: 'submitted', action: options.action || 'list', hash, from: sender, to: market, data, value: '0x0', assetId: id }, store = new Map([['trixmoji.market.contract.transaction.webp-v2', JSON.stringify([row])]])
 const provider = { request: async q => { if (q.method === 'eth_chainId') return '0x1'; if (q.method === 'eth_getTransactionByHash') return { from: sender, to: options.manager || manager, input: wrapped, value: '0x0' }; if (q.method === 'eth_getTransactionReceipt') return { status: '0x1', logs: [] }; throw Error('Unexpected RPC') } }
 const client = create({ provider, storageKey: 'trixmoji.market.contract.transaction.webp-v2', storage: { getItem: k => store.get(k) || null, setItem: (k,v) => store.set(k,v) }, locks: { request: async (_, __, fn) => fn({}) }, abi: artifact.abi, runtimeHash: ethers.utils.keccak256('0x6000'), market, creator, verifier, chainId: 1, readAsset: async () => ({}) })
 return { client, row }
}
test('a single wrapped listing reconciles only after event verification', async () => {
 const f = fixture(); let verified = false
 const result = await f.client.reconcile(f.row, async () => { verified = true; return true })
 assert.equal(result.complete, true); assert.equal(verified, true); assert.equal(f.client.records()[0].state, 'complete')
})
test('wrong manager, execution mode, target, or a wrapped deposit cannot be reconciled as a listing', async () => {
 for (const options of [{ manager: sender }, { target: sender }, { mode: ethers.utils.hexZeroPad('0x01', 32) }, { action: 'deposit' }]) {
  const f = fixture(options); await assert.rejects(f.client.reconcile(f.row, async () => true), /does not match/); assert.equal(f.client.records()[0].state, 'submitted')
 }
})
