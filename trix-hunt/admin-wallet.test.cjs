'use strict'
const test=require('node:test'),assert=require('node:assert/strict')
const {selectCreator}=require('./admin-wallet.js')
const creator='0x915a3d363d0a4e4470b531f008f5142c540e5417'
test('opens wallet account selector and accepts the selected creator',async()=>{
 const calls=[],provider={request:async req=>{calls.push(req.method);return req.method==='eth_accounts'?[creator.toUpperCase()]:[]}}
 assert.equal(await selectCreator(provider,creator),creator.toUpperCase());assert.deepEqual(calls,['wallet_requestPermissions','eth_accounts'])
})
test('rejects a different account and identifies the required creator',async()=>{
 const provider={request:async req=>req.method==='eth_accounts'?['0x'+'1'.repeat(40)]:[]}
 await assert.rejects(selectCreator(provider,creator),/authorized escrow admin wallet/)
})
test('accepts either configured admin account',async()=>{
 const verifier='0x'+'2'.repeat(40),provider={request:async req=>req.method==='eth_accounts'?[verifier]:[]}
 assert.equal(await selectCreator(provider,[creator,verifier]),verifier)
})
test('handles rejected and unsupported account selection without bypassing identity',async()=>{
 await assert.rejects(selectCreator({request:async()=>{throw Object.assign(new Error('cancel'),{code:4001})}},creator),/cancelled/)
 await assert.rejects(selectCreator({request:async()=>{throw Object.assign(new Error('unsupported'),{code:4200})}},creator),/Open the wallet/)
})
