'use strict'
// Count creations attributed to the current minter by the Ethscriptions indexer.
// Bounded work returns an explicitly labelled lower bound rather than guessing.
const {checkRateLimit}=require('../../api/lib/rate-limit')
const minter=require('../../assets/data/trixmoji-launch-candidate.json')
async function inspect(deps={}) {
 const get=deps.fetch||fetch, now=deps.now||Date.now, start=now(), seen=new Set(), cursors=new Set()
 let cursor=null, pages=0, complete=false
 while(pages<20 && now()-start<18000){
  const url=new URL('https://api.ethscriptions.com/v2/ethscriptions');url.searchParams.set('creator',minter.address);if(cursor)url.searchParams.set('page_key',cursor)
  let response
  try{response=await get(url.toString(),{signal:AbortSignal.timeout(4000)})}catch(e){if(pages)break;throw e}
  if(!response.ok){if(pages)break;throw Error('Indexer unavailable')}
  const result=await response.json()
  if(!Array.isArray(result.result)||!result.pagination||typeof result.pagination.has_more!=='boolean')throw Error('Invalid indexer response')
  for(const item of result.result){if(!item||!/^0x[0-9a-f]{64}$/i.test(String(item.transaction_hash||''))||String(item.creator||'').toLowerCase()!==minter.address.toLowerCase())throw Error('Invalid indexed creation');seen.add(item.transaction_hash.toLowerCase())}
  pages++
  if(!result.pagination.has_more){complete=true;break}
  cursor=result.pagination.page_key
  if(!/^0x[0-9a-f]{64}$/i.test(String(cursor||''))||cursors.has(cursor.toLowerCase()))throw Error('Invalid indexer pagination')
  cursors.add(cursor.toLowerCase())
 }
 if(!pages||seen.size>10000)throw Error('Invalid indexed count')
 return {count:seen.size,supply:10000,complete,source:'ethscriptions-indexer'}
}
exports.inspect=inspect
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return {statusCode:405,body:'Method not allowed'}
 const limit=checkRateLimit({headers:event.headers||{}},{prefix:'trixmoji-mint-count',perMinute:15,perDay:1500})
 if(!limit.ok)return {statusCode:429,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Please wait before retrying.'})}
 try{return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60, s-maxage=120'},body:JSON.stringify({ok:true,...await inspect()})}}
 catch(_){return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({ok:false,error:'Mint count unavailable.'})}}
}
