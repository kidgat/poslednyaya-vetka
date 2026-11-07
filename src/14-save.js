/* SAVE:BEGIN — SAVE-001 этап 1 (ШТАБ-015 § 3): ядро сохранений. Чистые функции + адаптер хранилища; В ИГРУ ЕЩЁ НЕ ВСТРОЕНО.
   Три механизма:
   - session (pv.session.v2) — «Продолжить» после закрытия/сворачивания PWA; НЕ точка возрождения;
   - checkpoint-хранилище (pv.game.v2) — 1 auto + 2 последних manual (чай / сон) + initial (безопасный старт в комнате Глеба);
   - pv.game.v2.bak — последняя проверенная копия (last-known-good).
   DEV — pv.dev.* через saveKey (та же изоляция, что у действующих сохранений). localStorage не транзакционен: целостность —
   контрольной суммой, повторным чтением после записи и резервной копией; при сбое остаётся прежнее состояние. */
const SAVE_V = 2;
const SAVE_KEYS = { root: 'pv.game.v2', bak: 'pv.game.v2.bak', session: 'pv.session.v2' };
/** Каноническая сериализация (ключи по алфавиту) — одинаковая сумма для одинакового содержимого. */
function saveCanon(v) {
  if (Array.isArray(v)) return '[' + v.map(saveCanon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + saveCanon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function saveSum(obj) { const t = saveCanon(obj); let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
const SAVE_SOURCES = ['initial', 'auto', 'tea', 'sleep'];
/** Запись снимка: { v, id, source, seq, at, state, sum }. state — ПОЛНЫЙ самодостаточный снимок (копия, не ссылка). */
function makeRecord(source, seq, state, at = 0) {
  const r = { v: SAVE_V, id: source + ':' + seq, source, seq, at, state: JSON.parse(JSON.stringify(state)) };
  r.sum = saveSum({ ...r, sum: undefined }); return r;
}
function recordValid(r) {
  return !!(r && typeof r === 'object' && r.v === SAVE_V && SAVE_SOURCES.includes(r.source) && Number.isInteger(r.seq) && r.seq >= 0
    && r.state && typeof r.state === 'object' && stateValid(r.state) && r.state.atmo !== 'toxic' && r.sum === saveSum({ ...r, sum: undefined }));   // checkpoint в токсичной среде недействителен
}
/** Минимальная проверка полного состояния: то, что уже есть в игре, + поля будущих систем (HP, лечение, запасы, флаги). */
function stateValid(s) {
  return !!(s && typeof s.floor === 'string' && Number.isFinite(s.x) && Number.isFinite(s.hp) && Number.isFinite(s.maxHp) && s.hp >= 0 && s.hp <= s.maxHp
    && s.heal && typeof s.heal.tea === 'boolean' && typeof s.heal.sleep === 'boolean' && s.flags && typeof s.flags === 'object'
    && s.inv && Number.isInteger(s.inv.wallet) && s.inv.wallet >= 0 && Number.isInteger(s.inv.filters) && s.inv.filters >= 0 && s.inv.ammo && typeof s.inv.ammo === 'object');
}
/** Безопасное начальное состояние новой игры — комната Глеба. Числа HP — заготовка до решения автора (maxHp 100 по ШТАБ-013). */
function initialState(cfg) {
  const H = cfg.PLAYER.HOME;
  return { scene: 'station', floor: H.floor, x: H.x, facing: 1, atmo: 'safe', hp: 100, maxHp: 100, heal: { tea: false, sleep: false },
    inv: { wallet: 0, filters: 0, ammo: {} }, flags: {}, world: {} };
}
function emptyStore(cfg, at = 0) { return { v: SAVE_V, seq: 0, initial: makeRecord('initial', 0, initialState(cfg), at), auto: null, manual: [] }; }
function storeValid(st) {
  return !!(st && st.v === SAVE_V && Number.isInteger(st.seq) && recordValid(st.initial) && (st.auto === null || recordValid(st.auto))
    && Array.isArray(st.manual) && st.manual.length <= 2 && st.manual.every(recordValid)
    && [st.auto, ...st.manual].filter(Boolean).every(r => r.seq <= st.seq) && (st.manual.length < 2 || st.manual[0].seq > st.manual[1].seq));
}
/** Новый checkpoint. Запрещён в токсичной атмосфере и при HP 0 (смерть во время действия). Возвращает НОВОЕ хранилище (старое не меняется). */
function addCheckpoint(st, source, state, at = 0) {
  if (!['auto', 'tea', 'sleep'].includes(source)) return { ok: false, reason: 'source' };
  if (!state || state.atmo === 'toxic') return { ok: false, reason: 'toxic' };
  if (!stateValid(state) || state.hp <= 0) return { ok: false, reason: 'state' };
  const seq = st.seq + 1, rec = makeRecord(source, seq, state, at), next = { ...st, seq };
  if (source === 'auto') next.auto = rec; else next.manual = [rec, ...st.manual].slice(0, 2);   // 2 последних ручных; старшие вытесняются
  return { ok: true, store: next, record: rec };
}
/** Чай / сон: лечение только при первом применении в текущем лечебном цикле; сохранение — ВСЕГДА. Выход за дверь цикл НЕ сбрасывает. */
function applyRest(state, kind) {
  if (!state || state.hp <= 0) return { ok: false, reason: 'dead' };
  const s = JSON.parse(JSON.stringify(state)), used = s.heal[kind];
  if (!used) { s.hp = kind === 'tea' ? Math.min(s.maxHp, s.hp + s.maxHp * 0.5) : s.maxHp; s.heal[kind] = true; }
  return { ok: true, state: s, healed: !used, line: used ? (kind === 'tea' ? 'Я уже напился чая' : 'Я уже выспался') : null };
}
/** Новый лечебный цикл — ТОЛЬКО по событию из утверждённого автором списка. Список пуст: сброса нет, эксплуатировать нечем. */
const HEAL_CYCLE_EVENTS = [];
function beginHealCycle(state, event) {
  if (!HEAL_CYCLE_EVENTS.includes(event)) return { ok: false, reason: 'not-approved' };
  const s = JSON.parse(JSON.stringify(state)); s.heal = { tea: false, sleep: false }; return { ok: true, state: s };
}
/** Чаепитие / сон целиком: состояние → лечение → снимок ПОСЛЕ лечения. */
function restAndSave(st, state, kind, at = 0) {
  const r = applyRest(state, kind); if (!r.ok) return r;
  const c = addCheckpoint(st, kind, r.state, at); if (!c.ok) return c;
  return { ok: true, store: c.store, state: r.state, healed: r.healed, line: r.line };
}
/** Авто-checkpoint перед выходом на поверхность: на безопасной стороне, идемпотентно для одного фактического выхода (exitId). */
function autoBeforeExit(st, state, exitId, at = 0) {
  if (typeof exitId !== 'string' || !exitId) return { ok: false, reason: 'exit-id' };
  if (st.auto && st.auto.state.exitId === exitId) return { ok: true, store: st, duplicate: true };
  return addCheckpoint(st, 'auto', { ...state, exitId }, at);
}
/** После смерти: последний по seq действительный checkpoint (auto или manual); если нет — initial. Session не используется. */
function deathRestore(st) {
  const c = [st.auto, ...st.manual].filter(r => r && recordValid(r)).sort((a, b) => b.seq - a.seq)[0];
  return JSON.parse(JSON.stringify((c || st.initial).state));
}
/** Меню загрузки: «Продолжить» (session) и «Загрузить сохранение» — авто / последнее ручное / предыдущее ручное. Недоступное — с причиной. */
function loadMenu(st, session) {
  const opt = (rec, none) => (rec && recordValid(rec) ? { enabled: true, id: rec.id, source: rec.source, seq: rec.seq } : { enabled: false, reason: none });
  return { continue: session && sessionValid(session) ? { enabled: true } : { enabled: false, reason: 'Нет прерванной игры' },
    auto: opt(st.auto, 'Ещё не было выхода на поверхность'), lastManual: opt(st.manual[0], 'Ещё не было чая или сна'), prevManual: opt(st.manual[1], 'Нужно два ручных сохранения') };
}
/** Выбор точки загрузки ЗАМЕНЯЕТ всё состояние (копия снимка), а не дополняет текущее. */
function loadChoice(st, choice) {
  const rec = { auto: st.auto, lastManual: st.manual[0], prevManual: st.manual[1], initial: st.initial }[choice];
  return rec && recordValid(rec) ? JSON.parse(JSON.stringify(rec.state)) : null;
}
/** Подарок Деда (первое узнавание Colt): +10 валютных и +2 фильтра вместе с флагом — одна новая копия состояния; повтор ничего не даёт.
    Обычные патроны (.357) не трогаются. Снимок можно сделать только с готового результата — частичного состояния не бывает. */
function dedGift(state) {
  if (state.flags.ded_gift_given) return { ok: true, state, given: false };
  const s = JSON.parse(JSON.stringify(state)); s.inv.wallet += 10; s.inv.filters += 2; s.flags.ded_gift_given = true;
  return { ok: true, state: s, given: true };
}
function sessionValid(x) { return !!(x && x.v === SAVE_V && x.state && stateValid(x.state) && x.sum === saveSum({ ...x, sum: undefined })); }
/** Session — текущее положение (может быть и в опасной зоне), «Продолжить». Не checkpoint. */
function makeSession(state, at = 0) { const x = { v: SAVE_V, at, state: JSON.parse(JSON.stringify(state)) }; x.sum = saveSum({ ...x, sum: undefined }); return x; }
/** Адаптер хранилища: запись с проверкой чтением и резервной копией. io — { get(k), set(k, v), keyOf(k) }. */
function createSaveIO(io) {
  const K = k => io.keyOf(SAVE_KEYS[k]);
  const raw = k => { try { return io.get(K(k)); } catch (_) { return null; } };
  const read = k => { try { const t = raw(k); return t ? JSON.parse(t) : null; } catch (_) { return null; } };
  return {
    /** Загрузка: основная запись → при порче резервная → при отсутствии обеих null (нужна миграция / новая игра). */
    loadStore() {
      const a = read('root'); if (storeValid(a)) return { store: a, from: 'root' };
      const b = read('bak'); if (storeValid(b)) { try { io.set(K('root'), JSON.stringify(b)); } catch (_) { /* чинить нечем — работаем с копией */ } return { store: b, from: 'bak' }; }
      return { store: null, from: raw('root') || raw('bak') ? 'corrupt' : 'none' };   // испорчено ≠ нет записи (для отчёта и миграции)
    },
    /** Запись нового хранилища: root → проверка чтением → bak. При ошибке (quota, порча) прежние root/bak остаются, ok: false. */
    saveStore(st) {
      if (!storeValid(st)) return { ok: false, reason: 'invalid' };
      const t = JSON.stringify(st);
      try { io.set(K('root'), t); } catch (e) { return { ok: false, reason: 'quota' }; }
      let back = null; try { back = io.get(K('root')); } catch (_) { /* нет чтения */ }
      if (back !== t) { const b = read('bak'); if (storeValid(b)) try { io.set(K('root'), JSON.stringify(b)); } catch (_) { /* остаётся bak */ } return { ok: false, reason: 'verify' }; }
      try { io.set(K('bak'), t); } catch (_) { return { ok: true, bak: false }; }
      return { ok: true, bak: true };
    },
    loadSession() { const x = read('session'); return sessionValid(x) ? x : null; },
    saveSession(state, at = 0) { try { io.set(K('session'), JSON.stringify(makeSession(state, at))); return { ok: true }; } catch (_) { return { ok: false, reason: 'quota' }; } },
  };
}
/** Миграция с 1.1.x: прежние pv.* ключи НЕ удаляются и не меняются. Позиция из pv.player.v1 → session («Продолжить»);
    checkpoint из старой позиции НЕ создаётся (о её безопасности ничего не известно) — только initial в комнате Глеба. */
function migrateV1(cfg, getOld, at = 0) {
  const st = emptyStore(cfg, at); let session = null;
  let p = null; try { p = parsePlayerSave(cfg, getOld(cfg.PLAYER.SAVE_KEY)); } catch (_) { p = null; }
  if (p) session = makeSession({ ...initialState(cfg), floor: p.floor, x: p.x, facing: p.facing, atmo: 'unknown' }, at);
  return { store: st, session };
}
/* SAVE:END */
