/* Офлайн-режим «Последней ветки».
   При первом открытии с интернетом кладёт игру в кэш браузера; дальше она запускается без сети.
   При выпуске новой версии поменяйте CACHE — браузер скачает файлы заново и удалит старый кэш игры.
   Кэши других приложений на том же сайте не трогаются: удаляются только наши, с префиксом PREFIX. */
const PREFIX = 'poslednyaya-vetka-';
const CACHE = PREFIX + '0.5.2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];
const SCOPE = new URL('./', self.location).pathname;             // папка игры на сервере

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Только GET-запросы к файлам самой игры (тот же сайт, та же папка). Остальное идёт мимо кэша.
// Сначала кэш (мгновенно и без сети), в фоне — обновление из сети, если она есть.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => cached);
    return cached || network;
  }));
});
