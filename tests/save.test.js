/* SAVE-001 этап 1: ядро сохранений (без браузера): node tests/save.test.js
   Блок SAVE:BEGIN/END и parsePlayerSave вынимаются из index.html. Хранилище — подделка с внедрением сбоев (quota, порча, потеря записи). */
const fs = require('fs'), path = require('path');
const src = require('./_src.js');   // TECH-001: сборка из src/
const cut = (from, to) => { const i = src.indexOf(from); if (i < 0) throw new Error('нет ' + from); return src.slice(i, src.indexOf(to, i) + to.length); };
const CONFIG = Function(`${cut('const CONFIG = {', '\n};')} return CONFIG;`)();
const env = Function(`${src.slice(src.indexOf('/* ENV:BEGIN'), src.indexOf('/* ENV:END */'))}; return { detectEnv, envSaveKey };`)();
const blk = src.slice(src.indexOf('/* SAVE:BEGIN'), src.indexOf('/* SAVE:END */'));
const S = Function('CONFIG', `${cut('function parsePlayerSave(', '\n}')}\n${blk}; return { SAVE_KEYS, saveSum, makeRecord, recordValid, stateValid, initialState, emptyStore, storeValid,
  addCheckpoint, applyRest, beginHealCycle, HEAL_CYCLE_EVENTS, restAndSave, autoBeforeExit, deathRestore, loadMenu, loadChoice, dedGift, makeSession, sessionValid, createSaveIO, migrateV1 };`)(CONFIG);
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  [' + info + ']' : ''}`); };
/** Поддельное хранилище: mode — 'ok' | 'quota' (set бросает) | 'corrupt' (пишет обрезанное) | 'lose' (set молча не пишет). */
function fakeIO(envName = 'prod') {
  const m = new Map(); const io = { m, mode: 'ok', failKey: null,
    get: k => (m.has(k) ? m.get(k) : null),
    set: (k, v) => { const hit = !io.failKey || k.endsWith(io.failKey);
      if (hit && io.mode === 'quota') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      if (hit && io.mode === 'corrupt') { m.set(k, v.slice(0, v.length >> 1)); return; }
      if (hit && io.mode === 'lose') return; m.set(k, v); },
    keyOf: k => env.envSaveKey(envName, k) };
  return io;
}
const st0 = S.emptyStore(CONFIG), init = S.initialState(CONFIG);
const at = (st, hp = 63, extra = {}) => ({ ...JSON.parse(JSON.stringify(init)), hp, ...extra });

// ---- формат ----
ok('SV01 новая игра: только initial в комнате Глеба (upper, x 100), HP 100/100, валюта 0, фильтров 0; auto и manual пусты', st0.initial.state.floor === 'upper' && st0.initial.state.x === 100
  && st0.initial.state.hp === 100 && st0.initial.state.inv.wallet === 0 && st0.initial.state.inv.filters === 0 && st0.auto === null && st0.manual.length === 0 && S.storeValid(st0));
const r1 = S.makeRecord('tea', 5, at(st0));
ok('SV02 запись: v, id, source, seq, at, state, sum; сумма ловит любую правку', r1.v === 2 && r1.id === 'tea:5' && r1.source === 'tea' && r1.seq === 5 && S.recordValid(r1)
  && !S.recordValid({ ...r1, state: { ...r1.state, hp: 99 } }) && !S.recordValid({ ...r1, seq: 6 }) && !S.recordValid({ ...r1, source: 'session' }));
ok('SV03 снимок — копия: последующие изменения состояния не затрагивают записанный checkpoint', (() => { const s = at(st0); const r = S.makeRecord('tea', 1, s); s.hp = 1; s.inv.ammo.x = 5; return r.state.hp === 63 && !r.state.inv.ammo.x; })());

