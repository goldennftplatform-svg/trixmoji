/**
 * DOSWAPZ local site server
 * - Static files from project root
 * - All /api/* handlers (same as Netlify/Vercel)
 * Usage: node start-site-server.js
 * Optional: .env (XAI_API_KEY, SOLANA_RPC_URL, KV_*, HELIUS_API_KEY, ...)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { URL } = require('url');

const ROOT = path.resolve(__dirname);
const PORT = 8890;
const HOST = '0.0.0.0';
const BODY_LIMIT = 2.5 * 1024 * 1024; // attic images etc.

// Load .env
(function loadEnv() {
 try {
 const envPath = path.join(ROOT, '.env');
 if (!fs.existsSync(envPath)) return;
 fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(function (line) {
 const t = line.trim();
 if (!t || t.startsWith('#')) return;
 const i = t.indexOf('=');
 if (i < 1) return;
 const key = t.slice(0, i).trim();
 let val = t.slice(i + 1).trim();
 if (
 (val.startsWith('"') && val.endsWith('"')) ||
 (val.startsWith("'") && val.endsWith("'"))
 ) {
 val = val.slice(1, -1);
 }
 if (key && process.env[key] == null) process.env[key] = val;
 });
 console.log(' Loaded .env');
 } catch (e) {
 /* ignore */
 }
})();

// Auto-load every api/*.js handler (not lib/)
const API_HANDLERS = {};
(function loadApis() {
 const apiDir = path.join(ROOT, 'api');
 fs.readdirSync(apiDir).forEach(function (name) {
 if (!name.endsWith('.js')) return;
 const base = name.slice(0, -3);
 try {
 API_HANDLERS[base] = require(path.join(apiDir, name));
 } catch (e) {
 console.warn(' WARN: failed to load api/' + name + ' - ' + e.message);
 }
 });
 console.log(' APIs: ' + Object.keys(API_HANDLERS).sort().join(', '));
})();

const MIME = {
 '.html': 'text/html; charset=utf-8',
 '.htm': 'text/html; charset=utf-8',
 '.js': 'text/javascript; charset=utf-8',
 '.mjs': 'text/javascript; charset=utf-8',
 '.css': 'text/css; charset=utf-8',
 '.json': 'application/json',
 '.png': 'image/png',
 '.jpg': 'image/jpeg',
 '.jpeg': 'image/jpeg',
 '.gif': 'image/gif',
 '.svg': 'image/svg+xml',
 '.webp': 'image/webp',
 '.mp4': 'video/mp4',
 '.webm': 'video/webm',
 '.ico': 'image/x-icon',
 '.woff': 'font/woff',
 '.woff2': 'font/woff2',
 '.ttf': 'font/ttf',
 '.txt': 'text/plain; charset=utf-8',
 '.map': 'application/json',
 '.wasm': 'application/wasm',
 '.xml': 'application/xml',
 '.webmanifest': 'application/manifest+json'
};

function safePath(urlPath) {
 try {
 let decoded = decodeURIComponent(String(urlPath || '/').split('?')[0].split('#')[0]);
 decoded = decoded.replace(/^\/+/, '');
 if (!decoded) decoded = 'index.html';
 const full = path.resolve(ROOT, decoded);
 const rel = path.relative(ROOT, full);
 if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
 const top = rel.split(path.sep)[0];
 if (top === '.data' || top === '.netlify' || top === '.vercel' || top === '.env' || top.indexOf('.env') === 0) return null;
 return full;
 } catch (e) {
 return null;
 }
}

function send(res, code, type, body) {
 res.writeHead(code, {
 'Content-Type': type,
 'Cache-Control': 'no-store',
 'Access-Control-Allow-Origin': '*'
 });
 res.end(body);
}

