'use strict'
// Read-only deployment simulation. This script never signs or broadcasts.
const { ethers } = require('ethers')
const artifact = require('../../assets/data/clean-pop-webp-v2-candidate.json')
const manifest = require('../../assets/ethscriptions/clean-pop-webp-v2/manifest.json')
const CANONICAL_FACTORY_HASH = '0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989'
async function inspect(provider, candidate = artifact) {
 if ((await provider.getNetwork()).chainId !== 1) throw Error('RPC is not Ethereum mainnet.')
 if (candidate.root !== manifest.root || candidate.mimeType !== 'image/webp' || ethers.utils.keccak256(candidate.runtime) !== candidate.runtimeHash) throw Error('Candidate artwork or runtime does not match.')
 if (ethers.utils.getCreate2Address(candidate.factory, candidate.salt, ethers.utils.keccak256(candidate.bytecode)) !== candidate.address || candidate.deployData !== candidate.salt + candidate.bytecode.slice(2)) throw Error('Candidate deployment payload does not match its predicted address.')
 const [head, factoryCode, existingCode, balance, gasPrice] = await Promise.all([provider.getBlockNumber(), provider.getCode(candidate.factory), provider.getCode(candidate.address), provider.getBalance(candidate.creator), provider.getGasPrice()])
 if (ethers.utils.keccak256(factoryCode) !== CANONICAL_FACTORY_HASH) throw Error('Deterministic deployment factory code does not match the expected mainnet factory.')
 if (existingCode !== '0x') throw Error('Predicted address already contains code; inspect before any deployment.')
 const tx = { from: candidate.creator, to: candidate.factory, data: candidate.deployData, value: 0 }
 const [gas, result] = await Promise.all([provider.estimateGas(tx), provider.call(tx)])
 if (result.toLowerCase() !== candidate.address.toLowerCase()) throw Error('Simulated factory return does not match the candidate address.')
 return { chainId: 1, block: head, creator: candidate.creator, predictedAddress: candidate.address, root: candidate.root,
  factoryVerified: true, addressEmpty: true, estimatedGas: gas.toString(), gasPriceWei: gasPrice.toString(), estimatedCostWei: gas.mul(gasPrice).toString(), balanceWei: balance.toString(),
  sufficientForEstimate: balance.gte(gas.mul(gasPrice)), transactionSubmitted: false,
  note: 'Read-only simulation only. Recheck immediately before deployment; it does not verify live mint or market integration.' }
}
if (require.main === module) inspect(new ethers.providers.JsonRpcProvider({ url: process.env.ETH_RPC_URL || 'https://eth.drpc.org', timeout: 20000 }, 1)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { inspect, CANONICAL_FACTORY_HASH }
