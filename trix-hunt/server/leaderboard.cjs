'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createTestEconomy } = require('./test-economy.cjs');

const MAX_BODY = 4096;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function normalizeRound(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'hits,nickname,playerId,sessionId,shots') {
    throw new Error('Expected sessionId, playerId, nickname, shots and hits');
  }
  const { sessionId, playerId, shots, hits } = value;
  if (typeof sessionId !== 'string' || !ID.test(sessionId) ||
      typeof playerId !== 'string' || !ID.test(playerId)) throw new Error('Invalid ID');
  if (typeof value.nickname !== 'string' || value.nickname.length > 128) throw new Error('Invalid nickname');
  const nickname = value.nickname.replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/ +/g, ' ');
  if (!nickname || nickname.length > 24) throw new Error('Invalid nickname');
  if (!Number.isInteger(shots) || shots < 0 || shots > 10 ||
      !Number.isInteger(hits) || hits < 0 || hits > shots) throw new Error('Invalid shots or hits');
  return { sessionId, playerId, nickname, shots, hits };
}

function leaderboard(rounds) {
  const players = new Map();
  for (const round of rounds) {
    let player = players.get(round.playerId);
    if (!player) {
      player = { playerId: round.playerId, nickname: round.nickname, hits: 0, shots: 0, rounds: 0 };
      players.set(round.playerId, player);
    }
    player.nickname = round.nickname;
    player.hits += round.hits;
    player.shots += round.shots;
    player.rounds++;
    if (![player.hits, player.shots, player.rounds].every(Number.isSafeInteger)) throw new Error('Totals exceed safe integer range');
  }
  return [...players.values()].sort((a, b) => {
    if (a.hits !== b.hits) return b.hits - a.hits;
    // Compare fractions exactly, including zero-shot accuracy as zero.
    const difference = BigInt(b.hits) * BigInt(a.shots || 1) - BigInt(a.hits) * BigInt(b.shots || 1);
    return difference > 0n ? 1 : difference < 0n ? -1 : a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  }).map((player, index) => ({ rank: index + 1, ...player, accuracy: player.shots ? player.hits / player.shots : 0 }));
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function createLeaderboardServer({ directory = process.env.TRIX_LEADERBOARD_DIR || path.join(os.tmpdir(), 'trix-hunt-leaderboard') } = {}) {
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, 'rounds.json');
  let rounds;
  try {
    const stored = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (!Array.isArray(stored)) throw new Error('Invalid stored rounds');
    rounds = stored.map(normalizeRound);
    if (new Set(rounds.map(round => round.sessionId)).size !== rounds.length) throw new Error('Duplicate stored session');
    leaderboard(rounds);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    rounds = [];
  }
  let queue = Promise.resolve();
  const economy = await createTestEconomy({ directory, quote: async () => {
    const response = await fetch('http://127.0.0.1:8790/quote', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Quote unavailable');
    return response.json();
  } });
  const server = http.createServer(async (req, res) => {
    // A local browser may use only this exact loopback origin. Do not expose this
    // development-only, caller-supplied-score service to a public network.
    const address = server.address();
    const localHost = address && `127.0.0.1:${address.port}`;
    if (req.headers.host !== localHost) return send(res, 403, { error: 'Loopback host required' });
    if ((req.headers.origin && req.headers.origin !== `http://${localHost}`) ||
        (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
      return send(res, 403, { error: 'Local same-origin requests only' });
    }
    if (req.method === 'GET') {
      const pathname = req.url.split('?')[0];
      let filename, mime;
      if (pathname === '/' || pathname === '/trix-hunt/' || pathname === '/trix-hunt/index.html') {
        filename = path.join(__dirname, '..', 'index.html'); mime = 'text/html; charset=utf-8';
      } else if (/^\/trix-hunt\/(style\.css|admin\.css|admin\.html|admin\.js|admin-wallet\.js|game\.js|engine\.js|beta-client\.js|inventory\.js|test-quote\.js|test-admin\.html|test-admin\.js)$/.test(pathname)) {
        filename = path.join(__dirname, '..', pathname.slice('/trix-hunt/'.length));
        mime = pathname.endsWith('.css') ? 'text/css; charset=utf-8' : pathname.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8';
      } else if (/^\/assets\/ethscriptions\/trixmoji-launch\/(?:[0-9]{1,4})\.(?:json|webp)$/.test(pathname)) {
        filename = path.join(__dirname, '..', '..', pathname.slice(1));
        mime = pathname.endsWith('.json') ? 'application/json; charset=utf-8' : 'image/webp';
      } else if (/^\/assets\/js\/core\/(?:ethscription-checkout|market-wallet-connect)\.js$/.test(pathname)) {
        filename = path.join(__dirname, '..', '..', pathname.slice(1));
        mime = 'text/javascript; charset=utf-8';
      }
      if (filename) {
        try {
          const body = await fs.readFile(filename);
          res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          return res.end(body);
        } catch (error) { return send(res, error.code === 'ENOENT' ? 404 : 500, { error: 'File unavailable' }); }
      }
    }
    if (req.method === 'GET' && req.url === '/test-quote') {
      try {
        const response = await fetch('http://127.0.0.1:8790/quote', { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw Error('unavailable');
        return send(res, 200, await response.json());
      } catch (_) { return send(res, 503, { ok: false, error: 'Sepolia test quote unavailable' }); }
    }
    if (req.method === 'GET' && req.url === '/escrow-snapshot') {
      try {
        const response = await fetch('https://trixmoji.netlify.app/.netlify/functions/trixmoji-market-launch', { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('upstream unavailable');
        const data = await response.json();
        return send(res, 200, data);
      } catch (_) { return send(res, 503, { ok: false, error: 'Escrow snapshot unavailable' }); }
    }
    if (req.method === 'GET' && req.url === '/leaderboard') {
      await queue;
      return send(res, 200, { players: leaderboard(rounds) });
    }
    if (req.method === 'GET' && req.url === '/test-economy') return send(res, 200, { ok: true, ...await economy.summary() });
    if (req.method === 'GET' && req.url === '/test-vault') {
      try {
        const vault='0x6d2b465ce1dd7a0192f67d6d257e06444d8a0eb1';
        const [statusResponse,itemsResponse]=await Promise.all([
          fetch('http://127.0.0.1:4000/status',{signal:AbortSignal.timeout(10000)}),
          fetch('http://127.0.0.1:4000/ethscriptions?current_owner='+vault,{signal:AbortSignal.timeout(10000)})
        ]);
        if(!statusResponse.ok||!itemsResponse.ok)throw Error('unavailable');
        const status=await statusResponse.json(),data=await itemsResponse.json();
        const head=Number(status.current_block_number),indexed=Number(status.last_imported_block);
        if(!Number.isSafeInteger(head)||!Number.isSafeInteger(indexed)||indexed>head||head-indexed>2||!Array.isArray(data.result))throw Error('stale');
        const items=data.result.filter(x=>x&&/^0x[a-f0-9]{64}$/i.test(String(x.transaction_hash||''))&&String(x.current_owner||'').toLowerCase()===vault).map(x=>({id:x.transaction_hash,previousOwner:x.previous_owner}));
        return send(res,200,{ok:true,vault,indexedBlock:indexed,complete:!(data.pagination&&data.pagination.has_more),items});
      } catch (_) { return send(res,503,{ok:false,error:'Sepolia test vault indexer unavailable or behind'}); }
    }
    if (req.method === 'POST' && (req.url === '/test-round/start' || req.url === '/test-round/finish')) {
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Expected application/json' });
      let size=0,chunks=[];for await (const chunk of req){size+=chunk.length;if(size<=MAX_BODY)chunks.push(chunk)}
      if(size>MAX_BODY)return send(res,413,{error:'Body too large'});
      try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8')),row=req.url.endsWith('/start')?await economy.start(body):await economy.finish(body);return send(res,200,{ok:true,round:row})}
      catch(_){return send(res,400,{ok:false,error:'Test round or quote unavailable'})}
    }
    if (req.method !== 'POST' || req.url !== '/round') return send(res, 404, { error: 'Not found' });
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Expected application/json' });
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size <= MAX_BODY) chunks.push(chunk);
    }
    if (size > MAX_BODY) return send(res, 413, { error: 'Body too large' });
    let round;
    try { round = normalizeRound(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch (error) { return send(res, 400, { error: 'Invalid round' }); }
    const operation = queue.then(async () => {
      const existing = rounds.find(item => item.sessionId === round.sessionId);
      if (existing) {
        return JSON.stringify(existing) === JSON.stringify(round)
          ? { status: 200, body: { recorded: false, round: existing } }
          : { status: 409, body: { error: 'Session ID already recorded with different data' } };
      }
      const next = [...rounds, round];
      leaderboard(next);
      const temporary = `${filename}.${process.pid}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
        await fs.rename(temporary, filename);
      } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => {});
        throw error;
      }
      rounds = next;
      return { status: 201, body: { recorded: true, round } };
    });
    queue = operation.then(() => {}, () => {});
    try { const result = await operation; send(res, result.status, result.body); }
    catch { send(res, 500, { error: 'Unable to persist round' }); }
  });
  return server;
}

if (require.main === module) {
  const port = process.env.PORT === undefined ? 8787 : Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('PORT must be an integer from 0 to 65535');
    process.exitCode = 1;
  } else {
    createLeaderboardServer().then(server => {
      server.on('error', error => { console.error(error); process.exitCode = 1; });
      server.listen(port, '127.0.0.1', () => console.log(`Local Trix Hunt playtest: http://127.0.0.1:${server.address().port}/trix-hunt/`));
    }).catch(error => { console.error(error); process.exitCode = 1; });
  }
}

module.exports = { createLeaderboardServer };
