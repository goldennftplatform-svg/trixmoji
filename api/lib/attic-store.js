/**
 * Shared Attic post storage helpers (Vercel KV + bundled fallback).
 */

const fs = require('fs');
const path = require('path');

const KV_KEY = 'doswapz:attic-posts';
const DEFAULT_STORE = { posts: [], updatedAt: null };

function readBundled() {
  try {
    const p = path.join(__dirname, '..', '..', 'assets', 'data', 'attic-posts.json');
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

async function getPostById(id) {
  if (!id || typeof id !== 'string') return null;
  const store = await loadStore();
  const posts = store.posts || [];
  return posts.find(function (p) {
    return p.id === id && p.status === 'approved';
  }) || null;
}

module.exports = { loadStore, getPostById, getKv };