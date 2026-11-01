/**
 * Solana honeypot / rug heuristic.
 * GET /api/token-safety?mints=mint1,mint2
 * RugCheck + GoPlus + mint/freeze/hook flags.
 */
const { rateLimitOrReject } = require('./lib/rate-limit');

const MAX = 10;

function cors(res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
 res.setHeader('Cache-Control', 'public, max-age=60');
}

async function fetchJson(url) {
 const res = await fetch(url, { headers: { Accept: 'application/json' } });
 if (!res.ok) throw new Error('HTTP ' + res.status);
 return res.json();
}

async function rugcheck(mint) {
 return fetchJson('https://api.rugcheck.xyz/v1/tokens/' + encodeURIComponent(mint) + '/report');
}

async function goplus(mint) {
 const data = await fetchJson(
  'https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=' + encodeURIComponent(mint)
 );
 return data && data.result ? data.result[mint] : null;
}

function summarize(mint, rc, gp) {
 const reasons = [];
 let honey = false;
 let high = false;
 const token = (rc && rc.token) || {};
 const ext = (rc && rc.token_extensions) || {};
 if (rc && rc.rugged) {
  honey = true;
  reasons.push('MARKED RUGGED');
 }
 if (rc && rc.mintAuthority) {
  high = true;
  reasons.push('MINT AUTH LIVE');
 }
 if (token.mintAuthority) {
  high = true;
  reasons.push('CAN MINT');
 }
 if (rc && rc.freezeAuthority) {
  high = true;
  reasons.push('FREEZE AUTH LIVE');
 }
 if (token.freezeAuthority) {
  high = true;
  reasons.push('CAN FREEZE');
 }
 if (ext.nonTransferable) {
  honey = true;
  reasons.push('NON TRANSFERABLE');
 }
 if (ext.transferHook) {
  honey = true;
  reasons.push('TRANSFER HOOK');
 }
 if (ext.permanentDelegate) {
  high = true;
  reasons.push('PERMANENT DELEGATE');
 }
 if (gp) {
  if (String(gp.non_transferable) === '1') {
   honey = true;
   reasons.push('CANT TRANSFER');
  }
  if (gp.freezable && String(gp.freezable.status) === '1') {
   high = true;
   reasons.push('FREEZABLE');
  }
  if (gp.mintable && String(gp.mintable.status) === '1') {
   high = true;
   reasons.push('MINTABLE');
  }
  if (Array.isArray(gp.transfer_hook) && gp.transfer_hook.length) {
   honey = true;
   reasons.push('HOOK');
  }
  const fee = gp.transfer_fee || {};
  if (fee.fee_rate && Number(fee.fee_rate) > 0) {
   high = true;
   reasons.push('TRANSFER FEE');
  }
 }
 const score = rc && rc.score != null ? Number(rc.score) : null;
 if (score != null && score >= 1000) {
  high = true;
  reasons.push('RUGCHECK SCORE ' + score);
 }
 const risks = Array.isArray(rc && rc.risks) ? rc.risks : [];
 risks.slice(0, 6).forEach((r) => {
  const lvl = String((r && (r.level || r.severity)) || '').toLowerCase();
  const name = String((r && (r.name || r.displayName)) || '').toUpperCase();
  if (!name) return;
  if (lvl === 'danger' || lvl === 'critical' || /honey|freeze|mint|hook|scam/i.test(name)) {
   if (/honey|non.?transfer|hook/i.test(name)) honey = true;
   else high = true;
   reasons.push(name);
  }
 });
 const uniq = [];
 reasons.forEach((x) => {
  if (uniq.indexOf(x) < 0) uniq.push(x);
 });
 let risk = 'OK';
 if (honey) risk = 'HONEY';
 else if (high) risk = 'RISK';
 else if (!uniq.length) risk = 'OK';
 return {
  mint,
  risk,
  honeypot: honey,
  score: score,
  rugged: !!(rc && rc.rugged),
  liquidity: rc && rc.totalMarketLiquidity != null ? Number(rc.totalMarketLiquidity) : null,
  holders: rc && rc.totalHolders != null ? Number(rc.totalHolders) : null,
  reasons: uniq.slice(0, 8)
 };
}

async function checkOne(mint) {
 const rc = await rugcheck(mint).catch(() => null);
 const gp = await goplus(mint).catch(() => null);
 if (!rc && !gp) {
  return { mint, risk: 'UNK', honeypot: false, reasons: ['CHECK FAILED'] };
 }
 return summarize(mint, rc, gp);
}

module.exports = async function handler(req, res) {
 cors(res);
 if (req.method === 'OPTIONS') return res.status(204).end();
 if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'GET only' });
 if (rateLimitOrReject(req, res, { prefix: 'token-safety', perMinute: 20, perDay: 300 })) return;

 const q = (req.query && (req.query.mints || req.query.mint)) || '';
 const mints = String(q)
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length >= 32)
  .slice(0, MAX);
 if (!mints.length) return res.status(400).json({ ok: false, error: 'mints required' });

 const out = [];
 for (let i = 0; i < mints.length; i += 3) {
  const chunk = mints.slice(i, i + 3);
  const part = await Promise.all(chunk.map(checkOne));
  out.push.apply(out, part);
 }
 return res.status(200).json({ ok: true, updatedAt: new Date().toISOString(), tokens: out });
};
