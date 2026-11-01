/**
 * Simple in-memory rate limiter (per serverless instance / local process).
 * Better than nothing for abuse of RPC / ticker / trades endpoints.
 */

const buckets = new Map();

function clientIp(req) {
  const h = req.headers || {};
  const xf = h['x-forwarded-for'] || h['X-Forwarded-For'] || h['x-nf-client-connection-ip'] || '';
  if (typeof xf === 'string' && xf) return xf.split(',')[0].trim() || 'unknown';
  return h['x-real-ip'] || h['client-ip'] || 'unknown';
}

/**
 * @param {object} req
 * @param {{ prefix?: string, perMinute?: number, perDay?: number }} opts
 * @returns {{ ok: true } | { ok: false, code: string, retryAfter: number }}
 */
function checkRateLimit(req, opts) {
  opts = opts || {};
  const prefix = opts.prefix || 'default';
  const perMinute = Math.max(1, opts.perMinute || 30);
  const perDay = Math.max(1, opts.perDay || 500);
  const ip = clientIp(req);
  const key = prefix + ':' + ip;
  const now = Date.now();
  const dayKey = new Date().toISOString().slice(0, 10);

  let b = buckets.get(key);
  if (!b) {
    b = { minStart: now, minCount: 0, day: dayKey, dayCount: 0 };
    buckets.set(key, b);
  }
  if (now - b.minStart > 60 * 1000) {
    b.minStart = now;
    b.minCount = 0;
  }
  if (b.day !== dayKey) {
    b.day = dayKey;
    b.dayCount = 0;
  }
  if (b.minCount >= perMinute) {
    return { ok: false, code: 'RATE_MINUTE', retryAfter: 60 };
  }
  if (b.dayCount >= perDay) {
    return { ok: false, code: 'RATE_DAY', retryAfter: 3600 };
  }
  b.minCount += 1;
  b.dayCount += 1;

  if (buckets.size > 8000) {
    const it = buckets.keys();
    for (let i = 0; i < 800; i++) {
      const n = it.next();
      if (n.done) break;
      buckets.delete(n.value);
    }
  }
  return { ok: true };
}

function rateLimitOrReject(req, res, opts) {
  const r = checkRateLimit(req, opts);
  if (r.ok) return false;
  res.setHeader('Retry-After', String(r.retryAfter || 60));
  res.status(429).json({ error: 'Rate limit exceeded', code: r.code });
  return true;
}

module.exports = {
  clientIp,
  checkRateLimit,
  rateLimitOrReject
};
