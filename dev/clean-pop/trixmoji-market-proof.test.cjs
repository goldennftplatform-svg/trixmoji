'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),{ethers}=require('ethers')
const proof=require('../../assets/js/core/trixmoji-market-proof.js'),{authenticateWalletProof}=require('../../api/lib/trixmoji-market/wallet-proof.cjs')
const buyer=ethers.Wallet.createRandom(),seller=ethers.Wallet.createRandom(),id=ethers.utils.id('artwork')
async function signed(kind=0){let body={id,seller:seller.address,buyer:buyer.address,kind,amount:'10000000000000',duration:kind?3600:0},wallet=kind?seller:buyer,expires=100120,nonce='0x'+'ab'.repeat(16);body.walletProof={expires,nonce,signature:await wallet.signMessage(proof.message({...body,expires,nonce}))};return body}
test('purchase proof authenticates buyer and auction proof authenticates seller',async()=>{assert.equal((await authenticateWalletProof(await signed(),100000)).toLowerCase(),buyer.address.toLowerCase());assert.equal((await authenticateWalletProof(await signed(1),100000)).toLowerCase(),seller.address.toLowerCase())})
test('proof rejects tampering, incorrect signer, expiry and excessive lifetime',async()=>{
 let a=await signed();assert.throws(()=>authenticateWalletProof({...a,amount:'2'},100000),/does not match/)
 a=await signed();assert.throws(()=>authenticateWalletProof({...a,id:ethers.utils.id('different')},100000),/does not match/)
 a=await signed();assert.throws(()=>authenticateWalletProof({...a,buyer:seller.address},100000),/does not match/)
 a=await signed();assert.throws(()=>authenticateWalletProof(a,100121),/expired/);assert.throws(()=>authenticateWalletProof(a,99800),/expired/)
 a=await signed();a.walletProof.signature='0x12';assert.throws(()=>authenticateWalletProof(a,100000),/signature/)
})
