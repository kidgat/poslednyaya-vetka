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
c = clone(CONFIG); c.INSPECTS[0].trigger = [734, 746];                    // 1.0.1: на входе служебного прохода платформы
ok('N02 пересечение со служебным проходом поймано', hit(errsOf(c), /пересекаются/));
c = clone(CONFIG); c.INSPECTS[2].trigger = [1860, 1880];
ok('N03 недостижимый триггер за maxX пойман', hit(errsOf(c), /недостижимо/));
// 1.0: все пять уровней действующие — для «плановых» проверок добавляется вымышленный плановый уровень −3
const withDepot = () => { const c = clone(CONFIG); c.STATION.floors.push({ id: 'depot', name: 'Депо', level: -3, status: 'planned', legacyFloor: null }); return c; };
c = withDepot(); c.STATION.plannedConnectors.push({ id: 'x', type: 'stair', from: 'utility', to: 'depot' }); c.STATION.plannedConnectors.at(-1).status = 'active';
const pl = buildStationPlan(c, ROOMS); pl.connectors.at(-1).status = 'active';
ok('N04 active-связь на planned-уровень поймана', hit(validateStationPlan(pl, c), /плановый/));
c = clone(CONFIG); c.SPACES[0].door = [170, 190];
ok('N05 достижимая дверь поста поймана', hit(errsOf(c), /достижима/));
c = clone(CONFIG); c.SPACES[1].circuit = 'wifi';
ok('N06 неизвестная цепь поймана', hit(errsOf(c), /неизвестная цепь/));
c = withDepot(); c.INSPECTS[0].floor = 'depot';
ok('N07 осмотр на плановом уровне пойман', hit(errsOf(c), /неактивном уровне/));
c = clone(CONFIG); c.STATION.floors.find(f => f.id === 'upper').legacyFloor = 'roof';
ok('N08 рассинхрон с CONFIG.FLOORS пойман', hit(errsOf(c), /CONFIG\.FLOORS/));
const r2 = clone(ROOMS); r2[1].id = r2[0].id;
ok('N09 повтор id комнаты пойман', hit(errsOf(CONFIG, r2), /повтор id/));

// 0.8: верхний ярус целиком, собеседники, находки
const U = CONFIG.FLOORS.upper;
ok('S14 верхний ярус проходной: жилой блок и столовая в пределах ходьбы', U.minX <= 160 && ['habitation', 'kitchen'].every(id => { const r = ROOMS.find(x => x.id === id); return r.x + r.w - 4 > U.minX; }), `${U.minX}–${U.maxX}`);
ok('S15 открытых маршей main и utility нет: в STAIRS только марш в вестибюль, переходы через платформу — PASSAGES', CONFIG.STAIRS.map(s => s.id).join() === 'vestibule' && CONFIG.PASSAGES.map(q => q.id).join() === 'service-upper,service-utility');
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
ok('S19 разговоры охраны в реестре (нижний пост и КПП), зоны не задевают ворота и марши', ['talk-airlock-west', 'talk-kpp'].every(id => plan.interactions.some(i => i.id === id)));
c = clone(CONFIG); c.NPCS['guard-airlock-west'].x = 1700;
ok('N18 охранник шлюза встал у подножия марша в вестибюль — пересечение поймано', hit(errsOf(c), /пересекаются/));
c = clone(CONFIG); c.NPCS.mechanic.onBlackout = ['ОЧЕНЬ ДЛИННАЯ ФРАЗА ДЛЯ ПУЗЫРЯ НАД ГОЛОВОЙ'];
ok('N19 длинная реакция поймана', hit(errsOf(c), /плохие onBlackout/));
c = clone(CONFIG); c.EMERGENCY_LAMPS[0].x = 1300;
ok('N20 аварийный светильник вне своей комнаты пойман', hit(errsOf(c), /вне комнаты/));
c = clone(CONFIG); c.NPCS['worker-pumps'].lamp = 'laser';
ok('N21 неизвестный тип света пойман', hit(errsOf(c), /неизвестный свет/));
c = clone(CONFIG); c.NPCS['worker-pumps'].x = 1700;
ok('N22 старт NPC вне участка ходьбы пойман', hit(errsOf(c), /вне участка/));

