'use strict'
const fs = require('fs'), path = require('path'), solc = require('solc')
const { ethers } = require('ethers')
const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'api/lib/clean-pop-minter.sol'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/ethscriptions/clean-pop-v1/manifest.json')))
if (!source.includes('ROOT = ' + manifest.root + ';') || manifest.count !== 10000) throw Error('Artwork/contract mismatch')
const input = { language: 'Solidity', sources: { 'clean-pop-minter.sol': { content: source } }, settings: {
 optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai',
 outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } }
} }
const result = JSON.parse(solc.compile(JSON.stringify(input)))
const errors = (result.errors || []).filter(e => e.severity === 'error')
if (errors.length) throw Error(errors.map(e => e.formattedMessage).join('\n'))
const c = result.contracts['clean-pop-minter.sol'].CleanPopMinter
const bytecode = '0x' + c.evm.bytecode.object, runtime = '0x' + c.evm.deployedBytecode.object
const factory = '0x4e59b44847b379578588920ca78fbf26c0b4956c'
const salt = ethers.utils.id('TRIXMOJI-CLEAN-POP-V1:' + manifest.root)
const artifact = { version: 'clean-pop-v1', root: manifest.root, factory, salt,
 address: ethers.utils.getCreate2Address(factory, salt, ethers.utils.keccak256(bytecode)),
 bytecode, runtime, runtimeHash: ethers.utils.keccak256(runtime), deployData: salt + bytecode.slice(2),
 abi: c.abi, compiler: solc.version(), chainId: 1, priceWei: '200000000000000',
 creator: '0x915A3D363D0a4e4470B531f008F5142c540E5417', startsPaused: true,
 replacementPolicy: 'owner-verified manual delivery; owner pays gas; legacy token numbers reserved',
 mainnetVerified: false }
fs.writeFileSync(path.join(root, 'assets/data/clean-pop-minter.json'), JSON.stringify(artifact, null, 2))
fs.writeFileSync(path.join(__dirname, 'solidity-input.json'), JSON.stringify(input, null, 2))
console.log(JSON.stringify({ address: artifact.address, root: artifact.root, initcodeBytes: (bytecode.length - 2) / 2, startsPaused: true }, null, 2))
