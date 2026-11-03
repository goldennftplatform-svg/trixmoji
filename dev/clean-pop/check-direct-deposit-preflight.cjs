'use strict'
// Read-only candidate check. This never connects a wallet or submits a transaction.
const { ethers } = require('ethers')
const { buildDirectDeposit } = require('../../api/lib/trixmoji-market/direct-deposit-proof.cjs')
const deployment = require('../../assets/data/trixmoji-escrow-deployment.json')
const owner = '0x47cf60bdd877203264921d05ce26f81f6d36aa3e', id = '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74'
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
async function rpc(method, params) {
 const r = await fetch('https://ethereum.publicnode.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
 if (!r.ok) throw Error('Ethereum RPC unavailable.')
 const body = await r.json(); if (body.error) throw Error(body.error.message || 'Ethereum RPC error.'); return body.result
}
async function main() {
 const tx = buildDirectDeposit({ seller: owner, escrow: deployment.address, id }), iface = new ethers.utils.Interface(['function depositBlock(address,bytes32) view returns(uint256)'])
 const [chain, walletCode, marketCode, recorded, response] = await Promise.all([
  rpc('eth_chainId', []), rpc('eth_getCode', [owner, 'latest']), rpc('eth_getCode', [deployment.address, 'latest']), rpc('eth_call', [{ to: deployment.address, data: iface.encodeFunctionData('depositBlock', [owner, id]) }, 'latest']),
  fetch('https://api.ethscriptions.com/v2/ethscriptions/' + id, { signal: AbortSignal.timeout(15000) })
 ])
 if (!response.ok) throw Error('Ethscription indexer unavailable.')
 const asset = (await response.json()).result
 if (BigInt(chain) !== 1n || !/^0xef0100[a-f0-9]{40}$/i.test(walletCode) || !same(ethers.utils.keccak256(marketCode), deployment.runtimeHash) || !ethers.BigNumber.from(recorded).isZero() || !asset || !same(asset.transaction_hash, id) || !same(asset.current_owner, owner)) throw Error('Wallet, escrow, record, or indexed ownership did not match.')
 const [simulation, gas] = await Promise.all([rpc('eth_call', [tx, 'latest']), rpc('eth_estimateGas', [tx])])
 if (simulation !== '0x' || ethers.BigNumber.from(gas).isZero()) throw Error('Direct deposit simulation failed.')
 console.log(JSON.stringify({ readOnly: true, transactionSubmitted: false, wallet: owner, walletDelegated: true, indexedOwner: asset.current_owner, escrow: deployment.address, depositRecordClear: true, directCallSimulation: 'success', estimatedGas: ethers.BigNumber.from(gas).toString(), note: 'This simulates an outer direct call. It does not prove MetaMask will send that outer transaction or that an indexer will recognize a future transfer.' }, null, 2))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
