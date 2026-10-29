/* Этап 0 (PROD / DEV): окружение по адресу, ключи сохранений и префикс кэша service worker.
   Блок ENV:BEGIN/END вынимается из index.html, начало sw.js выполняется с подставным self.location. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const { detectEnv, envSaveKey } = Function(`${src.slice(src.indexOf('/* ENV:BEGIN'), src.indexOf('/* ENV:END */'))}; return { detectEnv, envSaveKey };`)();
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const swHead = sw.slice(0, sw.indexOf('const SCOPE'));
const swEnv = href => Function('self', `${swHead}; return { DEV, PREFIX, CACHE, FILES };`)({ location: new URL(href) });
let pass = 0, fail = 0;
const ok = (n, c, i = '') => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  [' + i + ']' : ''}`); };
const U = s => new URL(s);
const PROD = 'https://kidgat.github.io/poslednyaya-vetka/', CF = 'https://poslednyaya-vetka.pages.dev/', GHDEV = 'https://kidgat.github.io/poslednyaya-vetka-dev/';
ok('E01 адрес PROD → prod', detectEnv(U(PROD)) === 'prod' && detectEnv(U(PROD + 'index.html')) === 'prod');
ok('E02 Cloudflare Pages (*.pages.dev, в т.ч. превью веток) → dev', detectEnv(U(CF)) === 'dev' && detectEnv(U('https://dev.poslednyaya-vetka.pages.dev/index.html')) === 'dev');
ok('E03 отдельный GitHub Pages-проект /poslednyaya-vetka-dev/ → dev', detectEnv(U(GHDEV)) === 'dev' && detectEnv(U(GHDEV + 'index.html')) === 'dev');
ok('E04 похожие адреса не путаются: /poslednyaya-vetka/ и /poslednyaya-vetka-devX/ → prod', detectEnv(U('https://kidgat.github.io/poslednyaya-vetka/dev/')) === 'prod' && detectEnv(U('https://kidgat.github.io/poslednyaya-vetka-devX/')) === 'prod');
ok('E05 локальный файл, localhost, без location → prod (тесты и разработка на прежних ключах)', detectEnv(U('file:///home/x/index.html')) === 'prod' && detectEnv(U('http://localhost:8000/')) === 'prod' && detectEnv(null) === 'prod');
const K = ['pv.power.v1', 'pv.scavenge.v1', 'pv.visual.v1'];
ok('E06 PROD: ключи сохранений без изменений', K.every(k => envSaveKey('prod', k) === k));
ok('E07 DEV: свои ключи pv.dev.*, ни один не совпадает с PROD', K.every(k => envSaveKey('dev', k) === k.replace('pv.', 'pv.dev.')) && K.every(k => !K.includes(envSaveKey('dev', k))));
ok('E08 index.html: все чтения и записи localStorage идут через saveKey', !/localStorage\.(get|set|remove)Item\((?!saveKey\()/.test(src));
const p = swEnv(PROD + 'sw.js'), c = swEnv(CF + 'sw.js'), g = swEnv(GHDEV + 'sw.js');
ok('E09 service worker PROD: префикс кэша poslednyaya-vetka-, манифест прежний', !p.DEV && p.PREFIX === 'poslednyaya-vetka-' && p.FILES.includes('./manifest.webmanifest'));
ok('E10 service worker DEV: префикс pv-dev- (не начинается с префикса PROD), свой манифест', c.DEV && g.DEV && c.PREFIX === 'pv-dev-' && g.PREFIX === 'pv-dev-' && !c.CACHE.startsWith(p.PREFIX) && c.FILES.includes('./manifest-dev.webmanifest'));
ok('E11 окружение SW совпадает с окружением страницы на тех же адресах', [PROD, CF, GHDEV, 'http://localhost:8000/'].every(h => swEnv(h + 'sw.js').DEV === (detectEnv(U(h)) === 'dev')));
const md = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest-dev.webmanifest'), 'utf8'));
ok('E12 манифест DEV: имя с пометкой DEV, область — своя папка', /DEV/.test(md.name) && /DEV/.test(md.short_name) && md.scope === './');
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
