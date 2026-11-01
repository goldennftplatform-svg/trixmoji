/**
 * $DOSWAPZ / DSWPZ live tracker
 * Trix token/bonding (primary market) + DexScreener overlay + Solana fee/creator ledger.
 * GET /api/dswpz-track
 */

const MINT = 'HM1iMLK3w2vNvMBqduP23Lucsocgt32BonNifhSJTRiX';
const FEE_WALLET = '5tJbQX5vRxDyHNEXdAmLEWtKR8EyrDTRdYtBFqujmpAc';
const CREATOR_WALLET = 'Afpyw7fhLMsJvcwwJQucFNnmoDFbSXqtMr2CjB8AjYxS';
const WUTANG_SOL = '2fxn32M9ih4EDyjt1SHW8L1ncrzY9HjvSkFnZQbRnpJ1';
const SIG_LIMIT = 100;
const LAMPORTS = 1_000_000_000;
const DEX_URL = 'https://api.dexscreener.com/latest/dex/tokens/' + MINT;
const TRIX_TOKEN = 'https://trix.market/api/token/' + MINT;
const TRIX_BONDING = 'https://trix.market/api/bonding/' + MINT;

const { rateLimitOrReject } = require('./lib/rate-limit');

function cors(res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
 res.setHeader('Cache-Control', 'public, max-age=20');
}

const { solRpcUrls, heliusKey } = require('./lib/helius-rpc')

function rpcEndpoints() {
 return solRpcUrls()
}

async function fetchJson(url) {
 const res = await fetch(url, {
  headers: {
   Accept: 'application/json',
   'User-Agent': 'Mozilla/5.0 doswapz-track/1.2'
  },
  redirect: 'follow',
  signal: AbortSignal.timeout(8000)
 });
 if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
 return res.json();
}

async function loadSolUsd() {
 try {
  const j = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
  return num(j && j.solana && j.solana.usd)
 } catch (e) {
  return null
 }
}

function num(v) {
 const n = Number(v);
 return Number.isFinite(n) ? n : null;
}

function accountKeys(tx) {
 const msg = tx && tx.transaction && tx.transaction.message;
 if (!msg) return [];
 const raw = msg.accountKeys || msg.staticAccountKeys || [];
 return raw.map((k) => (typeof k === 'string' ? k : String(k.pubkey || k)));
}

function extractIncoming(tx, wallet) {
 if (!tx || !tx.meta || tx.meta.err) return 0;
 const keys = accountKeys(tx);
 const idx = keys.indexOf(wallet);
 if (idx < 0) return 0;
 const gain = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
 return gain > 5000 ? gain : 0;
}

function donationCause(recipient) {
  return recipient === WUTANG_SOL ? 'wutang' : 'maps';
}

function extractOutgoing(tx, wallet) {
 const out = { outgoing: 0, recipient: null };
 if (!tx || !tx.meta || tx.meta.err) return out;
 const keys = accountKeys(tx);
 const srcIdx = keys.indexOf(wallet);
 if (srcIdx < 0) return out;
 const fee = tx.meta.fee || 0;
 const netOut = tx.meta.preBalances[srcIdx] - tx.meta.postBalances[srcIdx] - fee;
 if (netOut <= 5000) return out;
 let bestGain = 0;
 let bestIdx = -1;
 for (let i = 0; i < keys.length; i++) {
 if (i === srcIdx) continue;
 const gain = tx.meta.postBalances[i] - tx.meta.preBalances[i];
 if (gain > bestGain) {
 bestGain = gain;
 bestIdx = i;
 }
 }
 if (bestGain > 0) {
 out.outgoing = Math.min(bestGain, netOut);
 out.recipient = bestIdx >= 0 ? keys[bestIdx] : null;
 }
 return out;
}