// 0.9 «Вестибюль +1»: вестибюль действующий, связи через него, геометрия маршей в обе стороны
const stairTopY = Function('CONFIG', `${cut('function stairTopY(s, x) {', '\n}')} return stairTopY;`)(CONFIG);
const VD = Function(`${cut('const VEST_DOORWAYS = ', ';')} return VEST_DOORWAYS;`)();
const GAL = Function(`${cut('const GALLERIES = [', '\n];')} return GALLERIES;`)();
const DW = Function(`${cut('const DOORWAYS = ', ';')} return DOORWAYS;`)();
const S = id => CONFIG.STAIRS.find(s => s.id === id), V = S('vestibule');
const PS = id => CONFIG.PASSAGES.find(q => q.id === id), PU = PS('service-upper'), PD = PS('service-utility');
const vf = plan.floors.find(f => f.id === 'vestibule');
ok('W01 вестибюль — active, этаж vestibule', vf.status === 'active' && vf.legacyFloor === 'vestibule' && CONFIG.FLOORS.vestibule);
const want = { quarantine: 'critical', equipment: 'technical', checkpoint: 'technical', 'vestibule-hall': 'technical', guardroom: 'living' };
ok('W02 пять помещений вестибюля, цепи: карантин critical, склад/КПП/зал technical, караульная living', Object.entries(want).every(([id, c]) => plan.rooms.filter(r => r.id === id).length === 1 && plan.rooms.find(r => r.id === id).floor === 'vestibule' && plan.rooms.find(r => r.id === id).circuit === c && plan.rooms.find(r => r.id === id).status === 'active'));
const ids = plan.rooms.map(r => r.id);
ok('W03 дублей помещений нет (карантин и караульная ушли из planned)', ids.length === new Set(ids).size && !CONFIG.STATION.plannedRooms.some(r => r.id in want));
const act = plan.connectors.filter(c => c.status === 'active').map(c => c.from + '>' + c.to).sort().join();
ok('W04 действующие связи: проходы upper→platform и platform→utility, марш upper→vestibule, ворота vestibule→surface; перескоков нет', act === 'platform>utility,upper>platform,upper>vestibule,vestibule>surface', act);
ok('W05 нет плановой связи vestibule-gates (стала действующей)', !CONFIG.STATION.plannedConnectors.some(c => c.id === 'vestibule-gates'));
c = clone(CONFIG); c.GATES[0].a.floor = 'upper'; c.GATES[0].a.x = 1635;
ok('W06 ворота прямо с яруса 0 на улицу пойманы (перескок уровня)', hit(errsOf(c), /перескакивает/));
c = clone(CONFIG); c.EMERGENCY_LAMPS.find(e => e.id === 'em-kpp').y = 30;
ok('W07 аварийный светильник КПП на высоте яруса 0 — вне комнаты', hit(errsOf(c), /вне комнаты/));
// Марши: главный — без изменений, новый поднимается влево
const yb = CONFIG.FLOORS.upper.y, yt = CONFIG.FLOORS.vestibule.y;
ok('W08 служебный проход 0 ↔ −1: арка яруса 0 (x 806, «вниз») и платформы (x 740, «вверх»)', PU.a.floor === 'upper' && PU.a.x === 806 && PU.a.dir === 'down' && PU.b.floor === 'platform' && PU.b.x === 740 && PU.b.dir === 'up');
const prof = []; for (let x = V.run.x0; x >= V.run.x1; x--) prof.push(stairTopY(V, x));
ok('W09 марш в вестибюль: от (1696,98) влево к (1540,−14), монотонно вверх', stairTopY(V, V.run.x0 + 1) === yb && stairTopY(V, V.run.x1) === yt && prof.every((y, i) => !i || y <= prof[i - 1]), prof[0] + '…' + prof[prof.length - 1]);
ok('W10 18 ступеней', new Set(prof).size === V.run.steps, new Set(prof).size);
ok('W11 нижняя площадка не перекрывает проход в насосную (1716–1734)', V.bottom.trigger[1] <= 1716 && Math.max(V.run.x0, V.bottom.x) < 1716);
const g2 = GAL.find(g => g.stair === 'vestibule'), dKpp = VD.find(d => d[0] < g2.x1 + 4 && d[1] > g2.x1 - 4);
ok('W12 галерея 1536–1592 кончается у проёма 1592–1610 в зал: проход свободен', g2.x0 === 1536 && g2.x1 === 1592 && dKpp && dKpp[0] === g2.x1 && V.hole[1] <= dKpp[0], dKpp);
ok('W13 проём марша не задевает проёмы вестибюля', VD.every(([a, b]) => b <= V.hole[0] || a >= V.hole[1]));
ok('W14 верх марша (1530) и низ (1704) в пределах ходьбы своих этажей', V.top.x >= CONFIG.FLOORS.vestibule.minX && V.top.x <= CONFIG.FLOORS.vestibule.maxX && V.bottom.x <= CONFIG.FLOORS.upper.maxX);
ok('W15 проём в плите пересекает y = 0 (марш непрерывен между слоями)', V.holeY[0] < 0 && V.holeY[1] > 0);
ok('W16 проёмы яруса 0 прежние; галерея осталась только у марша в вестибюль', DW.length === 7 && GAL.length === 1 && GAL[0].stair === 'vestibule');

