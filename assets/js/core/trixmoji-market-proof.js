(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.TrixmojiMarketProof = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 var MARKET='0x21c1A938d06f87A039abfC48d1cCB459f55b1685', MINTER='0x14F9B4a11A10A83C6A686012110Dc2bd54eFD673'
 function normalize(body) {
  if(!body||!/^0x[a-f0-9]{64}$/i.test(String(body.id||''))||!ethers.utils.isAddress(body.seller||'')||![0,1].includes(body.kind))throw Error('Invalid market authorization request.')
  var buyer=body.kind===0?body.buyer:ethers.constants.AddressZero
  if(!ethers.utils.isAddress(buyer||'')||!/^\d+$/.test(String(body.amount||'')))throw Error('Invalid market authorization request.')
  var amount=ethers.BigNumber.from(String(body.amount));if(amount.lte(0))throw Error('Invalid market amount.')
  var duration=body.kind===1?Number(body.duration):0
  if(body.kind===1&&(!Number.isInteger(duration)||duration<3600||duration>604800))throw Error('Invalid auction duration.')
  var expires=Number(body.expires),nonce=String(body.nonce||'')
  if(!Number.isSafeInteger(expires)||!/^0x[a-f0-9]{32}$/i.test(nonce))throw Error('Invalid wallet authorization.')
  return {id:body.id.toLowerCase(),seller:body.seller.toLowerCase(),buyer:buyer.toLowerCase(),kind:body.kind,amount:amount.toString(),duration:duration,expires:expires,nonce:nonce.toLowerCase()}
 }
 function message(body){var x=normalize(body);return ['TrixMoji market authorization','Ethereum mainnet (chain 1)','Market: '+MARKET.toLowerCase(),'Collection: '+MINTER.toLowerCase(),'Action: '+(x.kind===0?'buy':'start auction'),'Asset: '+x.id,'Seller: '+x.seller,'Buyer: '+x.buyer,'Amount (wei): '+x.amount,'Duration (seconds): '+x.duration,'Expires (Unix seconds): '+x.expires,'Nonce: '+x.nonce,'Signing this message does not send a transaction.'].join('\n')}
 return {normalize:normalize,message:message,market:MARKET,minter:MINTER}
})
