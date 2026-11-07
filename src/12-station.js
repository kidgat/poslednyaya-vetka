/* =============================== STATION ==================================
   Реестр «Гагаринской 3.0»: проекция действующих данных (ROOMS, FLOORS, PASSAGES, GATES, GENERATOR, SPACES, INSPECTS)
   плюс замыслы из CONFIG.STATION. Второго источника истины нет — активное собирается из рабочих конфигов.
   Блок между маркерами проверяется отдельно: node tests/station.test.js */
/* STATION:BEGIN */
/** Участок действия: неподвижный trigger или зона разговора — весь путь NPC плюс радиус. */
const ARCH_HALF = 21, ARCH_LANDING = 4;   // ARCH_LANDING — глубина площадки у порога арки «вниз», px
const _AH_ = 0;                       // 1.0.1: половина ширины служебной арки вместе с бетонным пилоном
function inspectZone(cfg, i) {
  if (i.trigger) return i.trigger;
  const n = cfg.NPCS[i.npc]; if (!n) return [0, -1];
  const [a, b] = n.walk || [n.x, n.x]; return [a - i.radius, b + i.radius];
}
/** NPC-001: облик «архетип.номер» (например tech.1) есть в CONFIG.LOOKS. */
function lookExists(cfg, look) {
  const m = /^([a-z-]+)\.(\d)$/.exec(look || ''), A = m && cfg.LOOKS && cfg.LOOKS.ARCHETYPES[m[1]];
  return !!(A && A.variants[+m[2]]);
}
function buildStationPlan(cfg, rooms) {
  const st = cfg.STATION, act = 'active';
  const plan = {
    floors: st.floors.map(f => ({ ...f })),
    circuits: [...Object.keys(cfg.POWER.DEMAND), 'emergency'],
    rooms: [
      ...rooms.map(r => { const f = r.floor || 'upper', dy = cfg.FLOORS[f].y - cfg.FLOORS.upper.y;
        return { id: r.id, floor: f, name: r.label, type: r.type, circuit: r.circuit, status: act, x: [r.x, r.x + r.w], y: [15 + dy, 107 + dy] }; }),
      ...cfg.SPACES.map(sp => ({ ...sp, status: act })),
      ...st.plannedRooms.map(r => ({ ...r, status: 'planned' })),
    ],
    connectors: [
      ...cfg.GATES.map(g => ({ id: 'gate-' + g.id, type: 'gate', from: g.a.floor, to: g.b.floor, status: act })),
      ...(cfg.PASSAGES || []).map(q => ({ id: 'passage-' + q.id, type: 'passage', from: q.a.floor, to: q.b.floor, status: act })),   // 1.0.1
      ...st.plannedConnectors.map(c => ({ ...c, status: 'planned' })),
    ],
    features: (st.plannedFeatures || []).map(f => ({ ...f, status: 'planned' })),
    interactions: [
      ...cfg.GATES.flatMap(g => [g.a, g.b].map((e, k) => ({ id: `gate-${g.id}-${k ? 'b' : 'a'}`, kind: 'gate', floor: e.floor, trigger: [e.x - g.radius, e.x + g.radius] }))),
      ...(cfg.PASSAGES || []).flatMap(q => [q.a, q.b].map((e, k) => ({ id: `passage-${q.id}-${k ? 'b' : 'a'}`, kind: 'passage', floor: e.floor, trigger: [e.x - q.radius, e.x + q.radius] }))),
      { id: 'generator', kind: 'generator', floor: cfg.GENERATOR.floor, trigger: cfg.GENERATOR.trigger },
      ...cfg.INSPECTS.map(i => ({ id: i.id, kind: 'inspect', floor: i.floor, trigger: inspectZone(cfg, i), space: i.space, type: i.type,
        npc: i.npc, lines: i.lines })),
      ...cfg.SCAVENGE.SPOTS.map(sp => ({ id: 'scavenge-' + sp.id, kind: 'scavenge', floor: sp.floor, trigger: sp.trigger })),
    ],
  };
  return plan;
}
/** Проверки реестра; возвращает список ошибок (пустой — всё согласовано). */
function validateStationPlan(plan, cfg) {
  const err = [], floor = id => plan.floors.find(f => f.id === id);
  const all = [...plan.floors, ...plan.rooms, ...plan.connectors, ...plan.interactions];
  const seen = new Set();
  for (const o of all) { if (!o.id) err.push('объект без id'); else if (seen.has(o.id)) err.push(`повтор id: ${o.id}`); seen.add(o.id); }
  for (const f of plan.floors) {
    if (f.status === 'active' && !(f.legacyFloor in cfg.FLOORS)) err.push(`уровень ${f.id}: нет CONFIG.FLOORS.${f.legacyFloor}`);
    if (f.status === 'planned' && f.legacyFloor !== null) err.push(`плановый уровень ${f.id} ссылается на рабочий этаж`);
  }
  for (const key of Object.keys(cfg.FLOORS))
    if (plan.floors.filter(f => f.status === 'active' && f.legacyFloor === key).length !== 1) err.push(`CONFIG.FLOORS.${key} не связан ровно с одним active-уровнем`);
  for (const r of plan.rooms) {
    const f = floor(r.floor);
    if (!f) { err.push(`помещение ${r.id}: нет уровня ${r.floor}`); continue; }
    if (r.status === 'active' && f.status !== 'active') err.push(`помещение ${r.id} active на плановом уровне ${r.floor}`);
    if (r.circuit !== null && !plan.circuits.includes(r.circuit)) err.push(`помещение ${r.id}: неизвестная цепь ${r.circuit}`);
    if (r.door) {
      const F = cfg.FLOORS[f.legacyFloor];
      if (F && !(r.door[1] < F.minX || r.door[0] > F.maxX)) err.push(`дверь ${r.id} достижима — это был бы проход без механики`);
    }
  }
  for (const c of plan.connectors) {
    const a = floor(c.from), b = c.to === null ? null : floor(c.to);
    if (!a) err.push(`связь ${c.id}: нет уровня ${c.from}`);
    if (c.to !== null && !b) err.push(`связь ${c.id}: нет уровня ${c.to}`);
    if (c.status === 'active' && (!a || !b || a.status !== 'active' || b.status !== 'active')) err.push(`действующая связь ${c.id} ведёт на плановый/несуществующий уровень`);
    if (c.via && !plan.rooms.some(r => r.id === c.via)) err.push(`связь ${c.id}: нет помещения ${c.via}`);
    if (c.status === 'active' && a && b && Math.abs(a.level - b.level) !== 1) err.push(`действующая связь ${c.id} перескакивает уровень: ${c.from} → ${c.to}`);   // 0.9: без обхода вестибюля
  }
  const it = plan.interactions;
  for (const i of it) {
    const f = floor(i.floor);
    if (!f || f.status !== 'active') { err.push(`действие ${i.id} на неактивном уровне ${i.floor}`); continue; }
    const F = cfg.FLOORS[f.legacyFloor], [a, b] = i.trigger;
    if (!F) continue;                                          // рассинхрон уровня уже записан выше
    if (!(a < b)) err.push(`действие ${i.id}: пустой участок`);
    if (b < F.minX || a > F.maxX) err.push(`действие ${i.id} недостижимо (${a}–${b} вне ${F.minX}–${F.maxX})`);
    if (i.space && !plan.rooms.some(r => r.id === i.space && r.status === 'active')) err.push(`действие ${i.id}: нет действующего пространства ${i.space}`);
    if (i.kind === 'inspect') {
      if (!Array.isArray(i.lines) || !i.lines.length || i.lines.some(l => typeof l !== 'string' || !l.trim())) err.push(`действие ${i.id}: нет реплик`);
      else if (new Set(i.lines).size !== i.lines.length) err.push(`действие ${i.id}: повтор реплик`);
    }
    if (i.npc !== undefined) {
      const n = cfg.NPCS[i.npc];
      if (!n) err.push(`разговор ${i.id}: нет NPC ${i.npc}`);
      else {
        if (n.floor !== i.floor) err.push(`разговор ${i.id}: NPC ${i.npc} на другом этаже`);
        const [na, nb] = n.walk || [n.x, n.x];
        if (plan.rooms.some(r => r.status === 'active' && r.floor === f.legacyFloor && r.y) && !plan.rooms.some(r => r.status === 'active' && r.floor === f.legacyFloor && r.y && na >= r.x[0] + 4 && nb <= r.x[1] - 4))
          err.push(`разговор ${i.id}: NPC ${i.npc} ходит не в пределах одной комнаты`);
      }
    }
  }
  for (const [id, n] of Object.entries(cfg.NPCS)) {                          // реплики реакций — короткие строки
    for (const key of ['onBlackout', 'onRestore']) if (n[key] !== undefined
      && (!Array.isArray(n[key]) || !n[key].length || n[key].some(t => typeof t !== 'string' || !t.trim() || t.length > 22))) err.push(`NPC ${id}: плохие ${key}`);
    if (n.walk && !(n.walk[0] <= n.x && n.x <= n.walk[1])) err.push(`NPC ${id}: старт вне участка ходьбы`);
    if (n.lamp && !['beam', 'lantern', 'candle', 'headlamp'].includes(n.lamp)) err.push(`NPC ${id}: неизвестный свет ${n.lamp}`);
    if (n.look !== undefined && !lookExists(cfg, n.look)) err.push(`NPC ${id}: неизвестный облик ${n.look}`);   // NPC-001
  }
  for (const e of cfg.EMERGENCY_LAMPS || []) {                               // аварийный свет — внутри своей комнаты
    const r = plan.rooms.find(x => x.id === e.room && x.status === 'active');
    if (!r || !r.x || !r.y || e.x < r.x[0] + 4 || e.x > r.x[1] - 4 || e.y < r.y[0] + 4 || e.y > r.y[1] - 11) err.push(`аварийный светильник ${e.id} вне комнаты ${e.room}`);
  }
  for (const q of cfg.PASSAGES || []) {                                      // 1.0.1: служебные проходы — оба входа
    const A = floor(q.a.floor), B = floor(q.b.floor);
    if (q.a.floor === q.b.floor) err.push(`проход ${q.id}: оба входа на одном этаже`);
    if (!['up', 'down'].includes(q.a.dir) || !['up', 'down'].includes(q.b.dir) || q.a.dir === q.b.dir) err.push(`проход ${q.id}: направления входов`);
    if (A && B && (q.a.dir === 'down') !== (A.level > B.level)) err.push(`проход ${q.id}: «вниз» ведёт не вниз`);
    for (const e of [q.a, q.b]) {                                           // арка — в стене комнаты, не в проёме между комнатами
      const rs = plan.rooms.filter(r => r.status === 'active' && r.floor === e.floor && r.y);
      if (rs.length && !rs.some(r => e.x - ARCH_HALF >= r.x[0] + 4 && e.x + ARCH_HALF <= r.x[1] - 4)) err.push(`проход ${q.id}: арка ${e.floor} x ${e.x} не помещается в комнату`);
    }
  }
  for (const ft of cfg.STATION.plannedFeatures || [])                        // 1.0: будущие механики привязаны к существующим комнатам
    if (ft.room !== null && !plan.rooms.some(r => r.id === ft.room && r.status === 'active')) err.push(`будущая функция ${ft.id}: нет действующей комнаты ${ft.room}`);
  for (const r of plan.rooms) {                                              // действующие комнаты яруса — достижимы
    if (r.status !== 'active' || !r.y || !r.x) continue;                     // комнаты ярусов (с 0.9 — и вестибюля)
    const U = cfg.FLOORS[r.floor];
    if (r.x[1] - 4 < U.minX || r.x[0] + 4 > U.maxX) err.push(`комната ${r.id} недоступна: вне ${U.minX}–${U.maxX}`);
  }
  for (let m = 0; m < it.length; m++) for (let n = m + 1; n < it.length; n++)
    if (it[m].floor === it[n].floor && it[m].trigger[0] <= it[n].trigger[1] && it[n].trigger[0] <= it[m].trigger[1])
      err.push(`участки действий пересекаются: ${it[m].id} и ${it[n].id}`);
  return err;
}
/* STATION:END */
