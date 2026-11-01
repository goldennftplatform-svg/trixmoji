/**
 * DOSWAPZ — Attic drops board store (launch prep).
 * Live polling is OFF unless ATTIC_DROPS_LIVE=1 and secrets are set.
 */

const fs = require('fs');
const path = require('path');

const KV_BOARD_KEY = 'doswapz:attic-drops-board';
const KV_WATCH_KEY = 'doswapz:attic-watchlist';
const KV_EVENTS_KEY = 'doswapz:attic-drop-events';

const STATUSES = new Set(['live', 'preorder', 'upcoming', 'soldout', 'unknown']);
const CATS = new Set(['sports', 'pokemon', 'other']);

function isLiveEnabled() {
  return String(process.env.ATTIC_DROPS_LIVE || '').trim() === '1';
}

function adminSecretOk(req) {
  const want = String(process.env.ATTIC_DROPS_ADMIN_SECRET || '').trim();
  if (!want) return false;
  const got =
    (req.headers && (req.headers['x-attic-admin'] || req.headers['x-attic-drops-secret'])) ||
    '';
  return String(got).trim() === want;
}

function readJson(rel) {
  const p = path.join(__dirname, '..', '..', rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readBundledBoard() {
  try {
    return readJson('assets/data/attic-drops.json');
  } catch (e) {
    return { updated: null, products: [], note: 'missing attic-drops.json' };
  }
}

function readBundledWatchlist() {
  try {
    return readJson('assets/data/attic-watchlist.json');
  } catch (e) {
    return { live: false, products: [], retailers: {} };
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

/**
 * Flatten watchlist product → board product (UI shape for drops.js).
 */
function watchProductToBoard(p) {
  if (!p || !p.id || !p.title) return null;
  const retailers = Array.isArray(p.retailers) ? p.retailers : [];
  const statuses = retailers.map((r) => r.status).filter((s) => STATUSES.has(s));
  let status = p.status;
  if (!STATUSES.has(status)) {
    if (statuses.indexOf('live') >= 0) status = 'live';
    else if (statuses.indexOf('preorder') >= 0) status = 'preorder';
    else if (statuses.indexOf('upcoming') >= 0) status = 'upcoming';
    else if (statuses.indexOf('soldout') >= 0) status = 'soldout';
    else status = 'upcoming';
  }
  const links = retailers
    .filter((r) => r && r.url)
    .map((r) => ({
      label: String(r.label || (r.store || 'LINK')).toUpperCase(),
      href: String(r.url),
      dim: !!r.dim,
      store: r.store || null,
      status: r.status || null
    }));

  return {
    id: String(p.id),
    cat: CATS.has(p.cat) ? p.cat : 'other',
    status: status,
    title: String(p.title),
    brand: String(p.brand || ''),
    date: String(p.date || ''),
    msrp: String(p.msrp || ' - '),
    note: String(p.note || ''),
    links: links,
    retailers: retailers,
    priority: p.priority || 'cold',
    publish: p.publish !== false
  };
}

function boardFromWatchlist(watch) {
  const list = Array.isArray(watch.products) ? watch.products : [];
  const products = list
    .filter((p) => p && p.publish !== false)
    .map(watchProductToBoard)
    .filter(Boolean);
  return {
    updated: watch.updated || new Date().toISOString().slice(0, 10),
    note: watch.note || 'Generated from watchlist',
    source: 'watchlist',
    liveTracking: false,
    products: products
  };
}

async function loadWatchlist() {
  const kv = await getKv();
  if (kv) {
    const stored = await kv.get(KV_WATCH_KEY);
    if (stored && typeof stored === 'object' && Array.isArray(stored.products)) {
      return stored;
    }
  }
  return readBundledWatchlist();
}

async function saveWatchlist(watch) {
  const kv = await getKv();
  if (!kv) return false;
  watch.updated = new Date().toISOString();
  await kv.set(KV_WATCH_KEY, watch);
  return true;
}

async function loadBoard() {
  const kv = await getKv();
  if (kv) {
    const stored = await kv.get(KV_BOARD_KEY);
    if (stored && typeof stored === 'object' && Array.isArray(stored.products)) {
      return stored;
    }
  }
  // Prefer projecting watchlist if present; else static board
  const watch = await loadWatchlist();
  if (watch && Array.isArray(watch.products) && watch.products.length) {
    const board = boardFromWatchlist(watch);
    board.liveTracking = isLiveEnabled() && !!watch.live;
    return board;
  }
  const bundled = readBundledBoard();
  bundled.source = 'bundled-json';
  bundled.liveTracking = false;
  return bundled;
}

async function saveBoard(board) {
  const kv = await getKv();
  if (!kv) return false;
  board.updated = new Date().toISOString();
  await kv.set(KV_BOARD_KEY, board);
  return true;
}

async function pushEvent(evt) {
  const kv = await getKv();
  if (!kv) return false;
  let events = (await kv.get(KV_EVENTS_KEY)) || [];
  if (!Array.isArray(events)) events = [];
  events.unshift(
    Object.assign({ ts: new Date().toISOString() }, evt)
  );
  events = events.slice(0, 100);
  await kv.set(KV_EVENTS_KEY, events);
  return true;
}

async function recentEvents(limit) {
  const kv = await getKv();
  if (!kv) return [];
  const events = (await kv.get(KV_EVENTS_KEY)) || [];
  if (!Array.isArray(events)) return [];
  return events.slice(0, limit || 20);
}

function publicBoardPayload(board) {
  const products = (board.products || []).map((p) => ({
    id: p.id,
    cat: p.cat,
    status: p.status,
    title: p.title,
    brand: p.brand,
    date: p.date,
    msrp: p.msrp,
    note: p.note,
    links: (p.links || []).map((l) => ({
      label: l.label,
      href: l.href,
      dim: !!l.dim
    }))
  }));
  return {
    updated: board.updated || null,
    note: board.note || '',
    source: board.source || 'unknown',
    liveTracking: !!board.liveTracking,
    prepOnly: !isLiveEnabled(),
    products: products
  };
}

module.exports = {
  KV_BOARD_KEY,
  KV_WATCH_KEY,
  KV_EVENTS_KEY,
  STATUSES,
  CATS,
  isLiveEnabled,
  adminSecretOk,
  readBundledBoard,
  readBundledWatchlist,
  loadWatchlist,
  saveWatchlist,
  loadBoard,
  saveBoard,
  boardFromWatchlist,
  watchProductToBoard,
  pushEvent,
  recentEvents,
  publicBoardPayload
};
