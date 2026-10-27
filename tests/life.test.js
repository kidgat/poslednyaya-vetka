/* 0.8.1 «Жизнь в темноте»: режимы яркости, очередь реакций NPC, данные NPC и аварийного света (без браузера).
   node tests/life.test.js — модели вынимаются из index.html (SCAVENGE:BEGIN/END), данные — из CONFIG. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const CONFIG = Function(`${src.slice(src.indexOf('const CONFIG = {'), src.indexOf('\n};', src.indexOf('const CONFIG = {')) + 3)} return CONFIG;`)();
const { parseVisual, createReactions } = Function(`${cut('/* SCAVENGE:BEGIN */', '/* SCAVENGE:END */')}; return { parseVisual, createReactions };`)();
const BEACONS = Function(`return ${cut('const BEACONS = ', ';').slice('const BEACONS = '.length)}`)();
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  [' + info + ']' : ''}`); };
const V = CONFIG.VISUAL, lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

// Режимы яркости
ok('V01 три режима, по умолчанию «Нормально»', V.ORDER.join() === 'dark,normal,bright' && V.DEFAULT === 'normal' && V.ORDER.every(k => V.PRESETS[k]));
ok('V02 подписи: Атмосферно / Нормально / Светлее', V.ORDER.map(k => V.PRESETS[k].label).join() === 'Атмосферно,Нормально,Светлее');
ok('V03 по возрастанию: ambient, blackout, surface светлее; виньетка слабее', ['ambient', 'blackout', 'surface'].every(f => lum(V.PRESETS.dark[f]) < lum(V.PRESETS.normal[f]) && lum(V.PRESETS.normal[f]) < lum(V.PRESETS.bright[f]))
  && V.PRESETS.dark.vignette > V.PRESETS.normal.vignette && V.PRESETS.normal.vignette > V.PRESETS.bright.vignette);
ok('V04 в каждом режиме блэкаут заметно темнее сети (≥25%)', V.ORDER.every(k => lum(V.PRESETS[k].blackout) <= 0.75 * lum(V.PRESETS[k].ambient)));
ok('V05 «Нормально» светлее 0.8 и при сети, и в блэкаут', lum(V.PRESETS.normal.ambient) > lum([74, 80, 100]) * 1.5 && lum(V.PRESETS.normal.blackout) > lum([38, 42, 56]) * 1.5);
ok('V06 холодный тон темноты сохранён (синий ≥ красного)', V.ORDER.every(k => V.PRESETS[k].ambient[2] >= V.PRESETS[k].ambient[0] && V.PRESETS[k].blackout[2] >= V.PRESETS[k].blackout[0]));
ok('V07 сохранение: верные значения читаются', ['dark', 'normal', 'bright'].every(k => parseVisual(V, JSON.stringify({ v: 1, brightness: k })) === k));
ok('V08 битое/чужое — только «Нормально»', [null, '', '{', '{"v":2,"brightness":"dark"}', '{"v":1,"brightness":"ultra"}', '{"v":1}', '[]', '{"v":1,"brightness":"__proto__"}', '{"v":1,"brightness":"toString"}']
  .every(r => parseVisual(V, r) === 'normal'));
ok('V09 ключ отдельный: pv.visual.v1, не pv.power.v1 / pv.scavenge.v1', V.SAVE_KEY === 'pv.visual.v1' && V.SAVE_KEY !== CONFIG.POWER.SAVE_KEY && V.SAVE_KEY !== CONFIG.SCAVENGE.SAVE_KEY);

// Очередь реакций
const RC = CONFIG.REACT, ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
let Q = createReactions(RC);
ok('R01 блэкаут: не больше 5 реплик в очереди', Q.trigger('blackout', ids, 0) === 5);
const at = Q.queue.map(e => e.at), gaps = at.slice(1).map((t, i) => t - at[i]);
ok('R02 первая через ~1 с, дальше разнос 0.6–1.5 с', Math.abs(at[0] - RC.FIRST) < 1e-9 && gaps.every(g => g >= 0.6 - 1e-9 && g <= 1.5 + 1e-9), gaps.map(g => g.toFixed(2)).join());
ok('R03 в момент 0 ничего не показывается, к 1 с — одна', Q.due(0).length === 0 && Q.due(1.0).length === 1);
ok('R04 возврат сети отменяет старые аварийные фразы', Q.trigger('restore', ['a', 'b'], 2) === 2 && Q.queue.every(e => e.kind === 'restore'));
ok('R05 облегчение — не больше 3', createReactions(RC).trigger('restore', ids, 0) === 3);
Q = createReactions(RC); const lens = [];
for (let k = 0; k < 6; k++) { Q.trigger(k % 2 ? 'restore' : 'blackout', ids, k * 0.5); lens.push(Q.queue.length); }
ok('R06 частые ВКЛ/ВЫКЛ: очередь не растёт, повтор в пределах 6 с — 1 фраза', Math.max(...lens) <= 5 && lens.slice(2).every(n => n <= 1), lens.join());
ok('R07 после паузы > 6 с — снова полная реакция', Q.trigger('blackout', ids, 100) === 5);
const Lq = createReactions(RC), lines = ['X', 'Y', 'Z'];
ok('R08 фразы одного NPC идут по кругу, без повтора подряд', [1, 2, 3, 4].map(() => Lq.line('m', lines)).join() === 'X,Y,Z,X');
ok('R09 длительность пузыря 2–4 с', ['ОК', 'НАСОСЫ СНОВА В СЕТИ!'].every(t => Lq.duration(t) >= 2 && Lq.duration(t) <= 4));
ok('R10 без кандидатов — пустая очередь, без ошибок', createReactions(RC).trigger('blackout', [], 0) === 0);

