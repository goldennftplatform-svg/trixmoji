/**
 * One-pass internal link crawl against local server.
 * Usage: node dev/scripts/crawl-site.mjs
 */
import http from 'http';
import { URL } from 'url';

const ORIGIN = process.env.CRAWL_ORIGIN || 'http://127.0.0.1:8890';
const seeds = [
  '/classic/hub.html',
  '/orbit/hub.html',
  '/portal.html',
  '/index.html',
  '/harbinger.html',
  '/classic/pages/harbinger.html'
];
const visited = new Set();
const queue = [...seeds];
const broken = [];
const ok = [];
const skipExt = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|woff2?|ttf|ico|map|json|wav|mp3)$/i;

function get(path) {
  return new Promise((resolve) => {
    const u = new URL(path, ORIGIN);
    const req = http.get(u, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (c) => {
        if (data.length < 2_500_000) data += c;
      });
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          type: res.headers['content-type'] || '',
          body: data,
          url: u.pathname
        })
      );
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message, url: path }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout', url: path });
    });
  });
}

function extractLinks(html, basePath) {
  const links = new Set();
  const re = /(?:href|src)=["']([^"'#]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    let ref = m[1].trim();
    if (!ref || ref.startsWith('data:') || ref.startsWith('mailto:') || ref.startsWith('javascript:')) {
      continue;
    }
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
      if (!ref.startsWith(ORIGIN)) continue;
      ref = ref.slice(ORIGIN.length) || '/';
    }
    if (ref.startsWith('//')) continue;
    if (ref.includes('${')) continue;
    try {
      const abs = new URL(ref, ORIGIN + basePath).pathname;
      if (abs.startsWith('/')) links.add(abs);
    } catch {
      /* ignore */
    }
  }
  return [...links];
}

while (queue.length && visited.size < 300) {
  const path = queue.shift();
  const key = path.split('?')[0];
  if (visited.has(key)) continue;
  visited.add(key);
  const res = await get(key);
  if (!res.status || res.status >= 400) {
    broken.push({ path: key, status: res.status || res.error });
    continue;
  }
  ok.push(key);
  if (skipExt.test(key)) continue;
  if (!String(res.type).includes('html') && !key.endsWith('.html') && key !== '/') continue;
  for (const link of extractLinks(res.body || '', key)) {
    if (!visited.has(link) && !queue.includes(link)) queue.push(link);
  }
}

console.log('VISITED', visited.size);
console.log('OK', ok.length);
console.log('BROKEN', broken.length);
broken.forEach((b) => console.log('FAIL', b.status, b.path));
process.exitCode = broken.length ? 1 : 0;
