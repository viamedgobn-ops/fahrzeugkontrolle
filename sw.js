// Offline-Zwischenspeicher: App läuft auch ohne Netz.
const CACHE = 'fk-v8';
const DATEIEN = ['./', 'index.html', 'style.css', 'app.js', 'pdf.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request)));
});
