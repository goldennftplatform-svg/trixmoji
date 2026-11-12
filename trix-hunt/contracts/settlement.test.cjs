const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dependency = process.env.TRIX_TEST_DEPS
    ? require('node:module').createRequire(path.join(process.env.TRIX_TEST_DEPS, 'package.json'))
    : require;
const solc = dependency('solc');
const ganache = dependency('ganache');
const { ethers } = dependency('ethers');

const source = fs.readFileSync(path.join(__dirname, 'TrixHuntSettlement.sol'), 'utf8');
const helper = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IGame { function startRound(bytes32,uint8) external payable; function withdraw() external; }
contract Receiver {
    IGame public game; bool public reject; bool public attempted; bool public reentered;
    constructor(address g) { game = IGame(g); }
    function start(bytes32 id) external payable { game.startRound{value: msg.value}(id, 0); }
    function setReject(bool v) external { reject = v; }
    function withdraw() external { game.withdraw(); }
    receive() external payable {
        require(!reject, "reject");
        attempted = true;
        (reentered,) = address(game).call(abi.encodeCall(IGame.withdraw, ()));
    }
}`;
const input = { language: 'Solidity', sources: { 'Game.sol': { content: source }, 'Receiver.sol': { content: helper } }, settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter(e => e.severity === 'error');
assert.deepEqual(errors, [], errors.map(e => e.formattedMessage).join('\n'));
const artifact = (file, name) => output.contracts[file][name];
const id = n => ethers.zeroPadValue(ethers.toBeHex(n), 32);
const prices = [1000n, 1500n, 2000n];

async function setup() {
    const chain = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' } });
    const provider = new ethers.BrowserProvider(chain);
    const [operator, player, other] = await Promise.all([0, 1, 2].map(i => provider.getSigner(i)));
    const a = artifact('Game.sol', 'TrixHuntSettlement');
    const game = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, operator).deploy(await operator.getAddress(), prices, 100);
    await game.waitForDeployment();
    return { chain, provider, operator, player, other, game };
}
async function fails(action) { await assert.rejects(async () => { const tx = await action(); if (tx && tx.wait) await tx.wait(); }); }

test('exact payments, unique sessions, authorization, result validation and accounting', async () => {
    const { game, player, other, operator, chain } = await setup();
    try {
        await fails(() => game.connect(player).startRound(id(0), 0, { value: 1000 }));
        await fails(() => game.connect(player).startRound(id(1), 3, { value: 1000 }));
        await fails(() => game.connect(player).startRound(id(1), 0, { value: 999 }));
        await (await game.connect(player).startRound(id(1), 1, { value: 1500 })).wait();
        await fails(() => game.connect(other).startRound(id(1), 0, { value: 1000 }));
        await fails(() => game.connect(other).finalizeRound(id(1), 4, id(9), []));
        await fails(() => game.finalizeRound(id(2), 4, id(9), []));
        await fails(() => game.finalizeRound(id(1), 11, id(9), []));
        await fails(() => game.finalizeRound(id(1), 1, id(0), []));
        await fails(() => game.finalizeRound(id(1), 1, id(9), [id(4), id(5)]));
        await fails(() => game.finalizeRound(id(1), 2, id(9), [id(4), id(4)]));
        await fails(() => game.finalizeRound(id(1), 1, id(9), [id(0)]));
        const receipt = await (await game.finalizeRound(id(1), 4, id(9), [id(4)])).wait();
        const event = receipt.logs.map(l => { try { return game.interface.parseLog(l); } catch { return null; } }).find(x => x && x.name === 'RoundFinalized');
        assert.equal(event.args.resultHash, id(9));
        assert.deepEqual([...event.args.claimedCapturedIds], [id(4)]);
        assert.equal(await game.credit(await player.getAddress()), 900n);
        assert.equal(await game.credit(await operator.getAddress()), 600n);
        await fails(() => game.finalizeRound(id(1), 4, id(9), []));
        await fails(() => game.expireRound(id(1)));
        await (await game.connect(player).withdraw()).wait();
        await (await game.withdraw()).wait();
        assert.equal(await game.credit(await player.getAddress()), 0n);
        assert.equal(await game.credit(await operator.getAddress()), 0n);
        assert.equal(await providerBalance(game), 0n);
        await fails(() => game.connect(player).withdraw());
    } finally { await chain.disconnect(); }
});
async function providerBalance(game) { return BigInt(await game.runner.provider.send('eth_getBalance', [await game.getAddress(), 'latest'])); }

test('zero and all shots, concurrent rounds and expiry refund', async () => {
    const { game, player, other, operator, chain, provider } = await setup();
    try {
        await (await game.connect(player).startRound(id(10), 0, { value: prices[0] })).wait();
        await (await game.connect(other).startRound(id(11), 2, { value: prices[2] })).wait();
        await (await game.connect(player).startRound(id(12), 1, { value: prices[1] })).wait();
        await (await game.finalizeRound(id(10), 0, id(20), [])).wait();
        await (await game.finalizeRound(id(11), 10, id(21), [])).wait();
        await fails(() => game.expireRound(id(12)));
        await provider.send('evm_increaseTime', [101]);
        await provider.send('evm_mine', []);
        await fails(() => game.finalizeRound(id(12), 10, id(22), []));
        await (await game.connect(other).expireRound(id(12))).wait();
        await fails(() => game.expireRound(id(12)));
        assert.equal(await game.credit(await player.getAddress()), 2500n);
        assert.equal(await game.credit(await other.getAddress()), 0n);
        assert.equal(await game.credit(await operator.getAddress()), 2000n);
        assert.equal(await providerBalance(game), 4500n);
    } finally { await chain.disconnect(); }
});

test('failed withdrawal preserves credit and callback cannot withdraw twice', async () => {
    const { game, operator, chain } = await setup();
    try {
        const a = artifact('Receiver.sol', 'Receiver');
        const receiver = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, operator).deploy(await game.getAddress());
        await receiver.waitForDeployment();
        await (await receiver.start(id(30), { value: 1000 })).wait();
        await (await game.finalizeRound(id(30), 0, id(31), [])).wait();
        await (await receiver.setReject(true)).wait();
        await fails(() => receiver.withdraw());
        assert.equal(await game.credit(await receiver.getAddress()), 1000n);
        await (await receiver.setReject(false)).wait();
        await (await receiver.withdraw({ gasLimit: 300000 })).wait();
        assert.equal(await receiver.attempted(), true);
        assert.equal(await receiver.reentered(), false);
        assert.equal(await game.credit(await receiver.getAddress()), 0n);
        assert.equal(await providerBalance(game), 0n);
    } finally { await chain.disconnect(); }
});

test('constructor rejects invalid operator, prices and timeout', async () => {
    const { operator, chain } = await setup();
    try {
        const a = artifact('Game.sol', 'TrixHuntSettlement');
        const factory = new ethers.ContractFactory(a.abi, a.evm.bytecode.object, operator);
        await fails(() => factory.deploy(ethers.ZeroAddress, prices, 100));
        await fails(() => factory.deploy(operator.address, [1000, 1501, 2000], 100));
        await fails(() => factory.deploy(operator.address, [0, 1500, 2000], 100));
        await fails(() => factory.deploy(operator.address, prices, 0));
    } finally { await chain.disconnect(); }
});