// ---- checkpoint: 1 auto + 2 manual ----
let st = st0, res;
res = S.restAndSave(st, at(st0, 40), 'tea'); st = res.store;
ok('SV04 первый чай: +50 % maxHP (40 → 90), снимок ПОСЛЕ лечения', res.ok && res.healed && res.state.hp === 90 && st.manual[0].state.hp === 90 && st.manual[0].source === 'tea');
const s2 = S.restAndSave(st, res.state, 'tea'); st = s2.store;
ok('SV05 повторный чай: сохраняет, но не лечит; реплика «Я уже напился чая»', s2.ok && !s2.healed && s2.state.hp === 90 && s2.line === 'Я уже напился чая' && st.manual.length === 2 && st.manual[0].seq > st.manual[1].seq);
const s3 = S.restAndSave(st, { ...s2.state, hp: 20 }, 'sleep'); st = s3.store;
ok('SV06 первый сон: до 100 % maxHP; повторный — сохраняет без лечения, «Я уже выспался»', s3.healed && s3.state.hp === 100 && (() => { const s4 = S.restAndSave(st, { ...s3.state, hp: 30 }, 'sleep'); return s4.ok && !s4.healed && s4.state.hp === 30 && s4.line === 'Я уже выспался'; })());
ok('SV07 ручных записей — две последние: третья вытесняет старшую, порядок по seq', st.manual.length === 2 && st.manual[0].source === 'sleep' && st.manual[1].source === 'tea' && st.manual[0].seq === 3 && st.manual[1].seq === 2);
ok('SV08 чай подряд 10 раз — 10 сохранений (seq растёт), HP не растёт после первого', (() => { let x = S.emptyStore(CONFIG), s = at(st0, 10), hp = [];
  for (let i = 0; i < 10; i++) { const r = S.restAndSave(x, s, 'tea'); x = r.store; s = r.state; hp.push(s.hp); } return x.seq === 10 && hp[0] === 60 && hp.every(h => h === 60) && x.manual[0].seq === 10; })());
ok('SV09 выход за дверь и возврат не сбрасывают лечение: цикл открывается только событием из утверждённого списка (сейчас пуст)', S.HEAL_CYCLE_EVENTS.length === 0
  && !S.beginHealCycle(s3.state, 'leave-shelter').ok && !S.beginHealCycle(s3.state, 'door').ok && !S.beginHealCycle(s3.state, 'surface-trip').ok);
ok('SV10 checkpoint запрещён в токсичной среде и при HP 0 (смерть во время действия)', !S.addCheckpoint(st, 'tea', at(st0, 50, { atmo: 'toxic' })).ok
  && S.addCheckpoint(st, 'tea', at(st0, 50, { atmo: 'toxic' })).reason === 'toxic' && !S.restAndSave(st, at(st0, 0), 'tea').ok && !S.addCheckpoint(st, 'session', at(st0)).ok);

// ---- авто-checkpoint перед выходом ----
let a1 = S.autoBeforeExit(st, at(st0, 77, { floor: 'vestibule', x: 1650 }), 'gate-surface:1');
const a2 = S.autoBeforeExit(a1.store, at(st0, 70, { floor: 'vestibule', x: 1650 }), 'gate-surface:1');
const a3 = S.autoBeforeExit(a2.store, at(st0, 70, { floor: 'vestibule', x: 1650 }), 'gate-surface:2');
ok('SV11 авто перед выходом: создаётся; повторная обработка ТОГО ЖЕ выхода — без новой записи; следующий выход — обновляет', a1.ok && a1.store.auto.state.hp === 77
  && a2.ok && a2.duplicate && a2.store === a1.store && a3.ok && !a3.duplicate && a3.store.auto.seq > a1.store.auto.seq && a3.store.auto.state.exitId === 'gate-surface:2');
ok('SV12 авто не создаётся на токсичной стороне и без идентификатора выхода', !S.autoBeforeExit(st, at(st0, 70, { atmo: 'toxic' }), 'gate-surface:9').ok && !S.autoBeforeExit(st, at(st0), '').ok);