function readBody(req) {
 return new Promise(function (resolve) {
 var chunks = [];
 var size = 0;
 req.on('data', function (c) {
 size += c.length;
 if (size > BODY_LIMIT) {
 resolve({ __tooLarge: true });
 req.destroy();
 return;
 }
 chunks.push(c);
 });
 req.on('end', function () {
 var raw = Buffer.concat(chunks).toString('utf8');
 if (!raw) return resolve({});
 try {
 resolve(JSON.parse(raw));
 } catch (e) {
 resolve({ __raw: raw });
 }
 });
 req.on('error', function () {
 resolve({});
 });
 });
}

function parseQuery(urlStr) {
 try {
 var u = new URL(urlStr, 'http://127.0.0.1');
 var q = {};
 u.searchParams.forEach(function (v, k) {
 q[k] = v;
 });
 return q;
 } catch (e) {
 return {};
 }
}

function vercelRes(res) {
 var statusCode = 200;
 var headers = {};
 var finished = false;
 function finish(body) {
 if (finished) return;
 finished = true;
 res.writeHead(statusCode, headers);
 res.end(body == null ? '' : body);
 }
 return {
 setHeader: function (k, v) {
 if (String(k).toLowerCase() === 'set-cookie') {
 var list = Array.isArray(v) ? v : [v];
 var prev = headers['Set-Cookie'];
 headers['Set-Cookie'] = (Array.isArray(prev) ? prev : prev ? [prev] : []).concat(list);
 return;
 }
 headers[k] = v;
 },
 status: function (code) {
 statusCode = code;
 return this;
 },
 redirect: function (url) {
 if (!(statusCode >= 300 && statusCode < 400)) statusCode = 302;
 headers['Location'] = url;
 finish('');
 },
 json: function (data) {
 headers['Content-Type'] = headers['Content-Type'] || 'application/json';
 finish(JSON.stringify(data));
 },
 send: function (data) {
 if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
 headers['Content-Type'] = headers['Content-Type'] || 'application/json';
 finish(JSON.stringify(data));
 return;
 }
 finish(data == null ? '' : String(data));
 },
 end: function (body) {
 finish(body == null ? '' : body);
 }
 };
}

async function handleApi(req, res) {
 var urlPath = String(req.url || '').split('?')[0];
 if (urlPath.indexOf('/api/') !== 0) return false;

 var aliases = {
  'auth/x': 'auth-x',
  'auth/me': 'auth-me',
  'auth/logout': 'auth-logout'
 };
 var name = urlPath.slice('/api/'.length).replace(/\/+$/, '');
 if (aliases[name]) name = aliases[name];
 if (!name) {
 send(res, 404, 'application/json', JSON.stringify({ error: 'Unknown API' }));
 return true;
 }

 var handler = API_HANDLERS[name];
 if (!handler) {
 send(res, 404, 'application/json', JSON.stringify({ error: 'Unknown API: ' + name }));
 return true;
 }

 var body = {};
 if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
 body = await readBody(req);
 if (body && body.__tooLarge) {
 send(res, 413, 'application/json', JSON.stringify({ error: 'Body too large' }));
 return true;
 }
 }

 var vReq = {
 method: req.method,
 body: body,
 query: parseQuery(req.url),
 headers: req.headers || {}
 };

 await handler(vReq, vercelRes(res));
 return true;
}

const PAGE_ALIASES = {
 '/meme': '/classic/pages/basement/meme-lab.html',
 '/meme-lab': '/classic/pages/basement/meme-lab.html',
 '/meme-maker': '/classic/pages/basement/meme-lab.html',
 '/x-login': '/classic/pages/arcade/x-connect.html',
 '/x-connect': '/classic/pages/arcade/x-connect.html',
 '/past': '/classic/hub.html',
 '/present': '/orbit/hub.html',
 '/future': '/future/hub.html',
 '/geoffwatch': '/classic/pages/geoffwatch.html',
 '/geoff-watch': '/classic/pages/geoffwatch.html',
 '/harbinger': '/classic/pages/harbinger.html',
 '/quantum/present': '/classic/pages/quantum.html',
 '/account': '/classic/pages/account.html',
 '/account/past': '/classic/pages/account.html',
 '/account/present': '/classic/pages/account.html',
 '/ek': '/classic/pages/ek.html',
 '/ek/past': '/classic/pages/ek.html',
 '/ek/present': '/classic/pages/ek.html',
 '/ethscriptions': '/classic/pages/ethscriptions.html',
 '/ethscriptions/past': '/classic/pages/ethscriptions.html',
 '/ethscriptions/present': '/classic/pages/ethscriptions.html',
 '/ethscriptions/how': '/docs/ethscriptions.html',
 '/social': '/classic/pages/social.html',
 '/social/past': '/classic/pages/social.html',
 '/social/present': '/classic/pages/social.html'
};

