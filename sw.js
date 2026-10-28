/* Офлайн-режим «Последней ветки».
   Стратегия:
   — страница (index.html, навигация): сначала сеть с таймаутом 3 с, при неудаче — кэш.
     Поэтому при доступной сети всегда открывается свежая версия, а без сети или при «полумёртвом» интернете в поезде — сохранённая;
   — остальные файлы игры (иконки, манифест): сначала кэш, в фоне — обновление из сети.
   При выпуске новой версии поменяйте CACHE — старый кэш игры удалится, кэши других приложений не трогаются. */
const PREFIX = 'poslednyaya-vetka-';
const CACHE = PREFIX + '1.0.1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];
const SCOPE = new URL('./', self.location).pathname;             // папка игры на сервере
const NET_TIMEOUT = 3000;

self.addEventListener('install', e => {
  // cache:'reload' — свежие файлы с сервера, мимо HTTP-кэша браузера (иначе новая версия могла бы закэшировать старую страницу)
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/** Запрос в сеть с ограничением по времени; удачный ответ кладётся в кэш (запись привязана к событию). */
function fromNetwork(e, cache, timeout) {
  // страница — с проверкой у сервера (no-cache): HTTP-кэш хостинга (у GitHub Pages ~10 мин) не задерживает новую версию
  const req = timeout ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request;
  const net = fetch(req).then(r => {
    if (r.ok) e.waitUntil(cache.put(e.request, r.clone()));
    return r;
  });
  if (!timeout) return net;
  return Promise.race([net, new Promise((_, fail) => setTimeout(() => fail(new Error('timeout')), timeout))]);
}

// Только GET-запросы к файлам самой игры (тот же сайт, та же папка). Остальное идёт мимо service worker.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  const page = e.request.mode === 'navigate' || url.pathname === SCOPE || url.pathname.endsWith('/index.html');
  e.respondWith(caches.open(CACHE).then(async c => {
    if (page) {
      try { return await fromNetwork(e, c, NET_TIMEOUT); }
      catch (_) { return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error(); }
    }
    const cached = await c.match(e.request, { ignoreSearch: true });
    const update = fromNetwork(e, c, 0).catch(() => cached);
    if (cached) { e.waitUntil(update.then(() => {}, () => {})); return cached; }
    return update;
  }));
});
