'use strict'
const chain = require('../../api/lib/ethscriptions-chain')
const {verify} = require('../../api/lib/trixmoji-launch-verify.cjs')
const {checkRateLimit} = require('../../api/lib/rate-limit')
async function inspect(query, source=chain) {
 const token=String(query.token == null ? '' : query.token), hash=String(query.hash||''), buyer=String(query.buyer||'')
 if (!/^\d{1,4}$/.test(token)||Number(token)>=10000||!source.isHash(hash)||!source.isAddr(buyer)) throw Error('Invalid mint verification request.')
 return verify(source,hash,buyer,Number(token))
}
exports.inspect=inspect
exports.handler=async event => {
 if(event.httpMethod!=='GET') return {statusCode:405,body:'Method not allowed'}
 const limit=checkRateLimit({headers:event.headers||{}},{prefix:'trixmoji-launch-verify',perMinute:15,perDay:500})
 if(!limit.ok) return {statusCode:429,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Please wait before retrying.'})}
 try { return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({ok:true,...await inspect(event.queryStringParameters||{})})} }
 catch(error) { const message=String(error.message||error), safe=/^(Invalid mint|Transaction does not match|Transaction is not a TrixMoji|Creation event|TrixMoji artwork|Minted number|That transaction is not on Ethereum yet|That transaction is not confirmed|Ethscriptions indexing is pending|The indexed Ethscription does not match)/.test(message); return {statusCode:400,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({ok:false,error:safe?message:'Mint verification is unavailable. Check the saved transaction before retrying.'})} }
}
