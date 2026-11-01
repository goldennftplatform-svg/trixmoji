/**
 * Merge X OAuth secrets into local .env without wiping other keys.
 * Usage: node dev/scripts/set-x-login.mjs --id ID --secret SECRET
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const envPath = path.join(root, '.env');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return '';
  return String(process.argv[i + 1] || '').trim();
}

const id = arg('id');
const secret = arg('secret');
if (!id || !secret) {
  console.error('Need --id CLIENT_ID --secret CLIENT_SECRET');
  process.exit(1);
}

const session = crypto.randomBytes(32).toString('hex');
const pairs = {
  X_CLIENT_ID: id,
  X_CLIENT_SECRET: secret,
  X_SESSION_SECRET: session,
  X_REDIRECT_URI: 'http://127.0.0.1:8890/api/auth/x'
};

let lines = [];
if (fs.existsSync(envPath)) {
  lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
}

const seen = new Set();
const next = lines.map(function (line) {
  const t = line.trim();
  if (!t || t.startsWith('#') || t.indexOf('=') < 1) return line;
  const key = t.slice(0, t.indexOf('=')).trim();
  if (pairs[key] != null) {
    seen.add(key);
    return key + '=' + pairs[key];
  }
  return line;
});

if (!seen.has('X_CLIENT_ID')) {
  next.push('');
  next.push('# --- Sign in with X (identity only) ---');
}
Object.keys(pairs).forEach(function (k) {
  if (!seen.has(k)) next.push(k + '=' + pairs[k]);
});

fs.writeFileSync(envPath, next.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf8');
console.log('Wrote X login keys into .env (other keys kept).');
console.log('Restart START-SITE.bat then open /classic/pages/arcade/x-connect.html');
