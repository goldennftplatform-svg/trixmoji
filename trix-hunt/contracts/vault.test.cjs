const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dependency = process.env.TRIX_TEST_DEPS
    ? require('node:module').createRequire(path.join(process.env.TRIX_TEST_DEPS, 'package.json')) : require;
const solc = dependency('solc');
const ganache = dependency('ganache');
const { ethers } = dependency('ethers');
const { preflight } = require('./vault-preflight.cjs');
const source = fs.readFileSync(path.join(__dirname, 'TrixGiveawayVault.sol'), 'utf8');
const helper = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract Forwarder { function send(address to, bytes calldata data) external { (bool ok,) = to.call(data); require(ok); } }`;
const input = { language: 'Solidity', sources: { 'Vault.sol': { content: source }, 'Forwarder.sol': { content: helper } }, settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter(e => e.severity === 'error');
assert.deepEqual(errors, [], errors.map(e => e.formattedMessage).join('\n'));
const artifact = (file, name) => output.contracts[file][name];
const id = n => ethers.zeroPadValue(ethers.toBeHex(n), 32);
async function fails(action) { await assert.rejects(async () => { const result = await action(); if (result && result.wait) await result.wait(); }); }
async function setup() {
    const chain = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' } });
    const provider = new ethers.BrowserProvider(chain);
    const [owner, curator, winner, stranger] = await Promise.all([0, 1, 2, 3].map(i => provider.getSigner(i)));
    const a = artifact('Vault.sol', 'TrixGiveawayVault');
    const factory = new ethers.ContractFactory(a.abi, a.evm.bytecode.object, owner);
    const vault = await factory.deploy(owner.address, curator.address);
    await vault.waitForDeployment();
    return { chain, provider, owner, curator, winner, stranger, vault, factory, address: await vault.getAddress() };
}
async function deposit(owner, address, n) { return (await owner.sendTransaction({ to: address, data: id(n) })).wait(); }
async function mine(provider, n) { for (let i = 0; i < n; i++) await provider.send('evm_mine', []); }

test('direct deposits, authorization, validation and forwarding restrictions', async () => {
    const { chain, owner, curator, stranger, vault, factory, address } = await setup();
    try {
        await fails(() => factory.deploy(ethers.ZeroAddress, curator.address));
        await fails(() => factory.deploy(owner.address, ethers.ZeroAddress));
        await fails(() => stranger.sendTransaction({ to: address, data: id(1) }));
        await fails(() => owner.sendTransaction({ to: address, data: '0x1234' }));
        await fails(() => owner.sendTransaction({ to: address, data: '0x' }));
        await fails(() => owner.sendTransaction({ to: address, data: id(0) }));
        await fails(() => owner.sendTransaction({ to: address, data: id(1), value: 1 }));
        const receipt = await deposit(owner, address, 1);
        assert.equal((await vault.entries(id(1))).receivedBlock, BigInt(receipt.blockNumber));
        assert.equal((await vault.entries(id(1))).status, 1n);
        await fails(() => deposit(owner, address, 1));
        const a = artifact('Forwarder.sol', 'Forwarder');
        const forwarder = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, owner).deploy();
        await forwarder.waitForDeployment();
        const otherVault = await factory.deploy(await forwarder.getAddress(), curator.address);
        await otherVault.waitForDeployment();
        await fails(() => forwarder.send(awaitAddress(otherVault), id(2)));
        await fails(() => forwarder.send(address, id(2)));
    } finally { await chain.disconnect(); }
});
function awaitAddress(contract) { return contract.target; }

test('immutable reservation, exact cooldown boundary, permissionless claim and ESIP-2 topics', async () => {
    const { chain, provider, owner, curator, winner, stranger, vault, address } = await setup();
    try {
        await deposit(owner, address, 11);
        await fails(() => vault.connect(stranger).reserve(id(11), id(99), winner.address));
        await fails(() => vault.connect(curator).reserve(id(12), id(99), winner.address));
        await fails(() => vault.connect(curator).reserve(id(11), id(0), winner.address));
        await fails(() => vault.connect(curator).reserve(id(11), id(99), ethers.ZeroAddress));
        await fails(() => vault.connect(curator).reserve(id(11), id(99), address));
        await fails(() => vault.retry(id(11)));
        await fails(() => vault.rescueUnrecorded(id(11), stranger.address));
        await (await vault.connect(curator).reserve(id(11), id(99), winner.address)).wait();
        await fails(() => vault.connect(curator).reserve(id(11), id(100), stranger.address));
        await fails(() => vault.recover(id(11)));
        await fails(() => vault.rescueUnrecorded(id(11), stranger.address));
        await fails(() => vault.connect(stranger).claim.staticCall(id(11)));
        // Reserve mined one block after deposit: four blocks have elapsed at this point.
        await mine(provider, 3);
        await fails(() => vault.connect(stranger).claim.staticCall(id(11)));
        await mine(provider, 1);
        await vault.connect(stranger).claim.staticCall(id(11));
        const receipt = await (await vault.connect(stranger).claim(id(11))).wait();
        const topic = ethers.id('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)');
        const log = receipt.logs.find(l => l.topics[0] === topic);
        assert.ok(log);
        assert.equal(log.address, address);
        assert.deepEqual([...log.topics], [topic, ethers.zeroPadValue(owner.address, 32), ethers.zeroPadValue(winner.address, 32), id(11)]);
        assert.equal(log.data, '0x');
        const request = receipt.logs.map(l => { try { return vault.interface.parseLog(l); } catch { return null; } }).find(l => l && l.name === 'DeliveryRequested');
        assert.equal(request.args.roundId, id(99));
        assert.equal((await vault.entries(id(11))).status, 3n);
        assert.equal((await vault.entries(id(11))).requestCount, 1n);
        await fails(() => vault.rescueUnrecorded(id(11), stranger.address));
        await fails(() => vault.retry.staticCall(id(11)));
        await mine(provider, 4);
        await fails(() => vault.retry.staticCall(id(11)));
        await mine(provider, 1);
        const retryReceipt = await (await vault.connect(stranger).retry(id(11))).wait();
        const retryLog = retryReceipt.logs.find(l => l.topics[0] === topic);
        assert.deepEqual([...retryLog.topics], [topic, ethers.zeroPadValue(owner.address, 32), ethers.zeroPadValue(winner.address, 32), id(11)]);
        const retryEvent = retryReceipt.logs.map(l => { try { return vault.interface.parseLog(l); } catch { return null; } }).find(l => l && l.name === 'TransferRetried');
        assert.equal(retryEvent.args.requestCount, 2n);
        const entry = await vault.entries(id(11));
        assert.equal(entry.requestCount, 2n);
        assert.equal(entry.lastRequestBlock, BigInt(retryReceipt.blockNumber));
        assert.equal(entry.roundId, id(99));
        assert.equal(entry.beneficiary, winner.address);
        await fails(() => vault.retry.staticCall(id(11)));
        await fails(() => vault.claim(id(11)));
        await fails(() => vault.connect(curator).reserve(id(11), id(101), stranger.address));
        await fails(() => deposit(owner, address, 11));
    } finally { await chain.disconnect(); }
});

test('unreserved recovery only to depositor, once and after cooldown', async () => {
    const { chain, provider, owner, curator, stranger, vault, address } = await setup();
    try {
        await deposit(owner, address, 21);
        await fails(() => vault.connect(stranger).recover(id(21)));
        await fails(() => vault.recover.staticCall(id(21)));
        await mine(provider, 5);
        const receipt = await (await vault.recover(id(21))).wait();
        const log = receipt.logs.find(l => l.topics[0] === ethers.id('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)'));
        assert.deepEqual([...log.topics], [ethers.id('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)'), ethers.zeroPadValue(owner.address, 32), ethers.zeroPadValue(owner.address, 32), id(21)]);
        assert.equal((await vault.entries(id(21))).status, 4n);
        await fails(() => vault.rescueUnrecorded(id(21), stranger.address));
        await fails(() => vault.connect(stranger).retry.staticCall(id(21)));
        await mine(provider, 5);
        const retried = await (await vault.connect(stranger).retry(id(21))).wait();
        const retryLog = retried.logs.find(l => l.topics[0] === ethers.id('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)'));
        assert.deepEqual([...retryLog.topics], [ethers.id('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)'), ethers.zeroPadValue(owner.address, 32), ethers.zeroPadValue(owner.address, 32), id(21)]);
        assert.equal((await vault.entries(id(21))).requestCount, 2n);
        await fails(() => vault.recover(id(21)));
        await fails(() => vault.claim(id(21)));
        await fails(() => vault.connect(curator).reserve(id(21), id(22), stranger.address));
        await fails(() => deposit(owner, address, 21));
    } finally { await chain.disconnect(); }
});

test('privileged ESIP-1 rescue is restricted, one-shot, and blocks later allocation', async () => {
    const { chain, owner, curator, winner, stranger, vault, address } = await setup();
    try {
        await fails(() => vault.connect(stranger).rescueUnrecorded(id(31), winner.address));
        await fails(() => vault.rescueUnrecorded(id(0), winner.address));
        await fails(() => vault.rescueUnrecorded(id(31), ethers.ZeroAddress));
        await fails(() => vault.rescueUnrecorded(id(31), address));
        const receipt = await (await vault.rescueUnrecorded(id(31), winner.address)).wait();
        const topic = ethers.id('ethscriptions_protocol_TransferEthscription(address,bytes32)');
        const log = receipt.logs.find(l => l.topics[0] === topic);
        assert.equal(topic, '0xf30861289185032f511ff94a8127e470f3d0e6230be4925cb6fad33f3436dffb');
        assert.deepEqual([...log.topics], [topic, ethers.zeroPadValue(winner.address, 32), id(31)]);
        assert.equal(log.address, address);
        assert.equal(log.data, '0x');
        const entry = await vault.entries(id(31));
        assert.equal(entry.status, 5n);
        assert.equal(entry.beneficiary, winner.address);
        assert.equal(entry.requestCount, 1n);
        assert.equal(entry.lastRequestBlock, BigInt(receipt.blockNumber));
        await fails(() => vault.rescueUnrecorded(id(31), stranger.address));
        await fails(() => vault.retry(id(31)));
        await fails(() => vault.recover(id(31)));
        await fails(() => vault.claim(id(31)));
        await fails(() => vault.connect(curator).reserve(id(31), id(1), stranger.address));
        await fails(() => deposit(owner, address, 31));
    } finally { await chain.disconnect(); }
});

test('raw 32-byte selector collision bypasses fallback despite successful EVM transaction', async () => {
    const { chain, owner, vault, address } = await setup();
    try {
        const selector = vault.interface.getFunction('depositor').selector;
        const collidingId = selector + '00'.repeat(28);
        assert.deepEqual(preflight(artifact('Vault.sol', 'TrixGiveawayVault').abi, collidingId).matches, ['depositor()']);
        assert.equal(preflight(artifact('Vault.sol', 'TrixGiveawayVault').abi, id(123)).safeFromSelectorCollision, true);
        assert.throws(() => preflight(artifact('Vault.sol', 'TrixGiveawayVault').abi, id(0)));
        const receipt = await (await owner.sendTransaction({ to: address, data: collidingId })).wait();
        assert.equal(receipt.status, 1);
        assert.equal(receipt.logs.length, 0);
        assert.equal((await vault.entries(collidingId)).status, 0n);
        assert.equal(vault.interface.parseTransaction({ data: collidingId }).name, 'depositor');
    } finally { await chain.disconnect(); }
});