const PRETTY_RESERVED = {
 api: 1, assets: 1, classic: 1, orbit: 1, future: 1, docs: 1, netlify: 1,
 apps: 1, extras: 1, images: 1, css: 1, data: 1, js: 1, media: 1, video: 1,
 videos: 1, functions: 1, pages: 1, portal: 1, legal: 1, node_modules: 1
};

function resolvePrettyUrl(reqUrl) {
 var raw = String(reqUrl || '/');
 var pathOnly = raw.split('?')[0];
 var q = raw.indexOf('?') >= 0 ? '?' + raw.split('?').slice(1).join('?') : '';
 var pretty = pathOnly.replace(/\/+$/, '') || '/';
 if (PAGE_ALIASES[pretty]) return PAGE_ALIASES[pretty] + q;
 var m = pretty.match(/^\/(.+)\/(past|present)$/);
 if (!m) return null;
 var rest = m[1];
 var era = m[2];
 var first = rest.split('/')[0].toLowerCase();
 if (PRETTY_RESERVED[first]) return null;
 var root = era === 'present' ? '/orbit/pages/' : '/classic/pages/';
 var candidates = [root + rest + '.html', root + rest + '/index.html', root + rest];
 for (var i = 0; i < candidates.length; i++) {
  var full = safePath(candidates[i]);
  if (!full || !fs.existsSync(full)) continue;
  var st = fs.statSync(full);
  if (st.isFile()) return candidates[i] + q;
  if (st.isDirectory()) {
   var idx = path.join(full, 'index.html');
   if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
    return candidates[i].replace(/\/?$/, '/') + 'index.html' + q;
   }
  }
 }
 return null;
}

