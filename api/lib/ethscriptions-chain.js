'use strict'

const { ethRpcs, firstRpc } = require('./awardz-chain')
const cleanPopVerify = require('./clean-pop-verify')

const ESCROW = '0x15e85a85B7026875d3529EF0c6de2723C285DA11'
const CLEAN_POP_MINTER = '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC'
const CLEAN_POP_CREATOR = '0x915A3D363D0a4e4470B531f008F5142c540E5417'

function escrowEth() {
  return String(process.env.EK_ESCROW_ETH || ESCROW).trim()
}

function isAddr(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ''))
}

function isHash(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value || ''))
}

function same(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase()
}

function hexToUtf8(hex) {
  const h = String(hex || '').replace(/^0x/i, '')
  if (!h || h.length % 2) return ''
  try {
    return Buffer.from(h, 'hex').toString('utf8')
  } catch (e) {
    return ''
  }
}

function parseEthToWei(raw) {
  const s = String(raw || '').trim()
  if (!/^\d+(\.\d{1,18})?$/.test(s)) return ''
  const parts = s.split('.')
  const frac = (parts[1] || '').padEnd(18, '0')
  let wei
  try {
    wei = BigInt(parts[0]) * (10n ** 18n) + BigInt(frac || '0')
  } catch (e) {
    return ''
  }
  if (wei < 200000000000000n || wei > 100n * (10n ** 18n)) return ''
  return wei.toString()
}

function weiToEth(wei) {
  const n = BigInt(wei)
  const whole = n / (10n ** 18n)
  const frac = (n % (10n ** 18n)).toString().padStart(18, '0').replace(/0+$/, '')
  return frac ? whole.toString() + '.' + frac : whole.toString()
}

async function txAndReceipt(hash) {
  if (BigInt(await firstRpc(ethRpcs(), 'eth_chainId', [])) !== 1n) throw new Error('The server RPC must be Ethereum mainnet.')
  const tx = await firstRpc(ethRpcs(), 'eth_getTransactionByHash', [hash])
  if (!tx) throw new Error('That transaction is not on Ethereum yet.')
  const receipt = await firstRpc(ethRpcs(), 'eth_getTransactionReceipt', [hash])
  if (receipt && receipt.status === '0x0') throw new Error('That transaction reverted. No mint payment was completed.')
  if (!receipt || receipt.status !== '0x1') throw new Error('That transaction is not confirmed.')
  const latest = BigInt(await firstRpc(ethRpcs(), 'eth_blockNumber', []))
  if (!receipt.blockNumber || latest - BigInt(receipt.blockNumber) + 1n < 2n) throw new Error('That transaction is not confirmed. Waiting for two blocks.')
  return { tx: tx, receipt: receipt }
}

async function requireMinter(address) {
  if (BigInt(await firstRpc(ethRpcs(), 'eth_chainId', [])) !== 1n) throw new Error('The server RPC must be Ethereum mainnet.')
  const code = await firstRpc(ethRpcs(), 'eth_getCode', [address, 'latest'])
  if (!code || code === '0x' || code === '0x0') throw new Error('The minter is not deployed. No payment should be sent.')
}

async function indexerGet(endpoint) {
  const base = String(process.env.ETHSCRIPTIONS_INDEXER_URL || 'https://api.ethscriptions.com/v2').replace(/\/$/, '')
  const response = await fetch(base + endpoint, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('Ethscriptions indexing is pending or unavailable. Check the saved mint again; do not pay again.')
  const data = await response.json()
  if (!data || !data.result) throw new Error('The Ethscriptions indexer returned an invalid response.')
  return data.result
}

async function requireUniqueContent(sha) {
  const result = await indexerGet('/ethscriptions/exists/0x' + sha.replace(/^0x/i, ''))
  if (typeof result.exists !== 'boolean') throw new Error('Could not verify artwork uniqueness.')
  if (result.exists) throw new Error('This artwork is already inscribed. Check an existing mint instead of purchasing it again.')
}

async function requireIndexedMint(sent) {
  const indexed = await indexerGet('/ethscriptions/' + sent.hash)
  if (!same(indexed.transaction_hash, sent.hash) || !same(indexed.initial_owner, sent.owner) ||
      !same(indexed.creator, sent.contractAddress) || indexed.content_uri !== sent.uri) {
    throw new Error('The indexed Ethscription does not match the mint. Keep the transaction hash for support; do not pay again.')
  }
  return indexed
}

async function indexedOwnership(hash, wallet) {
  if (!isHash(hash) || !isAddr(wallet)) throw new Error('Invalid ownership query.')
  const indexed = await indexerGet('/ethscriptions/' + hash)
  if (!same(indexed.transaction_hash, hash) || !isAddr(indexed.current_owner)) throw new Error('Ownership is not available from the indexer.')
  return { currentOwner: indexed.current_owner, owned: same(indexed.current_owner, wallet) }
}

async function requireIndexedTransfer(hash, transferHash, from, to, requireCurrentOwner) {
  if (!isHash(hash) || !isHash(transferHash) || !isAddr(from) || !isAddr(to)) throw new Error('Invalid indexed transfer query.')
  const indexed = await indexerGet('/ethscriptions/' + hash)
  if (!same(indexed.transaction_hash, hash) || !Array.isArray(indexed.ethscription_transfers)) throw new Error('Indexed transfer history is unavailable. Wait for indexing before listing.')
  const found = indexed.ethscription_transfers.some(function (transfer) {
    return transfer && same(transfer.ethscription_transaction_hash, hash) && same(transfer.transaction_hash, transferHash) && same(transfer.from_address, from) && same(transfer.to_address, to)
  })
  if (!found) throw new Error('The Ethscriptions indexer has not confirmed this exact transfer. Wait for indexing before listing.')
  if (requireCurrentOwner && (!same(indexed.current_owner, to) || !same(indexed.previous_owner, from))) throw new Error('The Ethscriptions indexer does not show this seller’s transfer as the current escrow custody.')
  return indexed
}

async function readCreation(id) {
  if (!isHash(id)) throw new Error('An ethscription id is the 0x transaction that created it.')
  const found = await txAndReceipt(id)
  const text = hexToUtf8(found.tx.input)
  if (text.indexOf('data:') !== 0) {
    // Contract-created Ethscriptions are emitted in a log, not transaction input.
    // Match both the receipt event and the independent protocol index before use.
    const sent = await readPhunkMint(id)
    if (!same(sent.to, CLEAN_POP_MINTER) || !same(sent.contractAddress, CLEAN_POP_MINTER) || !sent.uri) {
      throw new Error('That transaction did not create a supported ethscription.')
    }
    await requireIndexedMint(sent)
    const artwork = cleanPopVerify.decodeCreation(found.tx.input, sent.uri)
    return {
      id: id.toLowerCase(), creator: CLEAN_POP_CREATOR, creationContract: sent.contractAddress, firstOwner: sent.owner,
      tokenNo: artwork.tokenNo, preview: artwork.preview,
      contentUri: sent.uri.length > 80000 ? '' : sent.uri,
      mime: sent.uri.slice(5, sent.uri.indexOf(',') > 0 ? sent.uri.indexOf(',') : 40).slice(0, 40)
    }
  }
  return {
    id: id.toLowerCase(),
    creator: found.tx.from,
    firstOwner: found.tx.to || found.tx.from,
    contentUri: text.length > 80000 ? '' : text,
    mime: text.slice(5, text.indexOf(',') > 0 ? text.indexOf(',') : 40).slice(0, 40)
  }
}

async function readTransfer(txid) {
  if (!isHash(txid)) throw new Error('That is not an Ethereum transaction.')
  const found = await txAndReceipt(txid)
  const input = String(found.tx.input || '').toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(input)) throw new Error('The hex data has to be one ethscription id and nothing else.')
  return {
    hash: txid.toLowerCase(),
    from: found.tx.from,
    to: found.tx.to || '',
    id: input,
    value: BigInt(found.tx.value || '0x0').toString()
  }
}