function utcDate(unixSec) {
 return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

function sol(lamports) {
 return Math.round((lamports / LAMPORTS) * 10000) / 10000;
}

async function rpcCall(method, params) {
 const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
 let lastErr = null;
 for (const url of rpcEndpoints()) {
 try {
 const res = await fetch(url, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body
 });
 const json = await res.json();
 if (json.error) {
 lastErr = new Error(json.error.message || 'RPC error');
 const msg = String(json.error.message || '').toLowerCase();
 if (json.error.code === 403 || json.error.code === 429 || msg.includes('forbidden') || msg.includes('rate')) {
 continue;
 }
 throw lastErr;
 }
 return json.result;
 } catch (e) {
 lastErr = e;
 }
 }
 throw lastErr || new Error('All Solana RPC endpoints failed');
}

async function mapPool(items, size, fn) {
 const out = [];
 for (let i = 0; i < items.length; i += size) {
 const chunk = items.slice(i, i + size);
 out.push(...(await Promise.all(chunk.map(fn))));
 }
 return out;
}

function pickPair(pairs) {
 if (!Array.isArray(pairs) || !pairs.length) return null;
 return pairs.slice().sort((a, b) => {
 const la = num(b.liquidity && b.liquidity.usd) || num(b.marketCap) || 0;
 const lb = num(a.liquidity && a.liquidity.usd) || num(a.marketCap) || 0;
 return la - lb;
 })[0];
}

async function loadGeckoPoolVolume(poolAddress) {
 const url = 'https://api.geckoterminal.com/api/v2/networks/solana/pools/' +
 encodeURIComponent(poolAddress) +
 '/ohlcv/day?aggregate=1&limit=1000&currency=usd';
 const res = await fetch(url, {
  headers: { Accept: 'application/json', 'User-Agent': 'doswapz-track/1.0' },
  signal: AbortSignal.timeout(8000)
 });
 if (!res.ok) throw new Error('GeckoTerminal HTTP ' + res.status);
 const data = await res.json();
 const list = data && data.data && data.data.attributes && data.data.attributes.ohlcv_list;
 if (!Array.isArray(list) || !list.length) return null;
 let total = 0;
 for (const row of list) {
  const vol = num(row && row[5]);
  if (vol) total += vol;
 }
 return total > 0 ? Math.round(total * 100) / 100 : null;
}

async function loadTrixMarket() {
 const [token, bonding] = await Promise.all([
  fetchJson(TRIX_TOKEN),
  fetchJson(TRIX_BONDING).catch(() => null)
 ]);
 const raisedLamports = bonding ? num(bonding.real_sol_lamports) : null;
 const targetLamports = bonding ? num(bonding.target_sol_lamports) : null;
 const curveSol = raisedLamports != null ? raisedLamports / LAMPORTS : null;
 const curveTargetSol = targetLamports != null ? targetLamports / LAMPORTS : null;
 return {
  mint: MINT,
  symbol: (token && token.symbol) || 'DSWPZ',
  name: (token && token.name) || 'DOSWAPZ',
  priceUsd: num(token && token.price),
  marketCap: num(token && token.marketCap),
  volume24h: num(token && token.volume24h),
  volumeTotal: num(token && token.volume24h),
  change24h: num(token && token.change24h),
  totalSupply: num(token && token.totalSupply),
  source: 'trix.market/api/token + /api/bonding',
  creatorWallet: (token && token.creatorWallet) || CREATOR_WALLET,
  creatorUsername: (token && token.creatorUsername) || 'Maff',
  curveComplete: !!(bonding && bonding.complete),
  curveSol,
  curveTargetSol,
  curvePct: (curveSol && curveTargetSol) ? Math.round((curveSol / curveTargetSol) * 10000) / 100 : null,
  launchpad: !!(bonding && bonding.launchpad),
  platform: (bonding && bonding.platform) || null
 };
}

