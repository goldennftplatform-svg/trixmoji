'use strict'
// Separate candidate verifier: does not replace the deployed V1 PNG verifier.
const crypto = require('crypto'), { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-webp-v2-candidate.json')
const { extractMintCall } = require('./trixmoji-market/mint-call.cjs')
const iface = new ethers.utils.Interface(info.abi)
function validatePayload(uri, proof, tokenNo) {
 if (!Number.isInteger(tokenNo) || tokenNo < 0 || tokenNo >= 10000 || !Array.isArray(proof) || proof.length !== 14 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(uri)) throw Error('Invalid Clean Pop WebP artwork payload.')
 let digest = crypto.createHash('sha256').update(uri, 'utf8').digest(), index = tokenNo
 for (const value of proof) {
  if (!/^0x[0-9a-f]{64}$/i.test(value)) throw Error('Invalid WebP artwork proof.')
  const sibling = Buffer.from(value.slice(2), 'hex')
  digest = crypto.createHash('sha256').update(index % 2 ? Buffer.concat([sibling, digest]) : Buffer.concat([digest, sibling])).digest()
  index = Math.floor(index / 2)
 }
 if ('0x' + digest.toString('hex') !== info.root.toLowerCase()) throw Error('WebP artwork proof does not match the candidate root.')
}
function decodeCreation(input, expectedUri) {
 let parsed
 try { parsed = iface.parseTransaction({ data: input }) } catch (_) { throw Error('Transaction is not a supported WebP creation.') }
 if (!parsed || parsed.name !== 'mint') throw Error('Transaction is not a WebP mint.')
 const tokenNo = parsed.args.tokenNo.toNumber(), uri = parsed.args.contentURI
 if (uri !== expectedUri) throw Error('WebP creation event does not match the mint transaction.')
 validatePayload(uri, Array.from(parsed.args.proof), tokenNo)
 return { tokenNo, preview: '/assets/ethscriptions/clean-pop-webp-v2/' + tokenNo + '.webp' }
}
async function verify(chain, hash, buyer, tokenNo) {
 if (!chain.isHash(hash) || !chain.isAddr(buyer) || !Number.isInteger(tokenNo)) throw Error('Invalid WebP mint verification request.')
 const [sent, input] = await Promise.all([chain.readPhunkMint(hash), chain.readInput(hash)])
 if (!chain.same(sent.hash, hash) || !chain.same(sent.contractAddress, info.address) || !chain.same(sent.from, buyer) || !chain.same(sent.owner, buyer)) throw Error('Transaction does not match this WebP mint.')
 let call
 try { call = extractMintCall({ to: sent.to, data: input.input, value: sent.value }, info.address, true) } catch (_) { throw Error('Transaction does not match this WebP mint.') }
 if (!call.value.eq(info.priceWei)) throw Error('Transaction does not match this WebP mint.')
 const decoded = decodeCreation(call.data, sent.uri)
 if (decoded.tokenNo !== tokenNo) throw Error('Minted WebP number does not match.')
 await chain.requireIndexedMint(sent)
 return { complete: true, hash: hash.toLowerCase(), tokenNo, preview: decoded.preview }
}
module.exports = { validatePayload, decodeCreation, verify }
