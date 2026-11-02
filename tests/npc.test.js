/* NPC-001: облики жителей — 8 архетипов × 3 варианта (без браузера): node tests/npc.test.js
   CONFIG и STATION-блок вынимаются из index.html. Размещение NPC сверяется со снимком dev bbb5642 (до NPC-001): облики меняются, места — нет. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cut = (from, to) => { const i = src.indexOf(from); if (i < 0) throw new Error('нет ' + from); return src.slice(i, src.indexOf(to, i) + to.length); };
const CONFIG = Function(`${cut('const CONFIG = {', '\n};')} return CONFIG;`)();
const ROOMS = Function(`${cut('const ROOMS = [', '\n];')} return ROOMS;`)();
const HERO_PAL = Function(`${cut('const HERO_PAL = {', '\n};')} return HERO_PAL;`)();
const lib = Function(`${src.slice(src.indexOf('/* STATION:BEGIN */'), src.indexOf('/* STATION:END */'))}; return { buildStationPlan, validateStationPlan, lookExists };`)();
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  [' + info + ']' : ''}`); };
const clone = o => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 1e9 : v)));
const errsOf = cfg => lib.validateStationPlan(lib.buildStationPlan(cfg, ROOMS), cfg);
const BASE = {"npc":{"guard-west":"platform|guard|158||-1|beam|0","guard-west2":"platform|guard|118||1|beam|0","guard-east":"platform|guard|1864||1|beam|0","guard-east2":"platform|sitguard|1884||-1|lantern|0","resident-platform":"platform|walker|400|240-630|0|candle|20","cook":"upper|idle|648||1|candle|0","diner":"upper|sitter|532||1||0","resident":"upper|sitter|442||-1|candle|0","medic":"upper|walker|1200|1172-1232|0||16","mechanic":"upper|walker|1400|1340-1460|0|headlamp|24","worker-workshop":"upper|walker|1000|900-1100|0|beam|22","worker-pumps":"utility|walker|1880|1810-1950|0|beam|18","guard-airlock-west":"upper|guard|1600||1|beam|0","mushroom-grower":"utility|walker|640|590-690|0|headlamp|12","storekeeper":"utility|idle|1262||-1|lantern|0","drain-tech":"utility|walker|1730|1714-1756|0|headlamp|16","guard-kpp":"vestibule|guard|1480||1|beam|0","quarantine-medic":"vestibule|idle|1260||-1|lantern|0","guard-rest":"vestibule|sitguard|1810||-1|lantern|0"},"acts":["sleeper|0, 0, { bed: [218, 88] })","sleeper|0, 0, { bed: [294, 70] })","sleeper|0, 0, { bed: [370, 88] })","sitter|546, U, { facing: 1 })","sitter|590, U, { facing: -1 })","sitter|528, P, { facing: 1 })","sitter|1062, P, { facing: -1 })","sleeper|0, 0, { bed: [316, UY - 10] })","sleeper|0, 0, { bed: [386, UY - 28] })","pig|990, UY, { minX: 972, maxX: 1040, speed: 7, facing: 1 })","pig|1062, UY, { minX: 1046, maxX: 1110, speed: 6, facing: -1 })","pig|1086, UY, { minX: 1086, maxX: 1086, facing: -1 })","mutant|1250, S, { minX: 1140, maxX: 1560, speed: 20 })","mutant|1480, S, { minX: 1300, maxX: 1580, speed: 15 })","mutant|1820, S, { minX: 1730, maxX: 1975, speed: 24 })","sitter|940, P, { facing: -1 })","sitter|962, P, { facing: -1 })","stand|832, P, { facing: 1 })"]};
const L = CONFIG.LOOKS, A = L.ARCHETYPES, IDS = ['resident-m', 'resident-f', 'elder', 'young', 'tech', 'guard', 'trader', 'stalker'];
const OPTS = ['cap', 'capC', 'hairStyle', 'beard', 'hood', 'goggles', 'vest', 'apron', 'bag', 'coat', 'gun', 'pack'];

ok('NPC01 восемь архетипов (житель, жительница, пожилой, молодой, техник, охранник, торговец, сталкер) × по три облика; статус — предложение', Object.keys(A).join() === IDS.join()
  && IDS.every(id => A[id].variants.length === 3 && typeof A[id].label === 'string' && A[id].label.length > 3) && L.STATUS === 'proposal');
