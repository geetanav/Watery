// Watery service worker
// Handles: offline caching (required for installability) + scheduled
// reminder notifications that fire even when the app isn't open.

const CACHE_NAME = 'watery-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// ---- Reminder scheduling ----
// The page posts the current reminder list to the service worker.
// The worker re-checks against the clock on a recurring basis so
// notifications can fire even if the app tab isn't focused.

let reminders = [];   // [{id, time:"HH:MM", on:true}]
let firedToday = {};  // "id_YYYY-MM-DD" -> true
let checkTimer = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function checkReminders() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const current = `${hh}:${mm}`;
  const day = todayKey();

  reminders.forEach((r) => {
    if (!r.on) return;
    if (r.time !== current) return;
    const fireKey = `${r.id}_${day}`;
    if (firedToday[fireKey]) return;
    firedToday[fireKey] = true;

    self.registration.showNotification('Watery', {
      body: 'Time to drink some water 💧',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: r.id,
      renotify: true
    });
  });
}

function startTimer() {
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(checkReminders, 30000);
  checkReminders();
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SET_REMINDERS') {
    reminders = data.reminders || [];
    startTimer();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

startTimer();
