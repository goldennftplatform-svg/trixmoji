'use strict'
const { getStore } = require('@netlify/blobs')
const { connect,withConnection,storeOptions } = require('../../api/lib/ethscriptions-blobs')
const { createService } = require('../../api/lib/trix-hunt-admin.cjs')
const { checkRateLimit } = require('../../api/lib/rate-limit')
function reply(status,body){return {statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
exports.handler=async function(event){
 if(event.httpMethod!=='POST')return reply(405,{error:'POST only'})
 if(!event.body || event.body.length>100000)return reply(400,{error:'Invalid request'})
 try{
  const connection=connect(event)
  return await withConnection(connection,async()=>{
   const body=JSON.parse(event.body),headers=event.headers||{},req={headers,method:event.httpMethod}
   if(!checkRateLimit(req,{prefix:'trix-hunt-admin',perMinute:30,perDay:1000}).ok)return reply(429,{error:'Please retry later'})
   const store=getStore({...storeOptions(),name:'trix-hunt-admin',consistency:'strong'})
   const snapshot=async()=>{const r=await fetch('https://trixmoji.netlify.app/.netlify/functions/trixmoji-market-launch',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Escrow snapshot unavailable');return r.json()}
   const service=createService({store,snapshot})
   const result=body.action==='login'?await service.login(body):body.action==='data'?await service.data(body.token):body.action==='save'?await service.save(body.token,body):null
   return result?reply(200,{ok:true,...result}):reply(400,{error:'Unknown action'})
  })
 }catch(error){const text=String(error&&error.message||'');if(text==='Unauthorized')return reply(401,{error:'Unauthorized'});if(['Invalid order','Inventory changed; reload before saving'].includes(text))return reply(409,{error:text});return reply(503,{error:'Admin service unavailable'})}
}