const CREATE_TOPIC = '0x665fba0baf3dc33e9943340197893ac16f56482c2defb8de60f944987fee451c'

function decodeAbiString(data) {
  const hex = String(data || '').replace(/^0x/i, '')
  if (hex.length < 128) throw new Error('That transaction has no picture.')
  const offset = Number(BigInt('0x' + hex.slice(0, 64))) * 2
  if (!Number.isFinite(offset) || offset < 0 || offset + 64 > hex.length) throw new Error('That transaction has no picture.')
  const len = Number(BigInt('0x' + hex.slice(offset, offset + 64)))
  if (!Number.isFinite(len) || len < 15 || offset + 64 + len * 2 > hex.length) throw new Error('That transaction has no picture.')
  return Buffer.from(hex.slice(offset + 64, offset + 64 + len * 2), 'hex').toString('utf8').replace(/\u0000/g, '')
}

async function readPhunkMint(txid) {
  if (!isHash(txid)) throw new Error('That is not an Ethereum transaction.')
  const found = await txAndReceipt(txid)
  const logs = Array.isArray(found.receipt.logs) ? found.receipt.logs : []
  let uri = ''
  let owner = ''
  let emitter = ''
  for (const log of logs) {
    const topics = log && log.topics || []
    if (!topics[0] || String(topics[0]).toLowerCase() !== CREATE_TOPIC) continue
    if (!topics[1]) continue
    owner = '0x' + String(topics[1]).slice(-40).toLowerCase()
    emitter = String(log.address || '').toLowerCase()
    try { uri = decodeAbiString(log.data) } catch (e) { uri = '' }
    if (uri.startsWith('data:')) break
  }
  return {
    hash: txid.toLowerCase(),
    from: found.tx.from,
    to: found.tx.to || '',
    value: BigInt(found.tx.value || '0x0').toString(),
    uri: uri,
    owner: owner,
    contractAddress: String(found.receipt.contractAddress || emitter || '').toLowerCase()
  }
}

async function readInput(txid) {
  if (!isHash(txid)) throw new Error('That is not an Ethereum transaction.')
  const found = await txAndReceipt(txid)
  return {
    hash: txid.toLowerCase(),
    from: found.tx.from,
    to: found.tx.to || '',
    value: BigInt(found.tx.value || '0x0').toString(),
    input: String(found.tx.input || '0x')
  }
}

async function readPayment(txid) {
  if (!isHash(txid)) throw new Error('That is not an Ethereum transaction.')
  const found = await txAndReceipt(txid)
  const input = String(found.tx.input || '0x').toLowerCase()
  if (input !== '0x' && input !== '0x0') throw new Error('The ETH payment has to be sent with empty hex data.')
  return {
    hash: txid.toLowerCase(),
    from: found.tx.from,
    to: found.tx.to || '',
    value: BigInt(found.tx.value || '0x0').toString()
  }
}

module.exports = {
  ESCROW,
  escrowEth,
  isAddr,
  isHash,
  same,
  parseEthToWei,
  weiToEth,
  readCreation,
  readTransfer,
  readPayment,
  readInput,
  readPhunkMint,
  requireMinter,
  requireUniqueContent,
  requireIndexedMint,
  indexedOwnership,
  requireIndexedTransfer
}
