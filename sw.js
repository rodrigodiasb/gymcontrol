const CACHE_NAME = 'gymcontrol-material-v1';
const FILES = ['/', '/index.html', '/css/global.css', '/js/app.js', '/js/db.js', '/manifest.json'];
self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)));
});
self.addEventListener('fetch', evt => {
  evt.respondWith(caches.match(evt.request).then(r=>r||fetch(evt.request)));
});
