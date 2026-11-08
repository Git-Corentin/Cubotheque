// Service worker : le site s'ouvre hors connexion et s'installe comme une application.
// Stratégie « réseau d'abord » pour les pages et scripts du site (les mises à jour arrivent tout de suite),
// « cache d'abord » pour les bibliothèques versionnées, polices et images de la base.
const VERSION = 'cubo-v3';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/main.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const CACHE_FIRST = [/^https:\/\/cdn\.jsdelivr\.net\/npm\/[^/]+@\d/, /^https:\/\/cdn\.cubing\.net\//, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, /\/storage\/v1\/object\/public\//];

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (url.includes('/rest/v1/') || url.includes('/auth/v1/')) return; // jamais de cache pour les données et la connexion
  if (CACHE_FIRST.some((r) => r.test(url))) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (new URL(url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
});
