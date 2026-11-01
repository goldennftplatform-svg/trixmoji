const CACHE = 'cryptodad-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './privacy-policy.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/cryptodad_colorful/11.jpg',
  './images/toasty-head.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((network) => {
        const copy = network.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copy));
        return network;
      }).catch(() => cached)
    )
  );
});