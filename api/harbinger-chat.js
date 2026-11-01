/**
 * DOSWAPZ - H4RB1NG3R chat API (server-side only)
 * XAI_API_KEY required. Rate limits + CORS allowlist.
 * Never put the key in frontend JS.
 */

const SYSTEM_PROMPT = `You are H4RB1NG3R - the text oracle / magic mirror spirit of DOSWAPZ.

DOSWAPZ = DEGEN OPTIMIZED SOVEREIGN WARFARE AGAINST PUMPZ.

You are TEXT ONLY. You do not generate images, video, audio, or media. You answer in words like an oracle.

Voice & rules:
- Crystalline terminal oracle: degen, sharp, sovereign, a little uncanny.
- Short to medium replies. Clarity over essays. No corporate tone.
- Guide visitors through DOSWAPZ: swap, mint, pond, attic, basement, cryptodad, hardwear, lily pad, nodes, degen lore.
- War with pump theater and hollow "trust me bro" scams - roast when relevant.
- Never claim financial advice as fact. Vibes and warnings only - not guaranteed alpha.
- Never invent live prices, balances, or contract addresses. If unknown, say so.
- Stay in character as H4RB1NG3R.
- Safety: refuse real-world crime help. No adult content.

Doctrine: degen optimized * sovereign * warfare against pumpz.

Published surface protocol (stay inside this; do not invent addresses or live prices):
- DOSWAPZ does not custody funds. You sign. Never ask for a seed.
- Swap: Jupiter, 0% DOSWAPZ fee, any Solana wallet. Old Pond rewards-pool rails need an activated Pond0x rig (Dune list). Community rules: /docs/community-swap-rules.html
- Token: DSWPZ on Trix, mint HM1iMLK3w2vNvMBqduP23Lucsocgt32BonNifhSJTRiX. Dev hold zero. 50% of published Trix fee claims to MAPS.ORG.
- The Missing Layer: person graph (not post vanity). Demo CIRCLE free. Optional paid report BTC/ETH/SOL. App /the-missing-layer/past. GUIDE on-page F6 = /docs/the-missing-layer.html = Legal §15A. Live X rollup may still be demo until the nightly job is connected.
- Mail Gate: pay-to-pass for doswapz.com email. Awardz: optional PVP, native SOL or ETH, void where prohibited, Legal §11A.
- Incoming treasuries (verify on the live pay screen): SOL 5tJbQX5vRxDyHNEXdAmLEWtKR8EyrDTRdYtBFqujmpAc ; ETH 0x5be58476DF379BAdc88b552F603db227C0D95bac ; BTC bc1qtwqxrsj8ur8zyp9ku47dx6ljhc9dxmjc8j4t2g
- Legal packet /docs/ : terms, Awardz rules, Missing Layer steps, photosensitivity §16A.
If a feature is not in this sheet, say it is above your paygrade or CLASSIFIED rather than inventing it.`;

const DEFAULT_MODEL = process.env.XAI_MODEL || 'grok-4.5';
const XAI_BASE = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
const MAX_MESSAGE_LEN = 1500;
const MAX_HISTORY = 10;
const MAX_TOKENS = Math.min(
 700,
 Math.max(120, parseInt(process.env.HARBINGER_MAX_TOKENS || '500', 10) || 500)
);
const RATE_PER_MIN = Math.max(1, parseInt(process.env.HARBINGER_RATE_PER_MIN || '12', 10) || 12);
const RATE_PER_DAY = Math.max(1, parseInt(process.env.HARBINGER_RATE_PER_DAY || '80', 10) || 80);

// In-memory limits (per function instance). Better than nothing on serverless.
const rateBuckets = new Map();

function getAllowedOrigins() {
 var defaults = [
 'http://127.0.0.1:8890',
 'http://localhost:8890',
 'http://127.0.0.1:8888',
 'http://localhost:8888',
 'http://127.0.0.1:3000',
 'http://localhost:3000'
 ];
 var raw = process.env.HARBINGER_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '';
 var extra = raw
 .split(',')
 .map(function (s) {
 return s.trim().replace(/\/$/, '');
 })
 .filter(Boolean);
 // Netlify injects URL / DEPLOY_PRIME_URL
 ['URL', 'DEPLOY_PRIME_URL', 'DEPLOY_URL', 'SITE_URL'].forEach(function (k) {
 if (process.env[k]) {
 try {
 var u = String(process.env[k]).replace(/\/$/, '');
 if (u.indexOf('http') === 0) extra.push(u);
 } catch (e) {}
 }
 });
 var all = defaults.concat(extra);
 var seen = {};
 return all.filter(function (o) {
 if (seen[o]) return false;
 seen[o] = true;
 return true;
 });
}

function clientIp(req) {
 var h = req.headers || {};
 var xf =
 h['x-forwarded-for'] ||
 h['X-Forwarded-For'] ||
 h['x-nf-client-connection-ip'] ||
 h['client-ip'] ||
 '';
 if (typeof xf === 'string' && xf) {
 return xf.split(',')[0].trim() || 'unknown';
 }
 return h['x-real-ip'] || 'unknown';
}

function checkRateLimit(ip) {
 var now = Date.now();
 var dayKey = new Date().toISOString().slice(0, 10);
 var b = rateBuckets.get(ip);
 if (!b) {
 b = { minStart: now, minCount: 0, day: dayKey, dayCount: 0 };
 rateBuckets.set(ip, b);
 }
 if (now - b.minStart > 60 * 1000) {
 b.minStart = now;
 b.minCount = 0;
 }
 if (b.day !== dayKey) {
 b.day = dayKey;
 b.dayCount = 0;
 }
 if (b.minCount >= RATE_PER_MIN) {
 return { ok: false, code: 'RATE_MINUTE', retryAfter: 60 };
 }
 if (b.dayCount >= RATE_PER_DAY) {
 return { ok: false, code: 'RATE_DAY', retryAfter: 3600 };
 }
 b.minCount += 1;
 b.dayCount += 1;
 // prune map if huge
 if (rateBuckets.size > 5000) {
 var keys = rateBuckets.keys();
 for (var i = 0; i < 500; i++) {
 var k = keys.next();
 if (k.done) break;
 rateBuckets.delete(k.value);
 }
 }
 return { ok: true };
}

