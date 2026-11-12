'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSession, PACKS } = require('./engine.js');

const inventory = () => [
  { id: 'a', rank: 1, symbol: 'A', tiles: [{ x: 1 }] },
  { id: 'b', rank: 1, symbol: 'B', tiles: [] },
  { id: 'c', rank: 2, symbol: 'C', tiles: [] },
  { id: 'd', rank: 3, symbol: 'D', tiles: [] }
];
const rng = (...values) => () => { assert.ok(values.length, 'unexpected random draw'); return values.shift(); };

for (const [pack, threshold] of [['bullet', 0.04], ['shotgun', 0.5], ['sniper', 0.8]]) {
  test(`${pack} tier boundary is strictly below ${threshold}`, () => {
    assert.equal(createSession({ pack, inventory: inventory(), random: rng(threshold - 0.000001, 0) }).shoot(true).tier, 'best');
    assert.equal(createSession({ pack, inventory: inventory(), random: rng(threshold, 0) }).shoot(true).tier, 'normal');
  });
}

test('allocates without replacement, alternates players, and snapshots are isolated', () => {
  const input = inventory();
  const original = structuredClone(input);
  const session = createSession({ pack: 'bullet', inventory: input, players: 2, random: rng(0, 0, 0, 0) });
  const first = session.shoot(true);
  first.prize.tiles[0].x = 99;
  const snapshot = session.state;
  snapshot.results[0].prize.symbol = 'changed';
  snapshot.receipts.length = 0;
  const second = session.shoot(true);
  assert.equal(second.player, 1);
  assert.equal(second.prize.id, 'b');
  assert.equal(session.state.results[0].prize.tiles[0].x, 1);
  assert.equal(session.state.results[0].prize.symbol, 'A');
  assert.equal(session.state.receipts.length, 2);
  assert.deepEqual(input, original);
});

test('misses consume ammo without allocating or drawing randomness; zero ammo finishes', () => {
  const session = createSession({ pack: 'shotgun', inventory: inventory(), random: rng() });
  for (let i = 0; i < 10; i++) assert.equal(session.shoot(false).prize, null);
  assert.equal(session.state.reason, 'ammo_exhausted');
  assert.equal(session.state.shotsRemaining, 0);
  assert.equal(session.state.refundCents, 0);
  assert.equal(session.state.inventoryRemaining, 4);
  assert.throws(() => session.shoot(false), /not active/);
});

test('empty selected tier ends session and refunds the attempted and unused shots', () => {
  const session = createSession({ pack: 'shotgun', inventory: [inventory()[2]], random: rng(0) });
  session.shoot(false);
  const receipt = session.shoot(true);
  assert.equal(receipt.code, 'tier_exhausted');
  assert.equal(receipt.tier, 'best');
  assert.equal(receipt.refundCents, 675);
  assert.equal(session.state.shotsTaken, 1);
  assert.equal(session.state.inventoryRemaining, 1);
  assert.equal(session.state.reason, 'tier_exhausted');
});

test('inventory exhaustion and cancellation refund unused shots and preserve results', () => {
  const session = createSession({ pack: 'bullet', inventory: [inventory()[0]], random: rng(0, 0) });
  session.shoot(true);
  assert.equal(session.state.reason, 'inventory_exhausted');
  assert.equal(session.state.refundCents, 450);
  assert.equal(session.state.results.length, 1);
  const empty = createSession({ pack: 'sniper', inventory: [] });
  assert.equal(empty.state.refundCents, 1000);
  const cancelled = createSession({ pack: 'shotgun', inventory: inventory() });
  cancelled.shoot(false);
  assert.equal(cancelled.cancel().refundCents, 675);
  assert.equal(cancelled.state.status, 'cancelled');
  assert.throws(() => cancelled.cancel(), /not active/);
});

test('invalid random values do not partially consume a shot', () => {
  const session = createSession({ pack: 'sniper', inventory: inventory(), random: rng(0, 1) });
  const before = session.state;
  assert.throws(() => session.shoot(true), /random/);
  assert.deepEqual(session.state, before);
});

test('validates configuration and exposes immutable pack constants', () => {
  assert.equal(PACKS.shotgun.priceCents, 750);
  assert.ok(Object.isFrozen(PACKS.bullet));
  assert.throws(() => createSession({ pack: 'toString', inventory: [] }), /pack/);
  assert.throws(() => createSession({ pack: 'bullet', inventory: [inventory()[0], inventory()[0]] }), /Duplicate/);
  assert.throws(() => createSession({ pack: 'bullet', inventory: [], players: 3 }), /players/);
});
