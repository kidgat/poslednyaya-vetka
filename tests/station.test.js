/* Тесты реестра «Гагаринской 3.0» и осмотров постов (без браузера): node tests/station.test.js
   CONFIG, ROOMS и блок STATION:BEGIN/END вынимаются из index.html; проверяются и рабочие данные, и «сломанные» копии. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cut = (from, to) => { const i = src.indexOf(from); if (i < 0) throw new Error('нет ' + from); return src.slice(i, src.indexOf(to, i) + to.length); };
const CONFIG = Function(`${cut('const CONFIG = {', '\n};')} return CONFIG;`)();
const ROOMS = Function(`${cut('const ROOMS = [', '\n];')} return ROOMS;`)();
const lib = Function(`${src.slice(src.indexOf('/* STATION:BEGIN */'), src.indexOf('/* STATION:END */'))}; return { buildStationPlan, validateStationPlan };`)();
const { buildStationPlan, validateStationPlan } = lib;
const clone = o => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 1e9 : v)));
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  [' + info + ']' : ''}`); };
const errsOf = (cfg, rooms = ROOMS) => validateStationPlan(buildStationPlan(cfg, rooms), cfg);
const hit = (errs, re) => errs.some(e => re.test(e));

const plan = buildStationPlan(CONFIG, ROOMS), errs = validateStationPlan(plan, CONFIG);
ok('S01 рабочий реестр без ошибок', errs.length === 0, errs.join('; '));
ok('S02 пять уровней: surface, vestibule, upper, platform, utility', plan.floors.map(f => f.id).join() === 'surface,vestibule,upper,platform,utility');
ok('S03 active-уровни = рабочие этажи 0.6', plan.floors.filter(f => f.status === 'active').map(f => f.legacyFloor).sort().join() === Object.keys(CONFIG.FLOORS).sort().join());
ok('S04 у всех комнат 0.6 стабильные id', ROOMS.every(r => typeof r.id === 'string' && r.id.length > 1));
ok('S05 оба поста и место собраний в реестре как active', ['west-checkpoint', 'east-checkpoint', 'assembly'].every(id => plan.rooms.some(r => r.id === id && r.status === 'active')));
ok('S06 тоннели к соседним станциям — только planned', plan.connectors.filter(c => c.type === 'tunnel').every(c => c.status === 'planned') && plan.connectors.filter(c => c.type === 'tunnel').length === 2);
ok('S07 действующие связи ведут только на active-уровни', plan.connectors.filter(c => c.status === 'active').every(c => [c.from, c.to].every(f => plan.floors.find(x => x.id === f).status === 'active')));
const P = CONFIG.FLOORS.platform;
const west = CONFIG.INSPECTS.find(i => i.id === 'inspect-west-post'), east = CONFIG.INSPECTS.find(i => i.id === 'inspect-east-post');
ok('S08 запад: триггер в пределах ходьбы у левой границы', west.trigger[0] >= P.minX && west.trigger[0] - P.minX < 30, west.trigger.join('–'));
ok('S09 восток: триггер достижим при maxX ' + P.maxX, east.trigger[1] <= P.maxX && east.trigger[0] < P.maxX, east.trigger.join('–'));
ok('S10 двери постов за границей ходьбы', CONFIG.SPACES.filter(s => s.door).every(s => s.door[1] < P.minX || s.door[0] > P.maxX));
ok('S11 точка старта не в месте собраний и не в зоне действия', (() => {
  const x = CONFIG.PLAYER.START_X, asm = CONFIG.SPACES.find(s => s.id === 'assembly');
  return !(x >= asm.x[0] && x <= asm.x[1]) && plan.interactions.filter(i => i.floor === 'platform').every(i => x < i.trigger[0] || x > i.trigger[1]);
})());
ok('S12 типы осмотров: gate_locked у постов, inspect у доски', west.type === 'gate_locked' && east.type === 'gate_locked' && CONFIG.INSPECTS.find(i => i.space === 'assembly').type === 'inspect');
ok('S13 цепи пространств существуют в POWER.DEMAND', CONFIG.SPACES.every(s => s.circuit in CONFIG.POWER.DEMAND));

// Негативные случаи: валидатор обязан ловить поломки.
let c = clone(CONFIG); c.INSPECTS.push({ ...c.INSPECTS[0] });
ok('N01 повтор id пойман', hit(errsOf(c), /повтор id/));
c = clone(CONFIG); c.INSPECTS[0].trigger = [640, 660];
ok('N02 пересечение с лестницей поймано', hit(errsOf(c), /пересекаются/));
c = clone(CONFIG); c.INSPECTS[2].trigger = [1860, 1880];
ok('N03 недостижимый триггер за maxX пойман', hit(errsOf(c), /недостижимо/));
c = clone(CONFIG); c.STATION.plannedConnectors.push({ id: 'x', type: 'stair', from: 'platform', to: 'utility' }); c.STATION.plannedConnectors.at(-1).status = 'active';
const pl = buildStationPlan(c, ROOMS); pl.connectors.at(-1).status = 'active';
ok('N04 active-связь на planned-уровень поймана', hit(validateStationPlan(pl, c), /плановый/));
c = clone(CONFIG); c.SPACES[0].door = [170, 190];
ok('N05 достижимая дверь поста поймана', hit(errsOf(c), /достижима/));
c = clone(CONFIG); c.SPACES[1].circuit = 'wifi';
ok('N06 неизвестная цепь поймана', hit(errsOf(c), /неизвестная цепь/));
c = clone(CONFIG); c.INSPECTS[0].floor = 'utility';
ok('N07 осмотр на плановом уровне пойман', hit(errsOf(c), /неактивном уровне/));
c = clone(CONFIG); c.STATION.floors.find(f => f.id === 'upper').legacyFloor = 'roof';
ok('N08 рассинхрон с CONFIG.FLOORS пойман', hit(errsOf(c), /CONFIG\.FLOORS/));
const r2 = clone(ROOMS); r2[1].id = r2[0].id;
ok('N09 повтор id комнаты пойман', hit(errsOf(CONFIG, r2), /повтор id/));

