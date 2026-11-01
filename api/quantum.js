/**
 * Quantum desk sample.
 * GET  /api/quantum                 levels
 * GET  /api/quantum?level=3        scan
 * POST /api/quantum                unsigned swap for the caller's own wallet
 * This file never reads a seed or secret key.
 * New pools under 90 minutes are scored for a fast move, then refused
 * unless a honeypot check and a sell route are both clear.
 * Exits are strict: take the small win, sell a downtrend, cut a loser fast.
 * Closed trades adjust later entry weights. They do not promise a win rate.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { rateLimitOrReject } = require('./lib/rate-limit');
const { connectNetlifyBlobs } = require('./lib/x-scores-store');
const { solRpcUrls } = require('./lib/helius-rpc');

const SELL_ARM = 0.4;
const SELL_TRAIL = 0.3;
const SELL_STOP = 0.6;
const SELL_DEAD_MIN = 0.4;
const TAKE_GAS_SOL = 0.001;
const MIN_SOL = 0.01;
const MAX_SOL = 1;
const FEE_RESERVE_SOL = 0.003;
const DEX = 'https://api.dexscreener.com';
const JUP = 'https://lite-api.jup.ag/swap/v1';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const LEVELS = [
  { id: 1, name: 'SIT STILL', tradeUsd: 0, maxPos: 0, minScore: 90, minLiq: 200000, minV5: 20000, minV1: 100000, minTx: 40, minChange: 0, tp: 5, sl: 3, hold: 60, poll: 30, pressure: true, slippage: 50, paperUsd: 25 },
  { id: 2, name: 'SMALL PAPER', tradeUsd: 0.5, maxPos: 1, minScore: 82, minLiq: 80000, minV5: 8000, minV1: 40000, minTx: 25, minChange: 2, tp: 8, sl: 4, hold: 40, poll: 20, pressure: true, slippage: 75, paperUsd: 25 },
  { id: 3, name: 'SUPER DEGEN CRAZY AGGRESSIVE', tradeUsd: 2, maxPos: 5, minScore: 58, minLiq: 12000, minV5: 2500, minV1: 8000, minTx: 15, minChange: 3, tp: 18, sl: 7, hold: 12, poll: 12, pressure: true, slippage: 180, paperUsd: 25 },
  { id: 4, name: 'LOUDER', tradeUsd: 3, maxPos: 6, minScore: 52, minLiq: 8000, minV5: 2000, minV1: 6000, minTx: 12, minChange: 2, tp: 25, sl: 9, hold: 10, poll: 12, pressure: true, slippage: 200, paperUsd: 30 },
  { id: 5, name: 'NO SLEEP', tradeUsd: 4, maxPos: 6, minScore: 48, minLiq: 6000, minV5: 1500, minV1: 5000, minTx: 10, minChange: 1, tp: 30, sl: 11, hold: 8, poll: 12, pressure: true, slippage: 220, paperUsd: 40 },
  { id: 6, name: 'FLOOR IT', tradeUsd: 5, maxPos: 7, minScore: 44, minLiq: 5000, minV5: 1200, minV1: 4000, minTx: 8, minChange: 0, tp: 40, sl: 14, hold: 8, poll: 12, pressure: false, slippage: 250, paperUsd: 50 },
  { id: 7, name: 'UNHINGED', tradeUsd: 6, maxPos: 8, minScore: 40, minLiq: 4000, minV5: 800, minV1: 3000, minTx: 6, minChange: -2, tp: 50, sl: 16, hold: 6, poll: 12, pressure: false, slippage: 300, paperUsd: 60 },
  { id: 8, name: 'VOID BIAS', tradeUsd: 8, maxPos: 8, minScore: 36, minLiq: 3000, minV5: 500, minV1: 2000, minTx: 5, minChange: -5, tp: 60, sl: 20, hold: 5, poll: 12, pressure: false, slippage: 350, paperUsd: 80 },
  { id: 9, name: 'LAST RITES', tradeUsd: 10, maxPos: 10, minScore: 30, minLiq: 2000, minV5: 300, minV1: 1500, minTx: 4, minChange: -8, tp: 80, sl: 25, hold: 4, poll: 12, pressure: false, slippage: 400, paperUsd: 100 },
  { id: 10, name: 'FULL SEND', tradeUsd: 15, maxPos: 12, minScore: 22, minLiq: 1000, minV5: 100, minV1: 800, minTx: 2, minChange: -15, tp: 100, sl: 30, hold: 3, poll: 12, pressure: false, slippage: 500, paperUsd: 150 }
];

const QUOTES = {
  solana: ['SOL', 'USDC', 'USDT'],
  ethereum: ['WETH', 'ETH', 'USDC', 'USDT', 'DAI']
};
const QUOTE_IDS = {
  solana: [
    'So11111111111111111111111111111111111111112',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  ],
  ethereum: [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0xdac17f958d2ee523a2206206994597c13d831ec7'
  ]
};
const LEARN_KEY = 'learn';
const safetyCache = new Map();
let learnMem = null;
let learnSavedAt = 0;

const cache = new Map();

function levelById(id) {
  const n = Number(id);
  return LEVELS.filter((lvl) => lvl.id === n)[0] || null;
}

function publicLevel(lvl) {
  return {
    id: lvl.id,
    name: lvl.name,
    tradeUsd: lvl.tradeUsd,
    maxPos: lvl.maxPos,
    minScore: lvl.minScore,
    minLiq: lvl.minLiq,
    minChange: lvl.minChange,
    tp: lvl.tp,
    sl: lvl.sl,
    hold: lvl.hold,
    poll: lvl.poll,
    pressure: lvl.pressure,
    slippage: lvl.slippage,
    paperUsd: lvl.paperUsd,
    degen: lvl.id === 3
  };
}

async function getJson(url, ms) {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(ms || 8000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function rowsOf(data) {
  return Array.isArray(data) ? data : [];
}

function emptyLearn() {
  return {
    updatedAt: 0,
    coins: {},
    weights: { young: 1, pressure: 1, band: 1, lift: 1 },
    stats: { resolved: 0, trades: 0, wins: 0, losses: 0, winPct: 0, hit2: 0, hit10: 0, hit100: 0, honey: 0, dead: 0, ready: false }
  };
}

function publicLearn(book) {
  const s = (book && book.stats) || emptyLearn().stats;
  const w = (book && book.weights) || emptyLearn().weights;
  const wins = s.wins || 0;
  const losses = s.losses || 0;
  const decisive = wins + losses;
  return {
    resolved: decisive,
    trades: s.trades || 0,
    wins: wins,
    losses: losses,
    winPct: decisive ? Math.round((wins / decisive) * 100) : 0,
    hit2: s.hit2 || 0,
    hit10: s.hit10 || 0,
    hit100: s.hit100 || 0,
    honey: s.honey || 0,
    dead: losses,
    ready: decisive >= 12,
    weights: { young: w.young || 1, pressure: w.pressure || 1, band: w.band || 1, lift: w.lift || 1 }
  };
}

async function loadLearn() {
  if (learnMem && Date.now() - learnMem.loadedAt < 20000) return learnMem.book;
  const blobs = await blobStore();
  if (blobs) {
    try {
      const raw = await blobs.get(LEARN_KEY, { type: 'json' });
      if (raw && raw.coins) {
        learnMem = { book: raw, loadedAt: Date.now() };
        return raw;
      }
    } catch (e) {}
  }
  if (!learnMem) learnMem = { book: emptyLearn(), loadedAt: Date.now() };
  return learnMem.book;
}

async function saveLearn(book, force) {
  book.updatedAt = Date.now();
  learnMem = { book: book, loadedAt: Date.now() };
  if (!force && Date.now() - learnSavedAt < 45000) return;
  const blobs = await blobStore();
  if (!blobs) return;
  try {
    await blobs.setJSON(LEARN_KEY, book);
    learnSavedAt = Date.now();
  } catch (e) {}
}

function rowFromPair(chain, p) {
  if (!p.baseToken || p.chainId !== chain) return null;
  if (p.quoteToken && QUOTES[chain].indexOf(p.quoteToken.symbol) < 0) return null;
  const created = Number(p.pairCreatedAt);
  return {
    chain: chain,
    address: p.baseToken.address,
    symbol: String(p.baseToken.symbol || 'UNKNOWN').slice(0, 16),
    price: Number(p.priceUsd || 0),
    liquidity: Number((p.liquidity && p.liquidity.usd) || 0),
    volume5m: Number((p.volume && p.volume.m5) || 0),
    volume1h: Number((p.volume && p.volume.h1) || 0),
    buys: Number((p.txns && p.txns.m5 && p.txns.m5.buys) || 0),
    sells: Number((p.txns && p.txns.m5 && p.txns.m5.sells) || 0),
    change5m: Number((p.priceChange && p.priceChange.m5) || 0),
    ageMin: Number.isFinite(created) && created > 0 ? (Date.now() - created) / 60000 : null,
    score: 0,
    safety: '',
    why: '',
    early: false,
    lpOpen: false
  };
}

function poolFromGecko(chain, pool) {
  const a = pool.attributes || {};
  const rel = pool.relationships || {};
  const baseId = (rel.base_token && rel.base_token.data && rel.base_token.data.id) || '';
  const quoteId = (rel.quote_token && rel.quote_token.data && rel.quote_token.data.id) || '';
  const cut = baseId.indexOf('_');
  const qcut = quoteId.indexOf('_');
  if (cut < 1 || qcut < 1) return null;
  const base = baseId.slice(cut + 1);
  const quote = quoteId.slice(qcut + 1);
  const known = QUOTE_IDS[chain] || [];
  if (!known.some((id) => id.toLowerCase() === quote.toLowerCase())) return null;
  const created = Date.parse(a.pool_created_at);
  const m5 = (a.transactions && a.transactions.m5) || {};
  const vol = a.volume_usd || {};
  const ch = a.price_change_percentage || {};
  const name = String(a.name || '');
  return {
    chain: chain,
    address: base,
    symbol: (name.split('/')[0] || 'UNKNOWN').trim().slice(0, 16) || 'UNKNOWN',
    price: Number(a.base_token_price_usd || 0),
    liquidity: Number(a.reserve_in_usd || 0),
    volume5m: Number(vol.m5 || 0),
    volume1h: Number(vol.h1 || 0),
    buys: Number(m5.buys || 0),
    sells: Number(m5.sells || 0),
    change5m: Number(ch.m5 || 0),
    ageMin: Number.isFinite(created) ? (Date.now() - created) / 60000 : null,
    score: 0,
    safety: '',
    why: '',
    early: false,
    lpOpen: false
  };
}

function scoreRow(row) {
  const liq = row.liquidity || 0;
  const v1 = row.volume1h || 0;
  const buys = row.buys || 0;
  const sells = row.sells || 0;
  const ch = row.change5m || 0;
  let score = Math.min(25, Math.log10(liq / 1000 + 1) * 10);
  score += Math.min(25, Math.log10(v1 / 1000 + 1) * 8);
  score += Math.min(20, (buys + sells) / 5);
  score += Math.max(0, Math.min(20, ch * 2));
  score += buys + sells ? Math.min(10, (buys / (buys + sells)) * 10) : 0;
  row.score = score;
}

function markEarly(lvl, row) {
  row.early = false;
  if (!lvl || lvl.id < 3) return;
  if (row.ageMin == null || row.ageMin < 1 || row.ageMin > 90) return;
  if (row.liquidity < 5000 || row.volume5m < 300) return;
  if (row.buys + row.sells < 6 || row.buys <= row.sells) return;
  if (row.change5m < 5 || row.change5m > 150) return;
  row.early = true;
}

function passes(lvl, row) {
  markEarly(lvl, row);
  if (row.early) return true;
  if (row.liquidity < lvl.minLiq || row.volume5m < lvl.minV5 || (row.volume1h || 0) < lvl.minV1) return false;
  if (row.buys + row.sells < lvl.minTx) return false;
  return true;
}

function earlyBonus(row) {
  if (!row.early) return 0;
  let bonus = 14;
  if (row.ageMin <= 25) bonus += 8;
  if (row.buys >= row.sells * 1.5) bonus += 6;
  if (row.change5m >= 8 && row.change5m <= 60) bonus += 5;
  return bonus;
}

function patternWeight(book, row) {
  const w = (book && book.weights) || {};
  const ready = book && book.stats && book.stats.ready;
  if (!ready) return 1;
  let n = 1;
  if (row.ageMin != null && row.ageMin <= 45) n *= w.young || 1;
  if (row.sells > 0 && row.buys / row.sells >= 1.4) n *= w.pressure || 1;
  if (row.liquidity >= 5000 && row.liquidity <= 80000) n *= w.band || 1;
  if (row.change5m >= 5 && row.change5m <= 80) n *= w.lift || 1;
  return n;
}

function keepBest(best, row) {
  const key = row.chain + ':' + row.address;
  const prev = best.get(key);
  if (!prev) {
    best.set(key, row);
    return;
  }
  const kept = row.liquidity > prev.liquidity ? row : prev;
  const other = kept === row ? prev : row;
  if (other.early) kept.early = true;
  if (other.ageMin != null && (kept.ageMin == null || other.ageMin < kept.ageMin)) kept.ageMin = other.ageMin;
  best.set(key, kept);
}

async function collectDex(byChain) {
  const sources = [DEX + '/token-profiles/latest/v1', DEX + '/token-boosts/latest/v1', DEX + '/token-boosts/top/v1'];
  for (let i = 0; i < sources.length; i++) {
    try {
      const data = await getJson(sources[i]);
      rowsOf(data).forEach((row) => {
        if (byChain[row.chainId] && row.tokenAddress) byChain[row.chainId].add(row.tokenAddress);
      });
    } catch (e) {}
  }
}

async function collectNew(early) {
  const nets = [['solana', 'solana'], ['ethereum', 'eth']];
  await Promise.all(nets.map(async (pair) => {
    const chain = pair[0];
    const net = pair[1];
    try {
      const data = await getJson('https://api.geckoterminal.com/api/v2/networks/' + net + '/new_pools?page=1', 7000);
      rowsOf(data && data.data).slice(0, 20).forEach((pool) => {
        const row = poolFromGecko(chain, pool);
        if (row) early.push(row);
      });
    } catch (e) {}
  }));
}

async function enrichDex(byChain, lvl, out) {
  const chains = Object.keys(byChain);
  await Promise.all(chains.map(async (chain) => {
    const list = Array.from(byChain[chain]).slice(0, 24);
    for (let i = 0; i < list.length; i += 12) {
      const chunk = list.slice(i, i + 12);
      await Promise.all(chunk.map(async (addr) => {
        try {
          const data = await getJson(DEX + '/tokens/v1/' + chain + '/' + addr);
          rowsOf(data).forEach((p) => {
            const row = rowFromPair(chain, p);
            if (!row) return;
            scoreRow(row);
            if (passes(lvl, row)) out.push(row);
          });
        } catch (e) {}
      }));
    }
  }));
}

function verdictFromRug(report) {
  if (!report) return null;
  const token = report.token || {};
  const ext = report.token_extensions || {};
  let lpOpen = false;
  if (report.rugged) return { safety: 'HONEY', why: 'RUGGED', lpOpen: false };
  if (ext.nonTransferable) return { safety: 'HONEY', why: 'HONEY', lpOpen: false };
  if (ext.transferHook) return { safety: 'HONEY', why: 'HOOK', lpOpen: false };
  const risks = Array.isArray(report.risks) ? report.risks : [];
  for (let i = 0; i < risks.length; i++) {
    const name = String(risks[i].name || risks[i].displayName || '').toLowerCase();
    const level = String(risks[i].level || risks[i].severity || '').toLowerCase();
    if (/lp unlocked|liquidity unlocked/.test(name)) lpOpen = true;
    if (/honey|honeypot|non.?transfer|transfer hook|scam/.test(name)) return { safety: 'HONEY', why: 'HONEY', lpOpen: lpOpen };
    if ((level === 'danger' || level === 'critical') && /freeze|mint authority|mint auth/.test(name)) {
      return { safety: 'RISK', why: /freeze/.test(name) ? 'FREEZE' : 'MINT', lpOpen: lpOpen };
    }
  }
  if (report.mintAuthority || token.mintAuthority) return { safety: 'RISK', why: 'MINT', lpOpen: lpOpen };
  if (report.freezeAuthority || token.freezeAuthority) return { safety: 'RISK', why: 'FREEZE', lpOpen: lpOpen };
  if (ext.permanentDelegate) return { safety: 'RISK', why: 'DELEGATE', lpOpen: lpOpen };
  const feePct = Number(report.transferFee && report.transferFee.pct);
  if (Number.isFinite(feePct) && feePct > 2) return { safety: 'HONEY', why: 'FEE', lpOpen: lpOpen };
  if (ext.pausableConfig && typeof ext.pausableConfig === 'object') return { safety: 'RISK', why: 'PAUSE', lpOpen: lpOpen };
  return { safety: 'OK', why: '', lpOpen: lpOpen };
}

function verdictFromGoplus(gp, eth) {
  if (!gp) return null;
  if (eth) {
    if (gp.is_honeypot == null && gp.cannot_sell_all == null) return null;
    if (String(gp.is_honeypot) === '1' || String(gp.cannot_sell_all) === '1' || String(gp.honeypot_with_same_creator) === '1') {
      return { safety: 'HONEY', why: 'HONEY', lpOpen: false };
    }
    const sellTax = Number(gp.sell_tax);
    const buyTax = Number(gp.buy_tax);
    if ((Number.isFinite(sellTax) && sellTax > 0.05) || (Number.isFinite(buyTax) && buyTax > 0.05)) {
      return { safety: 'HONEY', why: 'TAX', lpOpen: false };
    }
    if (String(gp.is_honeypot) !== '0' && String(gp.cannot_sell_all) !== '0') return null;
    return { safety: 'OK', why: '', lpOpen: false };
  }
  if (String(gp.non_transferable) === '1') return { safety: 'HONEY', why: 'HONEY', lpOpen: false };
  if (Array.isArray(gp.transfer_hook) && gp.transfer_hook.length) return { safety: 'HONEY', why: 'HOOK', lpOpen: false };
  if (gp.freezable && String(gp.freezable.status) === '1') return { safety: 'RISK', why: 'FREEZE', lpOpen: false };
  if (gp.mintable && String(gp.mintable.status) === '1') return { safety: 'RISK', why: 'MINT', lpOpen: false };
  return { safety: 'OK', why: '', lpOpen: false };
}

function mergeSafety(parts) {
  const xs = parts.filter(Boolean);
  if (!xs.length) return null;
  const honey = xs.filter((x) => x.safety === 'HONEY')[0];
  if (honey) return honey;
  const risk = xs.filter((x) => x.safety === 'RISK')[0];
  if (risk) return risk;
  const nosell = xs.filter((x) => x.safety === 'NOSELL')[0];
  if (nosell) return nosell;
  const ok = xs.filter((x) => x.safety === 'OK')[0];
  if (!ok) return null;
  return { safety: 'OK', why: '', lpOpen: xs.some((x) => x.lpOpen) };
}

async function roundTripOk(mint, lamports) {
  const buy = await jupQuoteOnce(SOL, mint, String(lamports), 150, false);
  if (!buy || !buy.routePlan || !buy.routePlan.length || !buy.outAmount || buy.outAmount === '0') return false;
  const sell = await jupQuoteOnce(mint, SOL, String(buy.outAmount), 150, false);
  if (!sell || !sell.routePlan || !sell.routePlan.length) return false;
  return Number(sell.outAmount || 0) >= lamports * 0.85;
}

async function sellRouteOk(mint) {
  return roundTripOk(mint, 50000000);
}

function blockedMints(book) {
  const now = Date.now();
  const out = {};
  (book && book.trades ? book.trades : []).forEach((trade) => {
    if (!trade || !trade.address) return;
    const age = now - Number(trade.at || 0);
    if (Number(trade.pnlPct) <= -40 && age < 24 * 60 * 60 * 1000) out[trade.address] = 'dead';
    else if (age < 20 * 60 * 1000 && !out[trade.address]) out[trade.address] = 'cool';
  });
  return out;
}

async function ethSellRouteOk(token, decimals) {
  const d = Number(decimals);
  if (!Number.isFinite(d) || d < 0 || d > 18) return false;
  const unit = 10n ** BigInt(d);
  const amount = unit / 100n;
  if (amount <= 0n) return false;
  const u = new URL('https://aggregator-api.kyberswap.com/ethereum/api/v1/routes');
  u.searchParams.set('tokenIn', token);
  u.searchParams.set('tokenOut', ETH);
  u.searchParams.set('amountIn', amount.toString());
  const routeRes = await fetch(u, { headers: { 'x-client-id': 'doswapz-quantum' }, signal: AbortSignal.timeout(4000) });
  if (!routeRes.ok) return false;
  const route = await routeRes.json();
  return !!(route && route.data && route.data.routeSummary);
}

function clearedSafety(row) {
  return row.safety === 'OK' || row.safety === 'HONEY' || row.safety === 'RISK' || row.safety === 'NOSELL';
}

function wouldChase(lvl, row) {
  if (!row || row.score < lvl.minScore || row.price <= 0) return false;
  if (row.safety === 'HONEY' || row.safety === 'RISK' || row.safety === 'NOSELL') return false;
  const isNew = row.early || (row.ageMin != null && row.ageMin <= 90);
  if (isNew) return true;
  if (row.change5m < lvl.minChange) return false;
  if (lvl.pressure && row.buys < row.sells) return false;
  return true;
}

async function guardBuys(rows, lvl, started) {
  rows.forEach((row) => {
    if (!wouldChase(lvl, row)) return;
    const cached = safetyCache.get(row.chain + ':' + row.address);
    const ttl = cached && cached.safety === 'NOSELL' ? 60 * 1000 : 10 * 60 * 1000;
    if (cached && Date.now() - cached.at < ttl) {
      row.safety = cached.safety;
      row.why = cached.why;
      row.lpOpen = cached.lpOpen;
    }
  });
  const markWait = () => {
    rows.forEach((row) => {
      if (wouldChase(lvl, row) && !clearedSafety(row)) {
        row.safety = 'WAIT';
        row.why = 'NO CHECK';
      }
    });
  };
  if (Date.now() - started > 18000) {
    markWait();
    return;
  }
  const need = rows.filter((row) => wouldChase(lvl, row) && !clearedSafety(row))
    .sort((a, b) => Number(b.early) - Number(a.early) || b.score - a.score)
    .slice(0, 3);
  await Promise.all(need.map(async (row) => {
    const cached = safetyCache.get(row.chain + ':' + row.address);
    const ttl = cached && cached.safety === 'NOSELL' ? 60 * 1000 : 10 * 60 * 1000;
    if (cached && Date.now() - cached.at < ttl) {
      row.safety = cached.safety;
      row.why = cached.why;
      row.lpOpen = cached.lpOpen;
      return;
    }
    let verdict = null;
    try {
      if (row.chain === 'solana') {
        const report = await getJson('https://api.rugcheck.xyz/v1/tokens/' + encodeURIComponent(row.address) + '/report', 4500);
        verdict = verdictFromRug(report);
        if (verdict && verdict.safety === 'OK') {
          const decimals = Number(report && report.token && report.token.decimals);
          let canSell = false;
          try {
            canSell = await sellRouteOk(row.address, decimals);
          } catch (e3) {
            row.safety = 'WAIT';
            row.why = 'NO CHECK';
            return;
          }
          if (!canSell) verdict = { safety: 'NOSELL', why: 'NOSELL', lpOpen: verdict.lpOpen };
        }
      } else {
        const data = await getJson('https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=' + encodeURIComponent(row.address), 4500);
        const result = (data && data.result) || {};
        const gp = result[row.address] || result[row.address.toLowerCase()] || null;
        verdict = verdictFromGoplus(gp, true);
        if (verdict && verdict.safety === 'OK') {
          const canSell = await ethSellRouteOk(row.address, gp && gp.decimals).catch(() => false);
          if (!canSell) verdict = { safety: 'NOSELL', why: 'NOSELL', lpOpen: false };
        }
      }
    } catch (e) {}
    if (!verdict) {
      row.safety = 'WAIT';
      row.why = 'NO CHECK';
      return;
    }
    row.safety = verdict.safety;
    row.why = verdict.why;
    row.lpOpen = !!verdict.lpOpen;
    safetyCache.set(row.chain + ':' + row.address, { at: Date.now(), safety: row.safety, why: row.why, lpOpen: row.lpOpen });
  }));
  markWait();
}

function hitRate(list) {
  if (!list.length) return 0;
  let n = 0;
  list.forEach((hit) => { if (hit) n += 1; });
  return n / list.length;
}

function clampWeight(rateIn, nIn, rateOut, nOut) {
  if (nIn < 4 || nOut < 4) return 1;
  return Math.min(1.35, Math.max(0.7, rateIn / Math.max(0.05, rateOut)));
}

function countBlocked(book) {
  let n = 0;
  Object.keys((book && book.coins) || {}).forEach((key) => {
    const safety = book.coins[key].safety;
    if (safety === 'HONEY' || safety === 'RISK' || safety === 'NOSELL') n += 1;
  });
  return n;
}

function baseTactic() {
  return {
    newTp: 1.5,
    swingTp: 2.5,
    newStop: 0.6,
    swingStop: 1,
    newArm: 0.4,
    swingArm: 0.6,
    newTrail: 0.3,
    swingTrail: 0.45,
    newDeadMin: 0.4,
    swingDeadMin: 1.5,
    newMaxMin: 1.5,
    swingMaxMin: 4,
    maxNewChange: 80,
    minBuyRatio: 1.2,
    armPct: SELL_ARM,
    trailPct: SELL_TRAIL,
    stopPct: SELL_STOP,
    deadMin: SELL_DEAD_MIN,
    takeGasSol: TAKE_GAS_SOL,
    bankInitial: false
  };
}

function deriveTactic(trades) {
  const tactic = baseTactic();
  const list = Array.isArray(trades) ? trades : [];
  const decisive = list.filter((row) => row.win === true || row.win === false);
  const early = decisive.filter((row) => row.early || (row.ageMin != null && row.ageMin <= 90));
  if (early.length >= 8) {
    const rate = early.filter((row) => row.win).length / early.length;
    if (rate < 0.45) {
      tactic.maxNewChange = 40;
      tactic.minBuyRatio = 1.6;
    } else if (rate >= 0.62) {
      tactic.maxNewChange = 60;
      tactic.minBuyRatio = 1.3;
    }
  }
  const wins = decisive.filter((row) => row.win);
  const losses = decisive.filter((row) => row.win === false);
  if (wins.length >= 6 && losses.length >= 6) {
    const avg = (xs) => xs.reduce((sum, row) => sum + Math.abs(Number(row.pnlPct) || 0), 0) / xs.length;
    if (avg(losses) > avg(wins) * 1.25) {
      tactic.newMaxMin = 1;
      tactic.newDeadMin = 0.25;
      tactic.swingMaxMin = 3;
      tactic.swingDeadMin = 1;
    }
  }
  return tactic;
}

function settleTrades(book) {
  const trades = Array.isArray(book.trades) ? book.trades : [];
  const decisive = trades.filter((row) => row.win === true || row.win === false);
  const buckets = {
    young: { inn: [], out: [] },
    pressure: { inn: [], out: [] },
    band: { inn: [], out: [] },
    lift: { inn: [], out: [] }
  };
  decisive.forEach((row) => {
    const put = (name, inside) => buckets[name][inside ? 'inn' : 'out'].push(row.win === true);
    put('young', row.ageMin != null && row.ageMin <= 45);
    put('pressure', row.buyRatio >= 1.4);
    put('band', row.liquidity >= 5000 && row.liquidity <= 80000);
    put('lift', row.change5m >= 5 && row.change5m <= 40);
  });
  const weights = {};
  Object.keys(buckets).forEach((name) => {
    const inn = buckets[name].inn;
    const out = buckets[name].out;
    let weight = clampWeight(hitRate(inn), inn.length, hitRate(out), out.length);
    if (inn.length >= 4) {
      const rate = hitRate(inn);
      if (rate < 0.35) weight = Math.min(weight, 0.75);
      else if (rate < 0.45) weight = Math.min(weight, 0.9);
    }
    weights[name] = weight;
  });
  const wins = decisive.filter((row) => row.win).length;
  book.weights = decisive.length ? weights : (book.weights || { young: 1, pressure: 1, band: 1, lift: 1 });
  book.tactic = deriveTactic(trades);
  book.stats = {
    resolved: decisive.length,
    trades: trades.length,
    wins: wins,
    losses: decisive.length - wins,
    winPct: decisive.length ? Math.round((wins / decisive.length) * 100) : 0,
    hit2: wins,
    hit10: 0,
    hit100: 0,
    honey: countBlocked(book),
    dead: decisive.length - wins,
    ready: decisive.length >= 12
  };
}

const TRADE_EXITS = ['stop', 'trail', 'lock', 'take profit', 'downtrend', 'time', 'flat', 'no quote'];

async function rememberTrade(body) {
  const book = await loadLearn();
  if (!book.coins) book.coins = {};
  if (!Array.isArray(book.trades)) book.trades = [];
  const chain = body.chain === 'ethereum' ? 'ethereum' : (body.chain === 'solana' ? 'solana' : '');
  const address = String(body.address || '');
  if (!chain) throw new Error('Bad trade.');
  if (chain === 'solana' && !solOk(address)) throw new Error('Bad trade.');
  if (chain === 'ethereum' && !ethOk(address)) throw new Error('Bad trade.');
  const pnl = clampNum(body.pnlPct, -100, 400);
  let win = null;
  if (pnl >= 0.3) win = true;
  else if (pnl <= -0.5) win = false;
  const exit = TRADE_EXITS.indexOf(body.exit) >= 0 ? body.exit : 'flat';
  const sells = Number(body.sells);
  const buys = Number(body.buys);
  book.trades.push({
    at: Date.now(),
    chain: chain,
    address: address,
    symbol: String(body.symbol || '').slice(0, 16),
    early: !!body.early || (Number(body.ageMin) > 0 && Number(body.ageMin) <= 90),
    ageMin: Number.isFinite(Number(body.ageMin)) ? Number(body.ageMin) : null,
    buyRatio: sells > 0 ? buys / sells : (buys > 0 ? 2 : 0),
    liquidity: clampNum(body.liquidity, 0, 1e12),
    change5m: clampNum(body.change5m, -100, 1000),
    pnlPct: pnl,
    win: win,
    exit: exit
  });
  if (book.trades.length > 200) book.trades = book.trades.slice(-200);
  settleTrades(book);
  await saveLearn(book, true);
  return publicLearn(book);
}

function rememberRow(book, row) {
  if (!row || !(row.price > 0) || !row.address) return;
  const key = row.chain + ':' + row.address;
  const now = Date.now();
  const ratio = row.sells ? row.buys / row.sells : (row.buys ? 2 : 0);
  let c = book.coins[key];
  if (!c) {
    book.coins[key] = {
      symbol: row.symbol,
      chain: row.chain,
      address: row.address,
      firstSeen: now,
      firstPrice: row.price,
      lastPrice: row.price,
      peakPrice: row.price,
      firstLiq: row.liquidity || 0,
      buyRatio: ratio,
      firstChange: row.change5m || 0,
      ageMin: row.ageMin,
      safety: row.safety || '',
      lastSeen: now
    };
    return;
  }
  c.lastPrice = row.price;
  if (row.price > (c.peakPrice || 0)) c.peakPrice = row.price;
  if (row.safety) c.safety = row.safety;
  c.lastSeen = now;
}

function trimLearn(book) {
  const keys = Object.keys(book.coins);
  if (keys.length <= 180) return;
  const now = Date.now();
  const mature = keys.filter((key) => now - book.coins[key].firstSeen > 45 * 60000);
  mature.sort((a, b) => book.coins[a].firstSeen - book.coins[b].firstSeen);
  const extra = keys.length - 180;
  for (let i = 0; i < extra && i < mature.length; i++) delete book.coins[mature[i]];
}

async function repriceOld(book, started) {
  if (Date.now() - started > 18000) return;
  const now = Date.now();
  const due = Object.keys(book.coins).map((key) => book.coins[key]).filter((c) => {
    return c.firstPrice > 0 && now - c.firstSeen > 15 * 60000 && now - c.lastSeen > 10 * 60000;
  }).sort((a, b) => a.lastSeen - b.lastSeen).slice(0, 3);
  await Promise.all(due.map(async (c) => {
    try {
      const data = await getJson(DEX + '/tokens/v1/' + c.chain + '/' + c.address, 4000);
      let price = 0;
      rowsOf(data).forEach((p) => {
        const px = Number(p.priceUsd || 0);
        if (px > price) price = px;
      });
      if (price > 0) {
        c.lastPrice = price;
        if (price > (c.peakPrice || 0)) c.peakPrice = price;
      }
    } catch (e) {}
    c.lastSeen = Date.now();
  }));
}

async function learnFrom(rows, lvl, started) {
  const book = await loadLearn();
  if (!book.coins) book.coins = {};
  if (!Array.isArray(book.trades)) book.trades = [];
  rows.forEach((row) => {
    row.score = Math.round((row.score * patternWeight(book, row) + earlyBonus(row)) * 10) / 10;
  });
  await guardBuys(rows, lvl, started);
  rows.forEach((row) => {
    const key = row.chain + ':' + row.address;
    if (row.early || book.coins[key]) rememberRow(book, row);
  });
  await repriceOld(book, started);
  settleTrades(book);
  trimLearn(book);
  await saveLearn(book);
  return { learn: publicLearn(book), tactic: book.tactic || baseTactic(), blocked: Object.keys(blockedMints(book)) };
}

async function scan(lvl) {
  const hit = cache.get(lvl.id);
  if (hit && Date.now() - hit.at < 12000) return hit.pack;
  const started = Date.now();
  const byChain = { solana: new Set(), ethereum: new Set() };
  const early = [];
  const newcomers = collectNew(early);
  await collectDex(byChain);
  const out = [];
  await Promise.all([enrichDex(byChain, lvl, out), newcomers]);
  early.forEach((row) => {
    scoreRow(row);
    if (passes(lvl, row)) out.push(row);
  });
  const best = new Map();
  out.forEach((row) => keepBest(best, row));
  let rows = Array.from(best.values());
  const learned = await learnFrom(rows, lvl, started);
  const learn = learned.learn;
  rows.sort((a, b) => {
    const rank = (row) => (row.early && row.safety === 'OK' ? 2 : row.early ? 1 : 0);
    const d = rank(b) - rank(a);
    if (d) return d;
    return b.score - a.score;
  });
  rows = rows.slice(0, 20);
  const pack = { rows: rows, learn: learn, tactic: learned.tactic, blocked: learned.blocked || [] };
  cache.set(lvl.id, { at: Date.now(), pack: pack });
  return pack;
}

function parseHold(raw) {
  const out = [];
  String(raw || '').split(',').slice(0, 8).forEach((bit) => {
    const idx = bit.indexOf(':');
    if (idx < 1) return;
    const chain = bit.slice(0, idx);
    const address = bit.slice(idx + 1);
    if ((chain === 'solana' && solOk(address)) || (chain === 'ethereum' && ethOk(address))) out.push({ chain: chain, address: address });
  });
  return out;
}

async function markHeld(list) {
  const marks = [];
  await Promise.all(list.map(async (item) => {
    try {
      const data = await getJson(DEX + '/tokens/v1/' + item.chain + '/' + item.address);
      let best = null;
      rowsOf(data).forEach((p) => {
        if (!p.baseToken || p.chainId !== item.chain) return;
        const price = Number(p.priceUsd || 0);
        const liq = Number((p.liquidity && p.liquidity.usd) || 0);
        if (!(price > 0)) return;
        if (!best || liq > best.liquidity) {
          best = {
            chain: item.chain,
            address: p.baseToken.address,
            symbol: p.baseToken.symbol || 'UNKNOWN',
            price: price,
            liquidity: liq,
            buys: Number((p.txns && p.txns.m5 && p.txns.m5.buys) || 0),
            sells: Number((p.txns && p.txns.m5 && p.txns.m5.sells) || 0),
            change5m: Number((p.priceChange && p.priceChange.m5) || 0),
            score: 0
          };
        }
      });
      if (best) marks.push(best);
    } catch (e) {}
  }));
  return marks;
}

function sellRaw(raw, part) {
  const p = Number(part);
  if (!Number.isFinite(p) || p <= 0 || p >= 0.99) return raw;
  const bps = BigInt(Math.max(1, Math.min(9900, Math.round(p * 10000))));
  const scaled = (raw * bps) / 10000n;
  if (scaled <= 0n || scaled >= raw) return raw;
  return scaled;
}

function chase(lvl, row, tactic) {
  if (!row || row.score < lvl.minScore || row.price <= 0) return false;
  if (row.safety !== 'OK') return false;
  const rules = tactic || baseTactic();
  const isNew = row.early || (row.ageMin != null && row.ageMin <= 90);
  if (isNew) {
    const minLift = Math.max(3, Number(lvl.minChange) || 0);
    if (row.change5m < minLift || row.change5m > rules.maxNewChange) return false;
    const ratio = row.sells > 0 ? row.buys / row.sells : (row.buys > 0 ? 99 : 0);
    if (ratio < rules.minBuyRatio) return false;
    return true;
  }
  if (row.change5m < lvl.minChange) return false;
  if (lvl.pressure && row.buys < row.sells) return false;
  return true;
}

function clampSol(v) {
  const n = Math.round(Number(v) * 100) / 100;
  if (!Number.isFinite(n)) return MIN_SOL;
  return Math.min(MAX_SOL, Math.max(MIN_SOL, n));
}

function solOk(v) { return typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v); }
function ethOk(v) { return typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v); }

function jupNoRoute(json, text) {
  const code = String((json && (json.errorCode || json.error)) || text || '');
  return code.includes('NO_ROUTES') || code.includes('No routes');
}

async function jupQuoteOnce(input, output, amount, slippage, restrict) {
  const u = new URL(JUP + '/quote');
  u.searchParams.set('inputMint', input);
  u.searchParams.set('outputMint', output);
  u.searchParams.set('amount', String(amount));
  u.searchParams.set('slippageBps', String(slippage));
  if (restrict) u.searchParams.set('restrictIntermediateTokens', 'true');
  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(12000) });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (e) { json = null; }
      const rate = res.status === 429 || (json && (json.code === 429 || String(json.message || '').toLowerCase().includes('too many')));
      if (rate) {
        last = new Error('JUP_RATE');
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        if (jupNoRoute(json, text)) return { routePlan: [], noRoute: true };
        throw new Error((text || 'Jupiter quote failed.').slice(0, 180));
      }
      return json;
    } catch (e) {
      if (e && (e.message === 'JUP_RATE' || e.name === 'TimeoutError' || e.name === 'AbortError')) {
        last = new Error('JUP_RATE');
        continue;
      }
      throw e;
    }
  }
  throw last || new Error('JUP_RATE');
}

async function jupQuote(input, output, amount, slippage) {
  const strict = await jupQuoteOnce(input, output, amount, slippage, true);
  if (strict && strict.routePlan && strict.routePlan.length) return strict;
  if (strict && strict.noRoute) {
    const loose = await jupQuoteOnce(input, output, amount, slippage, false);
    if (loose && ((loose.routePlan && loose.routePlan.length) || loose.noRoute)) return loose;
  }
  return strict;
}

async function hostileMint(mint) {
  let rug = null;
  let decimals = 6;
  try {
    const report = await getJson('https://api.rugcheck.xyz/v1/tokens/' + encodeURIComponent(mint) + '/report', 6000);
    rug = verdictFromRug(report);
    const d = Number(report && report.token && report.token.decimals);
    if (Number.isFinite(d)) decimals = d;
  } catch (e) {}
  let gp = null;
  try {
    const data = await getJson('https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=' + encodeURIComponent(mint), 5000);
    const result = (data && data.result) || {};
    gp = verdictFromGoplus(result[mint] || result[String(mint).toLowerCase()] || null, false);
  } catch (e2) {}
  const verdict = mergeSafety([rug, gp]);
  if (!verdict) return 'Safety check did not answer. Phantom was not opened.';
  if (verdict.safety === 'HONEY') return 'This mint looks like a honeypot. Phantom was not opened.';
  if (verdict.safety === 'RISK') return 'This mint looks hostile. Phantom was not opened.';
  return '';
}

async function hostileEth(token) {
  try {
    const data = await getJson('https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=' + encodeURIComponent(token), 6000);
    const result = (data && data.result) || {};
    const verdict = verdictFromGoplus(result[token] || result[String(token).toLowerCase()] || null, true);
    if (!verdict) return 'Safety check did not answer. MetaMask was not opened.';
    if (verdict.safety === 'HONEY') return 'This token looks like a honeypot. MetaMask was not opened.';
    if (verdict.safety === 'RISK') return 'This token looks hostile. MetaMask was not opened.';
    return '';
  } catch (e) {
    return 'Safety check did not answer. MetaMask was not opened.';
  }
}

async function solRpc(method, params) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params });
  let last = null;
  for (const url of solRpcUrls()) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body,
        signal: AbortSignal.timeout(8000)
      });
      const json = await res.json();
      if (json && json.result != null && !json.error) return json.result;
      const msg = String((json && json.error && json.error.message) || '').toLowerCase();
      last = new Error((json && json.error && json.error.message) || 'Solana RPC did not answer.');
      if (res.status === 403 || res.status === 429 || msg.includes('forbidden') || msg.includes('rate') || msg.includes('too many')) continue;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('Solana RPC did not answer.');
}

async function jupSwap(quote, user) {
  const payload = JSON.stringify({
    quoteResponse: quote,
    userPublicKey: user,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: { priorityLevel: 'medium', maxLamports: 100000 }
    }
  });
  let last = 'Jupiter is busy. Phantom was not opened. Quantum will try this coin again.';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(JUP + '/swap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(12000)
      });
      const text = await res.text();
      const rate = res.status === 429 || res.status === 503 || res.status === 504 || text.toLowerCase().includes('too many');
      if (rate) {
        last = 'Jupiter is busy. Phantom was not opened. Quantum will try this coin again.';
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error((text || 'Jupiter swap failed.').slice(0, 180));
      const built = JSON.parse(text);
      if (!built.swapTransaction) throw new Error('Jupiter did not return a transaction.');
      return built;
    } catch (e) {
      if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        last = 'Jupiter is busy. Phantom was not opened. Quantum will try this coin again.';
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error(last);
}

async function solSwap(body, lvl) {
  if (!solOk(body.user) || !solOk(body.mint)) throw new Error('Bad Solana address.');
  if (body.mint === SOL) throw new Error('That mint is SOL itself.');
  const blocked = await hostileMint(body.mint);
  if (blocked) throw new Error(blocked);
  const solIn = clampSol(body.sol);
  const lamports = Math.floor(solIn * 1e9);
  const slip = Math.min(Number(lvl.slippage) || 100, 150);
  const book = await loadLearn();
  const block = blockedMints(book)[body.mint];
  if (block === 'dead') throw new Error('This mint just sold for almost nothing. Phantom was not opened.');
  if (block === 'cool') throw new Error('This mint was just traded. Waiting before another buy.');
  const q = await jupQuote(SOL, body.mint, lamports, slip);
  if (!q.routePlan || !q.routePlan.length || !q.outAmount) throw new Error('No Solana route.');
  const back = await jupQuoteOnce(body.mint, SOL, String(q.outAmount), slip, false);
  const backLamports = Number(back && back.outAmount || 0);
  if (!(back && back.routePlan && back.routePlan.length) || backLamports < lamports * 0.85) {
    throw new Error('Selling this bag would not return the stake. Phantom was not opened.');
  }
  const bal = await solRpc('getBalance', [body.user, { commitment: 'confirmed' }]);
  const balance = Number(bal && bal.value);
  const reserve = Math.floor(FEE_RESERVE_SOL * 1e9);
  if (!Number.isFinite(balance) || balance < lamports + reserve) {
    throw new Error('Not enough SOL. The meter is the swap. Gas sits on top. Leave at least 0.003 SOL in the wallet for fees.');
  }
  delete q.platformFee;
  const built = await jupSwap(q, body.user);
  return { chain: 'solana', swapTransaction: built.swapTransaction, sol: solIn, doswapzFee: 0, slippageBps: slip };
}

async function solSell(body, lvl) {
  if (!solOk(body.user) || !solOk(body.mint)) throw new Error('Bad Solana address.');
  const bal = await solRpc('getTokenAccountsByOwner', [body.user, { mint: body.mint }, { encoding: 'jsonParsed' }]);
  const rows = (bal && bal.value) || [];
  let raw = 0n;
  rows.forEach((row) => {
    const amt = BigInt((((row.account || {}).data || {}).parsed || {}).info.tokenAmount.amount || '0');
    if (amt > raw) raw = amt;
  });
  if (raw <= 0n) throw new Error('No tokens in the wallet to sell.');
  raw = sellRaw(raw, body.part);
  const slip = Math.min(Number(lvl && lvl.slippage) || 100, 150);
  const q = await jupQuote(body.mint, SOL, raw.toString(), slip);
  if (!q.routePlan || !q.routePlan.length) throw new Error('No Solana sell route.');
  delete q.platformFee;
  const built = await jupSwap(q, body.user);
  return { chain: 'solana', swapTransaction: built.swapTransaction, doswapzFee: 0, slippageBps: slip };
}

async function ethSwap(body, lvl) {
  if (!ethOk(body.user) || !ethOk(body.token)) throw new Error('Bad Ethereum address.');
  const blockedEth = await hostileEth(body.token);
  if (blockedEth) throw new Error(blockedEth);
  const solIn = clampSol(body.sol);
  const px = await jupQuote(SOL, USDC, 1000000000, 50);
  const solPrice = Number(px.outAmount) / 1e6;
  const pairs = await getJson(DEX + '/tokens/v1/ethereum/' + WETH);
  const hit = rowsOf(pairs).filter((p) => Number(p.priceUsd) > 0)[0];
  if (!solPrice || !hit) throw new Error('No price for the SOL meter.');
  const wei = BigInt(Math.floor(((solIn * solPrice) / Number(hit.priceUsd)) * 1e18));
  const u = new URL('https://aggregator-api.kyberswap.com/ethereum/api/v1/routes');
  u.searchParams.set('tokenIn', ETH);
  u.searchParams.set('tokenOut', body.token);
  u.searchParams.set('amountIn', wei.toString());
  const routeRes = await fetch(u, { headers: { 'x-client-id': 'doswapz-quantum' } });
  if (!routeRes.ok) throw new Error(await routeRes.text());
  const route = await routeRes.json();
  const summary = route.data && route.data.routeSummary;
  if (!summary) throw new Error('No Ethereum route.');
  const buildRes = await fetch('https://aggregator-api.kyberswap.com/ethereum/api/v1/route/build', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-client-id': 'doswapz-quantum' },
    body: JSON.stringify({
      routeSummary: summary,
      sender: body.user,
      recipient: body.user,
      slippageTolerance: Math.min(Number(lvl.slippage) || 100, 150)
    })
  });
  if (!buildRes.ok) throw new Error(await buildRes.text());
  const built = await buildRes.json();
  const tx = built.data;
  if (!tx || !tx.data || !tx.routerAddress) throw new Error('Ethereum build did not return a transaction.');
  return {
    chain: 'ethereum',
    to: tx.routerAddress,
    data: tx.data,
    value: '0x' + BigInt(tx.transactionValue || wei.toString()).toString(16),
    sol: solIn,
    doswapzFee: 0
  };
}

async function ethSell(body, lvl) {
  if (!ethOk(body.user) || !ethOk(body.token)) throw new Error('Bad Ethereum address.');
  const data = '0x70a08231' + body.user.slice(2).toLowerCase().padStart(64, '0');
  const call = await fetch('https://ethereum.publicnode.com', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: body.token, data: data }, 'latest'] })
  });
  const called = await call.json();
  let raw = BigInt(called.result || '0x0');
  if (raw <= 0n) throw new Error('No tokens in the wallet to sell.');
  raw = sellRaw(raw, body.part);
  const u = new URL('https://aggregator-api.kyberswap.com/ethereum/api/v1/routes');
  u.searchParams.set('tokenIn', body.token);
  u.searchParams.set('tokenOut', ETH);
  u.searchParams.set('amountIn', raw.toString());
  const routeRes = await fetch(u, { headers: { 'x-client-id': 'doswapz-quantum' } });
  if (!routeRes.ok) throw new Error(await routeRes.text());
  const route = await routeRes.json();
  const summary = route.data && route.data.routeSummary;
  if (!summary) throw new Error('No Ethereum sell route.');
  const buildRes = await fetch('https://aggregator-api.kyberswap.com/ethereum/api/v1/route/build', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-client-id': 'doswapz-quantum' },
    body: JSON.stringify({
      routeSummary: summary,
      sender: body.user,
      recipient: body.user,
      slippageTolerance: Math.min(Number(lvl && lvl.slippage) || 100, 150)
    })
  });
  if (!buildRes.ok) throw new Error(await buildRes.text());
  const built = await buildRes.json();
  const tx = built.data;
  if (!tx || !tx.data || !tx.routerAddress) throw new Error('Ethereum sell did not build.');
  return {
    chain: 'ethereum',
    to: tx.routerAddress,
    data: tx.data,
    value: '0x' + BigInt(tx.transactionValue || 0).toString(16),
    doswapzFee: 0
  };
}

const BOARD_STORE = 'quantum-board';
const BOARD_KEY = 'sessions';
const BOARD_CAP = 40;
const boardFile = path.join(__dirname, '..', 'dev', 'quantum-board.json');

function clampNum(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function shortWallet(v) {
  if (typeof v !== 'string') return '';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return v.slice(0, 4) + '...' + v.slice(-4);
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return v.slice(0, 6) + '...' + v.slice(-4);
  return '';
}

async function blobStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({ name: BOARD_STORE, consistency: 'strong' });
  } catch (e) {
    return null;
  }
}

async function loadBoard() {
  const blobs = await blobStore();
  if (blobs) {
    try {
      const raw = await blobs.get(BOARD_KEY, { type: 'json' });
      if (raw && Array.isArray(raw.sessions)) return raw.sessions;
    } catch (e) {}
  }
  try {
    const raw = JSON.parse(fs.readFileSync(boardFile, 'utf8'));
    if (raw && Array.isArray(raw.sessions)) return raw.sessions;
  } catch (e2) {}
  return [];
}

async function saveBoard(sessions) {
  const payload = { sessions: sessions };
  let ok = false;
  const blobs = await blobStore();
  if (blobs) {
    try {
      await blobs.setJSON(BOARD_KEY, payload);
      ok = true;
    } catch (e) {}
  }
  try {
    fs.mkdirSync(path.dirname(boardFile), { recursive: true });
    fs.writeFileSync(boardFile, JSON.stringify(payload));
    ok = true;
  } catch (e2) {}
  return ok;
}

function acceptRun(body) {
  const lvl = levelById(body && body.level);
  if (!lvl) throw new Error('Pick a level from 1 to 10.');
  const startedAt = Number(body.startedAt);
  const finishedAt = Number(body.finishedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) throw new Error('Session times are required.');
  const elapsedMs = finishedAt - startedAt;
  if (elapsedMs < 3000 || elapsedMs > 7 * 24 * 60 * 60 * 1000) throw new Error('Session length is out of range.');
  const realized = clampNum(body.realized, -1000, 1000);
  const unrealized = clampNum(body.unrealized, -1000, 1000);
  const trades = clampNum(Math.round(Number(body.trades) || 0), 0, 500);
  const wins = clampNum(Math.round(Number(body.wins) || 0), 0, trades);
  const losses = clampNum(Math.round(Number(body.losses) || 0), 0, trades);
  const solIn = clampNum(body.solIn, MIN_SOL, MAX_SOL);
  const id = typeof body.id === 'string' && /^[0-9a-f-]{16,40}$/i.test(body.id) ? body.id : crypto.randomUUID();
  return {
    id: id,
    startedAt: startedAt,
    finishedAt: finishedAt,
    elapsedMs: elapsedMs,
    realized: realized,
    unrealized: unrealized,
    total: realized + unrealized,
    trades: trades,
    wins: wins,
    losses: losses,
    solIn: solIn,
    wallet: shortWallet(body.wallet),
    params: {
      level: lvl.id,
      name: lvl.name,
      maxPos: lvl.maxPos,
      minScore: lvl.minScore,
      minChange: lvl.minChange,
      minLiq: lvl.minLiq,
      armPct: SELL_ARM,
      trailPct: SELL_TRAIL,
      stopPct: SELL_STOP,
      deadMin: SELL_DEAD_MIN,
      takeGasSol: TAKE_GAS_SOL,
      newTp: 1.5,
      swingTp: 2.5,
      bankInitial: false
    }
  };
}

async function rememberRun(run) {
  const sessions = (await loadBoard()).filter((row) => row && row.id !== run.id);
  sessions.push(run);
  sessions.sort((a, b) => b.total - a.total || b.finishedAt - a.finishedAt);
  const kept = sessions.slice(0, BOARD_CAP);
  const saved = await saveBoard(kept);
  if (!saved) throw new Error('Leaderboard did not save.');
  return kept;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.__netlifyEvent) connectNetlifyBlobs(req.__netlifyEvent);
  const q = req.query || {};
  const metaGet = req.method === 'GET' && !q.level;
  const scanGet = req.method === 'GET' && !!q.level;
  // A paper session polls about every 12s. The old shared cap of 400 hid the
  // level list after roughly 80 minutes, because page load used the same bucket.
  if (metaGet && rateLimitOrReject(req, res, { prefix: 'quantum-meta', perMinute: 30, perDay: 1500 })) return;
  if (scanGet && rateLimitOrReject(req, res, { prefix: 'quantum-scan', perMinute: 30, perDay: 8000 })) return;
  if (!metaGet && !scanGet && rateLimitOrReject(req, res, { prefix: 'quantum-post', perMinute: 12, perDay: 600 })) return;
  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      if (!q.level) {
        const book = await loadLearn();
        if (!book.coins) book.coins = {};
        if (!Array.isArray(book.trades)) book.trades = [];
        settleTrades(book);
        return res.status(200).json({
          ok: true,
          levels: LEVELS.map(publicLevel),
          meter: { minSol: MIN_SOL, maxSol: MAX_SOL, step: 0.01, feeReserveSol: FEE_RESERVE_SOL, doswapzFee: 0 },
          sell: book.tactic || baseTactic(),
          board: await loadBoard(),
          learn: publicLearn(book)
        });
      }
      const lvl = levelById(q.level);
      if (!lvl) return res.status(400).json({ ok: false, error: 'Pick a level from 1 to 10.' });
      const scanned = await scan(lvl);
      const rows = scanned.rows || [];
      const marks = await markHeld(parseHold(q.hold));
      return res.status(200).json({
        ok: true,
        level: publicLevel(lvl),
        rows: rows,
        marks: marks,
        learn: scanned.learn || publicLearn(null),
        tactic: scanned.tactic || baseTactic(),
        blocked: scanned.blocked || [],
        chase: rows.filter((row) => chase(lvl, row, scanned.tactic) && (scanned.blocked || []).indexOf(row.address) < 0).map((row) => row.chain + ':' + row.address)
      });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action === 'session') {
        const sessions = await rememberRun(acceptRun(body));
        return res.status(200).json({ ok: true, sessions: sessions });
      }
      if (body.action === 'learn-trade') {
        const learn = await rememberTrade(body);
        return res.status(200).json({ ok: true, learn: learn });
      }
      const lvl = levelById(body.level);
      if (!lvl || lvl.tradeUsd <= 0) return res.status(400).json({ ok: false, error: 'That level does not send buys.' });
      body.sol = clampSol(body.sol);
      if (body.action === 'sol-swap') return res.status(200).json({ ok: true, tx: await solSwap(body, lvl) });
      if (body.action === 'eth-swap') return res.status(200).json({ ok: true, tx: await ethSwap(body, lvl) });
      if (body.action === 'sol-sell') return res.status(200).json({ ok: true, tx: await solSell(body, lvl) });
      if (body.action === 'eth-sell') return res.status(200).json({ ok: true, tx: await ethSell(body, lvl) });
      return res.status(400).json({ ok: false, error: 'Unknown action.' });
    }
    return res.status(405).json({ ok: false, error: 'GET or POST' });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || 'Quantum request failed.' });
  }
};