// NPC и свет
const N = CONFIG.NPCS;
// 0.9: правый охранник шлюза (x 1670) перенесён на КПП вестибюля вместе с репликами — копии на ярусе 0 нет
ok('N01 охрана: нижний пост upper x1600 и КПП vestibule x1480, у обоих луч; guard-airlock-east больше нет', N['guard-airlock-west'].floor === 'upper' && N['guard-airlock-west'].x === 1600 && N['guard-airlock-west'].lamp === 'beam'
  && N['guard-kpp'] && N['guard-kpp'].floor === 'vestibule' && N['guard-kpp'].x === 1480 && N['guard-kpp'].lamp === 'beam' && !N['guard-airlock-east']);
ok('N02 рабочие мастерской и насосной: прежние участки ходьбы, фонари', N['worker-workshop'].walk.join() === '900,1100' && N['worker-pumps'].walk.join() === '1748,1852' && N['worker-workshop'].lamp && N['worker-pumps'].lamp);
ok('N03 механик: налобный фонарь, участок 1340–1460 прежний', N.mechanic.lamp === 'headlamp' && N.mechanic.walk.join() === '1340,1460');
const place = cut('function placeActors() {', '\n}');
ok('N04 в placeActors не осталось копий охраны шлюза, рабочих и жителя столовой', !/actor\('guard', 'guard', 16[07]0/.test(place) && !/actor\('walker', 'worker'/.test(place) && !/actor\('sitter', 'resA', 492/.test(place));
ok('N05 разговоры охраны (нижний пост и КПП): по 7 разных реплик, радиус ≤ 14', ['talk-airlock-west', 'talk-kpp'].every(id => { const i = CONFIG.INSPECTS.find(x => x.id === id); return i && i.lines.length === 7 && new Set(i.lines).size === 7 && i.radius <= 14; }));
const G = CONFIG.GATES[0], zone = id => { const i = CONFIG.INSPECTS.find(x => x.id === id), n = N[i.npc]; return [n.x - i.radius, n.x + i.radius]; };
ok('N06 зоны разговора вестибюля не задевают гермоворота (1638–1662)', ['talk-kpp', 'talk-quarantine', 'talk-guardroom'].every(id => { const z = zone(id); return z[1] < G.a.x - G.radius || z[0] > G.a.x + G.radius; }), ['talk-kpp', 'talk-quarantine', 'talk-guardroom'].map(zone).join(' '));
const reacting = Object.keys(N).filter(id => N[id].onBlackout);
ok('N07 реакции на блэкаут у охраны, рабочих, медика, повара, жителей', ['guard-west', 'guard-airlock-west', 'mechanic', 'worker-pumps', 'worker-workshop', 'medic', 'cook', 'diner', 'resident-platform'].every(id => reacting.includes(id)), reacting.length);
const allEm = [...BEACONS, [1650, -76], [32, 158], [1924, 128], ...CONFIG.EMERGENCY_LAMPS.map(e => [e.x, e.y])];
let close = [];
for (let i = 0; i < allEm.length; i++) for (let j = i + 1; j < allEm.length; j++) if (Math.hypot(allEm[i][0] - allEm[j][0], allEm[i][1] - allEm[j][1]) < 30) close.push(allEm[i] + '~' + allEm[j]);
ok('N08 новые аварийные светильники не дублируют маяки (≥30 px от любого)', close.length === 0, close.join(' '));
ok('N09 аварийные светильники: мастерская, медпункт, энергоблок, насосная', ['workshop', 'medical', 'power', 'water'].every(r => CONFIG.EMERGENCY_LAMPS.some(e => e.room === r)));
ok('N10 отсветы у обоих постов, в доступной охране зоне платформы', CONFIG.EMERGENCY_GLOW.length === 2 && CONFIG.EMERGENCY_GLOW.every(e => e.x >= CONFIG.FLOORS.platform.minX - 60 && e.x <= CONFIG.FLOORS.platform.maxX + 10));
ok('N11 расход аварийной цепи прежний: EMERGENCY = 0.35', CONFIG.POWER.EMERGENCY === 0.35);
ok('N12 лимит ручных огней в кадре задан', Number.isInteger(CONFIG.LAMP_CAP) && CONFIG.LAMP_CAP >= 6 && CONFIG.LAMP_CAP <= 12);
// 0.8.2 «Полировка»
const post2 = CONFIG.INSPECTS.find(i => i.id === 'inspect-east-post');
ok('P01 Пост 2: первая реплика «Станция Московская там, за гермозатвором…»', post2.lines[0] === '«Станция Московская там, за гермозатвором. Но сегодня никто не проходит».', post2.lines[0]);
const allLines = CONFIG.INSPECTS.flatMap(i => i.lines);
ok('P02 в репликах нет вложенных кавычек „…“ внутри «…»', allLines.every(l => !/[„“]/.test(l)), allLines.filter(l => /[„“]/.test(l)).join(' | '));
ok('P03 реплики — по-прежнему по 5–10 у каждого места, смысл постов сохранён', CONFIG.INSPECTS.find(i => i.id === 'inspect-west-post').lines[0].includes('Спортивн') && post2.lines.length === 5);
ok('P04 нижний пост шлюза светит вправо — на подножие марша в вестибюль', N['guard-airlock-west'].aim === 1 && CONFIG.STAIRS.find(s => s.id === 'vestibule').bottom.x > N['guard-airlock-west'].x);
// 0.9 «Вестибюль +1»
const NEW = { 'quarantine-medic': 'talk-quarantine', 'guard-rest': 'talk-guardroom' };
ok('W01 санитар карантина и караульный — в вестибюле, по 5 разных реплик', Object.entries(NEW).every(([n, t]) => { const i = CONFIG.INSPECTS.find(x => x.id === t); return N[n].floor === 'vestibule' && i && i.npc === n && i.lines.length === 5 && new Set(i.lines).size === 5; }));
ok('W02 у новых NPC — короткие реакции и автономный фонарь', Object.keys(NEW).every(n => N[n].lamp === 'lantern' && N[n].onBlackout.length === 3 && N[n].onRestore.length === 2 && [...N[n].onBlackout, ...N[n].onRestore].every(t => t.length <= 22 && !/Ъ/.test(t))));
ok('W03 ворота наверх — только из вестибюля (обхода нет)', CONFIG.GATES.length === 1 && G.a.floor === 'vestibule' && G.b.floor === 'surface');
ok('W04 реплики КПП — прежние 7 реплик охранника внешних ворот', CONFIG.INSPECTS.find(i => i.id === 'talk-kpp').lines[0] === '«На улице спокойно только издалека. Не верь тишине».');
ok('W05 аварийный свет в карантине и на КПП', ['quarantine', 'checkpoint'].every(r => CONFIG.EMERGENCY_LAMPS.some(e => e.room === r)));

// 1.0: жители яруса −2
const U3 = { 'mushroom-grower': 'talk-mushrooms', storekeeper: 'talk-storeroom', 'drain-tech': 'talk-drainage' };
ok('X01 грибник, кладовщик, дренажный техник — на ярусе −2, у каждого ≥5 разных реплик', Object.entries(U3).every(([n, t]) => { const i = CONFIG.INSPECTS.find(x => x.id === t); return N[n] && N[n].floor === 'utility' && i && i.npc === n && i.lines.length >= 5 && new Set(i.lines).size === i.lines.length; }));
ok('X02 короткие реакции на блэкаут и возврат сети, без Ъ, ≤ 22 знаков', Object.keys(U3).every(n => N[n].onBlackout.length >= 3 && N[n].onRestore.length >= 2 && [...N[n].onBlackout, ...N[n].onRestore].every(t => t.length <= 22 && !/Ъ/.test(t))));
ok('X03 ручной свет: налобные у грибника и техника, фонарь у кладовщика', N['mushroom-grower'].lamp === 'headlamp' && N['drain-tech'].lamp === 'headlamp' && N.storekeeper.lamp === 'lantern');
ok('X04 у ходячих — свой участок, участки не пересекаются', N['mushroom-grower'].walk && N['drain-tech'].walk && N['mushroom-grower'].walk[1] < N.storekeeper.x && N.storekeeper.x < N['drain-tech'].walk[0]);
ok('X05 атмосферные реплики из ТЗ на месте', CONFIG.INSPECTS.some(i => i.lines.some(l => l.includes('насосы снова встанут'))) && CONFIG.INSPECTS.some(i => i.lines.some(l => l.includes('Грибам свет'))) && CONFIG.INSPECTS.some(i => i.lines.some(l => l.includes('ржавые гайки'))));
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
