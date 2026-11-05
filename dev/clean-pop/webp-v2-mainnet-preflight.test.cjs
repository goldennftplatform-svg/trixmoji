'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { inspect } = require('./check-webp-v2-mainnet.cjs')
const candidate = require('../../assets/data/clean-pop-webp-v2-candidate.json')
const factoryCode = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3'
function provider(overrides = {}) {
 return { getNetwork: async () => ({ chainId: 1 }), getBlockNumber: async () => 100,
  getCode: async address => address.toLowerCase() === candidate.factory.toLowerCase() ? factoryCode : '0x',
  getBalance: async () => ethers.BigNumber.from('1000000000000000000'), getGasPrice: async () => ethers.BigNumber.from(5),
  estimateGas: async tx => { assert.equal(tx.to, candidate.factory); assert.equal(tx.data, candidate.deployData); return ethers.BigNumber.from(123) },
  call: async () => candidate.address.toLowerCase(), ...overrides }
}
test('mainnet deployment preflight only reads and simulates the exact candidate', async () => {
 const p = provider({ sendTransaction: () => { throw Error('must not send') } }), result = await inspect(p)
 assert.equal(result.transactionSubmitted, false); assert.equal(result.addressEmpty, true); assert.equal(result.estimatedCostWei, '615')
})
test('preflight refuses wrong chain, factory, occupied address and mismatched simulation', async () => {
 await assert.rejects(inspect(provider({ getNetwork: async () => ({ chainId: 11155111 }) })), /not Ethereum mainnet/)
 await assert.rejects(inspect(provider({ getCode: async () => '0x01' })), /factory code/)
 await assert.rejects(inspect(provider({ getCode: async address => address.toLowerCase() === candidate.factory.toLowerCase() ? factoryCode : '0x01' })), /already contains code/)
 await assert.rejects(inspect(provider({ call: async () => '0x' + '0'.repeat(40) })), /Simulated factory return/)
})
