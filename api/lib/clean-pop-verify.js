'use strict'
const crypto = require('crypto')
const { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-minter.json')
const iface = new ethers.utils.Interface(info.abi)
function validatePayload(uri, proof, tokenNo) {
 if (!Number.isInteger(tokenNo) || tokenNo < 0 || tokenNo >= 10000 || !Array.isArray(proof) || proof.length !== 14 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(uri)) throw Error('Invalid Clean Pop artwork payload.')
 let digest = crypto.createHash('sha256').update(uri, 'utf8').digest()
 let n = tokenNo
 for (const sibling of proof) {
  if (!/^0x[0-9a-f]{64}$/i.test(sibling)) throw Error('Invalid artwork proof.')
  const other = Buffer.from(sibling.slice(2), 'hex')
  digest = crypto.createHash('sha256').update(n % 2 ? Buffer.concat([other, digest]) : Buffer.concat([digest, other])).digest()
  n = Math.floor(n / 2)
 }
 if ('0x' + digest.toString('hex') !== info.root.toLowerCase()) throw Error('Artwork proof does not match Clean Pop.')
}
async function verify(chain, hash, buyer, tokenNo) {
 if (!chain.isHash(hash) || !chain.isAddr(buyer) || !Number.isInteger(tokenNo)) throw Error('Invalid Clean Pop verification request.')
 const [sent, input] = await Promise.all([chain.readPhunkMint(hash), chain.readInput(hash)])
 if (!chain.same(sent.to, info.address) || !chain.same(sent.contractAddress, info.address) || !chain.same(sent.from, buyer) || !chain.same(sent.owner, buyer) || sent.value !== info.priceWei) throw Error('Transaction does not match this Clean Pop mint.')
 let decoded
 try { decoded = iface.decodeFunctionData('mint', input.input) } catch (_) { throw Error('Transaction is not a Clean Pop mint.') }
 if (!decoded.tokenNo.eq(tokenNo) || decoded.contentURI !== sent.uri) throw Error('Minted artwork or number does not match.')
 validatePayload(decoded.contentURI, Array.from(decoded.proof), tokenNo)
 await chain.requireIndexedMint(sent)
 return { complete: true, hash: hash.toLowerCase(), tokenNo, preview: '/assets/ethscriptions/clean-pop-v1/' + tokenNo + '.png' }
}
module.exports = { validatePayload, verify }
