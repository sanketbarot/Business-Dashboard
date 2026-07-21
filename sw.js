/* ============================================
   SERVICE WORKER (sw.js)
   AI Toolcor Business Dashboard
   ============================================ */

const CACHE_NAME = 'bd-cache-v1.8';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './transaction.html',
  './analytics.html',
  './manifest.json',
  './favicon.svg',
  './firebase-config.js',
  './assets/css/style.css?v=10.0',
  './assets/css/dashboard.css?v=10.0',
  './assets/css/transaction.css?v=10.0',
  './assets/css/analytics.css?v=10.0',
  './assets/css/animations.css?v=10.0',
  './assets/js/app.js?v=10.0',
  './assets/js/dashboard.js?v=10.0',
  './assets/js/transaction-page.js',
  './assets/js/analytics-page.js?v=10.0',
  './assets/icons/logo.png',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  // CDN scripts
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.31/dist/jspdf.plugin.autotable.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 PWA: Pre-caching static assets');
      return cache.addAll(ASSETS).catch((err) => {
        console.error('⚠️ PWA Cache warning: Failed to cache some assets during install', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ PWA: Clearing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network-first with offline fallback for HTML, Stale-while-revalidate for assets)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip firestore synchronization, auth, or external third-party logging
  if (
    url.origin !== self.location.origin &&
    !e.request.url.startsWith('https://www.gstatic.com/') &&
    !e.request.url.startsWith('https://cdn.jsdelivr.net/') &&
    !e.request.url.startsWith('https://fonts.googleapis.com/') &&
    !e.request.url.startsWith('https://fonts.gstatic.com/')
  ) {
    return;
  }

  // Skip non-GET requests (Firebase, etc.)
  if (e.request.method !== 'GET') return;

  // Check if HTML document (navigation request)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Put updated clone in cache
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          return response;
        })
        .catch(() => {
          // Return cached page or fallback to cached login page
          return caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('./login.html') || caches.match('login.html');
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate strategy for static resources
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return networkResponse;
      }).catch((err) => {
        console.log('📶 PWA: Offline fetch request failed for: ' + e.request.url, err);
      });
      return cachedResponse || fetchPromise;
    })
  );
});
