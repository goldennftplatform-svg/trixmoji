/**
 * Pull activated-rig wallets from Dune query results API.
 */

const { walletsFromDuneRows, saveStore } = require('./pond-rigs-store');

async function fetchDuneResults(queryId, apiKey, limit) {
  const url =
    'https://api.dune.com/api/v1/query/' +
    encodeURIComponent(queryId) +
    '/results?limit=' +
    encodeURIComponent(String(limit));

  const res = await fetch(url, {
    headers: {
      'X-Dune-API-Key': apiKey,
      Accept: 'application/json'
    }
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    body = null;
  }
  if (!res.ok) {
    const msg =
      (body && (body.error || body.message)) ||
      text.slice(0, 200) ||
      'Dune results failed';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

function rowsFromDuneBody(body) {
  if (!body) return [];
  if (Array.isArray(body.rows)) return body.rows;
  if (body.result && Array.isArray(body.result.rows)) return body.result.rows;
  if (body.data && Array.isArray(body.data.rows)) return body.data.rows;
  return [];
}

function uniqueWallets(list) {
  const seen = Object.create(null);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w || seen[w]) continue;
    seen[w] = true;
    out.push(w);
  }
  return out;
}

/**
 * @returns {Promise<{count, updatedAt, source, wrote, queryId, sampleKeys?}>}
 */
async function syncFromDune(opts) {
  opts = opts || {};
  const apiKey = (opts.apiKey || process.env.DUNE_API_KEY || '').trim();
  const queryId = String(opts.queryId || process.env.DUNE_POND_RIG_QUERY_ID || '').trim();
  const limit = Math.min(
    500000,
    Math.max(1000, Number(opts.limit || process.env.DUNE_POND_RIG_RESULT_LIMIT) || 250000)
  );

  if (!apiKey) {
    const err = new Error('DUNE_API_KEY not configured');
    err.status = 400;
    throw err;
  }
  if (!queryId) {
    const err = new Error('DUNE_POND_RIG_QUERY_ID not configured');
    err.status = 400;
    throw err;
  }

  const duneBody = await fetchDuneResults(queryId, apiKey, limit);
  const rows = rowsFromDuneBody(duneBody);
  const wallets = uniqueWallets(walletsFromDuneRows(rows));

  if (!wallets.length) {
    const err = new Error('No wallets parsed from Dune results');
    err.status = 422;
    err.rowCount = rows.length;
    err.sampleKeys = rows[0] ? Object.keys(rows[0]) : [];
    throw err;
  }

  const saved = await saveStore({
    wallets: wallets,
    updatedAt: new Date().toISOString(),
    source: 'dune:query:' + queryId,
    queryId: queryId
  });

  return {
    count: saved.data.count,
    updatedAt: saved.data.updatedAt,
    source: saved.data.source,
    wrote: saved.wrote,
    queryId: saved.data.queryId,
    rowCount: rows.length
  };
}

module.exports = {
  fetchDuneResults,
  rowsFromDuneBody,
  syncFromDune,
  uniqueWallets
};
