'use strict'
// Loopback-only preview of the real page/API. Sales remain paused unless explicitly enabled.
const http = require('http')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../..')
const handler = require('../../api/ethscriptions')
http.createServer(async (req, res) => {
 try {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/api/ethscriptions') {
   // Local preview is read-only. Tests intercept POST in the browser.
   if (req.method !== 'GET') { res.writeHead(405); res.end('Read-only preview'); return }
   res.status = n => { res.statusCode = n; return res }
   res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
   await handler(req, res); return
  }
  const rel = url.pathname === '/ethscriptions/past' ? '/classic/pages/ethscriptions.html' : url.pathname
  if (!(rel.startsWith('/assets/') || ['/classic/pages/ethscriptions.html', '/classic/pages/phunk-setup.html', '/docs/phunk-launch.md'].includes(rel))) { res.writeHead(404); res.end(); return }
  const file = path.resolve(root, '.' + decodeURIComponent(rel))
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return }
  const data = await fs.promises.readFile(file)
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream')
  res.end(data)
 } catch (e) { res.writeHead(500); res.end(e.message) }
}).listen(8894, '127.0.0.1', () => console.log('Mint preview: http://127.0.0.1:8894/ethscriptions/past#collections'))
