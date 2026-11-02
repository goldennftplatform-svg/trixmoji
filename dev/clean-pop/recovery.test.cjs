const {test}=require('node:test'), assert=require('node:assert/strict')
const {inspect}=require('../../assets/js/core/clean-pop-recovery')
const creator='0x'+'1'.repeat(40), address='0x'+'2'.repeat(40)
const saved={address,state:'awaiting-wallet'}
function provider(overrides={}){return {request:async({method,params})=>{
 const defaults={eth_chainId:'0x1',eth_accounts:[creator],eth_getCode:'0x',eth_getTransactionCount:'0x5'}
 if(!(method in defaults))throw Error('Unexpected RPC: '+method)
 const result=overrides[method]??defaults[method]
 return typeof result==='function'?result(params):result
}}}
test('permits recovery only after no-code and no-pending read-only checks',async()=>{
 assert.deepEqual(await inspect(provider(),creator,address,saved),{latestNonce:'5',pendingNonce:'5'})
})
test('refuses reset for submitted hash, deployed code, pending nonce and wrong wallet/chain',async()=>{
 await assert.rejects(inspect(provider(),creator,address,{...saved,hash:'0x123'}),/transaction hash/)
 await assert.rejects(inspect(provider({eth_getCode:'0x6000'}),creator,address,saved),/already exists/)
 await assert.rejects(inspect(provider({eth_getTransactionCount:p=>p[1]==='pending'?'0x6':'0x5'}),creator,address,saved),/pending transaction/)
 await assert.rejects(inspect(provider({eth_accounts:[address]}),creator,address,saved),/creator wallet/)
 await assert.rejects(inspect(provider({eth_chainId:'0xaa36a7'}),creator,address,saved),/mainnet/)
})
