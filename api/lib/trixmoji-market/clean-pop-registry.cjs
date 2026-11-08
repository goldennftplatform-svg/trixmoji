'use strict'
const { ethers } = require('ethers')
const { extractMintCall } = require('./mint-call.cjs')
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
const createTopic = ethers.utils.id('ethscriptions_protocol_CreateEthscription(address,string)')

/**
 * Build an authoritative registry lookup from Ethereum receipts and the
 * Ethscriptions indexer. All configuration is fixed by the server, never
 * supplied by a listing or approval request. No image files are rewritten.
 */
function createCleanPopRegistry({ provider, indexer, minter, abi, root, mintPriceWei, mimeType = 'image/png', allowWrappedMints = false, historyProvider = provider }) {
 if (!provider || typeof provider.getTransaction !== 'function' || typeof provider.getTransactionReceipt !== 'function' || typeof indexer !== 'function' || !ethers.utils.isAddress(minter || '') || !/^0x[a-f0-9]{64}$/i.test(String(root || '')) || !abi) throw Error('Clean Pop registry is not configured.')
 if (!historyProvider || typeof historyProvider.getTransaction !== 'function' || typeof historyProvider.getTransactionReceipt !== 'function') throw Error('Clean Pop transaction history is not configured.')
 if (!['image/png', 'image/webp'].includes(mimeType)) throw Error('Unsupported Clean Pop artwork format.')
 const iface = new ethers.utils.Interface(abi), price = ethers.BigNumber.from(mintPriceWei)
 return async function lookup(id) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(id || ''))) throw Error('Invalid Ethscription ID.')
  const [tx, receipt, indexed] = await Promise.all([historyProvider.getTransaction(id), historyProvider.getTransactionReceipt(id), indexer('/ethscriptions/' + id)])
  if (!tx || !receipt || receipt.status !== 1 || !same(tx.hash, id) || !same(receipt.transactionHash, id)) throw Error('Clean Pop creation transaction is unavailable or invalid.')
  let call
  try { call = extractMintCall(tx, minter, allowWrappedMints) } catch (_) { throw Error('Clean Pop creation transaction is unavailable or invalid.') }
  let parsed
  try { parsed = iface.parseTransaction({ data: call.data, value: call.value }) } catch (_) { throw Error('Unsupported Clean Pop creation transaction.') }
  if (!parsed || !['mint', 'deliverReplacement'].includes(parsed.name)) throw Error('Unsupported Clean Pop creation transaction.')
  const tokenNo = parsed.args.tokenNo.toNumber(), uri = parsed.args.contentURI, proof = Array.from(parsed.args.proof)
  const prefix = 'data:' + mimeType + ';base64,'
  if (tokenNo < 0 || tokenNo >= 10000 || proof.length !== 14 || !uri.startsWith(prefix) || !/^[A-Za-z0-9+/]+=*$/.test(uri.slice(prefix.length))) throw Error('Invalid Clean Pop artwork payload.')
  if (parsed.name === 'mint' ? !call.value.eq(price) : !call.value.isZero()) throw Error('Clean Pop transaction value is invalid.')
  let digest = ethers.utils.sha256(ethers.utils.toUtf8Bytes(uri)), position = tokenNo
  const contentSha = digest
  for (const sibling of proof) {
   if (!/^0x[a-f0-9]{64}$/i.test(sibling)) throw Error('Invalid Clean Pop proof.')
   digest = ethers.utils.sha256(ethers.utils.concat(position % 2 ? [sibling, digest] : [digest, sibling]))
   position = Math.floor(position / 2)
  }
  if (!same(digest, root)) throw Error('Clean Pop artwork does not match the approved root.')
  const firstCreation = (receipt.logs || []).find(log => log.topics && same(log.topics[0], createTopic))
  if (!firstCreation || !same(firstCreation.address, minter)) throw Error('Clean Pop creation event is missing or not first.')
  let event
  try { event = iface.parseLog(firstCreation) } catch (_) { throw Error('Invalid Clean Pop creation event.') }
  const expectedOwner = parsed.name === 'mint' ? tx.from : parsed.args.recipient
  if (!same(event.args.initialOwner, expectedOwner) || event.args.contentURI !== uri) throw Error('Creation event does not match its transaction.')
  if (!indexed || !same(indexed.transaction_hash, id) || !same(indexed.creator, minter) || !same(indexed.initial_owner, expectedOwner) || !same(indexed.content_sha, contentSha) || indexed.content_uri !== uri) throw Error('Ethscriptions indexer does not confirm this Clean Pop creation.')
  return { id: id.toLowerCase(), tokenNo, contentSha, initialOwner: expectedOwner, creationKind: parsed.name }
 }
}
module.exports = { createCleanPopRegistry }
