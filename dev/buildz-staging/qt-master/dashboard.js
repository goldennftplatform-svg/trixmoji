import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DASHBOARD_PORT || 8787);
const STATE_FILE = path.join(ROOT, 'swing-state.json');
const TRADE_LOG = path.join(ROOT, 'live-trades.jsonl');

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function readTrades() {
  try {
    return fs.readFileSync(TRADE_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean)
      .slice(-250).map(x => JSON.parse(x)).reverse();
  } catch { return []; }
}
function n(v, d=0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}
function buildData() {
  const state = readJson(STATE_FILE, {});
  const cache = Object.values(state.candidateCache || {});
  const positions = Object.values(state.positions || {});
  const trades = readTrades();
  const stateMtime = fs.existsSync(STATE_FILE) ? fs.statSync(STATE_FILE).mtimeMs : 0;
  const ageSec = stateMtime ? (Date.now() - stateMtime) / 1000 : Infinity;

  const candidates = cache
    .filter(c => c && c.address)
    .sort((a,b) => n(b.score)-n(a.score))
    .slice(0, 50);

  const open = positions.map(p => {
    const c = cache.find(x => x.address === p.mint);
    const price = n(c?.price, n(p.lastPrice, n(p.entryPrice)));
    const entry = n(p.entryPrice);
    const pnlPct = entry ? ((price-entry)/entry)*100 : 0;
    return {...p, currentPrice: price, pnlPct, score: n(c?.score), change5m: n(c?.change5m), change1h: n(c?.change1h), liquidity: n(c?.liquidity)};
  });

  const buys = trades.filter(t => t.side === 'BUY').length;
  const sells = trades.filter(t => t.side === 'SELL').length;
  const errors = trades.filter(t => String(t.side || '').includes('ERROR') || t.side === 'SYSTEM_ERROR').length;

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    bot: {
      stateFilePresent: fs.existsSync(STATE_FILE),
      stateAgeSec: Number.isFinite(ageSec) ? ageSec : null,
      status: ageSec < 90 ? 'RUNNING' : ageSec < 300 ? 'STALE' : 'OFFLINE',
      dayPnl: n(state.dayPnl),
      consecutiveLosses: n(state.consecutiveLosses),
      dayStart: state.dayStart || null,
      openPositions: open.length,
      candidateCount: candidates.length,
      tradesLogged: trades.length,
      buys, sells, errors
    },
    candidates,
    positions: open,
    trades
  };
}

const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'));

const server = http.createServer((req,res) => {
  if (req.url === '/api/state') {
    const body = JSON.stringify(buildData());
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
    return res.end(body);
  }
  if (req.url === '/api/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ok:true}));
  }
  if (req.url === '/' || req.url === '/dashboard.html') {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
    return res.end(html);
  }
  res.writeHead(404, {'Content-Type':'text/plain'});
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`QUANTUM TRADER DASHBOARD: http://127.0.0.1:${PORT}`);
});
