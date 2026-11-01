/**
 * DOSWAPZ - The Attic card-pull forum API (Vercel serverless).
 * GET: approved posts. POST: new card photo (validated, rate-limited).
 * Persists to Vercel KV when configured; falls back to bundled JSON for GET.
 */

const fs = require('fs');
const path = require('path');

const KV_KEY = 'doswapz:attic-posts';
const MAX_POSTS = 80;
const MAX_IMAGE_BYTES = 280000;
const MAX_POSTS_PER_HOUR = 4;
const MAX_CAPTION_LEN = 180;
const MAX_PACK_LEN = 60;
const ALLOWED_CATEGORIES = new Set(['sports', 'pokemon', 'other']);

const DEFAULT_STORE = { posts: [], updatedAt: null };

function readBundled() {
 try {
 const p = path.join(__dirname, '..', 'assets', 'data', 'attic-posts.json');
 return JSON.parse(fs.readFileSync(p, 'utf8'));
 } catch (e) {
 return { ...DEFAULT_STORE };
 }
}

async function getKv() {
 if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
 try {
 const { kv } = require('@vercel/kv');
 return kv;
 } catch (e) {
 return null;
 }
}

async function loadStore() {
 const kv = await getKv();
 if (kv) {
 const stored = await kv.get(KV_KEY);
 if (stored && typeof stored === 'object') return stored;
 }
 return readBundled();
}

async function saveStore(store) {
 const kv = await getKv();
 if (!kv) return false;
 store.updatedAt = new Date().toISOString();
 await kv.set(KV_KEY, store);
 return true;
}

function parseBody(req) {
 if (req.body && typeof req.body === 'object') return req.body;
 if (typeof req.body === 'string') {
 try {
 return JSON.parse(req.body);
 } catch (e) {
 return null;
 }
 }
 return null;
}

function sanitizeText(text, maxLen) {
 if (typeof text !== 'string') return '';
 return text
 .replace(/<[^>]*>/g, '')
 .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
 .trim()
 .slice(0, maxLen);
}

