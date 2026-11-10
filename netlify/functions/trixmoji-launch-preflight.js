'use strict'
const crypto=require('crypto'), {ethers}=require('ethers')
const info=require('../../assets/data/trixmoji-launch-candidate.json')
const {validatePayload}=require('../../api/lib/trixmoji-launch-verify.cjs')
const {checkRateLimit}=require('../../api/lib/rate-limit')
const sources=()=>[process.env.ETH_RPC_URL,'https://ethereum.publicnode.com'].filter(Boolean)
async function rpc(url,method,params) {
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(7000),body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})
 if(!response.ok) throw Error('Ethereum RPC unavailable.')
 const body=await response.json(); if(body.error) throw Error(body.error.message||'RPC error.'); return body.result
}
async function inspect(query,deps={}) {
 const raw=String(query.token==null?'':query.token), tokenNo=Number(raw), buyer=String(query.buyer||'')
 if(!/^\d{1,4}$/.test(raw)||!Number.isInteger(tokenNo)||tokenNo>=10000||!ethers.utils.isAddress(buyer)||/^0x0{40}$/i.test(buyer)) throw Error('Specify a token number 0–9999 and an Ethereum buyer address.')
 // The public/custom domain may only forward the homepage, not serve assets.
 // Fetch committed artwork from the known production asset origin instead.
 const get=deps.fetch||fetch, request=deps.rpc||rpc, base='https://trixmoji.netlify.app'
 const [manifestResponse,imageResponse]=await Promise.all([get(base+'/assets/ethscriptions/trixmoji-launch/manifest.json',{signal:AbortSignal.timeout(15000)}),get(base+'/assets/ethscriptions/trixmoji-launch/'+tokenNo+'.webp',{signal:AbortSignal.timeout(15000)})])
 if(!manifestResponse.ok||!imageResponse.ok) throw Error('Artwork or manifest unavailable.')
 const manifest=await manifestResponse.json(), entry=manifest.files&&manifest.files[tokenNo]
 if(manifest.root!==info.root||!entry||entry.id!==tokenNo) throw Error('Artwork manifest mismatch.')
 const uri='data:image/webp;base64,'+Buffer.from(await imageResponse.arrayBuffer()).toString('base64')
 validatePayload(uri,entry.proof,tokenNo)
 const contentSha=crypto.createHash('sha256').update(uri).digest('hex')
 const indexResponse=await get('https://api.ethscriptions.com/v2/ethscriptions/exists/0x'+contentSha,{signal:AbortSignal.timeout(8000)})
 if(!indexResponse.ok) throw Error('Ethscriptions uniqueness check unavailable.')
 const indexed=await indexResponse.json()
 if(!indexed.result||typeof indexed.result.exists!=='boolean') throw Error('Ethscriptions uniqueness response invalid.')
 const iface=new ethers.utils.Interface(info.abi); let lastError
 for(const url of sources()) {
  try {
   const call=data=>request(url,'eth_call',[{to:info.address,data},'latest'])
   const [network,code,pausedRaw,mintedRaw,countRaw]=await Promise.all([request(url,'eth_chainId',[]),request(url,'eth_getCode',[info.address,'latest']),call(iface.encodeFunctionData('paused')),call(iface.encodeFunctionData('minted',[tokenNo])),call(iface.encodeFunctionData('mintedBy',[buyer]))])
   if(BigInt(network)!==1n||String(code).toLowerCase()!==info.runtime.toLowerCase()) throw Error('TrixMoji minter does not match the reviewed deployment.')
   const paused=iface.decodeFunctionResult('paused',pausedRaw)[0],minted=iface.decodeFunctionResult('minted',mintedRaw)[0],count=iface.decodeFunctionResult('mintedBy',countRaw)[0].toNumber()
   let gas=null,gasPrice=null,estimateError=null
   if(!paused&&!minted&&count<20&&!indexed.result.exists) {
    const tx={from:buyer,to:info.address,value:ethers.utils.hexValue(ethers.BigNumber.from(info.priceWei)),data:iface.encodeFunctionData('mint',[uri,entry.proof,tokenNo])}
    try { const values=await Promise.all([request(url,'eth_estimateGas',[tx]),request(url,'eth_gasPrice',[])]);gas=BigInt(values[0]).toString();gasPrice=BigInt(values[1]).toString() }
    catch(error) { const message=String(error.message||error);estimateError=/insufficient funds|insufficient balance|exceeds (?:the )?(?:account )?balance|out[\s_-]*of[\s_-]*funds/i.test(message)?'Insufficient funds for this mint and gas.':/execution reverted/i.test(message)?'Mint simulation reverted.':'Gas estimation is unavailable.' }
   }
   const insufficientFunds=!gas&&!!estimateError&&/insufficient funds/i.test(estimateError)
   return {tokenNo,buyer,contract:info.address,chainId:1,paused,minted,walletMintCount:count,contentAlreadyInscribed:indexed.result.exists,artworkProofValid:true,contentSha256:contentSha,estimatedGas:gas,estimatedGasPriceWei:gasPrice,estimateError,insufficientFunds,readOnly:true,readyToRequestWallet:!!gas&&!!gasPrice||insufficientFunds}
  } catch(error) { lastError=error }
 }
 throw lastError||Error('Ethereum RPC unavailable.')
}
exports.inspect=inspect
exports.handler=async event=>{
 if(event.httpMethod!=='GET') return {statusCode:405,body:'Method not allowed'}
 const limit=checkRateLimit({headers:event.headers||{}},{prefix:'trixmoji-launch-preflight',perMinute:15,perDay:500})
 if(!limit.ok) return {statusCode:429,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Please wait before retrying.'})}
 try { return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({ok:true,...await inspect(event.queryStringParameters||{})})} }
 catch(error) { const message=String(error.message||error),safe=/^(Specify a token number|Artwork|TrixMoji minter|Ethscriptions uniqueness|Invalid TrixMoji|TrixMoji artwork)/.test(message);return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({ok:false,error:safe?message:'Mint preflight is unavailable. No transaction was requested.'})} }
}
