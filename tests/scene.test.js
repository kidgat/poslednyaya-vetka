/* Фаза А (ШТАБ-018 / CL-014): реестр сцен ST, S1, S2 — порталы края, точки появления, граф, запись pv.scene.v1.
   Чистые функции из блока SCENE:BEGIN/END и проверки исходника. Запуск: node tests/scene.test.js */
const fs = require('fs'), path = require('path');
const src = require('./_src.js');   // TECH-001: сборка из src/
const CONFIG = Function(`${src.slice(src.indexOf('const CONFIG = {'), src.indexOf('\n};', src.indexOf('const CONFIG = {')) + 3)} return CONFIG;`)();
const S = Function(`${src.slice(src.indexOf('/* SCENE:BEGIN'), src.indexOf('/* SCENE:END */'))}; return { sceneFloors, edgePortalAt, sceneDoors, doorPortalAt, portalSafeSpot, portalTarget, parseSceneSave, validateScenes };`)();
const { parsePlayerSave } = Function(`${src.slice(src.indexOf('/* SCAVENGE:BEGIN */'), src.indexOf('/* SCAVENGE:END */'))}; return { parsePlayerSave };`)();
const { envSaveKey } = Function(`${src.slice(src.indexOf('/* ENV:BEGIN'), src.indexOf('/* ENV:END */'))}; return { envSaveKey };`)();
let pass = 0, fail = 0;
const ok = (n, c, i = '') => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  [' + i + ']' : ''}`); };
const SC = CONFIG.SCENES, C = CONFIG.SCENE, F = CONFIG.FLOORS;
const portal = (id, pid) => (SC[id].portals.find(p => p.id === pid) || S.sceneDoors(CONFIG, id).find(p => p.id === pid));

// Реестр и граф (ST-VIEW-001: поверхность — отдельная сцена SURF; станция — только подземка)
ok('SC01 реестр: ровно ST, SURF, S1, S2; validateScenes без ошибок', JSON.stringify(Object.keys(SC)) === '["ST","SURF","S1","S2"]' && S.validateScenes(CONFIG).length === 0, S.validateScenes(CONFIG).join('; '));
ok('SC02 ST использует этажи станции без изменений (тот же объект CONFIG.FLOORS)', S.sceneFloors(CONFIG, 'ST') === F && SC.ST.W === 2000);
ok('SC03 геометрия S1 (ШТАБ-022): W 3600, дорожка 60–3540 на уровне земли станции, версия геометрии 2, слоистая', SC.S1.W === 3600 && SC.S1.floors.surface.minX === 60 && SC.S1.floors.surface.maxX === 3540 && SC.S1.floors.surface.y === F.surface.y && SC.S1.geo === 2 && SC.S1.layered === true);
ok('SC04 геометрия S2: W 1500, дорожка 160–1440 на уровне земли станции', SC.S2.W === 1500 && SC.S2.floors.surface.minX === 160 && SC.S2.floors.surface.maxX === 1440 && SC.S2.floors.surface.y === F.surface.y);
ok('SC05 наружные сцены (SURF, S1, S2) — только этаж surface (нет интерьеров и тоннелей)', ['SURF', 'S1', 'S2'].every(id => JSON.stringify(Object.keys(SC[id].floors)) === '["surface"]'));
ok('SC06 у ST нет порталов края; выход — дверь D_exit из вестибюля в SURF', SC.ST.portals.length === 0 && S.sceneDoors(CONFIG, 'ST').length === 1 && portal('ST', 'D_exit').floor === 'vestibule' && portal('ST', 'D_exit').to === 'SURF');
ok('SC07 левый край S2 — граница без портала', !SC.S2.portals.some(p => p.edge === 'left'));
const edges = id => [...SC[id].portals, ...S.sceneDoors(CONFIG, id)];
const reach = from => { const seen = new Set([from]), q = [from]; while (q.length) for (const p of edges(q.shift())) if (!seen.has(p.to)) { seen.add(p.to); q.push(p.to); } return seen; };
ok('SC08 из SURF/S1/S2 есть путь домой на ST; из ST достижимы ST, SURF, S1, S2', ['SURF', 'S1', 'S2'].every(id => reach(id).has('ST')) && [...reach('ST')].sort().join() === 'S1,S2,ST,SURF');
ok('SC09 дверь/портал → обратный путь → исходная точка появления', (() => {
  const metro = S.portalTarget(CONFIG, portal('SURF', 'D_metro')), exit = S.portalTarget(CONFIG, portal('ST', 'D_exit'));
  const yard = S.portalTarget(CONFIG, portal('SURF', 'D_yard')), back = S.portalTarget(CONFIG, portal('S1', 'P1r'));
  const c = S.portalTarget(CONFIG, portal('S1', 'P2')), d = S.portalTarget(CONFIG, portal('S2', 'P2r'));
  return metro.scene === 'ST' && metro.floor === 'vestibule' && metro.x === 1650 && exit.scene === 'SURF' && exit.floor === 'surface' && exit.x === 680
    && yard.scene === 'S1' && yard.x === 3500 && yard.facing === -1 && back.scene === 'SURF' && back.x === 2080 && back.facing === 1
    && c.scene === 'S2' && c.x === 1400 && c.facing === -1 && d.scene === 'S1' && d.x === 100 && d.facing === 1;
})());

