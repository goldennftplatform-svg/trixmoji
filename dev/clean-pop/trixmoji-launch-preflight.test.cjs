'use strict'
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), {ethers}=require('ethers')
const {inspect}=require('../../netlify/functions/trixmoji-launch-preflight')
const info=require('../../assets/data/trixmoji-launch-candidate.json'), manifest=require('../../assets/ethscriptions/trixmoji-launch/manifest.json')
const token=419, image=fs.readFileSync(path.resolve(__dirname,'../../assets/ethscriptions/trixmoji-launch/419.webp')), iface=new ethers.utils.Interface(info.abi), buyer='0x1111111111111111111111111111111111111111'
function mocks(options={}) {
 let estimated=0
 const fetch=async url=>url.includes('/manifest.json')?{ok:true,json:async()=>manifest}:url.includes('/exists/')?{ok:true,json:async()=>({result:{exists:!!options.exists}})}:{ok:true,arrayBuffer:async()=>image}
 const rpc=async (_,method,params)=>{
  if(method==='eth_chainId') return '0x1'
  if(method==='eth_getCode') return options.noCode?'0x':info.runtime
  if(method==='eth_gasPrice') return '0x10'
  if(method==='eth_estimateGas') {estimated++;if(options.error) throw Error(options.error);return '0x123456'}
  if(method==='eth_call') {const selector=params[0].data.slice(0,10);if(selector===iface.getSighash('paused'))return iface.encodeFunctionResult('paused',[!!options.paused]);if(selector===iface.getSighash('minted'))return iface.encodeFunctionResult('minted',[!!options.minted]);if(selector===iface.getSighash('mintedBy'))return iface.encodeFunctionResult('mintedBy',[options.count||0])}
  throw Error('Unexpected RPC '+method)
 }
 return {fetch,rpc,estimates:()=>estimated}
}
test('preflight checks real artwork proof and exact runtime',async()=>{const m=mocks(),result=await inspect({token:String(token),buyer},m);assert.equal(result.readyToRequestWallet,true);assert.equal(result.contentSha256,manifest.files[token].contentSha256);assert.equal(m.estimates(),1)})
test('preflight blocks wrong runtime, paused or minted token, wallet limit and duplicate content',async()=>{
 await assert.rejects(inspect({token:String(token),buyer},mocks({noCode:true})),/does not match/)
 for(const options of [{paused:true},{minted:true},{count:20},{exists:true}]) {const m=mocks(options),result=await inspect({token:String(token),buyer},m);assert.equal(result.readyToRequestWallet,false);assert.equal(m.estimates(),0)}
 const bad=await inspect({token:String(token),buyer},mocks({error:'execution reverted'}));assert.equal(bad.readyToRequestWallet,false)
})
