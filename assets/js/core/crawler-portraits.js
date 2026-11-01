/* Corner portraits for the two Crawlers Franc holds.
   #195 Cormocephalus Metuensenus and #266 Mecistocephalus Gila.
   Slava Rybin, CC BY-NC-ND 4.0. The creature code stays on IPFS.
   A click runs his CrawlerBookmarklet.launch on this page.
   Home and the hubs do not get the portraits. */
(function () {
  'use strict';

  if (window.__DOSWAPZ_CRAWLERS__) return;
  window.__DOSWAPZ_CRAWLERS__ = true;

  var HTML_CID = 'bafybeifc5ttdxw5gjfdqb3nfsaj2xmppswn4r6lkd5xu7itiaf6obr2lum';
  var IMG_CID = 'bafybeighwiirpsdzrvpnpensj53jxgdfki72nbkdyvakqzrbodbctmavky';
  var HTML_GATES = [
    'https://ipfs.filebase.io/ipfs/',
    'https://w3s.link/ipfs/',
    'https://dweb.link/ipfs/'
  ];
  var CRAWLERS = [
    { id: 195, name: 'Cormocephalus Metuensenus', file: '0195-cormocephalus-metuensenus' },
    { id: 266, name: 'Mecistocephalus Gila', file: '0266-mecistocephalus-gila' }
  ];

  function pathName() {
    var path = '/';
    try { path = decodeURIComponent(location.pathname || '/'); } catch (e) { path = location.pathname || '/'; }
    path = path.replace(/\/+$/, '') || '/';
    return path.toLowerCase();
  }

  function isHomeOrHub(path) {
    if (path === '/' || path === '/index.html' || path === '/portal.html' || path === '/portal') return true;
    if (path === '/past' || path === '/present' || path === '/future') return true;
    if (path === '/classic/hub' || path === '/classic/hub.html') return true;
    if (path === '/orbit/hub' || path === '/orbit/hub.html') return true;
    if (path === '/future/hub' || path === '/future/hub.html') return true;
    if (path === '/hub' || path === '/hub.html') return true;
    if (path === '/orbit/test-hub' || path === '/orbit/test-hub.html') return true;
    if (/\/hub(\.html)?$/.test(path)) return true;
    if (/\/hub\/(past|present)$/.test(path)) return true;
    if (/\/test-hub(\.html)?$/.test(path)) return true;
    return false;
  }

  if (isHomeOrHub(pathName())) return;

  var state = { active: 0, ticket: 0, packs: {}, homeTimer: 0 };
  var dock = null;
  var statusEl = null;

  function portraitUrl(crawler) {
    return 'https://gateway.pinata.cloud/ipfs/' + IMG_CID + '/' + crawler.file + '.jpg';
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
  }

  function paint() {
    if (!dock) return;
    var buttons = dock.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var on = String(state.active) === buttons[i].getAttribute('data-crawler-id');
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function lift() {
    if (!dock) return;
    document.documentElement.appendChild(dock);
    dock.style.zIndex = '2147483647';
  }

  function watchHome() {
    if (state.homeTimer) return;
    state.homeTimer = window.setInterval(function () {
      if (window.__crawlers_living_artwork_v2__) return;
      window.clearInterval(state.homeTimer);
      state.homeTimer = 0;
      if (!state.active) return;
      state.active = 0;
      paint();
      if (dock) dock.style.zIndex = '';
    }, 400);
  }

  function gunzipB64(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (typeof DecompressionStream !== 'function') {
      return Promise.reject(new Error('This browser cannot open the crawler.'));
    }
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }

  function unpack(html) {
    var marker = '{"page":"';
    var at = html.indexOf(marker);
    if (at < 0) throw new Error('Crawler file has no page.');
    var start = at + marker.length;
    var mid = html.indexOf('","canvas":"', start);
    var end = mid >= 0 ? mid : html.indexOf('"}', start);
    return gunzipB64(html.slice(start, end)).then(function (page) {
      var doc = new DOMParser().parseFromString(page, 'text/html');
      var book = doc.getElementById('crawler-bookmark-data');
      var data = doc.getElementById('crawler-data');
      var runtime = doc.getElementById('crawler-runtime');
      if (!book || !data || !runtime) throw new Error('Crawler file is missing its release.');
      var pack = JSON.parse(book.textContent);
      return {
        launcher: pack.launcher,
        css: pack.css,
        snapshot: JSON.parse(data.textContent),
        runtime: runtime.textContent
      };
    });
  }

  function fetchHtml(file) {
    var path = HTML_CID + '/' + file + '.html';
    var i = 0;
    function next(err) {
      if (i >= HTML_GATES.length) return Promise.reject(err || new Error('Crawler file did not load.'));
      var url = HTML_GATES[i++] + path;
      return fetch(url, { mode: 'cors', credentials: 'omit' }).then(function (res) {
        if (!res.ok) throw new Error('Crawler file did not load.');
        return res.text();
      }).catch(next);
    }
    return next();
  }

  function loadPack(crawler) {
    if (state.packs[crawler.id]) return Promise.resolve(state.packs[crawler.id]);
    return fetchHtml(crawler.file).then(unpack).then(function (pack) {
      state.packs[crawler.id] = pack;
      return pack;
    });
  }

  function release(crawler, ticket) {
    setStatus('Waking ' + crawler.name + '…');
    return loadPack(crawler).then(function (pack) {
      if (ticket !== state.ticket || state.active !== crawler.id) return;
      var run = new Function('__crawlers_artwork_view__', pack.runtime);
      window.eval(pack.launcher);
      if (!window.CrawlerBookmarklet || typeof window.CrawlerBookmarklet.launch !== 'function') {
        throw new Error('Crawler release did not start.');
      }
      window.CrawlerBookmarklet.launch(run, pack.snapshot, pack.css);
      lift();
      watchHome();
      setStatus('');
    }).catch(function (err) {
      if (ticket !== state.ticket) return;
      state.active = 0;
      paint();
      setStatus(err && err.message ? err.message : 'Crawler did not wake.');
    });
  }

  function onClick(crawler) {
    var ticket = ++state.ticket;
    var living = window.__crawlers_living_artwork_v2__;
    if (living && typeof living.stop === 'function') living.stop();
    if (state.active === crawler.id) {
      state.active = 0;
      paint();
      setStatus('');
      if (dock) dock.style.zIndex = '';
      return;
    }
    state.active = crawler.id;
    paint();
    release(crawler, ticket);
  }

  function mount() {
    if (document.getElementById('dosCrawlerPortraits')) return;
    var style = document.createElement('style');
    style.id = 'dosCrawlerPortraitStyle';
    style.textContent = [
      '#dosCrawlerPortraits{position:fixed;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:100000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin:0;padding:0;border:0;background:transparent;pointer-events:none}',
      '#dosCrawlerPortraits button{pointer-events:auto;width:42px;height:42px;padding:0;border:1px solid rgba(255,255,255,.55);border-radius:2px;background:#000;cursor:pointer;overflow:hidden}',
      '#dosCrawlerPortraits button[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 1px #fff}',
      '#dosCrawlerPortraits img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
      '#dosCrawlerPortraits p{pointer-events:none;margin:0;max-width:160px;color:#ddd;background:rgba(0,0,0,.82);font:11px/1.3 system-ui,sans-serif;padding:4px 6px}'
    ].join('');
    document.head.appendChild(style);

    dock = document.createElement('div');
    dock.id = 'dosCrawlerPortraits';
    dock.className = 'crawler-canvas-button';
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'Crawlers by Slava Rybin');

    CRAWLERS.forEach(function (crawler) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'crawler-canvas-button';
      button.setAttribute('data-crawler-id', String(crawler.id));
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Release ' + crawler.name + ', token ' + crawler.id + '. Escape sends it home.');
      button.title = crawler.name + ' #' + crawler.id;
      var img = document.createElement('img');
      img.alt = '';
      img.src = portraitUrl(crawler);
      button.appendChild(img);
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        onClick(crawler);
      });
      dock.appendChild(button);
    });

    statusEl = document.createElement('p');
    statusEl.hidden = true;
    dock.appendChild(statusEl);
    document.documentElement.appendChild(dock);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
