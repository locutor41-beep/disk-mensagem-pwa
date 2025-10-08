const CACHE_NAME = 'disk-mensagem-cache-v1';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.json'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k)))).then(self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Network-first for Supabase and APIs; cache-first for static
  if (/supabase\.co|supabase\.in/.test(request.url)) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, copy));
      return resp;
    }).catch(() => cached))
  );
});
