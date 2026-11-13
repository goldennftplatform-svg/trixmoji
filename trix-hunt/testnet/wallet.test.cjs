'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict')
const {connect,selectAccount}=require('./wallet.js')
const expected='0x47cf60bdd877203264921d05ce26f81f6d36aa3e',wrong='0x5f5d219c6b3f732ebdce4bfd9c4655957ff472c4'
test('requests wallet connection synchronously from the button click without sending a transaction',async()=>{
 const calls=[],p={request:({method})=>{calls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return Promise.resolve([expected]);if(method==='eth_chainId')return Promise.resolve('0xAA36A7');throw Error('unexpected')}}
 const pending=connect(p,expected);assert.deepEqual(calls,['eth_requestAccounts']);
 assert.equal(await pending,expected);assert.deepEqual(calls,['eth_requestAccounts','eth_chainId','eth_accounts'])
})
test('accepts an already-authorized account without requesting another transaction',async()=>{
 const calls=[],p={request:async({method})=>{calls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return[expected];if(method==='eth_chainId')return'0xaa36a7';throw Error('unexpected')}}
 assert.equal(await connect(p,expected),expected);assert.deepEqual(calls,['eth_requestAccounts','eth_chainId','eth_accounts'])
})
test('offers an account selection path when an already-connected wallet is different',async()=>{
 let account=wrong;const calls=[],p={request:async({method})=>{calls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return[account];if(method==='wallet_requestPermissions'){account=expected;return []}if(method==='eth_chainId')return '0xaa36a7';throw Error('unexpected')}}
 await assert.rejects(connect(p,expected),e=>e.code==='WRONG_ACCOUNT'&&e.message.includes(wrong));assert.equal(await selectAccount(p,expected),expected);assert.equal(await connect(p,expected),expected);assert.ok(calls.includes('wallet_requestPermissions'));assert.ok(!calls.includes('eth_sendTransaction'))
})
test('reports an already-open wallet prompt and does not clear or retry it',async()=>{
 const p={request:async()=>{throw Object.assign(new Error('pending'),{code:-32002})}}
 await assert.rejects(connect(p,expected),/already has a request open/)
})
test('switches only the selected account to Sepolia and verifies the chain',async()=>{
 let chain='0x1';const calls=[],p={request:async({method})=>{calls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return[expected];if(method==='eth_chainId')return chain;if(method==='wallet_switchEthereumChain'){chain='0xaa36a7';return null}throw Error('unexpected')}}
 assert.equal(await connect(p,expected),expected);assert.deepEqual(calls,['eth_requestAccounts','eth_chainId','wallet_switchEthereumChain','eth_chainId','eth_accounts'])
})
test('adds Sepolia when the wallet does not recognize it, then switches and rechecks account',async()=>{
 let chain='0x1',added=false;const calls=[],p={request:async({method,params})=>{calls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return[expected];if(method==='eth_chainId')return chain;if(method==='wallet_switchEthereumChain'){if(!added)throw {code:4902,message:'Unrecognized chain ID'};chain='0xaa36a7';return null}if(method==='wallet_addEthereumChain'){assert.equal(params[0].chainId,'0xaa36a7');added=true;return null}throw Error('unexpected')}}
 assert.equal(await connect(p,expected),expected);assert.deepEqual(calls,['eth_requestAccounts','eth_chainId','wallet_switchEthereumChain','wallet_addEthereumChain','wallet_switchEthereumChain','eth_chainId','eth_accounts'])
})
test('shows plain wallet errors without exposing private RPC URLs',async()=>{
 const p={request:async({method})=>{if(method==='eth_requestAccounts')return[expected];throw {code:-32603,message:'Network failed at https://secret.example/key'}}}
 await assert.rejects(connect(p,expected),e=>e.message.includes('Network failed')&&!e.message.includes('secret.example'))
})