// 1.0 «Подземное хозяйство»: ярус −2, лестница с платформы, задел под будущие механики
const UF = CONFIG.FLOORS.utility, PF = CONFIG.FLOORS.platform;
ok('U01 все пять уровней действующие, у каждого рабочий этаж', plan.floors.every(f => f.status === 'active' && CONFIG.FLOORS[f.legacyFloor]) && plan.floors.length === 5);
const uw = { 'living-pods': 'living', mushrooms: 'technical', 'tea-ferment': 'technical', pigsty: 'living', storeroom: 'technical', drainage: 'technical', 'utility-stairwell': 'technical' };
ok('U02 шесть помещений −2 + лестничный холл; цепи: жильё и свинарник living, остальное technical', Object.entries(uw).every(([id, c]) => { const r = plan.rooms.filter(x => x.id === id); return r.length === 1 && r[0].floor === 'utility' && r[0].circuit === c && r[0].status === 'active'; }));
ok('U03 planned-записи яруса −2 стали действующими — без дублей, плановой лестницы нет', !CONFIG.STATION.plannedRooms.some(r => r.floor === 'utility') && !CONFIG.STATION.plannedConnectors.some(c => c.to === 'utility' || c.from === 'utility') && ids.length === new Set(ids).size);
const ur = ROOMS.filter(r => r.floor === 'utility').sort((a, b) => a.x - b.x), UD = Function(`${cut('const UTIL_DOORWAYS = ', ';')} return UTIL_DOORWAYS;`)();
const joins = ur.slice(1).map((r, i) => [ur[i].x + ur[i].w, r.x]);
ok('U04 ярус проходим насквозь: между соседними комнатами — проём, границы ходьбы внутри крайних комнат', joins.every(([a, b]) => UD.some(([d0, d1]) => d0 <= a - 4 && d1 >= b + 4)) && UF.minX >= ur[0].x + 4 && UF.maxX <= ur.at(-1).x + ur.at(-1).w - 4, joins.map(j => j.join('–')).join(' '));
const COLS = []; for (let x = 180; x <= 1820; x += 160) COLS.push(x);
const AH = 16, onPlat = CONFIG.PASSAGES.flatMap(q => [q.a, q.b]).filter(e => e.floor === 'platform');
ok('U05 служебный проход −1 ↔ −2: арка платформы (x 1540, «вниз») и лестничного холла −2 (x 1500, «вверх»)', PD.a.floor === 'platform' && PD.a.x === 1540 && PD.a.dir === 'down' && PD.b.floor === 'utility' && PD.b.x === 1500 && PD.b.dir === 'up');
ok('U06 арки платформы — в задней стене между колоннами (±7), не у постов и не на путях', onPlat.every(e => COLS.every(c => c + 7 < e.x - AH || c - 7 > e.x + AH) && e.x - AH > 200 && e.x + AH < 1826));
const ar = e => ROOMS.find(r => (r.floor || 'upper') === e.floor && e.x - AH >= r.x + 4 && e.x + AH <= r.x + r.w - 4);
ok('U07 арки ярусов внутри комнат: 0 — в бывшей лестничной клетке, −2 — в лестничном холле; не в проёмах', ar(PU.a)?.id === 'stairwell' && ar(PD.b)?.id === 'utility-stairwell' && [...DW, ...UD].every(([a, b]) => [PU.a, PD.b].every(e => b <= e.x - AH || a >= e.x + AH)));
ok('U08 входы проходов: свои этажи, в пределах ходьбы, участки действий не пересекаются (реестр без ошибок)', CONFIG.PASSAGES.every(q => [q.a, q.b].every(e => e.x >= CONFIG.FLOORS[e.floor].minX + q.radius && e.x <= CONFIG.FLOORS[e.floor].maxX - q.radius)) && errs.length === 0 && plan.interactions.filter(i => i.kind === 'passage').length === 4);
ok('U09 старые этажи: камера и границы как в 0.9 (у платформы и яруса нет bottom/cam)', !PF.bottom && !PF.cam && !CONFIG.FLOORS.upper.bottom && !CONFIG.FLOORS.upper.cam && PF.minX === 176 && PF.maxX === 1850 && CONFIG.FLOORS.upper.minX === 150);
ok('U10 будущие механики — только записи реестра с существующими комнатами; действий и кнопок для них нет', plan.features.length >= 3 && plan.features.every(f => f.status === 'planned') && CONFIG.INSPECTS.every(i => ['talk', 'inspect', 'gate_locked'].includes(i.type)));
ok('U11 аварийный свет −2: жильё, лестничный холл, дренажная', ['living-pods', 'utility-stairwell', 'drainage'].every(r => CONFIG.EMERGENCY_LAMPS.some(e => e.room === r)));
c = clone(CONFIG); c.NPCS.storekeeper.x = 1500;
ok('U12 кладовщик у арки лестничного холла — пересечение с проходом поймано', hit(errsOf(c), /пересекаются/));
c = clone(CONFIG); c.NPCS.storekeeper.x = 1374;
ok('U13 кладовщик в проёме между комнатами — пойман', hit(errsOf(c), /не в пределах одной комнаты/));
c = clone(CONFIG); c.STATION.plannedFeatures.push({ id: 'x', room: 'garage', name: 'x' });
ok('U14 будущая функция без комнаты — поймана', hit(errsOf(c), /будущая функция/));

