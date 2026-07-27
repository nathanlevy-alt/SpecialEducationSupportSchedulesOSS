// Support Schedules — service worker
// PROTOTYPE STATE: this is structurally what a real service worker needs (install/activate
// lifecycle, a push event listener), but there is no real backend sending push messages yet —
// see the "engineer the backend" step this prototype is meant to justify before building.
// Nothing here talks to a server. Safe to install and test on a real device today.

const CACHE_NAME = 'support-schedules-v05418ef';
const CORE_ASSETS = ['./manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.mode === 'navigate' || url.pathname === '/app' || url.pathname === '/app/' || url.pathname === '/app/index.html') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});

// This is the real mechanism a future backend would trigger. Once device registration and a
// push-sending endpoint exist server-side, a message sent via Web Push arrives here even if
// the app is fully closed, and this is what turns it into a visible notification.
self.addEventListener('push', (event) => {
  let data = { title: 'Support Schedules', body: 'You have a new update.' };
  try { if (event.data) data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./index.html');
    })
  );
});
