/* Фаза А (ШТАБ-018 / CL-014): реестр сцен ST, S1, S2 — порталы края, точки появления, граф, запись pv.scene.v1.
   Чистые функции из блока SCENE:BEGIN/END и проверки исходника. Запуск: node tests/scene.test.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const CONFIG = Function(`${src.slice(src.indexOf('const CONFIG = {'), src.indexOf('\n};', src.indexOf('const CONFIG = {')) + 3)} return CONFIG;`)();
const S = Function(`${src.slice(src.indexOf('/* SCENE:BEGIN'), src.indexOf('/* SCENE:END */'))}; return { sceneFloors, edgePortalAt, portalSafeSpot, portalTarget, parseSceneSave, validateScenes };`)();
const { parsePlayerSave } = Function(`${src.slice(src.indexOf('/* SCAVENGE:BEGIN */'), src.indexOf('/* SCAVENGE:END */'))}; return { parsePlayerSave };`)();
const { envSaveKey } = Function(`${src.slice(src.indexOf('/* ENV:BEGIN'), src.indexOf('/* ENV:END */'))}; return { envSaveKey };`)();
let pass = 0, fail = 0;
const ok = (n, c, i = '') => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  [' + i + ']' : ''}`); };
const SC = CONFIG.SCENES, C = CONFIG.SCENE, F = CONFIG.FLOORS;
const portal = (id, pid) => SC[id].portals.find(p => p.id === pid);

// Реестр и граф
ok('SC01 реестр: ровно ST, S1, S2; validateScenes без ошибок', JSON.stringify(Object.keys(SC)) === '["ST","S1","S2"]' && S.validateScenes(CONFIG).length === 0, S.validateScenes(CONFIG).join('; '));
ok('SC02 ST использует этажи станции без изменений (тот же объект CONFIG.FLOORS)', S.sceneFloors(CONFIG, 'ST') === F && SC.ST.W === 2000);
ok('SC03 геометрия S1: W 1800, дорожка 60–1740 на уровне земли станции', SC.S1.W === 1800 && SC.S1.floors.surface.minX === 60 && SC.S1.floors.surface.maxX === 1740 && SC.S1.floors.surface.y === F.surface.y);
ok('SC04 геометрия S2: W 1500, дорожка 160–1440 на уровне земли станции', SC.S2.W === 1500 && SC.S2.floors.surface.minX === 160 && SC.S2.floors.surface.maxX === 1440 && SC.S2.floors.surface.y === F.surface.y);
ok('SC05 наружные сцены — только этаж surface (нет интерьеров и тоннелей)', ['S1', 'S2'].every(id => JSON.stringify(Object.keys(SC[id].floors)) === '["surface"]'));
ok('SC06 у ST один портал — P1 с левого края НАРУЖНОЙ дорожки', SC.ST.portals.length === 1 && SC.ST.portals[0].id === 'P1' && SC.ST.portals[0].floor === 'surface' && SC.ST.portals[0].edge === 'left');
ok('SC07 левый край S2 — граница без портала', !SC.S2.portals.some(p => p.edge === 'left'));
const reach = from => { const seen = new Set([from]), q = [from]; while (q.length) for (const p of SC[q.shift()].portals) if (!seen.has(p.to)) { seen.add(p.to); q.push(p.to); } return seen; };
ok('SC08 из S1 и S2 есть путь домой на ST; из ST достижимы ровно ST, S1, S2', reach('S1').has('ST') && reach('S2').has('ST') && [...reach('ST')].sort().join() === 'S1,S2,ST');
ok('SC09 портал → обратный портал → исходная точка появления (P1⇄P1r, P2⇄P2r)', (() => {
  const a = S.portalTarget(CONFIG, portal('ST', 'P1')), b = S.portalTarget(CONFIG, portal('S1', 'P1r'));
  const c = S.portalTarget(CONFIG, portal('S1', 'P2')), d = S.portalTarget(CONFIG, portal('S2', 'P2r'));
  return a.scene === 'S1' && a.x === 1700 && a.facing === -1 && b.scene === 'ST' && b.x === 1176 && b.facing === 1 && b.floor === 'surface'
    && c.scene === 'S2' && c.x === 1400 && c.facing === -1 && d.scene === 'S1' && d.x === 100 && d.facing === 1;
})());

