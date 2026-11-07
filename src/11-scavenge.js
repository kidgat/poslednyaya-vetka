/* ============================== SCAVENGE ==================================
   Поиск топлива: переносимый запас героя, разовые находки, тайник разведчиков. Время — только step(dt) игры:
   перезагрузка и свёрнутая вкладка тайник не пополняют. Тестируется отдельно: node tests/scavenge.test.js */
/* SCAVENGE:BEGIN */
function createScavenge(cfg) {
  const once = cfg.SPOTS.filter(s => s.kind === 'once').map(s => s.id);
  const S = {
    carried: 0, taken: {}, cache: { stock: 1, t: 0 }, message: '',
    spot(id) { return cfg.SPOTS.find(s => s.id === id) || null; },
    available(id) { const s = this.spot(id); return !!s && (s.kind === 'once' ? !this.taken[id] : this.cache.stock > 0); },
    /** Пустой тайник пополняется одной канистрой через CACHE_REFILL с активной игры. */
    step(dt) {
      if (!(dt > 0) || !Number.isFinite(dt) || this.cache.stock > 0) return;
      this.cache.t += dt;
      if (this.cache.t >= cfg.CACHE_REFILL) { this.cache.stock = 1; this.cache.t = 0; }
    },
    /** Забрать канистру из точки в переносимый запас. Нет места — точка остаётся нетронутой. */
    pick(id) {
      const s = this.spot(id);
      if (!s) { this.message = ''; return false; }
      if (!this.available(id)) {
        this.message = s.kind === 'once' ? 'Здесь уже пусто — канистру забрали.'
          : `Тайник пуст. Разведчики пополнят его примерно через ${Math.max(1, Math.ceil(cfg.CACHE_REFILL - this.cache.t))} с.`;
        return false;
      }
      if (this.carried >= cfg.CARRY_MAX) {
        this.message = `Больше не унести: при себе ${this.carried} из ${cfg.CARRY_MAX}. Отнесите канистры в генераторную.`; return false;
      }
      this.carried += 1;
      if (s.kind === 'once') this.taken[id] = true; else { this.cache.stock = 0; this.cache.t = 0; }
      this.message = `Найдена канистра топлива. При себе ${this.carried} из ${cfg.CARRY_MAX}.`; return true;
    },
    /** Сдать всё, что несёт герой, на склад генераторной (power.store); возвращает сданное число. */
    deliver(power) {
      if (this.carried <= 0) { this.message = 'При себе нет канистр'; return 0; }
      const n = power.store(this.carried); this.carried -= n; this.message = power.message; return n;
    },
    snapshot() { return { v: 1, carried: this.carried, taken: once.filter(id => this.taken[id]), cache: { stock: this.cache.stock, t: this.cache.t } }; },
    /** Загрузка с проверкой; при ошибке состояние не меняется (энергосистему это не затрагивает). */
    restore(s) {
      const ok = s && s.v === 1 && Number.isInteger(s.carried) && s.carried >= 0 && s.carried <= cfg.CARRY_MAX
        && Array.isArray(s.taken) && s.taken.every(id => once.includes(id)) && new Set(s.taken).size === s.taken.length
        && s.cache && (s.cache.stock === 0 || s.cache.stock === 1)
        && typeof s.cache.t === 'number' && Number.isFinite(s.cache.t) && s.cache.t >= 0 && s.cache.t <= cfg.CACHE_REFILL;
      if (!ok) return false;
      this.carried = s.carried; this.taken = {}; s.taken.forEach(id => { this.taken[id] = true; });
      this.cache = { stock: s.cache.stock, t: s.cache.stock ? 0 : s.cache.t }; return true;
    },
  };
  return S;
}
/** Курсор реплик: первое открытие — с первой строки, каждое следующее нажатие и новое открытие — следующая по кругу. */
function createDialogCursor() {
  const last = new Map();
  return {
    open(id, n) { const i = last.has(id) ? (last.get(id) + 1) % n : 0; last.set(id, i); return i; },
    next(id, n) { const i = ((last.get(id) ?? -1) + 1) % n; last.set(id, i); return i; },
    peek(id) { return last.get(id) ?? -1; },
  };
}
/** Режим яркости из сохранения: неизвестное или испорченное — «Нормально». */
function parseVisual(cfg, raw) {
  let v = null;
  try { v = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { v = null; }
  return v && v.v === 1 && typeof v.brightness === 'string' && Object.prototype.hasOwnProperty.call(cfg.PRESETS, v.brightness) ? v.brightness : cfg.DEFAULT;
}
/** Очередь коротких реакций NPC: новая авария отменяет старую очередь; реплики разнесены во времени;
    повтор того же события в пределах COOLDOWN — не больше одной реплики (защита от частых ВКЛ/ВЫКЛ). */
function createReactions(cfg) {
  return {
    queue: [], last: {}, turn: {},
    trigger(kind, ids, now) {
      this.queue.length = 0;
      const recent = now - (this.last[kind] ?? -1e9) < cfg.COOLDOWN;
      this.last[kind] = now;
      const max = recent ? 1 : kind === 'blackout' ? cfg.MAX_BLACKOUT : cfg.MAX_RESTORE;
      let at = now + cfg.FIRST;
      ids.slice(0, max).forEach((id, k) => {
        this.queue.push({ id, kind, at });
        at += cfg.GAP[0] + ((k * 0.37 + (this.turn[id] || 0) * 0.23) % 1) * (cfg.GAP[1] - cfg.GAP[0]);
      });
      return this.queue.length;
    },
    cancel() { this.queue.length = 0; },
    due(now) { const out = this.queue.filter(e => e.at <= now); if (out.length) this.queue = this.queue.filter(e => e.at > now); return out; },
    /** Следующая фраза персонажа по кругу: у соседей разные, у одного — не повторяется подряд. */
    line(id, lines) { const k = this.turn[id] = (this.turn[id] ?? -1) + 1; return lines[k % lines.length]; },
    duration(text) { return Math.max(cfg.DUR[0], Math.min(cfg.DUR[1], 1.6 + text.length * 0.09)); },
  };
}
/** 1.1А: разбор сохранения положения героя. Возвращает { floor, x, facing } или null (нет записи / испорчена / нет этажа / x вне minX–maxX).
    Внутри арки или ворот герой бывает только в анимации перехода, а в ней положение не сохраняется (savePlayer — только в ходьбе);
    стоянка перед аркой (в т.ч. ровно по центру после выхода) — обычное место. */
function parsePlayerSave(cfg, raw) {
  let d; try { d = typeof raw === 'string' ? JSON.parse(raw) : null; } catch (_) { return null; }
  if (!d || typeof d !== 'object' || d.v !== 1 || typeof d.floor !== 'string' || !Object.prototype.hasOwnProperty.call(cfg.FLOORS, d.floor)) return null;
  const F = cfg.FLOORS[d.floor], x = d.x;
  if (typeof x !== 'number' || !Number.isFinite(x) || x < F.minX || x > F.maxX) return null;
  return { floor: d.floor, x: Math.round(x * 10) / 10, facing: d.facing === -1 ? -1 : 1 };
}
/** 1.1А-UX1: разбор сохранения масштаба: { v:1, level } → индекс в LEVELS; нет записи / испорчена / чужое значение → 0 (100%). */
function parseZoom(cfg, raw) {
  let d; try { d = typeof raw === 'string' ? JSON.parse(raw) : null; } catch (_) { return 0; }
  if (!d || typeof d !== 'object' || d.v !== 1 || typeof d.level !== 'number') return 0;
  const i = cfg.ZOOM.LEVELS.indexOf(d.level);
  return i < 0 ? 0 : i;
}
/** Следующий индекс масштаба: ступень ±1, не выходит за пределы LEVELS. */
function zoomStep(cfg, idx, d) { return Math.max(0, Math.min(cfg.ZOOM.LEVELS.length - 1, idx + d)); }
/** 1.1А-UX2: жест одного пальца в игровой области. dt — мс с касания, dist — сдвиг в CSS px, released — палец отпущен,
    multi — в это время в игровой области был ещё палец. → 'pending' (ещё не ясно) | 'hold' (ручная ходьба) | 'tap' | 'none'. */
function classifyGesture(cfg, dt, dist, released, multi) {
  const T = cfg.TOUCH;
  if (dist > T.SLOP || dt >= T.HOLD_MS) return 'hold';                 // явный сдвиг или удерживание — прежняя ходьба
  if (!released) return 'pending';
  return multi ? 'none' : 'tap';                                        // два пальца — не точка назначения (задел под pinch)
}
/** Точка касания (CSS px) → мировые координаты: прямоугольник canvas, его пиксели (devicePixelRatio), масштаб рендера и камера. */
function screenToWorld(v, cssX, cssY) {
  const dx = (cssX - v.left) * (v.devW / v.cssW), dy = (cssY - v.top) * (v.devH / v.cssH);
  return { x: v.camX + dx / v.scale, y: v.camY + dy / v.scale };
}
/** Цель касания на текущем этаже: точка по высоте на дорожке этажа, x ограничен проходимым участком; иначе null. */
function tapTarget(cfg, floor, wx, wy) {
  const F = cfg.FLOORS[floor], B = cfg.TOUCH.BAND;
  if (!F || !Number.isFinite(wx) || !Number.isFinite(wy) || wy < F.y - B[0] || wy > F.y + B[1]) return null;
  return Math.round(Math.max(F.minX, Math.min(F.maxX, wx)) * 10) / 10;
}
/** Направление ходьбы к цели с учётом тормозного пути (без перелёта и дрожания). → { dir, done }. */
function autoWalkDir(cfg, x, vx, target) {
  const d = target - x, P = cfg.PLAYER, T = cfg.TOUCH;
  if (Math.abs(d) <= T.ARRIVE && Math.abs(vx) < 8) return { dir: 0, done: true };
  if (vx !== 0 && Math.sign(vx) === Math.sign(d) && (vx * vx) / (2 * P.DECEL) >= Math.abs(d) - 0.5) return { dir: 0, done: false };   // тормозим
  if (Math.abs(d) <= T.ARRIVE) return { dir: 0, done: false };          // догорает торможение у цели
  return { dir: Math.sign(d), done: false };
}
/* SCAVENGE:END */

