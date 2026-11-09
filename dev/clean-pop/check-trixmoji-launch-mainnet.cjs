'use strict'
// Read-only factory simulation; does not broadcast.
const { ethers } = require('ethers')
const a = require('../../assets/data/trixmoji-launch-candidate.json')
const m = require('../../assets/ethscriptions/trixmoji-launch/manifest.json')
async function main() {
 const p = new ethers.providers.JsonRpcProvider({url: process.env.ETH_RPC_URL || 'https://eth.drpc.org', timeout: 20000}, 1)
 if ((await p.getNetwork()).chainId !== 1 || a.root !== m.root || !m.uniqueContentUris || m.uniqueContentUris !== 10000 || a.startsPaused !== false) throw Error('Candidate mismatch')
 if (ethers.utils.keccak256(a.runtime) !== a.runtimeHash || ethers.utils.getCreate2Address(a.factory,a.salt,ethers.utils.keccak256(a.bytecode)) !== a.address || a.deployData !== a.salt + a.bytecode.slice(2)) throw Error('Invalid deployment payload')
 const [block, factory, existing, balance, gasPrice] = await Promise.all([p.getBlockNumber(),p.getCode(a.factory),p.getCode(a.address),p.getBalance(a.creator),p.getGasPrice()])
 if (ethers.utils.keccak256(factory) !== '0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989') throw Error('Factory mismatch')
 if (existing !== '0x') throw Error('Code already exists at candidate address')
 const tx = {from:a.creator,to:a.factory,data:a.deployData,value:0}
 const [gas,result] = await Promise.all([p.estimateGas(tx),p.call(tx)])
 if (result.toLowerCase() !== a.address.toLowerCase()) throw Error('Simulation address mismatch')
 console.log(JSON.stringify({chainId:1,block,address:a.address,root:a.root,startsPaused:false,factoryVerified:true,addressEmpty:true,estimatedGas:gas.toString(),gasPriceWei:gasPrice.toString(),estimatedCostWei:gas.mul(gasPrice).toString(),creatorBalanceWei:balance.toString(),sufficientForEstimate:balance.gte(gas.mul(gasPrice)),transactionSubmitted:false},null,2))
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
