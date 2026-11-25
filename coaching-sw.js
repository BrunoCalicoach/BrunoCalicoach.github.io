// Offline support for the installed coaching app (coaching.html only; the rest of the site is untouched).
// App files: network first so updates arrive at once, the saved copy when offline.
// Libraries and fonts from CDNs: saved copy first. Supabase requests are never cached here
// (the app keeps its own copy of the athlete's data and queues changes made offline).
const CACHE = 'coaching-v2';
const APP_FILES = ['coaching.html', 'coaching.css?v=1', 'coaching-core.js?v=1', 'coaching.js?v=1', 'coaching-tour.js?v=1', 'coaching.webmanifest',
  'media/coaching-icon-192.png', 'media/coaching-icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('coaching-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  const cdn = /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (url.origin !== location.origin && !cdn) return;

  if (cdn) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  event.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || caches.match('coaching.html'))));
});
