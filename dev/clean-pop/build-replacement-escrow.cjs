'use strict'
// Build an isolated, reviewable artifact. Never deploy or overwrite an existing file.
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')
const { compile } = require('../../../ethereumphunks-market/trixmoji/build.cjs')
const target = path.resolve(__dirname, '../../assets/data/trixmoji-escrow-replacement-artifact.json')
const built = compile()
const artifact = {
 version: 'trixmoji-escrow-replacement-experimental-v1',
 chainId: 1,
 creator: '0x915A3D363D0a4e4470B531f008F5142c540E5417',
 verifier: '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4',
 compiler: built.compiler,
 abi: built.abi,
 bytecode: built.bytecode,
 bytecodeHash: ethers.utils.keccak256(built.bytecode),
 note: 'Experimental combined deposit-and-list build. Wallet routing and mainnet indexing are not yet proven.'
}
fs.writeFileSync(target, JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ path: target, bytecodeHash: artifact.bytecodeHash, compiler: artifact.compiler, transactionSubmitted: false }, null, 2))
