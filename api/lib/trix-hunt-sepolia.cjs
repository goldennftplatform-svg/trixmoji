'use strict'
const {ethers}=require('ethers')
const defaultArtifact=require('../../trix-hunt/sepolia-settlement-artifact.json')
const CHAIN=11155111,CONFIG='sepolia-payment-config-v1',same=(a,b)=>String(a||'').toLowerCase()===String(b||'').toLowerCase()
function registrationMessage(address,hash,nonce,expires){return ['Trix Hunt Sepolia test setup','Chain: 11155111','Contract: '+address.toLowerCase(),'Deployment: '+hash.toLowerCase(),'Nonce: '+nonce.toLowerCase(),'Expires: '+expires].join('\n')}
function createSepolia({store,provider,now=()=>Date.now(),artifact=defaultArtifact}){
 const iface=new ethers.utils.Interface(artifact.abi)
 async function network(){const n=await provider.getNetwork();if(n.chainId!==CHAIN)throw Error('Wrong test network')}
 async function contract(address){
  if(!ethers.utils.isAddress(address||''))throw Error('Test contract unavailable')
  await network();const code=await provider.getCode(address);if(!code||code==='0x'||!same(ethers.utils.keccak256(code),artifact.runtimeHash))throw Error('Test contract mismatch')
  const c=new ethers.Contract(address,artifact.abi,provider),[feed,operator]=await Promise.all([c.feed(),c.operator()]);if(!same(feed,artifact.feed)||!same(operator,artifact.operator))throw Error('Test contract roles mismatch');return c
 }
 async function config(){const x=await store.getWithMetadata(CONFIG,{type:'json',consistency:'strong'});return x&&x.data||null}
 async function register(body){
  const address=String(body.address||''),hash=String(body.hash||''),nonce=String(body.nonce||'').toLowerCase(),expires=Number(body.expires),current=Math.floor(now()/1000)
  if(!ethers.utils.isAddress(address)||!/^0x[a-f0-9]{64}$/i.test(hash)||!/^0x[a-f0-9]{32}$/.test(nonce)||!Number.isSafeInteger(expires)||expires<current||expires>current+180||typeof body.signature!=='string'||body.signature.length>300)throw Error('Invalid setup authorization')
  let signer;try{signer=ethers.utils.verifyMessage(registrationMessage(address,hash,nonce,expires),body.signature)}catch(_){throw Error('Invalid setup authorization')}
  if(!same(signer,artifact.operator))throw Error('Invalid setup authorization')
  const existing=await config();if(existing){if(same(existing.address,address)&&same(existing.hash,hash))return existing;throw Error('Test contract already configured')}
  const [tx,receipt]=await Promise.all([provider.getTransaction(hash),provider.getTransactionReceipt(hash)])
  const creation=new ethers.ContractFactory(artifact.abi,artifact.bytecode).getDeployTransaction(artifact.feed,artifact.operator).data
  if(!tx||!receipt||receipt.status!==1||!same(tx.hash,hash)||!same(receipt.transactionHash,hash)||!same(tx.from,artifact.operator)||tx.to!==null||!same(receipt.contractAddress,address)||!same(tx.data,creation)||!ethers.BigNumber.from(tx.value).isZero())throw Error('Test deployment mismatch')
  await contract(address)
  const used=await store.setJSON('setup-nonce-'+nonce.slice(2),{expires},{onlyIfNew:true});if(!used||!used.modified)throw Error('Invalid setup authorization')
  const value={address:ethers.utils.getAddress(address),hash:hash.toLowerCase(),chainId:CHAIN,runtimeHash:artifact.runtimeHash}
  const saved=await store.setJSON(CONFIG,value,{onlyIfNew:true});if(!saved||!saved.modified){const other=await config();if(other&&same(other.address,address)&&same(other.hash,hash))return other;throw Error('Test contract already configured')}
  return value
 }
 async function verifyPayment(input){
  const cfig=await config();if(!cfig)throw Error('Sepolia test contract not configured')
  const hash=String(input&&input.hash||''),secret=String(input&&input.secret||''),wallet=String(input&&input.wallet||''),pack=Number(input&&input.pack)
  if(!/^0x[a-f0-9]{64}$/i.test(hash)||!/^0x[a-f0-9]{64}$/i.test(secret)||!ethers.utils.isAddress(wallet)||!Number.isInteger(pack)||pack<0||pack>2)throw Error('Invalid test payment')
  const roundId=ethers.utils.keccak256(secret),c=await contract(cfig.address),[tx,receipt]=await Promise.all([provider.getTransaction(hash),provider.getTransactionReceipt(hash)])
  if(!tx||!receipt||receipt.status!==1||!same(tx.hash,hash)||!same(receipt.transactionHash,hash)||!same(tx.from,wallet)||!same(tx.to,cfig.address))throw Error('Test payment not confirmed')
  let parsed;try{parsed=iface.parseTransaction({data:tx.data,value:tx.value})}catch(_){throw Error('Invalid test payment')}
  if(parsed.name!=='startRound'||!same(parsed.args.sessionId,roundId)||Number(parsed.args.pack)!==pack)throw Error('Invalid test payment')
  const events=receipt.logs.filter(l=>same(l.address,cfig.address)).map(l=>{try{return iface.parseLog(l)}catch(_){return null}}).filter(e=>e&&e.name==='RoundStarted'&&same(e.args.sessionId,roundId)&&same(e.args.player,wallet)&&Number(e.args.pack)===pack)
  if(events.length!==1)throw Error('Test payment event missing')
  const round=await c.rounds(roundId);if(!same(round.player,wallet)||round.settled||Number(round.pack)!==pack||!round.price.eq(events[0].args.price)||round.deadline.lte(Math.floor(now()/1000)))throw Error('Test round unavailable')
  return {roundId,wallet:ethers.utils.getAddress(wallet),priceWei:round.price.toString(),contract:cfig.address}
 }
 return {config,register,verifyPayment}
}
module.exports={createSepolia,registrationMessage}
