'use strict'
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), {ethers} = require('ethers')
const a=require('../../assets/data/trixmoji-launch-candidate.json'), d=require('../../assets/data/trixmoji-launch-deployment.json'), m=require('../../assets/ethscriptions/trixmoji-launch/manifest.json')
const {validatePayload,decodeCreation}=require('../../api/lib/trixmoji-launch-verify.cjs')
test('deployment record matches the candidate',()=>{assert.equal(d.address,a.address);assert.equal(d.root,a.root);assert.equal(d.runtimeHash,a.runtimeHash);assert.equal(d.deploymentBlock,26374149)})
test('real candidate art and proof validate; tampering or wrong number fails',()=>{
 const n=419, uri='data:image/webp;base64,'+fs.readFileSync(path.resolve(__dirname,'../../assets/ethscriptions/trixmoji-launch',`${n}.webp`)).toString('base64'), proof=m.files[n].proof
 validatePayload(uri,proof,n)
 assert.throws(()=>validatePayload(uri+'A',proof,n))
 assert.throws(()=>validatePayload(uri,proof,n+1))
 const data=new ethers.utils.Interface(a.abi).encodeFunctionData('mint',[uri,proof,n])
 assert.deepEqual(decodeCreation(data,uri),{tokenNo:n,preview:'/assets/ethscriptions/trixmoji-launch/419.webp'})
 assert.throws(()=>decodeCreation(data,uri+'A'))
})