// Двери-порталы (по действию, в точке x) и порталы края
ok('SC10 двери: вход в метро (SURF 560), во дворы (SURF 1980), выход (ST вестибюль 1650); между ними — ничего', S.doorPortalAt(CONFIG, 'SURF', 'surface', 560)?.id === 'D_metro' && S.doorPortalAt(CONFIG, 'SURF', 'surface', 1980)?.id === 'D_yard'
  && S.doorPortalAt(CONFIG, 'ST', 'vestibule', 1650)?.id === 'D_exit' && !S.doorPortalAt(CONFIG, 'SURF', 'surface', 1000) && !S.doorPortalAt(CONFIG, 'ST', 'surface', 1650));
ok('SC11 дверь срабатывает в пределах radius и не срабатывает вне его / не на том этаже', S.doorPortalAt(CONFIG, 'SURF', 'surface', 560 + 44)?.id === 'D_metro' && !S.doorPortalAt(CONFIG, 'SURF', 'surface', 560 + 45) && !S.doorPortalAt(CONFIG, 'S1', 'surface', 560));
ok('SC12 внутренние этажи станции (вестибюль, ярусы, платформа) у своих краёв порталов края не дают', Object.entries(F).filter(([f]) => f !== 'surface').every(([f, Fl]) => !S.edgePortalAt(CONFIG, 'ST', f, Fl.minX, -1) && !S.edgePortalAt(CONFIG, 'ST', f, Fl.maxX, 1)));
ok('SC13 у ST нет порталов края ни на одном этаже', Object.keys(S.sceneFloors(CONFIG, 'ST')).every(f => !S.edgePortalAt(CONFIG, 'ST', f, F[f] ? F[f].minX : 0, -1) && !S.edgePortalAt(CONFIG, 'ST', f, F[f] ? F[f].maxX : 0, 1)));
ok('SC14 S1: справа P1r (→ SURF), слева P2 (→ S2); S2: справа P2r (→ S1), слева ничего', S.edgePortalAt(CONFIG, 'S1', 'surface', 3540, 1)?.to === 'SURF' && S.edgePortalAt(CONFIG, 'S1', 'surface', 60, -1)?.to === 'S2'
  && S.edgePortalAt(CONFIG, 'S2', 'surface', 1440, 1)?.to === 'S1' && !S.edgePortalAt(CONFIG, 'S2', 'surface', 160, -1));
ok('SC15 неизвестная сцена или этаж → null (без исключения)', S.edgePortalAt(CONFIG, 'XX', 'surface', 0, -1) === null && S.edgePortalAt(CONFIG, 'S1', 'platform', 60, -1) === null);
ok('SC16 точки появления не на портале: от края не ближе SAFE, обратный портал взводится только после REARM', Object.entries(SC).every(([id, s]) => Object.values(s.spawns).every(sp => {
  const Fl = S.sceneFloors(CONFIG, id)[sp.floor]; return !S.edgePortalAt(CONFIG, id, sp.floor, sp.x, -1) && !S.edgePortalAt(CONFIG, id, sp.floor, sp.x, 1) && sp.x - Fl.minX >= C.SAFE - 0.5 && Fl.maxX - sp.x >= C.SAFE - 0.5;
})) && C.REARM > 0 && C.REARM < C.SAFE);
ok('SC17 удержание 0,2–0,3 с, затемнение 0,3–0,6 с, кэш — текущая + предыдущая', C.HOLD >= 0.2 && C.HOLD <= 0.3 && C.FADE >= 0.3 && C.FADE <= 0.6 && C.CACHE === 2);