function captionAllowed(text) {
 if (!text) return true;
 if (/https?:\/\//i.test(text)) return false;
 if (/www\./i.test(text)) return false;
 if (/\.(com|net|org|io|xyz|app)\b/i.test(text)) return false;
 if (/[<>`{}|\\]/.test(text)) return false;
 return /^[\w\s.,!?'#\-+():/&]*$/i.test(text);
}

function walletShort(wallet) {
 if (!wallet || wallet.length < 8) return 'anon';
 return wallet.slice(0, 4) + '...' + wallet.slice(-4);
}

function detectMime(buf) {
 if (buf.length < 12) return null;
 if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
 if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
 if (
 buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
 buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
 ) return 'image/webp';
 return null;
}

function validateImageDataUrl(dataUrl) {
 if (typeof dataUrl !== 'string') return { ok: false, error: 'Missing image' };
 const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
 if (!match) return { ok: false, error: 'Only JPEG, PNG, or WebP card photos allowed' };

 const b64 = match[2];
 if (b64.length > MAX_IMAGE_BYTES) {
 return { ok: false, error: 'Image too large - resize before upload (max ~200KB)' };
 }

 let buf;
 try {
 buf = Buffer.from(b64, 'base64');
 } catch (e) {
 return { ok: false, error: 'Invalid image data' };
 }

 if (buf.length < 800) return { ok: false, error: 'Image file too small' };
 if (buf.length > 220000) return { ok: false, error: 'Image file too large' };

 const mime = detectMime(buf);
 if (!mime) return { ok: false, error: 'File is not a valid card image (JPEG/PNG/WebP only)' };
 if (mime !== match[1] && !(mime === 'image/jpeg' && match[1] === 'image/jpeg')) {
 return { ok: false, error: 'Image type mismatch - no disguised files' };
 }

 return { ok: true, mime, dataUrl };
}

async function checkRateLimit(kv, wallet) {
 const key = 'doswapz:attic-rate:' + wallet.toLowerCase();
 const now = Date.now();
 const windowMs = 60 * 60 * 1000;
 const entry = (await kv.get(key)) || { count: 0, windowStart: now };

 if (now - entry.windowStart > windowMs) {
 entry.count = 0;
 entry.windowStart = now;
 }

 if (entry.count >= MAX_POSTS_PER_HOUR) {
 return false;
 }

 entry.count += 1;
 await kv.set(key, entry, { ex: 7200 });
 return true;
}

module.exports = async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 res.setHeader('Cache-Control', 'no-store');

 if (req.method === 'OPTIONS') {
 return res.status(204).end();
 }

 if (req.method === 'GET') {
 const store = await loadStore();
 const approved = (store.posts || [])
 .filter((p) => p.status === 'approved')
 .sort((a, b) => (b.ts || 0) - (a.ts || 0))
 .slice(0, MAX_POSTS)
 .map((p) => ({
 id: p.id,
 wallet: walletShort(p.wallet),
 category: p.category,
 pack: p.pack || '',
 caption: p.caption || '',
 image: p.image,
 ts: p.ts
 }));

 return res.status(200).json({
 posts: approved,
 updatedAt: store.updatedAt || null,
 persisted: !!(await getKv())
 });
 }

 if (req.method === 'POST') {
 const body = parseBody(req);
 if (!body) return res.status(400).json({ error: 'Invalid JSON body' });

 const wallet = sanitizeText(body.wallet || '', 64);
 const signature = sanitizeText(body.signature || '', 256);
 const category = (body.category || '').toLowerCase();
 const pack = sanitizeText(body.pack || '', MAX_PACK_LEN);
 const caption = sanitizeText(body.caption || '', MAX_CAPTION_LEN);
 const image = body.image;

 if (!wallet || wallet.length < 20) {
 return res.status(400).json({ error: 'Wallet required - connect and soft-sign first' });
 }
 if (!signature || signature.length < 16) {
 return res.status(400).json({ error: 'Signature required - soft-sign only, no funds' });
 }
 if (!ALLOWED_CATEGORIES.has(category)) {
 return res.status(400).json({ error: 'Category must be sports, pokemon, or other' });
 }
 if (!captionAllowed(caption)) {
 return res.status(400).json({ error: 'Caption rejected - plain text only, no links or HTML' });
 }
 if (!captionAllowed(pack)) {
 return res.status(400).json({ error: 'Pack name rejected - plain text only, no links' });
 }

 const imgCheck = validateImageDataUrl(image);
 if (!imgCheck.ok) return res.status(400).json({ error: imgCheck.error });

 const kv = await getKv();
 if (!kv) {
 return res.status(503).json({
 error: 'Forum storage not configured - deploy on Vercel with KV enabled'
 });
 }

 const allowed = await checkRateLimit(kv, wallet);
 if (!allowed) {
 return res.status(429).json({ error: 'Rate limit - max 4 card posts per hour per wallet' });
 }

 const store = await loadStore();
 store.posts = store.posts || [];

 const dupSig = store.posts.some((p) => p.signature === signature);
 if (dupSig) {
 return res.status(200).json({ ok: true, duplicate: true });
 }

 const post = {
 id: 'attic_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
 wallet,
 signature,
 category,
 pack,
 caption,
 image: imgCheck.dataUrl,
 ts: Date.now(),
 status: 'approved'
 };

 store.posts.unshift(post);
 if (store.posts.length > MAX_POSTS) {
 store.posts = store.posts.slice(0, MAX_POSTS);
 }

 await saveStore(store);

 return res.status(200).json({
 ok: true,
 id: post.id,
 message: 'Card pull posted - visible after refresh'
 });
 }

 return res.status(405).json({ error: 'Method not allowed' });
};