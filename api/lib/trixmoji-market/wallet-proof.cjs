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
module.exports={authenticateWalletProof}
