'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { ethers } = require('ethers')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json'), iface = new ethers.utils.Interface(artifact.abi)
const owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', market = '0x21c1A938d06f87A039abfC48d1cCB459f55b1685', id = '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74', original = '0x9de253efbaeb700b2947630706ce0234c19b23a8eb3ab16d1adb40db0e5a57c5', recovery = ethers.utils.id('recovery'), block = 26339898
function fixture({ currentOwner = owner, recordedBlock = block } = {}) {
 let canceled = false, sends = 0
 const originalLog = iface.encodeEventLog(iface.getEvent('Deposited'), [owner, id, block]), cancelLog = iface.encodeEventLog(iface.getEvent('Cancelled'), [owner, id])
 const provider = { request: async q => {
  if (q.method === 'eth_getCode') return '0x6000'
  if (q.method === 'eth_getTransactionByHash') return { hash: original, from: owner, to: '0x1111111111111111111111111111111111111111' }
  if (q.method === 'eth_getTransactionReceipt') return q.params[0] === original ? { transactionHash: original, status: '0x1', blockNumber: ethers.utils.hexValue(block), logs: [{ address: market, ...originalLog }] } : { transactionHash: recovery, status: '0x1', blockNumber: ethers.utils.hexValue(block + 7), logs: [{ address: market, ...cancelLog }] }
  if (q.method === 'eth_call') return iface.encodeFunctionResult('depositBlock', [canceled ? 0 : recordedBlock])
  if (q.method === 'eth_blockNumber') return ethers.utils.hexValue(block + 10)
  if (q.method === 'eth_getTransactionCount') return '0x10'
  if (q.method === 'eth_estimateGas') return '0x10000'
  if (q.method === 'eth_sendTransaction') { sends++; canceled = true; return recovery }
  throw Error('unexpected RPC ' + q.method)
 } }
 function element() { return { textContent: '', hidden: false, disabled: false, value: '', children: [], append(...xs) { this.children.push(...xs) } } }
 const ids = ['wallets','connect','prepare','status','review','saved','details','hash','check'], els = Object.fromEntries(ids.map(x => [x, element()])), store = new Map()
 const storage = { getItem: k => store.get(k) || null, setItem: (k,v) => store.set(k,v), removeItem: k => store.delete(k) }
 const rowsKey = 'trixmoji.market.contract.transaction.v1'; storage.setItem(rowsKey, JSON.stringify([{ action: 'depositAndList', from: owner, to: market, assetId: id, hash: original, state: 'submitted' }]))
 const fetch = async url => ({ ok: true, json: async () => String(url).includes('status') ? { last_imported_block: block + 10 } : String(url).includes('artifact') ? artifact : { result: { transaction_hash: id, current_owner: currentOwner } } })
 const context = { document: { getElementById: k => els[k], createElement: () => element() }, localStorage: storage, navigator: { locks: { request: async (_, __, fn) => fn({}) } }, EthscriptionCheckout: { choose: async () => provider, identity: async () => {} }, ethers, fetch, Promise, Error, Number, String, JSON, BigInt }
 let source = fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/replacement-6-recovery.js'), 'utf8').replace('0x509d4162264a94c741c00f6acfdd096aba84b6c03ca90db29bfe1043e89cd22e', ethers.utils.keccak256('0x6000'))
 vm.runInNewContext(source, context)
 return { els, storage, rowsKey, sends: () => sends }
}
test('replacement recovery only requests cancellation after explicit review and verifies indexed state', async () => {
 const f = fixture(); await f.els.connect.onclick(); const running = f.els.prepare.onclick(); await new Promise(resolve => setTimeout(resolve, 25))
 assert.equal(f.sends(), 0); const yes = f.els.review.children.find(x => x.textContent === 'APPROVE RECOVERY IN WALLET'); assert.ok(yes); yes.onclick(); await running
 assert.equal(f.sends(), 1); f.els.hash.value = recovery; await f.els.check.onclick()
 assert.match(f.els.status.textContent, /Recovery confirmed/); assert.equal(JSON.parse(f.storage.getItem(f.rowsKey))[0].state, 'failed')
})
test('replacement recovery refuses changed indexed ownership or deposit record before asking for approval', async () => {
 for (const options of [{ currentOwner: market }, { recordedBlock: block + 1 }]) {
  const f = fixture(options); await f.els.connect.onclick(); await f.els.prepare.onclick(); assert.equal(f.sends(), 0); assert.equal(f.els.review.children.length, 0)
 }
})