// Петля без дрейфа (чистая модель графа): 60 кругов SURF→S1→S2→S1→SURF
ok('SC18 60 кругов SURF→S1→S2→S1→SURF: те же точки появления, без дрейфа', (() => {
  const seq = [['SURF', 'D_yard'], ['S1', 'P2'], ['S2', 'P2r'], ['S1', 'P1r']]; const first = [];
  for (let k = 0; k < 60; k++) for (let i = 0; i < seq.length; i++) {
    const t = S.portalTarget(CONFIG, portal(...seq[i])), key = JSON.stringify(t);
    if (k === 0) first.push(key); else if (first[i] !== key) return false;
  }
  return first.length === 4;
})());

// pv.scene.v1
const P = o => S.parseSceneSave(CONFIG, JSON.stringify(o));
ok('SC20 ключ: PROD pv.scene.v1, DEV pv.dev.scene.v1', envSaveKey('prod', C.SAVE_KEY) === 'pv.scene.v1' && envSaveKey('dev', C.SAVE_KEY) === 'pv.dev.scene.v1');
ok('SC21 обычная запись S1/S2 восстанавливается как есть', (() => { const a = P({ v: 1, scene: 'S1', g: 2, floor: 'surface', x: 900.04, facing: -1, pending: null }), b = P({ v: 1, scene: 'S2', floor: 'surface', x: 500, facing: 1 });
  return a && a.scene === 'S1' && a.x === 900 && a.facing === -1 && !a.pending && b && b.scene === 'S2' && b.x === 500; })());