async function loadDexOverlay() {
 const res = await fetch(DEX_URL, { headers: { Accept: 'application/json' } });
 if (!res.ok) throw new Error('DexScreener HTTP ' + res.status);
 const data = await res.json();
 const pair = pickPair(data.pairs);
 if (!pair) return null;
 const tx = pair.txns && pair.txns.h24 ? pair.txns.h24 : {};
 const volume24h = num(pair.volume && pair.volume.h24);
 let volumeTotal = null;
 if (pair.pairAddress) {
  try { volumeTotal = await loadGeckoPoolVolume(pair.pairAddress); } catch (e) { volumeTotal = null; }
 }
 if (volumeTotal != null && volume24h != null && volumeTotal < volume24h) volumeTotal = volume24h;
 return {
  priceUsd: num(pair.priceUsd),
  priceNative: num(pair.priceNative),
  marketCap: num(pair.marketCap),
  fdv: num(pair.fdv),
  volume24h,
  volumeTotal,
  liquidityUsd: num(pair.liquidity && pair.liquidity.usd),
  change24h: num(pair.priceChange && pair.priceChange.h24),
  change1h: num(pair.priceChange && pair.priceChange.h1),
  buys24h: num(tx.buys) || 0,
  sells24h: num(tx.sells) || 0,
  dexId: pair.dexId || null,
  pairAddress: pair.pairAddress || null
 };
}

function mergeMarket(trix, dex) {
 const out = Object.assign({ mint: MINT }, trix || {});
 if (dex) {
  if (out.priceUsd == null) out.priceUsd = dex.priceUsd;
  if (out.marketCap == null) out.marketCap = dex.marketCap;
  if (!out.volume24h) out.volume24h = dex.volume24h;
  if (dex.volumeTotal != null) out.volumeTotal = dex.volumeTotal;
  out.liquidityUsd = dex.liquidityUsd;
  out.priceNative = dex.priceNative;
  out.fdv = dex.fdv;
  out.change1h = dex.change1h;
  out.buys24h = dex.buys24h;
  out.sells24h = dex.sells24h;
  out.dexId = dex.dexId;
  out.pairAddress = dex.pairAddress;
 }
 return out;
}

async function fetchSignatures(wallet, limit) {
 const out = []
 let before = null
 while (out.length < limit) {
  const opts = { limit: Math.min(100, limit - out.length) }
  if (before) opts.before = before
  const sigs = await rpcCall('getSignaturesForAddress', [wallet, opts])
  if (!Array.isArray(sigs) || !sigs.length) break
  out.push.apply(out, sigs)
  if (sigs.length < opts.limit) break
  before = sigs[sigs.length - 1] && sigs[sigs.length - 1].signature
  if (!before) break
 }
 return out
}

