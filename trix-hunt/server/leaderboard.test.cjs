'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createLeaderboardServer } = require('./leaderboard.cjs');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'trix-leaderboard-test-'));
  let server;
  async function start() {
    server = await createLeaderboardServer({ directory });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  t.after(async () => { if (server.listening) await stop(); await fs.rm(directory, { recursive: true, force: true }); });
  return { start, stop };
}
async function post(base, round, extra = {}) {
  const response = await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(round) });
  return { status: response.status, body: await response.json() };
}
const round = (sessionId, playerId, hits, shots, nickname = playerId) => ({ sessionId, playerId, nickname, shots, hits });

test('ranks aggregate hits, exact accuracy and deterministic ID; persists across restart', async t => {
  const f = await fixture(t);
  let base = await f.start();
  const inputs = [round('1', 'z', 4, 10), round('2', 'a', 4, 5), round('3', 'b', 4, 5), round('4', 'z', 1, 10), round('5', 'zero', 0, 0)];
  const results = await Promise.all(inputs.map(item => post(base, item)));
  assert.ok(results.every(result => result.status === 201));
  await f.stop();
  base = await f.start();
  const { players } = await (await fetch(`${base}/leaderboard`)).json();
  assert.deepEqual(players.map(p => [p.rank, p.playerId, p.hits, p.shots, p.accuracy]), [
    [1, 'z', 5, 20, 0.25], [2, 'a', 4, 5, 0.8], [3, 'b', 4, 5, 0.8], [4, 'zero', 0, 0, 0]
  ]);
  assert.equal(players[0].rounds, 2);
});

test('retries are idempotent, conflicts rejected and nicknames sanitized', async t => {
  const f = await fixture(t);
  const base = await f.start();
  const input = round('same', 'p', 2, 3, '  <Trix>   Fan!  ');
  const responses = await Promise.all([post(base, input), post(base, input)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  assert.equal(responses[0].body.round.nickname, 'Trix Fan');
  assert.equal((await post(base, { ...input, hits: 1 })).status, 409);
  const { players } = await (await fetch(`${base}/leaderboard`)).json();
  assert.equal(players[0].rounds, 1);
  assert.equal(players[0].hits, 2);
});

test('rejects invalid input, oversized bodies and browser requests without recording', async t => {
  const f = await fixture(t);
  const base = await f.start();
  const valid = round('one', 'p', 1, 2);
  for (const invalid of [{ ...valid, hits: 3 }, { ...valid, shots: 11 }, { ...valid, hits: -1 }, { ...valid, shots: 1.5 }, { ...valid, playerId: '../x' }, { ...valid, nickname: '<>' }, { ...valid, extra: true }]) {
    assert.equal((await post(base, invalid)).status, 400);
  }
  assert.equal((await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: ' '.repeat(4097) })).status, 413);
  assert.equal((await fetch(`${base}/round`, { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await post(base, valid, { origin: 'http://example.com' })).status, 403);
  assert.deepEqual((await (await fetch(`${base}/leaderboard`)).json()).players, []);
});

test('serves the local playtest, permits same-origin scores and rejects foreign origins', async t => {
  const f = await fixture(t);
  const base = await f.start();
  const page = await fetch(`${base}/trix-hunt/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /TRIX HUNT/);
  assert.equal((await fetch(`${base}/trix-hunt/game.js`)).status, 200);
  assert.equal((await fetch(`${base}/assets/ethscriptions/trixmoji-launch/3100.json`)).status, 200);
  assert.equal((await post(base, round('local', 'browser', 3, 5), { origin: base, 'sec-fetch-site': 'same-origin' })).status, 201);
  assert.equal((await post(base, round('foreign', 'browser', 1, 2), { origin: 'https://example.com', 'sec-fetch-site': 'cross-site' })).status, 403);
});