// Порталы края
const L = F.surface.minX;
ok('SC10 P1: край улицы станции x 1136 + направление влево', S.edgePortalAt(CONFIG, 'ST', 'surface', L, -1)?.id === 'P1' && L === 1136);
ok('SC11 P1 не срабатывает: не у края, направление вправо, без направления', !S.edgePortalAt(CONFIG, 'ST', 'surface', L + 1, -1) && !S.edgePortalAt(CONFIG, 'ST', 'surface', L, 1) && !S.edgePortalAt(CONFIG, 'ST', 'surface', L, 0));
ok('SC12 внутренние этажи станции (вестибюль, ярусы, платформа) у своих краёв порталов не дают', Object.entries(F).filter(([f]) => f !== 'surface').every(([f, Fl]) => !S.edgePortalAt(CONFIG, 'ST', f, Fl.minX, -1) && !S.edgePortalAt(CONFIG, 'ST', f, Fl.maxX, 1)));
ok('SC13 правый край улицы станции (павильон) — не портал', !S.edgePortalAt(CONFIG, 'ST', 'surface', F.surface.maxX, 1));
ok('SC14 S1: справа P1r (→ ST), слева P2 (→ S2); S2: справа P2r (→ S1), слева ничего', S.edgePortalAt(CONFIG, 'S1', 'surface', 1740, 1)?.to === 'ST' && S.edgePortalAt(CONFIG, 'S1', 'surface', 60, -1)?.to === 'S2'
  && S.edgePortalAt(CONFIG, 'S2', 'surface', 1440, 1)?.to === 'S1' && !S.edgePortalAt(CONFIG, 'S2', 'surface', 160, -1));
ok('SC15 неизвестная сцена или этаж → null (без исключения)', S.edgePortalAt(CONFIG, 'XX', 'surface', 0, -1) === null && S.edgePortalAt(CONFIG, 'S1', 'platform', 60, -1) === null);
ok('SC16 точки появления не на портале: от края не ближе SAFE, обратный портал взводится только после REARM', Object.entries(SC).every(([id, s]) => Object.values(s.spawns).every(sp => {
  const Fl = S.sceneFloors(CONFIG, id)[sp.floor]; return !S.edgePortalAt(CONFIG, id, sp.floor, sp.x, -1) && !S.edgePortalAt(CONFIG, id, sp.floor, sp.x, 1) && sp.x - Fl.minX >= C.SAFE - 0.5 && Fl.maxX - sp.x >= C.SAFE - 0.5;
})) && C.REARM > 0 && C.REARM < C.SAFE);
ok('SC17 удержание 0,2–0,3 с, затемнение 0,3–0,6 с, кэш — текущая + предыдущая', C.HOLD >= 0.2 && C.HOLD <= 0.3 && C.FADE >= 0.3 && C.FADE <= 0.6 && C.CACHE === 2);

// Петля без дрейфа (чистая модель графа): 60 кругов ST→S1→S2→S1→ST
ok('SC18 60 кругов ST→S1→S2→S1→ST: те же точки появления, без дрейфа', (() => {
  const seq = [['ST', 'P1'], ['S1', 'P2'], ['S2', 'P2r'], ['S1', 'P1r']]; const first = [];
  for (let k = 0; k < 60; k++) for (let i = 0; i < seq.length; i++) {
    const t = S.portalTarget(CONFIG, portal(...seq[i])), key = JSON.stringify(t);
    if (k === 0) first.push(key); else if (first[i] !== key) return false;
  }
  return first.length === 4;
})());

// pv.scene.v1
const P = o => S.parseSceneSave(CONFIG, JSON.stringify(o));
ok('SC20 ключ: PROD pv.scene.v1, DEV pv.dev.scene.v1', envSaveKey('prod', C.SAVE_KEY) === 'pv.scene.v1' && envSaveKey('dev', C.SAVE_KEY) === 'pv.dev.scene.v1');
ok('SC21 обычная запись S1/S2 восстанавливается как есть', (() => { const a = P({ v: 1, scene: 'S1', floor: 'surface', x: 900.04, facing: -1, pending: null }), b = P({ v: 1, scene: 'S2', floor: 'surface', x: 500, facing: 1 });
  return a && a.scene === 'S1' && a.x === 900 && a.facing === -1 && !a.pending && b && b.scene === 'S2' && b.x === 500; })());
