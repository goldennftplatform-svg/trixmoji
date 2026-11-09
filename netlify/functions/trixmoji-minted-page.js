'use strict'
// Read-only page of on-chain mint flags; never sends a transaction.
const {ethers}=require('ethers')
const info=require('../../assets/data/trixmoji-launch-candidate.json')
const {checkRateLimit}=require('../../api/lib/rate-limit')
const PAGE_SIZE=40
async function inspect(query,deps={}) {
 const raw=String(query.page==null?'':query.page),page=Number(raw)
 if(!/^\d{1,3}$/.test(raw)||!Number.isInteger(page)||page<0||page>=250)throw Error('Invalid page.')
 const request=deps.fetch||fetch, iface=new ethers.utils.Interface(info.abi),start=page*PAGE_SIZE
 const calls=[{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]},{jsonrpc:'2.0',id:2,method:'eth_getCode',params:[info.address,'latest']}]
 for(let i=0;i<PAGE_SIZE;i++)calls.push({jsonrpc:'2.0',id:i+3,method:'eth_call',params:[{to:info.address,data:iface.encodeFunctionData('minted',[start+i])},'latest']})
 let last
 for(const url of [process.env.ETH_RPC_URL,'https://ethereum.publicnode.com'].filter(Boolean)){
  try{
   const response=await request(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify(calls)})
   if(!response.ok)throw Error('Ethereum RPC unavailable.')
   const rows=await response.json();if(!Array.isArray(rows)||rows.length!==calls.length)throw Error('Invalid RPC batch.')
   const byId=new Map();for(const r of rows){if(!r||!Number.isInteger(r.id)||byId.has(r.id)||r.error||typeof r.result!=='string')throw Error('Invalid RPC result.');byId.set(r.id,r.result)}
   if(BigInt(byId.get(1))!==1n||ethers.utils.keccak256(byId.get(2)).toLowerCase()!==info.runtimeHash.toLowerCase())throw Error('Mint contract mismatch.')
   const minted=[]
   for(let i=0;i<PAGE_SIZE;i++){const value=byId.get(i+3);if(!/^0x[0-9a-f]{64}$/i.test(value)||BigInt(value)>1n)throw Error('Invalid mint state.');if(BigInt(value)===1n)minted.push(start+i)}
   return {page,pageSize:PAGE_SIZE,contract:info.address,minted}
  }catch(error){last=error}
 }
 throw last||Error('Ethereum RPC unavailable.')
}
exports.inspect=inspect
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return {statusCode:405,body:'Method not allowed'}
 const limit=checkRateLimit({headers:event.headers||{}},{prefix:'trixmoji-minted-page',perMinute:60,perDay:3000})
 if(!limit.ok)return {statusCode:429,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Please wait before refreshing.'})}
 try{return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=10, s-maxage=10'},body:JSON.stringify({ok:true,...await inspect(event.queryStringParameters||{})})}}
 catch(e){return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({ok:false,error:'Minted status unavailable; check again shortly.'})}}
}