// 1.0.1 «Служебные переходы»: валидатор проходов
c = clone(CONFIG); c.PASSAGES[0].b.floor = 'upper';
ok('Q01 проход с обоими входами на одном этаже пойман', hit(errsOf(c), /одном этаже/));
c = clone(CONFIG); c.PASSAGES[1].a.dir = 'up'; c.PASSAGES[1].b.dir = 'down';
ok('Q02 «вниз», ведущий вверх, пойман', hit(errsOf(c), /ведёт не вниз/));
c = clone(CONFIG); c.PASSAGES[0].a.x = 735;
ok('Q03 арка в проёме между комнатами пойман', hit(errsOf(c), /не помещается в комнату/));
c = clone(CONFIG); c.PASSAGES[0].a.floor = 'vestibule'; c.PASSAGES[0].a.x = 1400;
ok('Q04 проход через уровень (вестибюль ↔ платформа) пойман', hit(errsOf(c), /перескакивает/));
c = clone(CONFIG); c.PASSAGES[1].a.x = 1845;
ok('Q05 вход у края ходьбы, недостижимый целиком, пойман', hit(errsOf(c), /недостижимо|пересекаются/));
ok('Q06 параметры анимации прохода: вход и выход не короче 0.5 с, переход за стеной 0.4–1 с', CONFIG.PASSAGE.ENTER >= 0.5 && CONFIG.PASSAGE.EXIT >= 0.5 && CONFIG.PASSAGE.TRANSIT >= 0.4 && CONFIG.PASSAGE.TRANSIT <= 1);

console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
