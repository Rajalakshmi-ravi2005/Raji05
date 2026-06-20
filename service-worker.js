/**
 * BOOST – service-worker.js
 * Provides offline support, app-shell caching, and update handling.
 *
 * Strategy:
 *  - App shell (HTML/CSS/JS/manifest/icons): cache-first, falls back to network
 *  - Firebase / API calls: network-first, never cached (always need live data)
 *  - Everything else same-origin: stale-while-revalidate
 */

'use strict';

const CACHE_VERSION = 'boost-v1.0.0';
const CACHE_NAME     = `boost-cache-${CACHE_VERSION}`;

// Files that make up the installable app shell.
// Keep this list in sync with the files actually shipped.
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './firebase.js',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// Domains that should NEVER be served from cache (live data only).
const NETWORK_ONLY_HOSTS = [
  'firebaseio.com',
  'firebaseapp.com',
  'googleapis.com',
  'gstatic.com', // firebase SDK + fonts — handled separately below for fonts
];

/* ── INSTALL ───────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('[SW] Cache addAll failed (some assets missing):', err))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ──────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME && key.startsWith('boost-cache-'))
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH ─────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Never intercept Firebase / Google API calls — always go to network
  if (NETWORK_ONLY_HOSTS.some(host => url.hostname.includes(host))) {
    // Special-case: Google Fonts CSS/files can be cached for offline use
    if (url.hostname.includes('fonts.g')) {
      event.respondWith(staleWhileRevalidate(request));
    }
    return; // let it hit network normally (Firebase realtime data, etc.)
  }

  // App shell & same-origin assets
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: stale-while-revalidate for any other same-site resource
  event.respondWith(staleWhileRevalidate(request));
});

/* ── Strategies ────────────────────────────────────────────────── */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline fallback — serve the app shell index for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline – content not cached.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // network failed, fall back to cache if we have it

  return cached || networkFetch;
}

/* ── MESSAGE (manual cache update trigger from app) ───────────── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});

/* ── BACKGROUND SYNC (placeholder for future offline action queue) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'boost-sync-actions') {
    // Hook point: replay queued game actions once back online.
    // App-side code should listen for 'online' events and flush its own queue;
    // this is registered here so browsers that support Background Sync can
    // wake the SW to do so even if the tab is closed.
    event.waitUntil(Promise.resolve());
  }
});

/* ── PUSH NOTIFICATIONS (placeholder, opt-in) ─────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: 'BOOST', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'BOOST', {
      body: payload.body || "It's your turn!",
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientsArr => {
      const existing = clientsArr.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});
