'use strict'
const minter = require('../../assets/data/clean-pop-minter.json')

async function ownership(chain, id, wallet) {
 if (!chain.isHash(id) || !chain.isAddr(wallet)) throw Error('Enter a valid Ethscription ID and Ethereum wallet.')
 const created = await chain.readCreation(id)
 if (!created.preview || !/^\/assets\/ethscriptions\/clean-pop-v1\/(?:0|[1-9]\d{0,3})\.png$/.test(created.preview) || !Number.isInteger(created.tokenNo)) throw Error('This is not a verified Clean Pop creation.')
 const indexed = await chain.indexedOwnership(id, wallet)
 return { id: id.toLowerCase(), tokenNo: created.tokenNo, preview: created.preview, owned: indexed.owned, currentOwner: indexed.currentOwner }
}

async function verify(chain, id, hash, from, to) {
 if (!chain.isHash(id) || !chain.isHash(hash) || !chain.isAddr(from) || !chain.isAddr(to)) throw Error('Invalid transfer verification request.')
 const transfer = await chain.readTransfer(hash)
 if (!chain.same(transfer.id, id) || !chain.same(transfer.from, from) || !chain.same(transfer.to, to) || transfer.value !== '0') throw Error('Transaction does not match this 0 ETH Ethscription transfer.')
 const indexed = await chain.requireIndexedTransfer(id, hash, from, to, false)
 return { complete: true, id: id.toLowerCase(), hash: hash.toLowerCase(), from, to, currentOwner: indexed.current_owner }
}
async function plan(chain, rpc, id, from, to) {
 if (!chain.isHash(id) || !chain.isAddr(from) || !chain.isAddr(to) || /^0x0{40}$/i.test(to) || chain.same(from, to) || chain.same(to, minter.address)) throw Error('Enter a valid Ethscription ID and a different destination wallet.')
 const checked = await ownership(chain, id, from)
 if (!checked.owned) throw Error('The Ethscriptions indexer does not show this piece in the connected wallet.')
 if (BigInt(await rpc('eth_chainId', [])) !== 1n) throw Error('Ethereum mainnet RPC required.')
 const tx = { from, to, value: '0x0', data: id }
 const values = await Promise.all([rpc('eth_estimateGas', [tx]), rpc('eth_gasPrice', [])])
 const gas = BigInt(values[0]), price = BigInt(values[1])
 if (gas <= 0n || price <= 0n) throw Error('Transfer gas estimate unavailable.')
 return { ...checked, from, to, chainId: 1, value: '0', estimatedGas: gas.toString(), estimatedGasPriceWei: price.toString(), readOnly: true }
}
module.exports = { ownership, verify, plan }
