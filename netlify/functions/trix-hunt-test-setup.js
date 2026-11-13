'use strict'
// Sepolia setup only. This function cannot deploy a contract or request a wallet transaction.
const {getStore}=require('@netlify/blobs')
const {connect,withConnection,storeOptions}=require('../../api/lib/ethscriptions-blobs')
const {createSepolia}=require('../../api/lib/trix-hunt-sepolia.cjs')
const {checkRateLimit}=require('../../api/lib/rate-limit')
const {ethers}=require('ethers')
const provider=new ethers.providers.JsonRpcProvider({url:'https://ethereum-sepolia-rpc.publicnode.com',timeout:12000})
function reply(status,body){return {statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
exports.handler=async function(event){
 if(event.httpMethod!=='POST')return reply(405,{ok:false,error:'POST only'})
 if(!event.body||event.body.length>8192)return reply(400,{ok:false,error:'Invalid request'})
 try{const context=connect(event);return await withConnection(context,async()=>{
  if(!checkRateLimit({headers:event.headers||{}},{prefix:'trix-hunt-test-setup',perMinute:20,perDay:500}).ok)return reply(429,{ok:false,error:'Please retry later'})
  const body=JSON.parse(event.body),store=getStore({...storeOptions(),name:'trix-hunt-beta',consistency:'strong'}),service=createSepolia({store,provider})
  if(body.action==='config')return reply(200,{ok:true,config:await service.config()})
  if(body.action==='register')return reply(200,{ok:true,config:await service.register(body)})
  return reply(400,{ok:false,error:'Unknown action'})
 })}catch(error){const m=String(error&&error.message||'');if(/^(Invalid|Test deployment|Test contract|Wrong test network)/.test(m))return reply(400,{ok:false,error:m});return reply(503,{ok:false,error:'Sepolia setup unavailable. Please retry.'})}
}
