/**
 * Bump platform swap total in data/swap-stats.json.
 * Usage:
 *   node scripts/bump-swap-count.mjs           # +1
 *   node scripts/bump-swap-count.mjs 5         # set total to 5
 *   node scripts/bump-swap-count.mjs --add 3   # +3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statsPath = path.join(__dirname, '..', 'data', 'swap-stats.json');

function load() {
  return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}

function save(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(statsPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const args = process.argv.slice(2);
let data = load();

if (args[0] === '--add' && args[1]) {
  data.total = (data.total || 0) + Number(args[1]);
} else if (args[0] && !Number.isNaN(Number(args[0]))) {
  data.total = Number(args[0]);
} else {
  data.total = (data.total || 0) + 1;
}

save(data);
console.log('swap-stats.json total =', data.total);