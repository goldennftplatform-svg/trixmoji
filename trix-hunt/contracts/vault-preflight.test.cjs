'use strict'
const test=require('node:test'),assert=require('node:assert/strict'),{ethers}=require('ethers')
const {preflight}=require('./vault-preflight.cjs')
test('checks raw-ID selector collisions using the repository ethers version',()=>{
 const abi=[{type:'function',name:'depositor',inputs:[],outputs:[{type:'address'}],stateMutability:'view'}]
 const selector=new ethers.utils.Interface(abi).getSighash('depositor')
 assert.equal(preflight(abi,selector+'a'.repeat(56)).safeFromSelectorCollision,false)
 assert.equal(preflight(abi,'0x'+'1'.repeat(64)).safeFromSelectorCollision,true)
 assert.throws(()=>preflight(abi,'0x'+'0'.repeat(64)))
})