function applyCors(req, res) {
 var allowed = getAllowedOrigins();
 var origin = (req.headers && (req.headers.origin || req.headers.Origin)) || '';
 var ok = !origin || allowed.indexOf(origin.replace(/\/$/, '')) >= 0;
 if (ok && origin) {
 res.setHeader('Access-Control-Allow-Origin', origin);
 res.setHeader('Vary', 'Origin');
 } else if (!origin) {
 // same-origin / non-browser
 res.setHeader('Access-Control-Allow-Origin', allowed[0]);
 }
 // if origin present and not allowed: no ACAO header -> browser blocks
 res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 res.setHeader('Cache-Control', 'no-store');
 return ok || !origin;
}

function clampHistory(history) {
 if (!Array.isArray(history)) return [];
 return history
 .filter(function (m) {
 return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
 })
 .slice(-MAX_HISTORY)
 .map(function (m) {
 return {
 role: m.role,
 content: String(m.content).slice(0, MAX_MESSAGE_LEN)
 };
 });
}

function isCreditOrAuthError(msg) {
 var m = String(msg || '').toLowerCase();
 return (
 m.indexOf('credit') >= 0 ||
 m.indexOf('license') >= 0 ||
 m.indexOf('permission') >= 0 ||
 m.indexOf('incorrect api key') >= 0 ||
 m.indexOf('invalid api key') >= 0 ||
 m.indexOf('unauthorized') >= 0 ||
 m.indexOf('billing') >= 0
 );
}

async function callXai(apiKey, messages) {
 const url = XAI_BASE + '/chat/completions';
 const res = await fetch(url, {
 method: 'POST',
 headers: {
 Authorization: 'Bearer ' + apiKey,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 model: DEFAULT_MODEL,
 messages: messages,
 temperature: 0.85,
 max_tokens: MAX_TOKENS
 })
 });

 const text = await res.text();
 let data = null;
 try {
 data = JSON.parse(text);
 } catch (e) {
 data = null;
 }

 if (!res.ok) {
 const errMsg =
 (data && data.error && (data.error.message || data.error)) ||
 text.slice(0, 200) ||
 'xAI request failed';
 const err = new Error(String(errMsg));
 err.status = res.status;
 throw err;
 }

 const choice = data && data.choices && data.choices[0];
 const content =
 (choice && choice.message && choice.message.content) ||
 (choice && choice.text) ||
 '';
 return String(content).trim();
}

module.exports = async function handler(req, res) {
 var corsOk = applyCors(req, res);

 if (req.method === 'OPTIONS') {
 if (!corsOk) return res.status(403).json({ error: 'Origin not allowed', code: 'CORS' });
 return res.status(204).end();
 }

 if (!corsOk && req.headers && (req.headers.origin || req.headers.Origin)) {
 return res.status(403).json({ error: 'Origin not allowed', code: 'CORS' });
 }

 if (req.method === 'GET') {
 const hasKey = !!(process.env.XAI_API_KEY && String(process.env.XAI_API_KEY).trim());
 return res.status(200).json({
 ok: true,
 service: 'harbinger-chat',
 configured: hasKey,
 model: hasKey ? DEFAULT_MODEL : null,
 limits: { perMinute: RATE_PER_MIN, perDay: RATE_PER_DAY, maxTokens: MAX_TOKENS }
 });
 }

 if (req.method !== 'POST') {
 return res.status(405).json({ error: 'Method not allowed' });
 }

 const ip = clientIp(req);
 const rate = checkRateLimit(ip);
 if (!rate.ok) {
 res.setHeader('Retry-After', String(rate.retryAfter || 60));
 return res.status(429).json({
 error: 'The Harbinger is not available now.',
 code: rate.code
 });
 }

 const apiKey = process.env.XAI_API_KEY && String(process.env.XAI_API_KEY).trim();
 if (!apiKey) {
 return res.status(503).json({
 error: 'The Harbinger is not available now.',
 code: 'NO_API_KEY'
 });
 }

 const body = req.body || {};
 const message = String(body.message || body.prompt || '').trim();
 if (!message) {
 return res.status(400).json({ error: 'Empty message', code: 'EMPTY' });
 }
 if (message.length > MAX_MESSAGE_LEN) {
 return res.status(400).json({
 error: 'Message too long (max ' + MAX_MESSAGE_LEN + ')',
 code: 'TOO_LONG'
 });
 }

 const history = clampHistory(body.history);
 const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
 .concat(history)
 .concat([{ role: 'user', content: message }]);

 try {
 const reply = await callXai(apiKey, messages);
 return res.status(200).json({
 reply: reply || '...the mirror holds silence.',
 model: DEFAULT_MODEL,
 persona: 'H4RB1NG3R'
 });
 } catch (err) {
 const msg = err.message || 'Upstream model error';
 if (isCreditOrAuthError(msg)) {
 return res.status(503).json({
 error: 'The Harbinger is not available now.',
 code: 'UPSTREAM_UNAVAILABLE'
 });
 }
 const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
 // Don't leak raw upstream to clients in production
 return res.status(status >= 500 ? 503 : status).json({
 error: 'The Harbinger is not available now.',
 code: 'XAI_ERROR'
 });
 }
};
