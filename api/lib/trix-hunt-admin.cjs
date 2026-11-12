'use strict'
const crypto = require('crypto')
const { ethers } = require('ethers')
const deployment = require('../../assets/data/trixmoji-escrow-replacement-deployment.json')
const ADMIN = deployment.creator.toLowerCase()
const MARKET = deployment.address.toLowerCase()
const ID = /^0x[a-f0-9]{64}$/i
const TOKEN = /^[a-f0-9]{64}$/
const CONFIG = 'inventory-order-v1'

function message(nonce, expires, admin = ADMIN) {
 return ['Trix Hunt inventory admin', 'Action: sign in', 'Chain: 1', 'Escrow: ' + MARKET, 'Admin: ' + admin, 'Nonce: ' + nonce, 'Expires: ' + expires].join('\n')
}
function createService({ store, snapshot, now = () => Date.now(), random = n => crypto.randomBytes(n), admin = ADMIN }) {
 async function authorize(token) {
  if (!TOKEN.test(String(token || ''))) throw Error('Unauthorized')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await store.getWithMetadata('session-' + hash, { type: 'json', consistency: 'strong' })
  if (!record || !record.data || record.data.admin !== admin || record.data.expires <= now()) throw Error('Unauthorized')
 }
 async function login(body) {
  const nonce = String(body.nonce || '').toLowerCase(), expires = Number(body.expires), current = Math.floor(now()/1000)
  if (!/^0x[a-f0-9]{32}$/.test(nonce) || !Number.isSafeInteger(expires) || expires < current || expires > current+180 || typeof body.signature !== 'string' || body.signature.length > 300) throw Error('Unauthorized')
  let signer;try { signer=ethers.utils.verifyMessage(message(nonce,expires,admin),body.signature).toLowerCase() } catch (_) { throw Error('Unauthorized') }
  if (signer !== admin) throw Error('Unauthorized')
  const consumed=await store.setJSON('nonce-'+nonce.slice(2),{expires},{onlyIfNew:true})
  if (!consumed || consumed.modified !== true) throw Error('Unauthorized')
  const token=random(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex')
  const session=await store.setJSON('session-'+hash,{admin,expires:now()+15*60*1000},{onlyIfNew:true})
  if (!session || session.modified !== true) throw Error('Storage unavailable')
  return { token, expires: now()+15*60*1000 }
 }
 async function data(token) {
  await authorize(token)
  const live=await snapshot()
  if (!live || !live.ok || String(live.marketAddress||'').toLowerCase() !== MARKET || !Array.isArray(live.deposits) || !Number.isSafeInteger(live.indexedBlock)) throw Error('Escrow snapshot unavailable')
  const deposits=live.deposits.filter(x=>x && String(x.seller||'').toLowerCase()===admin && ID.test(String(x.id||'')) && Number.isInteger(x.tokenNo) && x.tokenNo>=0 && x.tokenNo<10000)
  const stored=await store.getWithMetadata(CONFIG,{type:'json',consistency:'strong'})
  return {deposits,indexedBlock:live.indexedBlock,blockNumber:live.blockNumber,marketAddress:deployment.address,config:stored?stored.data:null,version:stored?stored.etag:null}
 }
 async function save(token, body) {
  const live=await data(token),order=body.order,bestCount=body.bestCount,mode=body.mode
  if (!['auto','manual'].includes(mode) || !Array.isArray(order) || order.length!==live.deposits.length || order.length>1000 || !Number.isInteger(bestCount) || bestCount<0 || bestCount>order.length) throw Error('Invalid order')
  const allowed=new Set(live.deposits.map(x=>x.id.toLowerCase()))
  const normalized=order.map(x=>String(x).toLowerCase())
  if(new Set(normalized).size!==normalized.length || normalized.some(x=>!allowed.has(x)))throw Error('Invalid order')
  if ((body.version || null)!==(live.version || null)) throw Error('Inventory changed; reload before saving')
  const config={mode,order:normalized,bestCount,updatedAt:now(),indexedBlock:live.indexedBlock}
  const result=await store.setJSON(CONFIG,config,live.version?{onlyIfMatch:live.version}:{onlyIfNew:true})
  if(!result||result.modified!==true)throw Error('Inventory changed; reload before saving')
  return config
 }
 return {login,data,save}
}
module.exports={createService,message,ADMIN}
