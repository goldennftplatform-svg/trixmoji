'use strict'
// Produces the candidate only; no transaction is signed or sent.
const fs = require('fs'), path = require('path'), solc = require('solc'), { ethers } = require('ethers')
const root = path.resolve(__dirname, '../..'), filename = 'trixmoji-launch-minter.sol'
const source = fs.readFileSync(path.join(root, 'api/lib', filename), 'utf8').replace(/\r\n/g, '\n')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/ethscriptions/trixmoji-launch/manifest.json'), 'utf8'))
if (manifest.count !== 10000 || manifest.uniqueContentUris !== 10000 || !source.includes('ROOT = ' + manifest.root + ';') || !source.includes('paused = false;')) throw Error('Candidate mismatch')
if (!solc.version().startsWith('0.8.20+')) throw Error('Solidity 0.8.20 is required')
const input = { language: 'Solidity', sources: { [filename]: { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } }
const output = JSON.parse(solc.compile(JSON.stringify(input))), errors = (output.errors || []).filter(e => e.severity === 'error')
if (errors.length) throw Error(errors.map(e => e.formattedMessage).join('\n'))
const compiled = output.contracts[filename].TrixMojiLaunchMinter
const bytecode = '0x' + compiled.evm.bytecode.object, runtime = '0x' + compiled.evm.deployedBytecode.object
const factory = '0x4e59b44847b379578588920ca78fbf26c0b4956c', salt = ethers.utils.id('TRIXMOJI-LAUNCH:' + manifest.root)
const artifact = { version: 'trixmoji-launch-candidate', root: manifest.root, mimeType: 'image/webp', factory, salt,
 address: ethers.utils.getCreate2Address(factory, salt, ethers.utils.keccak256(bytecode)), bytecode, runtime,
 runtimeHash: ethers.utils.keccak256(runtime), deployData: salt + bytecode.slice(2), abi: compiled.abi, compiler: solc.version(), chainId: 1,
 priceWei: '200000000000000', creator: '0x915A3D363D0a4e4470B531f008F5142c540E5417', site: '0x15e85a85B7026875d3529EF0c6de2723C285DA11', maxPerWallet: 20,
 startsPaused: false, reservedTokenNumbers: [], deployed: false, mainnetVerified: false,
 note: 'Candidate only. No deployment, live mint integration or external audit is implied.' }
const target = path.join(root, 'assets/data/trixmoji-launch-candidate.json')
fs.writeFileSync(target, JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ path: target, predictedAddress: artifact.address, root: artifact.root, startsPaused: artifact.startsPaused, deployed: false }, null, 2))
