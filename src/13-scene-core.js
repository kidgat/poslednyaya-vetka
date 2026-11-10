/* SCENE:BEGIN — фаза А: реестр сцен, порталы края, точки появления, лёгкое сохранение сцены. Чистые функции (тесты — tests/scene.test.js). */
function sceneFloors(cfg, id) { const s = cfg.SCENES[id]; return !s ? null : (s.floors || cfg.FLOORS); }
/** Портал края: герой у края этажа (±0,5 px), направление — за край. Внутренние этажи станции порталов не имеют. */
function edgePortalAt(cfg, id, floor, x, dir) {
  const s = cfg.SCENES[id], fl = sceneFloors(cfg, id), F = fl && fl[floor];
  if (!s || !F || !dir) return null;
  for (const p of s.portals) {
    if (p.floor !== floor) continue;
    if (p.edge === 'left' && dir < 0 && x <= F.minX + 0.5) return p;
    if (p.edge === 'right' && dir > 0 && x >= F.maxX - 0.5) return p;
  }
  return null;
}
/** Двери-порталы сцены (ST-VIEW-001): переход по действию «Войти»/«Во дворы» в точке x на этаже, а не у края. */
function sceneDoors(cfg, id) { const s = cfg.SCENES[id]; return (s && s.doors) || []; }
/** Дверь-портал рядом: герой на том же этаже в пределах radius от точки двери. */
function doorPortalAt(cfg, id, floor, x) {
  for (const d of sceneDoors(cfg, id)) if (d.floor === floor && Math.abs(x - d.x) <= d.radius) return d;
  return null;
}
/** Безопасная точка перед порталом на исходной стороне (прерванный переход): у края (SAFE px, лицом к порталу) или у самой двери. */
function portalSafeSpot(cfg, id, portal) {
  const F = sceneFloors(cfg, id)[portal.floor], c = cfg.SCENE.SAFE;
  if (portal.edge === 'left') return { scene: id, floor: portal.floor, x: F.minX + c, facing: -1 };
  if (portal.edge === 'right') return { scene: id, floor: portal.floor, x: F.maxX - c, facing: 1 };
  return { scene: id, floor: portal.floor, x: portal.x, facing: 1 };     // дверь-портал: у самой двери
}
/** Точка назначения портала. */
function portalTarget(cfg, portal) { const sp = cfg.SCENES[portal.to].spawns[portal.spawn]; return { scene: portal.to, floor: sp.floor, x: sp.x, facing: sp.facing }; }
/** Запись pv.scene.v1: { v:1, scene, floor, x, facing, pending: null | { portal, from, to, ticket } } → куда поставить героя или null.
    При незавершённом переходе — безопасная точка ПЕРЕД порталом на исходной стороне. */
function parseSceneSave(cfg, raw) {
  let d; try { d = typeof raw === 'string' ? JSON.parse(raw) : null; } catch (_) { return null; }
  if (!d || d.v !== 1 || !cfg.SCENES[d.scene]) return null;
  if (cfg.SCENES[d.scene].geo !== undefined && d.g !== cfg.SCENES[d.scene].geo) return null;   // ШТАБ-022: запись другой геометрии сцены — не восстанавливать
  if (d.pending) {
    const s = cfg.SCENES[d.pending.from], p = s && (s.portals.find(q => q.id === d.pending.portal) || sceneDoors(cfg, d.pending.from).find(q => q.id === d.pending.portal));
    if (!p || !cfg.SCENES[p.to]) return null;
    return { ...portalSafeSpot(cfg, d.pending.from, p), pending: true };
  }
  const fl = sceneFloors(cfg, d.scene), F = fl[d.floor];
  if (!F || typeof d.x !== 'number' || !Number.isFinite(d.x) || d.x < F.minX || d.x > F.maxX) return null;
  return { scene: d.scene, floor: d.floor, x: Math.round(d.x * 10) / 10, facing: d.facing === -1 ? -1 : 1, pending: false };
}
/** Проверки реестра сцен: точки появления в границах и не ближе SAFE − 0,5 к краю-порталу; у портала есть обратный путь;
    из каждой сцены достижима ST; порталы станции — только на этаже surface. */
function validateScenes(cfg) {
  const err = [], ids = Object.keys(cfg.SCENES);
  for (const id of ids) {
    const s = cfg.SCENES[id], fl = sceneFloors(cfg, id);
    if (!(s.W > 0)) err.push(`сцена ${id}: нет ширины`);
    for (const [k, sp] of Object.entries(s.spawns)) {
      const F = fl[sp.floor];
      if (!F || sp.x < F.minX || sp.x > F.maxX) { err.push(`сцена ${id}: точка ${k} вне этажа`); continue; }
      for (const p of s.portals) {
        const gap = p.edge === 'left' ? sp.x - F.minX : F.maxX - sp.x;
        if (p.floor === sp.floor && gap < cfg.SCENE.SAFE - 0.5) err.push(`сцена ${id}: точка ${k} слишком близко к порталу ${p.id}`);
      }
    }
    for (const p of [...s.portals, ...sceneDoors(cfg, id)]) {            // порталы края и двери-порталы
      const d = cfg.SCENES[p.to], kind = p.edge ? 'портал' : 'дверь';
      if (!d || !d.spawns[p.spawn]) { err.push(`${kind} ${p.id}: нет точки ${p.to}.${p.spawn}`); continue; }
      if (!fl[p.floor]) err.push(`${kind} ${p.id}: нет этажа ${p.floor}`);
      if (p.edge === undefined && (p.x < fl[p.floor].minX || p.x > fl[p.floor].maxX)) err.push(`дверь ${p.id}: точка x вне этажа`);
      if (![...d.portals, ...sceneDoors(cfg, p.to)].some(q => q.to === id)) err.push(`${kind} ${p.id}: нет обратного пути из ${p.to}`);
    }
  }
  for (const id of ids) {                                               // путь домой — по порталам и дверям
    const seen = new Set([id]), q = [id];
    while (q.length) for (const p of [...cfg.SCENES[q[0]].portals, ...sceneDoors(cfg, q.shift())]) if (!seen.has(p.to)) { seen.add(p.to); q.push(p.to); }
    if (!seen.has('ST')) err.push(`сцена ${id}: нет пути на станцию`);
  }
  return err;
}
/* SCENE:END */
