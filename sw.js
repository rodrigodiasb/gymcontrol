const CACHE_NAME = 'gymcontrol-v1';
const FILES = [
  '/', '/index.html', '/css/styles.css', '/js/app.js', '/js/db.js', '/manifest.json'
];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache=> cache.addAll(FILES)));
});

self.addEventListener('fetch', evt => {
  evt.respondWith(caches.match(evt.request).then(resp => resp || fetch(evt.request)));
});
