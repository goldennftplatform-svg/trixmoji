'use strict'
const { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-minter.json')
const ledger = require('../../assets/data/clean-pop-legacy-mints.json')
const { validatePayload } = require('./clean-pop-verify')
const iface = new ethers.utils.Interface(info.abi)

function legacyRecord(tokenNo, legacyId) {
 if (!Number.isInteger(tokenNo) || tokenNo < 0 || tokenNo >= 10000 || !/^0x[a-f0-9]{64}$/i.test(String(legacyId || ''))) throw Error('Invalid legacy token or ID.')
 const row = ledger.mints.find(item => item.tokenNo === tokenNo && item.legacyId.toLowerCase() === legacyId.toLowerCase())
 if (!row) throw Error('This token and legacy ID are not in the original mint ledger.')
 return row
}
async function verify(chain, hash, tokenNo, legacyId, recipient) {
 legacyRecord(tokenNo, legacyId)
 if (!chain.isHash(hash) || !chain.isAddr(recipient)) throw Error('Invalid delivery verification request.')
 const [sent, input] = await Promise.all([chain.readPhunkMint(hash), chain.readInput(hash)])
 if (!chain.same(sent.to, info.address) || !chain.same(sent.contractAddress, info.address) || !chain.same(sent.from, info.creator) || !chain.same(sent.owner, recipient) || sent.value !== '0') throw Error('Transaction does not match this creator delivery.')
 let decoded
 try { decoded = iface.decodeFunctionData('deliverReplacement', input.input) } catch (_) { throw Error('Transaction is not a Clean Pop replacement.') }
 if (!decoded.tokenNo.eq(tokenNo) || !chain.same(decoded.legacyId, legacyId) || !chain.same(decoded.recipient, recipient) || decoded.contentURI !== sent.uri) throw Error('Replacement token, recipient, or artwork does not match.')
 validatePayload(decoded.contentURI, Array.from(decoded.proof), tokenNo)
 await chain.requireIndexedMint(sent)
 return { complete: true, hash: hash.toLowerCase(), tokenNo, legacyId: legacyId.toLowerCase(), recipient, preview: '/assets/ethscriptions/clean-pop-v1/' + tokenNo + '.png' }
}
module.exports = { legacyRecord, verify }
