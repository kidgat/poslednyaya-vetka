
/* ============================ ENV (PROD / DEV) =========================== */
/* ENV:BEGIN — окружение по адресу. PROD — kidgat.github.io/poslednyaya-vetka/ (и всё, что не DEV: локальные файлы, тесты).
   DEV — тестовая публикация: *.pages.dev (Cloudflare Pages, ветка dev) или папка /poslednyaya-vetka-dev/ (отдельный GitHub Pages-проект).
   В DEV сохранения живут под pv.dev.* — ключи PROD (pv.power.v1, pv.scavenge.v1, pv.visual.v1) не читаются и не пишутся.
   Код одинаковый для обеих публикаций: на адресе PROD он никогда не возьмёт тестовые сохранения. */
function detectEnv(loc) {
  if (!loc || !loc.hostname) return 'prod';
  if (/\.pages\.dev$/i.test(loc.hostname) || /^\/poslednyaya-vetka-dev(\/|$)/.test(loc.pathname || '')) return 'dev';
  return 'prod';
}
function envSaveKey(env, key) { return env === 'dev' ? key.replace(/^pv\./, 'pv.dev.') : key; }
/* ENV:END */
const ENV = detectEnv(typeof location === 'undefined' ? null : location);
const saveKey = key => envSaveKey(ENV, key);