ok('SC22 прерванный переход → безопасная точка ПЕРЕД порталом/дверью на стороне источника', (() => {
  const a = P({ v: 1, scene: 'SURF', g: 1, floor: 'surface', x: 560, facing: 1, pending: { portal: 'D_metro', from: 'SURF', to: 'ST', ticket: 3 } });   // дверь: у самой двери
  const b = P({ v: 1, scene: 'S1', g: 2, floor: 'surface', x: 100, facing: -1, pending: { portal: 'P2', from: 'S1', to: 'S2', ticket: 9 } });              // край
  const e = P({ v: 1, scene: 'ST', floor: 'vestibule', x: 1650, pending: { portal: 'D_exit', from: 'ST', to: 'SURF', ticket: 1 } });                        // дверь выхода
  return a.scene === 'SURF' && a.x === 560 && a.facing === 1 && a.pending && b.scene === 'S1' && b.x === 60 + C.SAFE && e.scene === 'ST' && e.floor === 'vestibule' && e.x === 1650;
})());
ok('SC23 точка источника для ST — допустимая запись pv.player.v1 для 1.2.0 (вестибюль, не удалённая поверхность)', (() => {
  const a = P({ v: 1, scene: 'ST', floor: 'vestibule', x: 1650, pending: { portal: 'D_exit', from: 'ST', to: 'SURF', ticket: 1 } });
  const v1 = parsePlayerSave(CONFIG, JSON.stringify({ v: 1, floor: a.floor, x: a.x, facing: a.facing }));
  const sp = SC.ST.spawns.fromSurf, v2 = parsePlayerSave(CONFIG, JSON.stringify({ v: 1, floor: sp.floor, x: sp.x, facing: sp.facing }));
  return v1 && v1.floor === 'vestibule' && v2 && v2.floor === 'vestibule' && v2.x === 1650;
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
ok('SC30 действия по сценам: двери-порталы везде, подземные действия только на ST, сбор топлива только на SURF', /interaction\(\) \{\s*if \(this\.state !== 'walk'\) return null;/.test(src) && /doorPortalAt\(CONFIG, Scene\.id, this\.floor, this\.x\)/.test(src) && /if \(Scene\.id === 'ST'\)/.test(src) && /else if \(Scene\.id === 'SURF'\)[\s\S]{0,200}SCAVENGE\.SPOTS/.test(src));
ok('SC31 портал — только по ручному удержанию (не автоходом от касания), один переход за раз, билет применяется один раз', /const manualDir = dir;/.test(src) && /this\.updateScene\(dt, manualDir\)/.test(src) && /startTransition\(portal\) \{\s*if \(this\.trans\) return;/.test(src) && /if \(this\.applied === tr\.ticket\) return;/.test(src));
ok('SC32 жители и лампы станции обновляются только на станции; placeActors вызывается один раз', /if \(Scene\.id === 'ST'\) \{ updateActors\(dt\); updateLamps\(dt\); \}/.test(src) && (src.match(/[;{] placeActors\(\);/g) || []).length === 1);
ok('SC33 вне станции pv.player.v1 не меняется периодической записью; при уходе со станции в него пишется точка перед P1', /if \(Scene\.id !== 'ST'\) \{ this\.writeScene\(/.test(src) && /if \(from === 'ST'\) this\.writePlayerV1\(safe\)/.test(src) && /else this\.writePlayerV1\(this\.v1Fallback\(\)\)/.test(src));
ok('SC34 R (в центр) — только на станции', /if \(Scene\.id !== 'ST' \|\| this\.trans\) return; Player\.reset\(\)/.test(src));
ok('SC35 касание точки — по этажам активной сцены; камера — по ширине активной сцены', /tapTarget\(\{ FLOORS: Scene\.floors\(\), TOUCH: CONFIG\.TOUCH \}/.test(src) && /clampX\(x\) \{ return clamp\(x, 0, Math\.max\(0, Scene\.W\(\) - this\.viewW\)\); \}/.test(src));
ok('SC36 нет новых кнопок интерфейса и надписей «заперто» в наружных сценах', (() => { const b = src.slice(src.indexOf('function buildOutdoor'), src.indexOf('const Scene = {')); return b.length > 1000 && !/заперто|button|addEventListener/i.test(b); })());
ok('SC37 испорченная запись сцены удаляется только своим ключом', /localStorage\.removeItem\(saveKey\(CONFIG\.SCENE\.SAVE_KEY\)\)/.test(src) && !/loadScene\(\) \{[\s\S]{0,1200}removeItem\(saveKey\(CONFIG\.PLAYER/.test(src));

// ШТАБ-022: миграция геометрии S1 и реальная архитектурная шкала
ok('SC26 запись S1 старой геометрии (без g или g ≠ 2) не восстанавливается → дальше работает pv.player.v1 (улица ST x 1176)', P({ v: 1, scene: 'S1', floor: 'surface', x: 900, facing: 1 }) === null && P({ v: 1, scene: 'S1', g: 1, floor: 'surface', x: 900 }) === null
  && P({ v: 1, scene: 'S1', floor: 'surface', x: 100, pending: { portal: 'P2', from: 'S1', to: 'S2', ticket: 1 } }) === null && P({ v: 1, scene: 'S2', floor: 'surface', x: 500 }) !== null);
const ST2 = CONFIG.STREET, M = ST2.HERO / 1.75;
ok('SC40 шкала: Глеб 40 px = 1,75 м; дверь 46–49 px (2,0–2,1 м) и выше Глеба', ST2.HERO === 40 && ST2.DOOR_H >= 46 && ST2.DOOR_H <= 49 && ST2.DOOR_H > ST2.HERO, `дверь ${ST2.DOOR_H} = ${(ST2.DOOR_H / M).toFixed(2)} м`);
ok('SC41 шаг этажа 62–69 px (2,7–3,0 м); окно 27–34 px по высоте', ST2.PITCH >= 62 && ST2.PITCH <= 69 && ST2.WIN_H >= 27 && ST2.WIN_H <= 34, `этаж ${(ST2.PITCH / M).toFixed(2)} м, окно ${(ST2.WIN_H / M).toFixed(2)} м`);
ok('SC42 правило автора: низ окна 1-го этажа (цоколь + подоконник) выше макушки Глеба', ST2.PLINTH + ST2.SILL > ST2.HERO, `подоконник ${ST2.PLINTH + ST2.SILL} px = ${((ST2.PLINTH + ST2.SILL) / M).toFixed(2)} м над дорожкой`);
ok('SC43 пятиэтажка с цоколем и парапетом — 320–380 px; окно с подоконником и перемычкой помещается в этаж', (() => { const h = ST2.PLINTH + ST2.FLOORS * ST2.PITCH + ST2.PARAPET; return ST2.FLOORS === 5 && h >= 320 && h <= 380 && ST2.SILL + ST2.WIN_H < ST2.PITCH - 6; })(), `${ST2.PLINTH + ST2.FLOORS * ST2.PITCH + ST2.PARAPET} px`);
ok('SC44 слои улицы выше дома и ниже дорожки: TOP ≥ 380 px над землёй (крыша уходит за кадр, неба хватает)', -ST2.TOP - (-F.surface.y) >= 380);
ok('SC45 раскладка S1: дом №1 (4 подъезда) и спортплощадка внутри сцены, не перекрываются; завал у правого края', (() => { const L = SC.S1.layout, h1 = [L.house1[0], L.house1[0] + L.house1[1] * ST2.SECTION], h2 = [L.house2[0], L.house2[0] + L.house2[1] * ST2.SECTION];
  return L.house1[1] === 4 && h1[1] <= L.edgeR[0] && L.sport[1] <= h1[0] && h2[1] <= L.sport[0] && L.edgeR[1] <= SC.S1.W && h2[0] >= 0; })());
ok('SC46 камера улицы: отдельная ветка только для слоистых сцен, ступни на 0,78–0,80; станция — прежний путь', SC.S1.floors.surface.cam >= 0.78 && SC.S1.floors.surface.cam <= 0.8 && /if \(Scene\.def\(\)\.layered\) \{ const F = Scene\.floor\(f\); return clamp\(F\.y - this\.viewH \* F\.cam, CONFIG\.STREET\.TOP, -this\.viewH\); \}/.test(src) && !SC.ST.layered && !SC.S2.layered);
ok('SC47 улица рисуется процедурно в самой странице (внешних файлов нет — офлайн-кэш sw.js не меняется)', (() => { const b = src.slice(src.indexOf('/* STREET:BEGIN'), src.indexOf('/* STREET:END */')); return b.length > 5000 && !/new Image|fetch\(|\.png|\.jpe?g|\.webp/.test(b); })());
// ST-VIEW-001: поверхность станции как отдельная сцена
ok('SC50 SURF: длинная слоистая улица, свой этаж surface на уровне земли, двери внутри дорожки, обе ведут домой', SC.SURF.W >= 3000 && SC.SURF.layered === true && SC.SURF.floors.surface.y === F.surface.y
  && S.sceneDoors(CONFIG, 'SURF').every(d => d.x > SC.SURF.floors.surface.minX && d.x < SC.SURF.floors.surface.maxX) && reach('SURF').has('ST'));
ok('SC51 миграция: старая запись «станция/поверхность» в loadScene уводит на SURF; поверхность из pv.player.v1 → домой', /if \(r\.scene === 'ST' && r\.floor === 'surface'\) \{[\s\S]{0,260}Scene\.enter\('SURF'\)/.test(src) && /if \(p && p\.floor !== 'surface'\) Player\.place/.test(src));
ok('SC52 дверь-портал в игре: действие use у двери запускает переход с затемнением (startTransition)', /if \(action === 'use' && it && it\.kind === 'door'\) \{ if \(!this\.trans\) this\.startTransition\(it\.portal\); /.test(src) && /it\.kind === 'door' \? it\.label/.test(src));
ok('SC53 вход в метро ведёт в вестибюль, выход — на surface; обратные точки согласованы (дверь ⇄ точка)', (() => {
  const toST = S.portalTarget(CONFIG, portal('SURF', 'D_metro')), toSURF = S.portalTarget(CONFIG, portal('ST', 'D_exit'));
  const Fv = S.sceneFloors(CONFIG, 'ST')[toST.floor], Fs = S.sceneFloors(CONFIG, 'SURF')[toSURF.floor];
  return toST.x >= Fv.minX && toST.x <= Fv.maxX && toSURF.x >= Fs.minX && toSURF.x <= Fs.maxX;
})());
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
