'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ethers } = require('ethers')
const { isDepositCalldata } = require('../../api/lib/trixmoji-market/deposit-calldata.cjs')
test('accepts only a raw ID or exact public Chopper deposit-and-list payload', () => {
 const id = ethers.utils.id('asset'), signature = ethers.utils.id('DEPOSIT_AND_LIST_SIGNATURE')
 const price = ethers.utils.hexZeroPad('0x01', 32), zero = ethers.constants.HashZero
 const payload = (a, b, c, d) => ethers.utils.hexConcat([a, b, c, d])
 assert.equal(isDepositCalldata(id, id), true)
 assert.equal(isDepositCalldata(payload(id, signature, price, zero), id), true)
 assert.equal(isDepositCalldata(payload(id, zero, price, zero), id), false)
 assert.equal(isDepositCalldata(payload(id, signature, zero, zero), id), false)
 assert.equal(isDepositCalldata(payload(id, signature, price, price), id), false)
 assert.equal(isDepositCalldata(payload(ethers.utils.id('other'), signature, price, zero), id), false)
 assert.equal(isDepositCalldata(payload(id, signature, price, zero) + '00', id), false)
})
