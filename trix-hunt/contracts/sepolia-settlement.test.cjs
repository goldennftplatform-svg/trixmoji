const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dependency = process.env.TRIX_TEST_DEPS
    ? require('node:module').createRequire(path.join(process.env.TRIX_TEST_DEPS, 'package.json')) : require;
const solc = dependency('solc');
const ganache = dependency('ganache');
const { ethers } = dependency('ethers');
const { quoteFromFeed } = require('../testnet/quote.cjs');

const source = fs.readFileSync(path.join(__dirname, 'TrixHuntSepoliaSettlement.sol'), 'utf8');
const helpers = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract Feed {
    uint8 public decimals = 8; uint80 public roundId = 5; int256 public answer = 200000000000;
    uint256 public updatedAt; uint80 public answeredInRound = 5;
    constructor() { updatedAt = block.timestamp; }
    function set(uint8 d, uint80 r, int256 a, uint256 t, uint80 ar) external { decimals=d; roundId=r; answer=a; updatedAt=t; answeredInRound=ar; }
    function latestRoundData() external view returns(uint80,int256,uint256,uint256,uint80) { return (roundId,answer,0,updatedAt,answeredInRound); }
}
interface IGame { function startRound(bytes32,uint8,uint256) external payable; function withdraw() external; }
contract Receiver {
    IGame game; bool public reject; bool public attempted; bool public reentered;
    constructor(address g) { game=IGame(g); }
    function start(bytes32 id, uint256 price) external payable { game.startRound{value:msg.value}(id,0,price); }
    function setReject(bool v) external { reject=v; }
    function withdraw() external { game.withdraw(); }
    receive() external payable { require(!reject); attempted=true; (reentered,) = address(game).call(abi.encodeCall(IGame.withdraw,())); }
}`;
const input = { language: 'Solidity', sources: { 'Game.sol': { content: source }, 'Helpers.sol': { content: helpers } }, settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter(e => e.severity === 'error');
assert.deepEqual(errors, [], errors.map(e => e.formattedMessage).join('\n'));
const artifact = (file, name) => output.contracts[file][name];
const id = n => ethers.zeroPadValue(ethers.toBeHex(n), 32);
async function fails(action) { await assert.rejects(async () => { const tx = await action(); if (tx?.wait) await tx.wait(); }); }
async function setup(chainId = 11155111) {
    const chain = ganache.provider({ logging: { quiet: true }, chain: { chainId, hardfork: 'shanghai' } });
    const provider = new ethers.BrowserProvider(chain);
    const [operator, player, other] = await Promise.all([0, 1, 2].map(i => provider.getSigner(i)));
    const deploy = async (file, name, ...args) => { const a = artifact(file, name); const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, operator).deploy(...args); await c.waitForDeployment(); return c; };
    const feed = await deploy('Helpers.sol', 'Feed');
    return { chain, provider, operator, player, other, feed, deploy };
}
async function gameFor(ctx) { return ctx.deploy('Game.sol', 'TrixHuntSepoliaSettlement', await ctx.feed.getAddress(), ctx.operator.address); }
async function timestamp(ctx) { return Number((await ctx.provider.send('eth_getBlockByNumber', ['latest', false])).timestamp); }
async function setFeed(ctx, d, r, a, t, ar) { await (await ctx.feed.set(d, r, a, t, ar)).wait(); }

test('quotes all packs with ceiling and validates every oracle field', async () => {
    const c = await setup();
    try {
        const game = await gameFor(c);
        for (const [pack, cents] of [[0, 500n], [1, 750n], [2, 1000n]]) {
            const raw = (cents * 10n ** 24n + 200000000000n - 1n) / 200000000000n;
            assert.equal(await game.quote(pack), ((raw + 9n) / 10n) * 10n);
        }
        const now = await timestamp(c);
        await setFeed(c, 8, 5, 234567890123n, now, 5);
        const raw = (500n * 10n ** 24n + 234567890123n - 1n) / 234567890123n;
        assert.equal(await game.quote(0), ((raw + 9n) / 10n) * 10n);
        const quote=quoteFromFeed({chainId:11155111,answer:'234567890123',decimals:8,updatedAt:now,blockTimestamp:now,roundId:5,answeredInRound:5});
        for(let pack=0;pack<3;pack++)assert.equal((await game.quote(pack)).toString(),quote.prices[pack].wei);
        await fails(() => game.quote(3));
        for (const args of [[7,5,1,now,5], [8,0,1,now,0], [8,5,0,now,5], [8,5,-1,now,5], [8,5,1,0,5], [8,5,1,now+10000,5], [8,5,1,now-7201,5], [8,5,1,now,4]]) {
            await setFeed(c, ...args); await fails(() => game.quote(0));
        }
    } finally { await c.chain.disconnect(); }
});

test('payment bounds, snapshot, authorization, accounting and withdrawals', async () => {
    const c = await setup();
    try {
        const game = await gameFor(c); const price = await game.quote(1); const max = price + 100n;
        await fails(() => game.connect(c.player).startRound(id(0), 1, max, { value: max }));
        await fails(() => game.connect(c.player).startRound(id(1), 1, price - 1n, { value: price - 1n }));
        await fails(() => game.connect(c.player).startRound(id(1), 1, max, { value: price - 1n }));
        await fails(() => game.connect(c.player).startRound(id(1), 1, max, { value: max + 1n }));
        await (await game.connect(c.player).startRound(id(1), 1, max, { value: max })).wait();
        await fails(() => game.connect(c.other).startRound(id(1), 1, max, { value: max }));
        assert.equal((await game.rounds(id(1))).price, price);
        await setFeed(c, 8, 6, 100000000000n, await timestamp(c), 6);
        assert.equal(await game.quote(1), price * 2n);
        await fails(() => game.connect(c.player).finalizeRound(id(1), 4, id(9)));
        await fails(() => game.finalizeRound(id(1), 11, id(9)));
        await fails(() => game.finalizeRound(id(1), 4, id(0)));
        await (await game.finalizeRound(id(1), 4, id(9))).wait();
        await fails(() => game.finalizeRound(id(1), 4, id(9)));
        await fails(() => game.expireRound(id(1)));
        assert.equal(await game.credit(c.player.address), 100n + price * 6n / 10n);
        assert.equal(await game.credit(c.operator.address), price * 4n / 10n);
        await (await game.connect(c.player).withdraw()).wait();
        await (await game.withdraw()).wait();
        assert.equal(await game.credit(c.player.address), 0n);
        assert.equal(BigInt(await c.provider.send('eth_getBalance', [await game.getAddress(), 'latest'])), 0n);
        await fails(() => game.withdraw());
    } finally { await c.chain.disconnect(); }
});

test('expiry refunds full snapshot and disallows finalization at deadline', async () => {
    const c = await setup();
    try {
        const game = await gameFor(c); const price = await game.quote(0);
        await (await game.connect(c.player).startRound(id(2), 0, price, { value: price })).wait();
        await fails(() => game.expireRound(id(2)));
        await c.provider.send('evm_increaseTime', [86401]); await c.provider.send('evm_mine', []);
        await fails(() => game.finalizeRound(id(2), 10, id(3)));
        await (await game.connect(c.other).expireRound(id(2))).wait();
        assert.equal(await game.credit(c.player.address), price);
        await fails(() => game.expireRound(id(2)));
    } finally { await c.chain.disconnect(); }
});

test('withdrawal failure preserves credit and reentrancy cannot withdraw twice', async () => {
    const c = await setup();
    try {
        const game = await gameFor(c); const price = await game.quote(0);
        const receiver = await c.deploy('Helpers.sol', 'Receiver', await game.getAddress());
        await (await receiver.start(id(4), price, { value: price })).wait();
        await (await game.finalizeRound(id(4), 0, id(31))).wait();
        await (await receiver.setReject(true)).wait();
        await fails(() => receiver.withdraw());
        assert.equal(await game.credit(await receiver.getAddress()), price);
        await (await receiver.setReject(false)).wait();
        await (await receiver.withdraw({ gasLimit: 300000 })).wait();
        assert.equal(await receiver.attempted(), true);
        assert.equal(await receiver.reentered(), false);
        assert.equal(await game.credit(await receiver.getAddress()), 0n);
    } finally { await c.chain.disconnect(); }
});

test('constructor rejects mainnet and zero addresses', async () => {
    const c = await setup();
    try {
        await fails(() => c.deploy('Game.sol', 'TrixHuntSepoliaSettlement', ethers.ZeroAddress, c.operator.address));
        await fails(() => c.deploy('Game.sol', 'TrixHuntSepoliaSettlement', awaitAddress(c.feed), ethers.ZeroAddress));
    } finally { await c.chain.disconnect(); }
    const mainnet = await setup(1);
    try { await fails(() => gameFor(mainnet)); } finally { await mainnet.chain.disconnect(); }
});
function awaitAddress(contract) { return contract.target; }
