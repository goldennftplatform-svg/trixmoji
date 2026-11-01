'use strict'

// Read-only preflight. Never signs, deploys, or submits a transaction.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { ethers } = require('ethers')
const merkle = require('../../api/lib/phunk-merkle')
const root = path.resolve(__dirname, '../..')
const info = merkle.info()
const initCode = '0x' + info.deployData.slice(66)
const predicted = ethers.utils.getCreate2Address(info.factory, info.salt, ethers.utils.keccak256(initCode))
const failures = []
if (predicted.toLowerCase() !== info.address.toLowerCase()) failures.push('CREATE2 address does not match deployData')
const seen = new Set()
let total = 0, min = Infinity, max = 0, missing = 0, mismatched = 0, duplicates = 0, newArtMismatch = 0
let largest = null
for (let id = 0; id < 10000; id++) {
 const file = path.join(root, 'assets/ethscriptions/phunks/img', id + '.png')
 if (!fs.existsSync(file)) { missing++; continue }
 const png = fs.readFileSync(file)
 const uri = 'data:image/png;base64,' + png.toString('base64')
 const sha = crypto.createHash('sha256').update(uri).digest('hex')
 if (!merkle.matches(id, sha)) mismatched++
 if (seen.has(sha)) duplicates++
 seen.add(sha)
 const supplied = path.join(root, '../TRIX-PHUNKS/assets-v2', id + '.png')
 if (fs.existsSync(supplied) && !png.equals(fs.readFileSync(supplied))) newArtMismatch++
 total += uri.length; min = Math.min(min, uri.length)
 if (uri.length > max) { max = uri.length; largest = { id, uri } }
}
if (missing || mismatched || duplicates) failures.push('Artwork manifest validation failed')
console.log(JSON.stringify({ address: info.address, predicted, initcodeBytes: (initCode.length - 2) / 2,
 supply: 10000, missing, mismatched, duplicates, suppliedV2Differences: newArtMismatch,
 uriBytes: { min, max, average: Math.round(total / (10000 - missing || 1)) }, failures }, null, 2))

async function live() {
 const provider = new ethers.providers.JsonRpcProvider({ url: process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com', timeout: 20000 })
 const chain = await provider.send('eth_chainId', [])
 if (BigInt(chain) !== 1n) throw new Error('RPC is not Ethereum mainnet')
 const code = await provider.getCode(info.address)
 const price = await provider.getGasPrice()
 const output = { chainId: 1, deployed: code !== '0x', gasPriceGwei: ethers.utils.formatUnits(price, 'gwei') }
 // eth_call with contract-creation data executes initcode locally at the RPC.
 // It returns the runtime without publishing a contract or spending funds.
 const runtime = await provider.call({ from: info.creator, data: initCode })
 output.expectedRuntimeHash = ethers.utils.keccak256(runtime)
 if (code !== '0x') {
  output.runtimeMatchesArtifact = code.toLowerCase() === runtime.toLowerCase()
  if (!output.runtimeMatchesArtifact) { failures.push('Deployed runtime does not match configured initcode'); process.exitCode = 1 }
 }
 if (code === '0x') {
  const gas = await provider.estimateGas({ from: info.creator, to: info.factory, data: info.deployData, value: 0 })
  output.deployGas = gas.toString()
  output.estimatedDeployETH = ethers.utils.formatEther(gas.mul(price))
 }
 if (largest) {
  const abi = new ethers.utils.Interface(['function mint(string,bytes32[],uint256) payable'])
  try {
   const tx = { from: info.creator, to: info.address, value: ethers.utils.hexValue(ethers.BigNumber.from(info.priceWei)),
    data: abi.encodeFunctionData('mint', [largest.uri, merkle.proof(largest.id), largest.id]) }
   const gas = code === '0x'
    ? ethers.BigNumber.from(await provider.send('eth_estimateGas', [tx, 'latest', {
      [info.address]: { code: runtime }, [info.creator]: { balance: '0x56bc75e2d63100000' }
     }]))
    : await provider.estimateGas(tx)
   output.mintEstimateUsesSimulatedDeployment = code === '0x'
   output.largestArtSample = largest.id
   output.sampleMintGas = gas.toString()
   output.estimatedSampleMintGasETH = ethers.utils.formatEther(gas.mul(price))
   if (process.argv.includes('--contract-checks')) {
    const word = n => ethers.utils.hexZeroPad(ethers.utils.hexlify(n), 32)
    const slot = (type, value, index) => ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([type, 'uint256'], [value, index]))
    const checks = [
     { name: 'valid mint', tx, revert: false },
     { name: 'wrong price', tx: { ...tx, value: '0x0' }, revert: true },
     { name: 'bad artwork proof', tx: { ...tx, data: abi.encodeFunctionData('mint', [largest.uri, Array(14).fill(word(0)), largest.id]) }, revert: true },
     { name: 'already minted', tx, stateDiff: { [slot('uint256', largest.id, 0)]: word(1) }, revert: true },
     { name: 'wallet limit', tx, stateDiff: { [slot('address', info.creator, 1)]: word(20) }, revert: true }
    ]
    output.simulatedContractChecks = []
    for (const check of checks) {
     let reverted = false
     try {
      await provider.send('eth_call', [check.tx, 'latest', {
       [info.address]: { code: runtime, stateDiff: check.stateDiff || {} },
       [info.creator]: { balance: '0x56bc75e2d63100000' }
      }])
     } catch (e) {
      if (!/revert/i.test(e.message)) throw e
      reverted = true
     }
     const passed = reverted === check.revert
     output.simulatedContractChecks.push({ name: check.name, passed })
     if (!passed) process.exitCode = 1
    }
   }
  } catch (e) { output.sampleEstimateError = e.reason || e.message }
 }
 console.log(JSON.stringify(output, null, 2))
}
if (process.argv.includes('--rpc')) live().catch(function (e) { console.error(e.message); process.exitCode = 1 })
if (failures.length) process.exitCode = 1
