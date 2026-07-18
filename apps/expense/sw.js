// sw.js — Service Worker cho Quản Lý Chi Tiêu
const CACHE = 'expense-v1';
const ASSETS = [
  'expense.html',
  'expense.js',
  'expense.css',
  'manifest.json',
  'icon.svg',
  'icon-72.png',
  'icon-192.png',
  'icon-512.png',
  '../../style.css',
  '../../status-bar.css',
  '../../top-nav.js',
  '../../bottom-nav.js',
  '../../points.js'
];

// Install: cache assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, fallback to network
self.addEventListener('fetch', e => {
  // Skip non-GET and external URLs
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Only cache same-origin or CDN
  if (!url.href.startsWith(self.location.origin) &&
      !url.href.startsWith('https://cdn.jsdelivr.net') &&
      !url.href.startsWith('https://www.gstatic.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful responses for next time
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback for navigation
        if (e.request.mode === 'navigate') {
          return caches.match('expense.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
