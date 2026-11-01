/**
 * Grok X post gate — pending drafts + YES/NO decisions.
 * Seed file + Netlify blobs / local JSON for status.
 */
const fs = require('fs');
const path = require('path');

const BLOB_STORE = 'x-gate';
const BLOB_KEY = 'queue';
const SEED_PATH = path.join(__dirname, '..', '..', 'assets', 'data', 'x-gate-queue.json');
const LOCAL_PATH = path.join(__dirname, '..', '..', 'dev', 'x-gate-queue.json');

function emptyAuto() {
  return { cadence: 'off', lastDueAt: null, lastApprovedAt: null };
}

function emptyState() {
  return { updatedAt: null, auto: emptyAuto(), posts: [] };
}

function intervalMs(cadence) {
  switch (String(cadence || 'off')) {
    case 'hourly':
      return 60 * 60 * 1000;
    case 'every2h':
      return 2 * 60 * 60 * 1000;
    case 'daily':
      return 24 * 60 * 60 * 1000;
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function normalizeCadence(raw) {
  const c = String(raw || 'off').toLowerCase();
  if (c === 'hourly' || c === 'every2h' || c === 'daily' || c === 'weekly' || c === 'off') return c;
  return 'off';
}

function nextPending(state) {
  const posts = (state && state.posts) || [];
  for (let i = 0; i < posts.length; i++) {
    if (posts[i] && posts[i].status === 'pending') return posts[i];
  }
  return null;
}

function dueInfo(state) {
  const auto = (state && state.auto) || emptyAuto();
  const cadence = normalizeCadence(auto.cadence);
  const ms = intervalMs(cadence);
  const next = nextPending(state);
  if (!ms || !next) {
    return { cadence: cadence, dueNow: null, nextDueAt: null, remaining: next ? 1 : 0 };
  }
  const last = Date.parse(auto.lastDueAt || auto.lastApprovedAt || 0);
  const due = !last || Date.now() - last >= ms;
  const nextDueAt = last ? new Date(last + ms).toISOString() : new Date().toISOString();
  return {
    cadence: cadence,
    dueNow: due ? next : null,
    nextDueAt: due ? new Date().toISOString() : nextDueAt,
    remaining: (state.posts || []).filter((p) => p && p.status === 'pending').length
  };
}

function connectNetlifyBlobs(event) {
  if (!event) return false;
  try {
    const { connectLambda, setEnvironmentContext } = require('@netlify/blobs');
    if (event && event.blobs && typeof connectLambda === 'function') {
      connectLambda(event);
      return true;
    }
    if (process.env.NETLIFY_BLOBS_CONTEXT && typeof setEnvironmentContext === 'function') {
      try {
        const ctx = process.env.NETLIFY_BLOBS_CONTEXT;
        if (typeof ctx === 'string' && ctx.charAt(0) === '{') {
          setEnvironmentContext(JSON.parse(ctx));
          return true;
        }
      } catch (e2) {}
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function getBlobStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    if (typeof getStore !== 'function') return null;
    try {
      return getStore({ name: BLOB_STORE, consistency: 'strong' });
    } catch (e1) {
      try {
        return getStore(BLOB_STORE);
      } catch (e2) {
        return null;
      }
    }
  } catch (e) {
    return null;
  }
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

function seedPosts() {
  const seed = readJsonFile(SEED_PATH);
  const list = seed && Array.isArray(seed.posts) ? seed.posts : [];
  return list
    .filter((p) => p && p.id && p.text)
    .map((p) => ({
      id: String(p.id),
      text: String(p.text).trim(),
      status: 'pending',
      createdAt: p.createdAt || seed.updatedAt || null
    }));
}

function mergeSeed(state) {
  const out = state && Array.isArray(state.posts) ? state : emptyState();
  if (!out.auto) out.auto = emptyAuto();
  out.auto.cadence = normalizeCadence(out.auto.cadence);
  const byId = {};
  out.posts.forEach((p) => {
    if (p && p.id) byId[p.id] = p;
  });
  seedPosts().forEach((seed) => {
    if (!byId[seed.id]) {
      out.posts.push(seed);
      byId[seed.id] = seed;
    } else if (seed.text && byId[seed.id].status === 'pending') {
      byId[seed.id].text = seed.text;
    }
  });
  return out;
}

async function loadState() {
  const blob = await getBlobStore();
  if (blob) {
    try {
      const raw = await blob.get(BLOB_KEY, { type: 'json' });
      if (raw) return mergeSeed(raw);
    } catch (e) {}
  }
  const local = readJsonFile(LOCAL_PATH);
  if (local) return mergeSeed(local);
  return mergeSeed(emptyState());
}

async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  const blob = await getBlobStore();
  if (blob) {
    await blob.setJSON(BLOB_KEY, state);
    return;
  }
  try {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function allowedHandles() {
  const raw = String(process.env.X_GATE_HANDLES || 'BATTLE__BUDIEZ')
    .split(',')
    .map((s) => s.replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean);
  return raw.length ? raw : ['battle__budiez'];
}

function isAllowed(user) {
  if (!user || !user.username) return false;
  return allowedHandles().indexOf(String(user.username).replace(/^@/, '').toLowerCase()) >= 0;
}

async function queueDraft(text, idPrefix) {
  const body = String(text || '').trim();
  if (!body) return null;
  const prefix = String(idPrefix || 'deploy').slice(0, 40);
  const state = await loadState();
  state.posts = Array.isArray(state.posts) ? state.posts : [];
  const dup = state.posts.find(function (p) {
    return p && p.text === body;
  });
  if (dup) return dup;
  const post = {
    id: prefix + '-' + Date.now(),
    text: body,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  state.posts.unshift(post);
  await saveState(state);
  return post;
}

module.exports = {
  connectNetlifyBlobs,
  loadState,
  saveState,
  queueDraft,
  allowedHandles,
  isAllowed,
  emptyAuto,
  normalizeCadence,
  intervalMs,
  dueInfo,
  nextPending
};
