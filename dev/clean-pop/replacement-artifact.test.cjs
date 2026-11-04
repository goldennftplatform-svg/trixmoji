'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ethers } = require('ethers')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json')
const existing = require('../../assets/data/trixmoji-escrow-artifact.json')
const deployment = require('../../assets/data/trixmoji-escrow-replacement-deployment.json')
const { compile } = require('../../../ethereumphunks-market/trixmoji/build.cjs')
test('replacement artifact is pinned to the locally tested source, constructor roles, and distinct bytecode', () => {
 const rebuilt = compile()
 assert.equal(artifact.version, 'trixmoji-escrow-replacement-experimental-v1')
 assert.equal(artifact.chainId, 1)
 assert.equal(artifact.creator, existing.creator)
 assert.equal(artifact.verifier, existing.verifier)
 assert.equal(artifact.bytecodeHash, ethers.utils.keccak256(artifact.bytecode))
 assert.notEqual(artifact.bytecodeHash, existing.bytecodeHash)
 assert.equal(artifact.bytecode, rebuilt.bytecode)
 assert.deepEqual(artifact.abi, rebuilt.abi)
 const deploy = new ethers.utils.Interface(artifact.abi).deploy
 assert.deepEqual(deploy.inputs.map(input => [input.name, input.type]), [['verifier_', 'address'], ['creator_', 'address']])
})
test('replacement deployment metadata binds reviewed constructor and keeps the existing escrow distinct', () => {
 const data = new ethers.ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(artifact.verifier, artifact.creator).data
 assert.equal(ethers.utils.keccak256(data), deployment.initcodeHash)
 assert.equal(deployment.creator, artifact.creator); assert.equal(deployment.verifier, artifact.verifier)
 assert.equal(deployment.status, 'experimental-not-switched')
 assert.notEqual(deployment.address.toLowerCase(), require('../../assets/data/trixmoji-escrow-deployment.json').address.toLowerCase())
})
