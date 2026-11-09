'use strict'
const {ethers}=require('ethers')
const proof=require('../../../assets/js/core/trixmoji-market-proof.js')
function authenticateWalletProof(body,now=Math.floor(Date.now()/1000)) {
 if(!body||!body.walletProof||typeof body.walletProof.signature!=='string'||body.walletProof.signature.length>300)throw Error('Wallet authorization required.')
 const payload={id:body.id,seller:body.seller,buyer:body.buyer,kind:body.kind,amount:body.amount,duration:body.duration,expires:body.walletProof.expires,nonce:body.walletProof.nonce}
 const normalized=proof.normalize(payload)
 if(normalized.expires<now||normalized.expires>now+180)throw Error('Wallet authorization expired or invalid.')
 let signer;try{signer=ethers.utils.verifyMessage(proof.message(payload),body.walletProof.signature)}catch(_){throw Error('Invalid wallet authorization signature.')}
 const actor=normalized.kind===0?normalized.buyer:normalized.seller
 if(signer.toLowerCase()!==actor)throw Error('Wallet authorization does not match the requested action.')
 return signer
}
// Purchase authorizations are public, but bound by the escrow contract to the
// named buyer (msg.sender), exact listing, price and nonce. The caller cannot
// spend that buyer's funds or redeem an approval on the buyer's behalf.
// Auctions still require the seller's signed proof.
function authenticateLaunchRequest(body,now) {
 if(body && body.kind===0) {
  if(!ethers.utils.isAddress(body.buyer||'') || body.buyer.toLowerCase()===ethers.constants.AddressZero.toLowerCase()) throw Error('Invalid market authorization request.')
  return ethers.utils.getAddress(body.buyer)
 }
 return authenticateWalletProof(body,now)
}
module.exports={authenticateWalletProof,authenticateLaunchRequest}
