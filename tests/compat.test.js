/* TECH-001: защита модульной сборки и старых сохранений. Запуск: node tests/compat.test.js
   1) index.html совпадает со сборкой из src/; каждая пара маркеров BEGIN/END цела и лежит внутри одного модуля.
   2) Ключи сохранений прежние; «живые» записи 1.1.x / 1.2.0 разбираются так же, как до разрезки на модули
      (эталон снят на dev 428a031, до TECH-001). Если тест упал — формат или разбор сохранений изменился: это
      затрагивает сохранения на iPhone и требует отдельного ТЗ с миграцией (канон § 3.6). */
const fs = require('fs'), path = require('path');
const src = require('./_src.js');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (n, c, i = '') => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  [' + i + ']' : ''}`); };
const J = v => JSON.stringify(v);

// ---- 1. Сборка и маркеры ----
ok('C01 index.html побайтно равен сборке из src/ (node tools/build.mjs --check)', fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') === src);
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')]);
const NAMES = ['ENV', 'POWER', 'SCAVENGE', 'STATION', 'SCENE', 'SAVE', 'STREET'];
for (const m of NAMES) {
  const b = `/* ${m}:BEGIN`, e = `/* ${m}:END */`;
  const once = src.split(b).length === 2 && src.split(e).length === 2 && src.indexOf(b) < src.indexOf(e);
  const home = mods.filter(([, t]) => t.includes(b) || t.includes(e));
  ok(`C02 маркеры ${m}:BEGIN/END — ровно по одному, по порядку, в одном модуле`, once && home.length === 1 && home[0][1].includes(b) && home[0][1].includes(e), home.map(h => h[0]).join());
}
ok('C03 const CONFIG = { … } целиком в одном модуле (его вынимают все наборы тестов)', mods.filter(([, t]) => t.includes('const CONFIG = {')).length === 1);
ok('C04 sw.js не кэширует src/ и tools/ (игре нужен только index.html)', !/src\/|tools\//.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
ok('C05 sw.js пересобирает ответы после перенаправления хостинга (Cloudflare: /index.html → /) — при установке, из сети и из кэша',
  /function clean\(r\)/.test(swSrc) && /r\.redirected/.test(swSrc) && /fetch\(req\)\.then\(clean\)/.test(swSrc) && (swSrc.match(/clean\(/g) || []).length >= 4 && !/\.addAll\(/.test(swSrc));
ok('C06 ярлык DEV стартует с ./ (без перенаправления /index.html → / на Cloudflare)', JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest-dev.webmanifest'), 'utf8')).start_url === './');
ok('C07 sw.js не перехватывает archive/ (архив не подменяется текущей игрой при медленной сети)', /url\.pathname\.startsWith\(SCOPE \+ 'archive\/'\)\) return;/.test(swSrc));

// ---- S1-ART: картинки улицы ----
const { execFileSync } = require('child_process');
const crypto = require('crypto');
let packOk = true; for (const set of ['s1', 'st']) try { execFileSync(process.execPath, [path.join(ROOT, 'tools', 'art', 'pack.mjs'), set, '--check'], { stdio: 'pipe' }); } catch (_) { packOk = false; }
ok('A01 src/24-s1-art.js и src/26-st-art.js совпадают с art/s1/game и art/st/game (node tools/art/pack.mjs s1|st --check)', packOk);
const artMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'art', 's1', 'game', 'meta.json'), 'utf8'));
const artImgs = Object.entries(artMeta.images);
ok('A02 ассеты S1 без магенты и розовой каймы (pink = 0 у всех)', artImgs.length >= 20 && artImgs.every(([, v]) => v.pink === 0), artImgs.filter(([, v]) => v.pink).map(([k]) => k).join());
ok('A03 палитра не урезана до потери деталей: средняя ошибка ≤ 5/255 у каждого ассета', artImgs.every(([, v]) => v.err <= 5), Math.max(...artImgs.map(([, v]) => v.err)) + '');
const sums = fs.readFileSync(path.join(ROOT, 'art', 'ART-SURF-001', 'SHA256SUMS'), 'utf8').trim().split('\n').map(l => l.split(/\s+\*?/));
ok('A04 семь исходников ART-SURF-001 на месте и не изменены (SHA256SUMS)', sums.length === 7 && sums.every(([h, f]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'art', 'ART-SURF-001', f))).digest('hex') === h));
ok('A05 игра не грузит файлы ассетов: только data URI внутри страницы; art/ нет в sw.js', !/fetch\(|\.src = ['"](?!data:)/.test(fs.readFileSync(path.join(ROOT, 'src', '25-street-s1-art.js'), 'utf8')) && !/art\//.test(swSrc));
ok('A06 резерв: процедурная S1 остаётся (buildStreetS1 вызывается при kind proc), ожидание и таймаут есть', /k === 'wait' \? buildStreetS1Wait\(\) : Object\.assign\(buildStreetS1\(\)/.test(src) && /WAIT_MS/.test(src) && src.includes('function buildStreetS1()'));
const cl = JSON.parse(fs.readFileSync(path.join(ROOT, 'art', 's1', 'game', 'meta.json'), 'utf8')).cells, bot = r => r[1] + r[3];
const baseY = bot(cl.entrance.r);
ok('A08 S1-ART-ALIGN: первый этаж, ступени подъезда и торцы кончаются на одной земле исходника, тротуар — сразу под ней',
  [...cl.ground.win, ...cl.ground.balc].every(c => bot(c.r) === baseY) && cl.walk.r[1] === baseY && [cl.endL, cl.endR].every(e => e.segs[4][0] + e.segs[4][1] === baseY), 'y ' + baseY);
const size = Buffer.byteLength(src);
ok('A07 размер index.html в пределах 1,5 МБ (S1-ART +~0,6 МБ, ST-ART-001 +~0,2 МБ)', size < 1.5 * 1024 * 1024, Math.round(size / 1024) + ' КБ');
const stSums = fs.readFileSync(path.join(ROOT, 'art', 'ST-ART-001', 'SHA256SUMS'), 'utf8').trim().split('\n').map(l => l.split(/\s+\*?/));
ok('A09 исходник ST-ART-001 на месте и не изменён (SHA256SUMS)', stSums.length === 1 && stSums.every(([h, f]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'art', 'ST-ART-001', f))).digest('hex') === h));
const boot = src.split('\n').find(l => l.includes('buildWorld();') && l.includes('placeActors();')) || '';
ok('A10 запуск игры: buildWorld, buildSprites, placeActors, FX.init вызываются (не попали в комментарий)', /^\s*buildWorld\(\); buildSprites\(\); placeActors\(\); FX\.init\(\);/.test(boot) && /STArt\.start\(\)/.test(src));

// ---- 2. Сохранения ----
const CONFIG = Function(`${src.slice(src.indexOf('const CONFIG = {'), src.indexOf('\n};', src.indexOf('const CONFIG = {')) + 3)} return CONFIG;`)();
const S = Function(`${src.slice(src.indexOf('/* SCAVENGE:BEGIN */'), src.indexOf('/* SCAVENGE:END */'))}; return { parsePlayerSave, parseZoom, parseVisual };`)();
const { parseSceneSave } = Function(`${src.slice(src.indexOf('/* SCENE:BEGIN'), src.indexOf('/* SCENE:END */'))}; return { parseSceneSave };`)();
const keys = []; JSON.stringify(CONFIG, (k, v) => (k === 'SAVE_KEY' && keys.push(v), v));
ok('C10 ключи сохранений прежние', J(keys.slice().sort()) === J(['pv.player.v1', 'pv.power.v1', 'pv.scavenge.v1', 'pv.scene.v1', 'pv.visual.v1', 'pv.zoom.v1']), keys.join());
ok('C11 pv.player.v1 (1.1.x): платформа, x 1250.37, взгляд влево → то же место', J(S.parsePlayerSave(CONFIG, '{"v":1,"floor":"platform","x":1250.37,"facing":-1}')) === '{"floor":"platform","x":1250.4,"facing":-1}');
ok('C12 pv.player.v1 испорчена → null (герой на старте, остальные ключи не трогаются)', S.parsePlayerSave(CONFIG, 'garbage') === null && S.parsePlayerSave(CONFIG, '{"v":1,"floor":"nowhere","x":1}') === null);
ok('C13 pv.scene.v1 (1.2.0+): S1, геометрия 2 → то же место', J(parseSceneSave(CONFIG, '{"v":1,"scene":"S1","g":2,"floor":"surface","x":2000.04,"facing":1,"pending":null}')) === '{"scene":"S1","floor":"surface","x":2000,"facing":1,"pending":false}');
ok('C14 pv.scene.v1 с незавершённым переходом ST→SURF (дверь D_exit) → безопасная точка у двери вестибюля', J(parseSceneSave(CONFIG, '{"v":1,"scene":"ST","floor":"vestibule","x":1650,"facing":1,"pending":{"portal":"D_exit","from":"ST","to":"SURF","ticket":1}}')) === '{"scene":"ST","floor":"vestibule","x":1650,"facing":1,"pending":true}');
ok('C15 pv.scene.v1 старой геометрии S1 (без g) → null, как решено в ШТАБ-022', parseSceneSave(CONFIG, '{"v":1,"scene":"S1","floor":"surface","x":500,"facing":1,"pending":null}') === null);
ok('C16 pv.zoom.v1: 150 % → индекс 2; нет записи → 100 %', S.parseZoom(CONFIG, '{"v":1,"level":1.5}') === 2 && S.parseZoom(CONFIG, null) === 0);
ok('C17 pv.visual.v1: «Атмосферно» сохраняется; неизвестное → «Нормально»', S.parseVisual(CONFIG.VISUAL, '{"v":1,"brightness":"dark"}') === 'dark' && S.parseVisual(CONFIG.VISUAL, '{"v":1,"brightness":"x"}') === 'normal');

const dExit = CONFIG.SCENES.ST.doors.find(d => d.id === 'D_exit'), dYard = CONFIG.SCENES.SURF.doors.find(d => d.id === 'D_yard');
ok('A11 ST-VIEW-001: выход из метро — дверь D_exit в вестибюле (1650) в сцену SURF; проход во «Дворы» — дверь D_yard (1980); прежняя геометрия FLOORS.surface сохранена как константа рисовки грунта', CONFIG.FLOORS.surface.minX === 1136 && CONFIG.FLOORS.surface.maxX === 1980 && CONFIG.GATES[0].b.x === 1650 && CONFIG.SCENES.ST.portals.length === 0 && dExit && dExit.floor === 'vestibule' && dExit.x === 1650 && dExit.to === 'SURF' && dYard && dYard.x === 1980 && dYard.to === 'S1');
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