const server = http.createServer(async function (req, res) {
 try {
 if (await handleApi(req, res)) return;
 } catch (e) {
 send(res, 500, 'application/json', JSON.stringify({ error: e.message || 'API error' }));
 return;
 }

 if (req.method !== 'GET' && req.method !== 'HEAD') {
 send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
 return;
 }

 var pretty = String(req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
 var mapped = resolvePrettyUrl(req.url);
 if (mapped) req.url = mapped;
 else if (PAGE_ALIASES[pretty]) req.url = PAGE_ALIASES[pretty] + (String(req.url).indexOf('?') >= 0 ? '?' + String(req.url).split('?')[1] : '');
 let filePath = safePath(req.url);
 if (!filePath) {
 send(res, 400, 'text/plain; charset=utf-8', 'Bad path');
 return;
 }

 fs.stat(filePath, function (err, st) {
 if (!err && st && st.isDirectory()) {
 filePath = path.join(filePath, 'index.html');
 fs.stat(filePath, function (err2, st2) {
 if (err2 || !st2 || !st2.isFile()) {
 send(
 res,
 404,
 'text/html; charset=utf-8',
 '<!doctype html><meta charset=utf-8><title>404</title>' +
 '<body style="font-family:system-ui;background:#111;color:#eee;padding:40px">' +
 '<h1>Page not found</h1><p><code>' +
 String(req.url).replace(/</g, '') +
 '</code></p><p><a style="color:#8af" href="/classic/hub.html">Hub</a></p></body>'
 );
 return;
 }
 serveFile(req, res, filePath, st2);
 });
 return;
 }

 if (err || !st || !st.isFile()) {
 send(
 res,
 404,
 'text/html; charset=utf-8',
 '<!doctype html><meta charset=utf-8><title>404</title>' +
 '<body style="font-family:system-ui;background:#111;color:#eee;padding:40px">' +
 '<h1>Page not found</h1><p><code>' +
 String(req.url).replace(/</g, '') +
 '</code></p><p><a style="color:#8af" href="/classic/hub.html">Hub</a></p></body>'
 );
 return;
 }

 serveFile(req, res, filePath, st);
 });
});

/** Serve files with Range support so HTML5 video/audio actually plays. */
function serveFile(req, res, filePath, st) {
 const ext = path.extname(filePath).toLowerCase();
 const type = MIME[ext] || 'application/octet-stream';
 const size = st.size;
 const isMedia = type.indexOf('video/') === 0 || type.indexOf('audio/') === 0;

 const baseHeaders = {
 'Content-Type': type,
 'Accept-Ranges': 'bytes',
 'Cache-Control': 'no-store',
 'Access-Control-Allow-Origin': '*'
 };

 if (req.method === 'HEAD') {
 res.writeHead(200, Object.assign({}, baseHeaders, { 'Content-Length': size }));
 res.end();
 return;
 }

 const range = req.headers.range;
 if (range && isMedia) {
 const m = /^bytes=(\d*)-(\d*)$/i.exec(String(range).trim());
 if (m) {
 let start = m[1] ? parseInt(m[1], 10) : 0;
 let end = m[2] ? parseInt(m[2], 10) : size - 1;
 if (isNaN(start)) start = 0;
 if (isNaN(end) || end >= size) end = size - 1;
 if (start >= size || start > end) {
 res.writeHead(416, Object.assign({}, baseHeaders, {
 'Content-Range': 'bytes */' + size
 }));
 res.end();
 return;
 }
 const chunk = end - start + 1;
 res.writeHead(206, Object.assign({}, baseHeaders, {
 'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
 'Content-Length': chunk
 }));
 fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
 return;
 }
 }

 // Stream media / large files instead of buffering entire body
 if (isMedia || size > 512 * 1024) {
 res.writeHead(200, Object.assign({}, baseHeaders, { 'Content-Length': size }));
 fs.createReadStream(filePath).pipe(res);
 return;
 }

 fs.readFile(filePath, function (readErr, data) {
 if (readErr) {
 send(res, 500, 'text/plain; charset=utf-8', 'Read error');
 return;
 }
 send(res, 200, type, data);
 });
}

server.listen(PORT, HOST, function () {
 const home = 'http://127.0.0.1:' + PORT + '/classic/hub.html';
 console.log('');
 console.log(' DOSWAPZ site is RUNNING');
 console.log(' =======================');
 console.log(' HUB: ' + home);
 console.log(' API: ' + Object.keys(API_HANDLERS).length + ' routes under /api/*');
 console.log(' KEYS: XAI_API_KEY=' + (process.env.XAI_API_KEY ? 'set' : 'no') +
 ' KV=' + (process.env.KV_REST_API_URL ? 'set' : 'no') +
 ' X_LOGIN=' + (process.env.X_CLIENT_ID ? 'set' : 'no') +
 ' SOLANA_RPC=' + (process.env.SOLANA_RPC_URL ? 'set' : 'public'));
 console.log('');
 console.log(' KEEP THIS WINDOW OPEN');
 console.log('');
 if (process.env.DOSWAPZ_NO_OPEN !== '1') exec('cmd /c start "" "' + home + '"');
});

server.on('error', function (err) {
 console.error('');
 console.error(' Could not start on port ' + PORT + ': ' + err.message);
 if (err.code === 'EADDRINUSE') {
 console.error(' Port busy - open http://127.0.0.1:8890/classic/hub.html');
 if (process.env.DOSWAPZ_NO_OPEN !== '1') exec('cmd /c start "" "http://127.0.0.1:8890/classic/hub.html"');
 }
 console.error('');
});