ok('NPC02 облик — только палитра (ключи палитры героя, цвета #rrggbb) и детали силуэта; поведения в обликах нет', IDS.every(id => A[id].variants.every(v =>
  Object.keys(v).sort().join() === 'opts,pal' && Object.entries(v.pal).every(([k, c]) => k in HERO_PAL && /^#[0-9a-f]{6}$/.test(c))
  && Object.keys(v.opts).every(k => OPTS.includes(k)) && (!v.opts.cap || (['beanie', 'cap', 'helmet'].includes(v.opts.cap) && /^#[0-9a-f]{6}$/.test(v.opts.capC)))
  && (!v.opts.hairStyle || ['long', 'bun', 'bald'].includes(v.opts.hairStyle)))));
ok('NPC03 три облика внутри архетипа различимы (разные палитры и наборы деталей)', IDS.every(id => { const v = A[id].variants;
  return new Set(v.map(x => JSON.stringify(x.pal))).size === 3 && new Set(v.map(x => JSON.stringify(x.opts))).size === 3; }));
ok('NPC04 у охраны во всех обликах оружие; рюкзак — только у сталкеров', A.guard.variants.every(v => v.opts.gun === true)
  && IDS.every(id => A[id].variants.every(v => !!v.opts.pack === (id === 'stalker'))));
ok('NPC05 облики NPC существуют; реестр без ошибок', Object.values(CONFIG.NPCS).every(n => n.look === undefined || lib.lookExists(CONFIG, n.look)) && errsOf(CONFIG).length === 0, errsOf(CONFIG).join('; '));
{ const c = clone(CONFIG); c.NPCS.cook.look = 'chef.0'; const c2 = clone(CONFIG); c2.NPCS.cook.look = 'tech.3';
  ok('NPC06 неизвестный архетип или номер облика ловится реестром', errsOf(c).some(e => /неизвестный облик chef\.0/.test(e)) && errsOf(c2).some(e => /неизвестный облик tech\.3/.test(e))); }
ok('NPC07 размещение и поведение NPC не изменились (этаж, тип, x, маршрут, взгляд, свет, скорость — как в dev bbb5642)', (() => {
  const cur = Object.fromEntries(Object.entries(CONFIG.NPCS).map(([k, n]) => [k, [n.floor, n.kind, n.x, (n.walk || []).join('-'), n.facing || 0, n.lamp || '', n.speed || 0].join('|')]));
  return JSON.stringify(cur) === JSON.stringify(BASE.npc); })());
ok('NPC08 безымянные жители (спящие, сидящие, стоящий) — те же места и позы, сменён только облик', (() => {
  const a = src.indexOf('function placeActors() {'), b = src.indexOf('\n}\n', a);
  const acts = [...src.slice(a, b).matchAll(/actor\('(\w+)', '[^']+', ([^)]*\))/g)].map(m => m[1] + '|' + m[2].replace(/\s+/g, ' '));
  return JSON.stringify(acts) === JSON.stringify(BASE.acts); })());
ok('NPC09 все 8 архетипов есть на станции; медики — прежний набор medic (вне восьми архетипов)', (() => {
  const a = src.indexOf('function placeActors() {'), b = src.indexOf('\n}\n', a);
  const used = new Set([...Object.values(CONFIG.NPCS).map(n => n.look).filter(Boolean), ...[...src.slice(a, b).matchAll(/actor\('\w+', '([a-z-]+)\.\d'/g)].map(m => m[1] + '.0')].map(l => l.split('.')[0]));
  return IDS.every(id => used.has(id)) && CONFIG.NPCS.medic.set === 'medic' && !CONFIG.NPCS.medic.look && CONFIG.NPCS['quarantine-medic'].set === 'medic'; })());
ok('NPC10 детали силуэта рисуются только при заданных опциях (прежние спрайты не меняются) — вызовы в кадрах стоя и сидя', /headExtras\(g, o, PAL, b\); bodyExtras\(g, o, PAL, b, false\);/.test(src)
  && /headExtras\(g, o, PAL, 6 \+ b\); bodyExtras\(g, o, PAL, b, true\);/.test(src) && /if \(o\.coat\)/.test(src)
  && cut('function headExtras(', '\nfunction bodyExtras(').split('\n').slice(1, -1).every(l => /^\s*(if \(o\.|\}|\/\/)/.test(l) || !l.trim()));
ok('NPC11 галерея обликов — только DEV и только с ?npc (в PROD нет даже с ?debug)', src.includes("if (ENV === 'dev' && /[?&]npc(?:[=&]|$)/.test(location.search)) {") && !src.includes("(ENV === 'dev' || Debug.on) && /[?&]npc"));
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