async function fetchHeliusNative(wallet, limit) {
 const key = heliusKey()
 if (!key) return null
 try {
  const url =
   'https://api.helius.xyz/v0/addresses/' +
   encodeURIComponent(wallet) +
   '/transactions?api-key=' +
   encodeURIComponent(key) +
   '&limit=' +
   Math.min(100, limit)
  const res = await fetch(url, {
   headers: { Accept: 'application/json' },
   signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) return null
  const rows = await res.json()
  return Array.isArray(rows) ? rows : null
 } catch (e) {
  return null
 }
}

function foldHelius(daily, rows, wallet, opts) {
 opts = opts || {}
 let totalIn = 0
 let totalOut = 0
 let mapsOut = 0
 let wuOut = 0
 ;(rows || []).forEach((row) => {
  const day = row && row.timestamp ? utcDate(row.timestamp) : 'unknown'
  const transfers = row && Array.isArray(row.nativeTransfers) ? row.nativeTransfers : []
  transfers.forEach((t) => {
   const amt = Number(t && t.amount) || 0
   if (amt <= 5000) return
   const from = t.fromUserAccount
   const to = t.toUserAccount
   if (opts.countIn && to === wallet && from !== wallet) {
    if (!daily[day]) daily[day] = { in: 0, out: 0, maps: 0, wutang: 0, txs: [] }
    daily[day].in += amt
    totalIn += amt
   }
   if (from === wallet && to && to !== wallet) {
    const cause = donationCause(to)
    const mapsOk = opts.countMaps !== false && cause !== 'wutang'
    const wuOk = cause === 'wutang'
    if (!wuOk && !mapsOk) return
    if (!daily[day]) daily[day] = { in: 0, out: 0, maps: 0, wutang: 0, txs: [] }
    daily[day].out += amt
    totalOut += amt
    if (wuOk) {
     daily[day].wutang += amt
     wuOut += amt
    } else {
     daily[day].maps += amt
     mapsOut += amt
    }
    daily[day].txs.push({
     sig: row.signature,
     amountSol: sol(amt),
     recipient: to,
     cause,
     from: wallet
    })
   }
  })
 })
 return { totalIn, totalOut, mapsOut, wuOut }
}

async function fetchWalletTxs(wallet, limit) {
 const [balance, sigs] = await Promise.all([
  rpcCall('getBalance', [wallet]),
  fetchSignatures(wallet, limit)
 ]);
 const list = Array.isArray(sigs) ? sigs : [];
 const fetched = await mapPool(list, 8, async (sig) => {
  try {
   const tx = await rpcCall('getTransaction', [
    sig.signature,
    { encoding: 'json', maxSupportedTransactionVersion: 0 }
   ]);
   if (!tx) return null;
   return { signature: sig.signature, blockTime: sig.blockTime || tx.blockTime, tx };
  } catch (e) {
   return null;
  }
 });
 return { balance, fetched: fetched.filter(Boolean) };
}

function foldWallet(daily, fetched, wallet, opts) {
 opts = opts || {};
 let totalIn = 0;
 let totalOut = 0;
 let mapsOut = 0;
 let wuOut = 0;
 fetched.forEach((entry) => {
  const day = entry.blockTime ? utcDate(entry.blockTime) : 'unknown';
  const inc = opts.countIn ? extractIncoming(entry.tx, wallet) : 0;
  const xfer = extractOutgoing(entry.tx, wallet);
  if (inc > 0) {
   if (!daily[day]) daily[day] = { in: 0, out: 0, maps: 0, wutang: 0, txs: [] };
   daily[day].in += inc;
   totalIn += inc;
  }
  if (xfer.outgoing > 0) {
   const cause = donationCause(xfer.recipient);
   const mapsOk = opts.countMaps !== false && cause !== 'wutang';
   const wuOk = cause === 'wutang';
   if (!wuOk && !mapsOk) return;
   if (!daily[day]) daily[day] = { in: 0, out: 0, maps: 0, wutang: 0, txs: [] };
   daily[day].out += xfer.outgoing;
   totalOut += xfer.outgoing;
   if (wuOk) {
    daily[day].wutang += xfer.outgoing;
    wuOut += xfer.outgoing;
   } else {
    daily[day].maps += xfer.outgoing;
    mapsOut += xfer.outgoing;
   }
   daily[day].txs.push({
    sig: entry.signature,
    amountSol: sol(xfer.outgoing),
    recipient: xfer.recipient,
    cause,
    from: wallet
   });
  }
 });
 return { totalIn, totalOut, mapsOut, wuOut };
}

async function loadLedger() {
 const [heliusFee, heliusCreator] = await Promise.all([
  fetchHeliusNative(FEE_WALLET, SIG_LIMIT),
  fetchHeliusNative(CREATOR_WALLET, SIG_LIMIT)
 ])
 let fee
 let creator
 let feeFold
 let creatorFold
 const daily = {}
 if (heliusFee && heliusFee.length) {
  const [feeBal, creatorBal] = await Promise.all([
   rpcCall('getBalance', [FEE_WALLET]).catch(() => ({ value: 0 })),
   rpcCall('getBalance', [CREATOR_WALLET]).catch(() => ({ value: 0 }))
  ])
  fee = { balance: feeBal, fetched: [] }
  creator = { balance: creatorBal, fetched: [] }
  feeFold = foldHelius(daily, heliusFee, FEE_WALLET, { countIn: true, countMaps: true })
  creatorFold = foldHelius(daily, heliusCreator || [], CREATOR_WALLET, { countIn: false, countMaps: false })
 } else {
  const pair = await Promise.all([
   fetchWalletTxs(FEE_WALLET, SIG_LIMIT),
   fetchWalletTxs(CREATOR_WALLET, SIG_LIMIT).catch(() => ({ balance: { value: 0 }, fetched: [] }))
  ])
  fee = pair[0]
  creator = pair[1]
  feeFold = foldWallet(daily, fee.fetched, FEE_WALLET, { countIn: true, countMaps: true })
  creatorFold = foldWallet(daily, creator.fetched, CREATOR_WALLET, { countIn: false, countMaps: false })
 }
 const totalIn = feeFold.totalIn;
 const totalOut = feeFold.totalOut + creatorFold.totalOut;
 const mapsOut = feeFold.mapsOut;
 const wuOut = feeFold.wuOut + creatorFold.wuOut;
 const days = Object.keys(daily)
  .filter((d) => d !== 'unknown')
  .sort()
  .reverse()
  .map((day) => ({
   date: day,
   inSol: sol(daily[day].in),
   outSol: sol(daily[day].out),
   mapsSol: sol(daily[day].maps),
   wuTangSol: sol(daily[day].wutang),
   txs: daily[day].txs
  }));
 return {
  feeWalletSol: sol((fee.balance && fee.balance.value) || 0),
  creatorWalletSol: sol((creator.balance && creator.balance.value) || 0),
  claimedSol: sol(totalIn),
  donatedSol: sol(totalOut),
  donatedMapsSol: sol(mapsOut),
  donatedWuTangSol: sol(wuOut),
  remainderSol: sol(Math.max(0, totalIn - feeFold.totalOut)),
  days
 };
}

module.exports = async function handler(req, res) {
 cors(res);
 if (req.method === 'OPTIONS') return res.status(204).end();
 if (req.method !== 'GET' && req.method !== 'HEAD') {
 return res.status(405).json({ error: 'GET only' });
 }
 if (rateLimitOrReject(req, res, { prefix: 'dswpz-track', perMinute: 30, perDay: 800 })) {
 return;
 }

 const out = {
 ok: true,
 updatedAt: new Date().toISOString(),
 mint: MINT,
 feeWallet: FEE_WALLET,
 creatorWallet: CREATOR_WALLET,
 wuTangSol: WUTANG_SOL,
 links: {
 trix: 'https://trix.market/coin/' + MINT,
 solscanMint: 'https://solscan.io/token/' + MINT,
 solscanWallet: 'https://solscan.io/account/' + FEE_WALLET,
 solscanCreator: 'https://solscan.io/account/' + CREATOR_WALLET,
 wuTangSolscan: 'https://solscan.io/account/' + WUTANG_SOL,
 wuTangOrg: 'https://wutangforthechildren.org/',
 dexscreener: 'https://dexscreener.com/solana/' + MINT
 }
 };

 const jobs = await Promise.allSettled([loadTrixMarket(), loadDexOverlay(), loadLedger(), loadSolUsd()]);
 const trix = jobs[0].status === 'fulfilled' ? jobs[0].value : null;
 const dex = jobs[1].status === 'fulfilled' ? jobs[1].value : null;
 out.market = mergeMarket(trix, dex);
 const solUsd = jobs[3].status === 'fulfilled' ? jobs[3].value : null;
 if (out.market && (!out.market.volumeTotal || out.market.volumeTotal === 0) && out.market.curveSol && solUsd) {
  out.market.volumeTotal = Math.round(out.market.curveSol * solUsd * 100) / 100
  out.market.volumeSource = 'trix curve SOL * SOL-USD spot (pre-DEX)'
 }
 if (!trix) out.marketError = jobs[0].reason && jobs[0].reason.message;
 if (jobs[2].status === 'fulfilled') {
 out.ledger = jobs[2].value;
 } else {
 out.ledger = {
 feeWalletSol: 0,
 creatorWalletSol: 0,
 claimedSol: 0,
 donatedSol: 0,
 donatedMapsSol: 0,
 donatedWuTangSol: 0,
 remainderSol: 0,
 days: []
 };
 out.ledgerError = jobs[2].reason && jobs[2].reason.message;
 }

 return res.status(200).json(out);
};