// ---- смерть и меню ----
ok('SV13 смерть: последний по seq checkpoint (здесь авто 2-го выхода, HP 70), а не session', S.deathRestore(a3.store).hp === 70 && S.deathRestore(a3.store).exitId === 'gate-surface:2');
ok('SV14 смерть до первого checkpoint — безопасное начало в комнате Глеба', (() => { const r = S.deathRestore(S.emptyStore(CONFIG)); return r.floor === 'upper' && r.x === 100 && r.hp === 100; })());
ok('SV15 HP после смерти = HP на момент записи (63 → 63, а не 50 или 100)', (() => { const c = S.addCheckpoint(S.emptyStore(CONFIG), 'tea', at(st0, 63)); return S.deathRestore(c.store).hp === 63; })());
ok('SV16 смерть: повреждённая последняя запись пропускается — берётся следующая действительная', (() => { const x = JSON.parse(JSON.stringify(a3.store)); x.auto.state.hp = 1; return S.deathRestore(x).hp === s3.store.manual[0].state.hp; })());
const menu = S.loadMenu(a3.store, S.makeSession(at(st0, 12, { atmo: 'toxic', floor: 'surface', x: 1500 })));
ok('SV17 меню: «Продолжить» из session (даже в опасной зоне), авто / последнее / предыдущее ручное — доступны', menu.continue.enabled && menu.auto.enabled && menu.lastManual.enabled && menu.prevManual.enabled
  && menu.lastManual.seq > menu.prevManual.seq);
const m0 = S.loadMenu(S.emptyStore(CONFIG), null);
ok('SV18 меню новой игры: всё недоступно с объяснением', !m0.continue.enabled && !m0.auto.enabled && !m0.lastManual.enabled && !m0.prevManual.enabled
  && m0.auto.reason && m0.lastManual.reason && m0.prevManual.reason && m0.continue.reason);
ok('SV19 загрузка выбранной точки ЗАМЕНЯЕТ состояние целиком (копия; правка результата не портит запись)', (() => { const s = S.loadChoice(a3.store, 'prevManual'); const before = a3.store.manual[1].state.hp; s.hp = 1;
  return before === a3.store.manual[1].state.hp && S.loadChoice(a3.store, 'auto').exitId === 'gate-surface:2' && S.loadChoice(a3.store, 'nope') === null; })());

// ---- подарок Деда ----
const g0 = at(st0, 80); g0.inv.ammo['357'] = 18;
const g1 = S.dedGift(g0), g2 = S.dedGift(g1.state);
ok('SV20 подарок Деда: +10 валюты и +2 фильтра вместе с флагом; .357 не тронуты; исходное состояние не изменено', g1.given && g1.state.inv.wallet === 10 && g1.state.inv.filters === 2
  && g1.state.flags.ded_gift_given === true && g1.state.inv.ammo['357'] === 18 && g0.inv.wallet === 0 && !g0.flags.ded_gift_given);
ok('SV21 повторный подарок ничего не даёт (тот же объект); чай / сон тоже не дают валюты и фильтров', !g2.given && g2.state === g1.state && (() => { const r = S.restAndSave(S.emptyStore(CONFIG), g1.state, 'tea'); return r.state.inv.wallet === 10 && r.state.inv.filters === 2; })());
ok('SV22 откат на сохранение ДО встречи — флаг и предметы откатываются вместе; новая встреча снова даёт подарок (без дублей в одной линии)', (() => {
  let x = S.addCheckpoint(S.emptyStore(CONFIG), 'tea', g0).store; const after = S.dedGift(g0).state; const back = S.deathRestore(x);
  return !back.flags.ded_gift_given && back.inv.wallet === 0 && S.dedGift(back).given && S.dedGift(S.dedGift(back).state).given === false && after.inv.wallet === 10; })());

// ---- хранилище, сбои ----
const io = fakeIO('prod'), IO = S.createSaveIO(io);
ok('SV23 ключи PROD: pv.game.v2 / pv.game.v2.bak / pv.session.v2; DEV — pv.dev.*', (() => { const d = fakeIO('dev'), D = S.createSaveIO(d); D.saveStore(st0); D.saveSession(init);
  IO.saveStore(st0); IO.saveSession(init); return [...io.m.keys()].sort().join() === 'pv.game.v2,pv.game.v2.bak,pv.session.v2' && [...d.m.keys()].sort().join() === 'pv.dev.game.v2,pv.dev.game.v2.bak,pv.dev.session.v2'; })());
