'use strict'
const {getStore}=require('@netlify/blobs')
const {connect,withConnection,storeOptions}=require('../../api/lib/ethscriptions-blobs')
const {createBeta}=require('../../api/lib/trix-hunt-beta.cjs')
const {createSepolia}=require('../../api/lib/trix-hunt-sepolia.cjs')
const {ethers}=require('ethers')
const {checkRateLimit}=require('../../api/lib/rate-limit')
const provider=new ethers.providers.JsonRpcProvider({url:'https://ethereum-sepolia-rpc.publicnode.com',timeout:12000})
function reply(status,body){return {statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
exports.handler=async function(event){
 if(event.httpMethod!=='POST')return reply(405,{ok:false,error:'POST only'})
 if(!event.body||event.body.length>8192)return reply(400,{ok:false,error:'Invalid request'})
 try{const context=connect(event);return await withConnection(context,async()=>{
  const limit=checkRateLimit({headers:event.headers||{}},{prefix:'trix-hunt-beta',perMinute:120,perDay:5000});if(!limit.ok)return reply(429,{ok:false,error:'Please wait and retry'})
  const body=JSON.parse(event.body),store=getStore({...storeOptions(),name:'trix-hunt-beta',consistency:'strong'}),sepolia=createSepolia({store,provider}),service=createBeta({store,verifyPayment:sepolia.verifyPayment})
  if(body.action==='config')return reply(200,{ok:true,config:await sepolia.config()})
  if(body.action==='register')return reply(200,{ok:true,config:await sepolia.register(body)})
  if(body.action==='start')return reply(200,{ok:true,...await service.start(body)})
  if(body.action==='leaderboard')return reply(200,{ok:true,players:await service.leaderboard()})
  if(body.action==='shot'||body.action==='finish'){const result=await service.mutate(body,body.action);await service.record(result.round);return reply(200,{ok:true,state:result.state,receipt:result.receipt||null})}
  return reply(400,{ok:false,error:'Unknown action'})
 })}catch(error){const m=String(error&&error.message||'');if(/^(Invalid|Session|Round|Shot|Test|Sepolia test contract)/.test(m))return reply(400,{ok:false,error:m});return reply(503,{ok:false,error:'Playtest service unavailable. Please retry.'})}
}
