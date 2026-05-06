// Minimal offline-first service worker. Bumps cache version on each release.
const CACHE = 'chess-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/main.js',
  './js/notification.js',
  './js/piece.js',
  './js/fen.js',
  './js/pgn.js',
  './js/moves.js',
  './js/board.js',
  './js/sideboard.js',
  './js/evalbar.js',
  './js/promotion.js',
  './js/audio.js',
  './js/haptics.js',
  './js/settings.js',
  './js/swipe.js',
  './js/engine.js',
  './js/engine-worker.js',
  './js/coach.js',
  './js/puzzles.js',
  './js/game.js',
  './js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './icons/pieces/wK.svg', './icons/pieces/wQ.svg', './icons/pieces/wR.svg',
  './icons/pieces/wB.svg', './icons/pieces/wN.svg', './icons/pieces/wP.svg',
  './icons/pieces/bK.svg', './icons/pieces/bQ.svg', './icons/pieces/bR.svg',
  './icons/pieces/bB.svg', './icons/pieces/bN.svg', './icons/pieces/bP.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