// 0.8: верхний ярус целиком, собеседники, находки
const U = CONFIG.FLOORS.upper;
ok('S14 верхний ярус проходной: жилой блок и столовая в пределах ходьбы', U.minX <= 160 && ['habitation', 'kitchen'].every(id => { const r = ROOMS.find(x => x.id === id); return r.x + r.w - 4 > U.minX; }), `${U.minX}–${U.maxX}`);
ok('S15 марш не тронут: (652,219) ↔ (862,98), 20 ступеней', (() => { const s = CONFIG.STAIRS[0]; return s.bottom.x === 652 && s.top.x === 862 && s.run.steps === 20 && s.hole.join() === '752,846'; })());
ok('S16 разговоры с NPC: 4 собеседника на ярусе + 2 поста, у каждого NPC есть запись', ['medic', 'mechanic', 'cook', 'resident'].every(id => CONFIG.INSPECTS.some(i => i.npc === id)) && CONFIG.INSPECTS.filter(i => i.npc).every(i => CONFIG.NPCS[i.npc]));
ok('S17 зона механика не заходит на пульт генератора', (() => { const z = plan.interactions.find(i => i.id === 'talk-mechanic').trigger; return z[1] < CONFIG.GENERATOR.trigger[0]; })());
ok('S18 точки поиска топлива — в реестре, на поверхности, в пределах ходьбы', plan.interactions.filter(i => i.kind === 'scavenge').length === 3);
c = clone(CONFIG); c.NPCS.mechanic.walk = [1340, 1520];
ok('N10 механик зашёл на пульт генератора — пересечение поймано', hit(errsOf(c), /пересекаются.*(talk-mechanic|generator)/));
c = clone(CONFIG); c.INSPECTS.find(i => i.id === 'talk-medic').npc = 'ghost';
ok('N11 разговор с несуществующим NPC пойман', hit(errsOf(c), /нет NPC/));
c = clone(CONFIG); c.NPCS.cook.floor = 'platform';
ok('N12 NPC на другом этаже пойман', hit(errsOf(c), /другом этаже/));
c = clone(CONFIG); c.NPCS.medic.walk = [1100, 1232];
ok('N13 NPC ходит через несколько комнат — пойман', hit(errsOf(c), /одной комнаты/));
c = clone(CONFIG); c.INSPECTS[1].lines = [];
ok('N14 доска без объявлений поймана', hit(errsOf(c), /нет реплик/));
c = clone(CONFIG); c.INSPECTS[1].lines[1] = c.INSPECTS[1].lines[0];
ok('N15 повтор объявления пойман', hit(errsOf(c), /повтор реплик/));
c = clone(CONFIG); c.FLOORS.upper.minX = 852;
ok('N16 ярус снова закрыт слева — жилой блок недоступен, поймано', hit(errsOf(c), /habitation недоступна/) && hit(errsOf(c), /kitchen недоступна/));
c = clone(CONFIG); c.SCAVENGE.SPOTS[2].trigger = [1640, 1660];
ok('N17 находка на воротах шлюза — пересечение поймано', hit(errsOf(c), /пересекаются/));

// 0.8.1: охрана шлюза, техперсонал, аварийный свет
ok('S19 разговоры охраны шлюза в реестре, зоны не задевают ворота', ['talk-airlock-west', 'talk-airlock-east'].every(id => plan.interactions.some(i => i.id === id)));
c = clone(CONFIG); c.NPCS['guard-airlock-west'].x = 1630;
ok('N18 охранник шлюза встал на ворота — пересечение поймано', hit(errsOf(c), /пересекаются/));
c = clone(CONFIG); c.NPCS.mechanic.onBlackout = ['ОЧЕНЬ ДЛИННАЯ ФРАЗА ДЛЯ ПУЗЫРЯ НАД ГОЛОВОЙ'];
ok('N19 длинная реакция поймана', hit(errsOf(c), /плохие onBlackout/));
c = clone(CONFIG); c.EMERGENCY_LAMPS[0].x = 1300;
ok('N20 аварийный светильник вне своей комнаты пойман', hit(errsOf(c), /вне комнаты/));
c = clone(CONFIG); c.NPCS['worker-pumps'].lamp = 'laser';
ok('N21 неизвестный тип света пойман', hit(errsOf(c), /неизвестный свет/));
c = clone(CONFIG); c.NPCS['worker-pumps'].x = 1700;
ok('N22 старт NPC вне участка ходьбы пойман', hit(errsOf(c), /вне участка/));

console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