IO.saveStore(a3.store);
io.mode = 'quota';
const q = IO.saveStore(S.addCheckpoint(a3.store, 'tea', at(st0, 55)).store);
io.mode = 'ok';
ok('SV24 переполнение хранилища (quota): ok false, прежняя запись цела и загружается', !q.ok && q.reason === 'quota' && IO.loadStore().store.seq === a3.store.seq && IO.loadStore().from === 'root');
io.mode = 'corrupt'; io.failKey = 'game.v2';
const c = IO.saveStore(S.addCheckpoint(a3.store, 'tea', at(st0, 55)).store);
io.mode = 'ok'; io.failKey = null;
const lc = IO.loadStore();
ok('SV25 испорченная запись (обрыв): проверка чтением ловит, загрузка — из резервной копии с прежним seq', !c.ok && c.reason === 'verify' && lc.store && lc.store.seq === a3.store.seq);
io.m.set('pv.game.v2', '{"v":2,"seq":');
ok('SV26 битая основная запись при старте → восстановление из .bak и починка основной', (() => { const r = IO.loadStore(); return r.from === 'bak' && r.store.seq === a3.store.seq && S.storeValid(JSON.parse(io.m.get('pv.game.v2'))); })());
io.m.set('pv.game.v2', 'x'); io.m.set('pv.game.v2.bak', 'y');
ok('SV27 обе записи испорчены → store null, from corrupt (игра начинает с initial, session не трогается)', (() => { const r = IO.loadStore(); return r.store === null && r.from === 'corrupt'; })());
ok('SV28 запись с чужой версией / подменённой суммой не принимается', (() => { const x = JSON.parse(JSON.stringify(a3.store)); x.v = 3; const y = JSON.parse(JSON.stringify(a3.store)); y.manual[0].sum = '00000000';
  return !S.storeValid(x) && !S.storeValid(y); })());
io.mode = 'lose';
const lo = IO.saveStore(st0);
io.mode = 'ok';
ok('SV29 запись молча потерялась (закрытие PWA / сбой) — обнаружено, ok false', !lo.ok && lo.reason === 'verify');
ok('SV30 session: пишется отдельно; битая session не мешает checkpoint и наоборот', (() => { const i2 = fakeIO('prod'), I2 = S.createSaveIO(i2); I2.saveStore(a3.store); I2.saveSession(at(st0, 5, { atmo: 'toxic' }));
  i2.m.set('pv.session.v2', 'oops'); return I2.loadSession() === null && I2.loadStore().store.seq === a3.store.seq; })());

// ---- миграция ----
const old = new Map([['pv.player.v1', JSON.stringify({ v: 1, floor: 'utility', x: 150, facing: -1 })], ['pv.power.v1', '{"v":1}']]);
const mg = S.migrateV1(CONFIG, k => old.get(k) ?? null);
ok('SV31 миграция 1.1.x: позиция pv.player.v1 → session («Продолжить»); checkpoint из неё НЕ создаётся — только initial', mg.session && mg.session.state.floor === 'utility' && mg.session.state.x === 150
  && mg.store.auto === null && mg.store.manual.length === 0 && mg.store.initial.state.floor === 'upper' && S.storeValid(mg.store) && S.sessionValid(mg.session));
ok('SV32 миграция ничего не удаляет и не меняет в прежних ключах; битая pv.player.v1 → без session', old.size === 2 && old.get('pv.power.v1') === '{"v":1}'
  && S.migrateV1(CONFIG, k => (k === 'pv.player.v1' ? '{bad' : null)).session === null);
ok('SV33 ядро ещё не встроено в игру: функции SAVE вызываются только из тестов (этап 1)', !/\b(createSaveIO|restAndSave|autoBeforeExit|deathRestore|migrateV1)\(/.test(src.replace(blk, '')));
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);