ok('SC22 прерванный переход → безопасная точка ПЕРЕД порталом на стороне источника (не скрытая сцена)', (() => {
  const a = P({ v: 1, scene: 'ST', floor: 'surface', x: 1176, facing: -1, pending: { portal: 'P1', from: 'ST', to: 'S1', ticket: 3 } });
  const b = P({ v: 1, scene: 'S1', floor: 'surface', x: 100, facing: -1, pending: { portal: 'P2', from: 'S1', to: 'S2', ticket: 9 } });
  const c = P({ v: 1, scene: 'S2', floor: 'surface', x: 1400, facing: 1, pending: { portal: 'P2r', from: 'S2', to: 'S1', ticket: 1 } });
  return a.scene === 'ST' && a.x === L + C.SAFE && a.facing === -1 && a.pending && b.scene === 'S1' && b.x === 60 + C.SAFE && c.scene === 'S2' && c.x === 1440 - C.SAFE && c.facing === 1;
})());
ok('SC23 точка источника для ST — допустимая запись pv.player.v1 для 1.2.0 (откат без невалидного этажа)', (() => {
  const a = P({ v: 1, scene: 'ST', floor: 'surface', x: 0, pending: { portal: 'P1', from: 'ST', to: 'S1', ticket: 1 } });
  const v1 = parsePlayerSave(CONFIG, JSON.stringify({ v: 1, floor: a.floor, x: a.x, facing: a.facing }));
  const sp = SC.ST.spawns.fromS1, v2 = parsePlayerSave(CONFIG, JSON.stringify({ v: 1, floor: sp.floor, x: sp.x, facing: sp.facing }));
  return v1 && v1.floor === 'surface' && v2 && v2.x === 1176;
})());
ok('SC24 мусор → null: не JSON, чужая версия, нет сцены, этаж не той сцены, x вне дорожки, NaN, чужой портал', [
  'x{', null, '', '[]', JSON.stringify({ v: 2, scene: 'S1', floor: 'surface', x: 900 }), JSON.stringify({ v: 1, scene: 'S9', floor: 'surface', x: 900 }),
  JSON.stringify({ v: 1, scene: 'S1', floor: 'platform', x: 900 }), JSON.stringify({ v: 1, scene: 'S1', floor: 'surface', x: 10 }), JSON.stringify({ v: 1, scene: 'S2', floor: 'surface', x: 1450 }),
  JSON.stringify({ v: 1, scene: 'S1', floor: 'surface', x: '900' }), '{"v":1,"scene":"S1","floor":"surface","x":1e999}',
  JSON.stringify({ v: 1, scene: 'S1', floor: 'surface', x: 900, pending: { portal: 'P1', from: 'S1', to: 'S2' } }),
  JSON.stringify({ v: 1, scene: 'toString', floor: 'surface', x: 900 }),
].every(r => S.parseSceneSave(CONFIG, r) === null));
ok('SC25 старая запись pv.player.v1 по-прежнему читается (ST, все этажи станции)', Object.entries(F).every(([f, Fl]) => parsePlayerSave(CONFIG, JSON.stringify({ v: 1, floor: f, x: Math.round((Fl.minX + Fl.maxX) / 2), facing: 1 })) !== null));

// Исходник: интеграция
ok('SC30 снаружи станции действий нет (гараж, тайник, ворота станции не срабатывают в S1/S2)', /interaction\(\) \{\s*if \(this\.state !== 'walk' \|\| Scene\.id !== 'ST'\) return null;/.test(src));
ok('SC31 портал — только по ручному удержанию (не автоходом от касания), один переход за раз, билет применяется один раз', /const manualDir = dir;/.test(src) && /this\.updateScene\(dt, manualDir\)/.test(src) && /startTransition\(portal\) \{\s*if \(this\.trans\) return;/.test(src) && /if \(this\.applied === tr\.ticket\) return;/.test(src));
ok('SC32 жители и лампы станции обновляются только на станции; placeActors вызывается один раз', /if \(Scene\.id === 'ST'\) \{ updateActors\(dt\); updateLamps\(dt\); \}/.test(src) && (src.match(/[;{] placeActors\(\);/g) || []).length === 1);
ok('SC33 вне станции pv.player.v1 не меняется периодической записью; при уходе со станции в него пишется точка перед P1', /if \(Scene\.id !== 'ST'\) \{ this\.writeScene\(/.test(src) && /if \(from === 'ST'\) this\.writePlayerV1\(safe\)/.test(src) && /else this\.writePlayerV1\(this\.v1Fallback\(\)\)/.test(src));
ok('SC34 R (в центр) — только на станции', /if \(Scene\.id !== 'ST' \|\| this\.trans\) return; Player\.reset\(\)/.test(src));
ok('SC35 касание точки — по этажам активной сцены; камера — по ширине активной сцены', /tapTarget\(\{ FLOORS: Scene\.floors\(\), TOUCH: CONFIG\.TOUCH \}/.test(src) && /clampX\(x\) \{ return clamp\(x, 0, Math\.max\(0, Scene\.W\(\) - this\.viewW\)\); \}/.test(src));
ok('SC36 нет новых кнопок интерфейса и надписей «заперто» в наружных сценах', (() => { const b = src.slice(src.indexOf('function buildOutdoor'), src.indexOf('const Scene = {')); return b.length > 1000 && !/заперто|button|addEventListener/i.test(b); })());
ok('SC37 испорченная запись сцены удаляется только своим ключом', /localStorage\.removeItem\(saveKey\(CONFIG\.SCENE\.SAVE_KEY\)\)/.test(src) && !/loadScene\(\) \{[\s\S]{0,1200}removeItem\(saveKey\(CONFIG\.PLAYER/.test(src));
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
