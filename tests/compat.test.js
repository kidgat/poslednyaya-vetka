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

// ---- 2. Сохранения ----
const CONFIG = Function(`${src.slice(src.indexOf('const CONFIG = {'), src.indexOf('\n};', src.indexOf('const CONFIG = {')) + 3)} return CONFIG;`)();
const S = Function(`${src.slice(src.indexOf('/* SCAVENGE:BEGIN */'), src.indexOf('/* SCAVENGE:END */'))}; return { parsePlayerSave, parseZoom, parseVisual };`)();
const { parseSceneSave } = Function(`${src.slice(src.indexOf('/* SCENE:BEGIN'), src.indexOf('/* SCENE:END */'))}; return { parseSceneSave };`)();
const keys = []; JSON.stringify(CONFIG, (k, v) => (k === 'SAVE_KEY' && keys.push(v), v));
ok('C10 ключи сохранений прежние', J(keys.slice().sort()) === J(['pv.player.v1', 'pv.power.v1', 'pv.scavenge.v1', 'pv.scene.v1', 'pv.visual.v1', 'pv.zoom.v1']), keys.join());
ok('C11 pv.player.v1 (1.1.x): платформа, x 1250.37, взгляд влево → то же место', J(S.parsePlayerSave(CONFIG, '{"v":1,"floor":"platform","x":1250.37,"facing":-1}')) === '{"floor":"platform","x":1250.4,"facing":-1}');
ok('C12 pv.player.v1 испорчена → null (герой на старте, остальные ключи не трогаются)', S.parsePlayerSave(CONFIG, 'garbage') === null && S.parsePlayerSave(CONFIG, '{"v":1,"floor":"nowhere","x":1}') === null);
ok('C13 pv.scene.v1 (1.2.0+): S1, геометрия 2 → то же место', J(parseSceneSave(CONFIG, '{"v":1,"scene":"S1","g":2,"floor":"surface","x":2000.04,"facing":1,"pending":null}')) === '{"scene":"S1","floor":"surface","x":2000,"facing":1,"pending":false}');
ok('C14 pv.scene.v1 с незавершённым переходом ST→S1 → безопасная точка перед порталом P1', J(parseSceneSave(CONFIG, '{"v":1,"scene":"ST","floor":"surface","x":1136,"facing":-1,"pending":{"portal":"P1","from":"ST","to":"S1","ticket":1}}')) === '{"scene":"ST","floor":"surface","x":1176,"facing":-1,"pending":true}');
ok('C15 pv.scene.v1 старой геометрии S1 (без g) → null, как решено в ШТАБ-022', parseSceneSave(CONFIG, '{"v":1,"scene":"S1","floor":"surface","x":500,"facing":1,"pending":null}') === null);
ok('C16 pv.zoom.v1: 150 % → индекс 2; нет записи → 100 %', S.parseZoom(CONFIG, '{"v":1,"level":1.5}') === 2 && S.parseZoom(CONFIG, null) === 0);
ok('C17 pv.visual.v1: «Атмосферно» сохраняется; неизвестное → «Нормально»', S.parseVisual(CONFIG.VISUAL, '{"v":1,"brightness":"dark"}') === 'dark' && S.parseVisual(CONFIG.VISUAL, '{"v":1,"brightness":"x"}') === 'normal');

console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
