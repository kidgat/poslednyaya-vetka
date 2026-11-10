/* ================================ ACTORS ==================================
   Жители, охрана и мутанты — только анимация и блуждание в своих границах.
   kind: guard (стоит, оглядывается) · idle (стоит, изредка поворачивается) · stand (стоит лицом в одну сторону) · walker (ходит) ·
         sitter / sitguard (сидит) · sleeper (лежит) · mutant (бродит по улице). */
const ACTORS = [];
function actor(kind, set, x, y, o = {}) {
  const a = { kind, set, x, y, facing: o.facing || 1, minX: o.minX ?? x, maxX: o.maxX ?? x, speed: o.speed || 24, tx: x,
    wait: rand() * 3, t: rand() * 5, turnT: 2 + rand() * 4, walkDist: 0, blinkT: rand() * 4, moving: false, bed: o.bed,
    bubble: null, id: o.id || null, lampType: o.lamp || null, tunnel: o.tunnel || 0, floor: o.floor || floorAtY(o.bed ? o.bed[1] : y),   // 1.0: спящий — по высоте кровати
    lamp: 0, lampWant: false, lampDelay: 0, talkT: 0 };
  ACTORS.push(a); return a;
}
/** Персонаж из CONFIG.NPCS (охрана постов, собеседники, жители со свечами). */
function npcActor(id) {
  const n = CONFIG.NPCS[id], [a, b] = n.walk || [n.x, n.x];
  return actor(n.kind, n.look || n.set, n.x, CONFIG.FLOORS[n.floor].y, { id, floor: n.floor, facing: n.facing, minX: a, maxX: b, speed: n.speed, lamp: n.lamp, tunnel: n.tunnel || n.aim });
}
const npcById = id => ACTORS.find(a => a.id === id) || null;
function placeActors() {
  const P = CONFIG.FLOORS.platform.y, U = CONFIG.FLOORS.upper.y, S = CONFIG.FLOORS.surface.y;
  Object.keys(CONFIG.NPCS).forEach(npcActor);                                                              // охрана постов, собеседники
  // охрана шлюза, рабочие мастерской и насосной, житель столовой — с 0.8.1 в CONFIG.NPCS (без копий здесь)
  actor('sleeper', 'resident-m.2', 0, 0, { bed: [218, 88] }); actor('sleeper', 'resident-f.2', 0, 0, { bed: [294, 70] }); actor('sleeper', 'elder.0', 0, 0, { bed: [370, 88] });   // 1.1А: нары сдвинуты с жилым блоком (+60)
  actor('sitter', 'elder.1', 546, U, { facing: 1 }); actor('sitter', 'young.1', 590, U, { facing: -1 });   // столовая
  actor('sitter', 'resident-m.1', 528, P, { facing: 1 }); actor('sitter', 'stalker.0', 1062, P, { facing: -1 });         // у столика и у бочки
  const UY = CONFIG.FLOORS.utility.y;                                     // 1.0: ярус −2 — спящие в ячейках и свиньи в загоне
  actor('sleeper', 'elder.2', 0, 0, { bed: [316, UY - 10] }); actor('sleeper', 'resident-m.0', 0, 0, { bed: [386, UY - 28] });
  actor('pig', 'pig', 990, UY, { minX: 972, maxX: 1040, speed: 7, facing: 1 });
  actor('pig', 'pig', 1062, UY, { minX: 1046, maxX: 1110, speed: 6, facing: -1 });
  actor('pig', 'pig', 1086, UY, { minX: 1086, maxX: 1086, facing: -1 });     // третья стоит у кормушки и вертит головой
  // ST-VIEW: наземные мутанты бродят в границах сцены SURF (minX 145 … maxX 940), не над станцией
  actor('mutant', 'mutant', 360, S, { minX: 300, maxX: 520, speed: 20 });
  actor('mutant', 'mutant', 600, S, { minX: 500, maxX: 720, speed: 15 });
  actor('mutant', 'mutant', 820, S, { minX: 700, maxX: 905, speed: 24 });
  actor('sitter', 'trader.1', 940, P, { facing: -1 }); actor('sitter', 'stalker.2', 962, P, { facing: -1 });         // слушатели у трибуны
  actor('stand', 'resident-m.2', 832, P, { facing: 1 });   // NPC-001: облики — CONFIG.LOOKS (места прежние)
}
/** Лёгкая реакция на свет: житель останавливается, оглядывается и говорит короткую фразу. */
/** Реакция на блэкаут или возвращение сети: очередь коротких реплик видимых NPC (0.8.1).
    Кандидаты — в кадре, ближе к герою; собеседник героя молчит; старые аварийные фразы снимаются. */
function actorsReact(blackout, now) {
  const key = blackout ? 'onBlackout' : 'onRestore';
  if (!blackout) for (const a of ACTORS) if (a.bubble && a.bubble.kind === 'blackout') a.bubble = null;
  const ids = ACTORS.filter(a => a.id && CONFIG.NPCS[a.id][key] && actorVisible(a) && !(InfoCard.open && InfoCard.item.npc === a.id))
    .sort((p, q) => reactRank(p) - reactRank(q)).map(a => a.id);
  Reactions.trigger(blackout ? 'blackout' : 'restore', ids, now);
}
const reactRank = a => Math.abs(a.x - Player.x) + (Math.abs(a.y - Player.y) > 20 ? 300 : 0);
function actorVisible(a) {
  return a.x > Camera.x - 6 && a.x < Camera.x + Camera.viewW + 6 && a.y > Camera.y + 30 && a.y - 40 < Camera.y + Camera.viewH;
}
/** Показать реплики, которым подошло время, — если NPC всё ещё в кадре и не разговаривает с героем. */
function updateReactions(now) {
  let shown = ACTORS.reduce((k, a) => k + (a.bubble && a.bubble.kind ? 1 : 0), 0);
  for (const e of Reactions.due(now)) {
    const a = npcById(e.id), n = CONFIG.NPCS[e.id], lines = n && n[e.kind === 'blackout' ? 'onBlackout' : 'onRestore'];
    if (!a || !lines || !actorVisible(a) || (InfoCard.open && InfoCard.item.npc === e.id)) continue;
    if (shown >= CONFIG.REACT.MAX_ON) { Reactions.queue.push({ ...e, at: now + 0.5 }); continue; }   // не больше MAX_ON фраз сразу
    shown++;
    const text = Reactions.line(e.id, lines);
    a.bubble = { text, t: Reactions.duration(text), kind: e.kind };
    if (a.kind === 'walker') { a.wait = Math.max(a.wait, 1.6); a.moving = false; }
  }
}
function updateActors(dt) {
  for (const a of ACTORS) {
    a.t += dt; a.blinkT -= dt; if (a.blinkT < -0.12) a.blinkT = 2 + rand() * 4;
    if (a.bubble && (a.bubble.t -= dt) <= 0) a.bubble = null;
    if (a.lampWant && a.tunnel) { a.facing = a.tunnel; continue; }       // блэкаут: охрана светит в тоннель и не оглядывается
    if (a.talkT > 0) { a.talkT -= dt; a.moving = false; continue; }       // разговаривает с героем — стоит на месте
    if (a.kind === 'guard' || a.kind === 'idle') { a.turnT -= dt; if (a.turnT <= 0) { a.facing *= -1; a.turnT = (a.kind === 'guard' ? 3 : 6) + rand() * 5; } }
    if (a.kind === 'pig' && a.minX === a.maxX) { a.turnT -= dt; if (a.turnT <= 0) { a.facing *= -1; a.turnT = 2 + rand() * 4; } continue; }
    if (a.kind !== 'walker' && a.kind !== 'mutant' && a.kind !== 'pig') continue;
    if (a.wait > 0) { a.wait -= dt; a.moving = false; continue; }
    const d = a.tx - a.x;
    if (Math.abs(d) < 1) { a.wait = (a.kind === 'mutant' ? 0.8 : a.kind === 'pig' ? 2.5 : 1.5) + rand() * 3; a.tx = a.minX + rand() * (a.maxX - a.minX); a.moving = false; continue; }
    const step = Math.min(Math.abs(d), a.speed * dt);
    a.x += Math.sign(d) * step; a.facing = Math.sign(d); a.walkDist += step; a.moving = true;
  }
}
/** Ручные фонари и свечи: при обесточенной цепи своего места NPC зажигает свет через 0.5–2 с (по порядку),
    при возвращении питания — гасит. Свет независимый: не от сети и не от аккумулятора. */
function updateLamps(dt) {
  const c = WORLD.candle;                                                // свеча медпункта: при обесточенной critical, не от сети
  if (c) {
    const want = Power.level('critical') === 0;
    if (want !== c.want) { c.want = want; c.delay = want ? 1.4 : 0.6; }
    if (c.delay > 0) c.delay -= dt; else c.lamp = clamp(c.lamp + (want ? dt * 1.5 : -dt), 0, 1);
  }
  let k = 0;
  for (const a of ACTORS) {
    if (!a.lampType) continue;
    const want = Power.level(actorCircuit(a)) === 0;
    if (want !== a.lampWant) { a.lampWant = want; a.lampDelay = 0.5 + ((k * 0.37) % 1.5); }
    k++;
    if (a.lampDelay > 0) { a.lampDelay -= dt; continue; }
    a.lamp = clamp(a.lamp + (want ? dt * 2.5 : -dt), 0, 1);
  }
}
/** Цепь, от которой зависит свет вокруг NPC: на ярусе — цепь комнаты, на платформе — зона зала. */
function actorCircuit(a) {
  if (ROOM_FLOORS.includes(a.floor)) { const r = roomAt(a.x, a.y); return r ? r.circuit : 'technical'; }
  return CONFIG.CIRCUIT_ZONES.hall.find(([to]) => a.x < to)[1];
}
/** Прямоугольник, за который свет NPC не выходит: комната яруса или зал. */
function actorClip(a) {
  if (ROOM_FLOORS.includes(a.floor)) { const r = roomAt(a.x, a.y); return r ? roomClip(r) : { upper: UPPER_CLIP, vestibule: VEST_CLIP, utility: UTIL_CLIP }[a.floor]; }
  return a.floor === 'surface' ? SURF_CLIP : HALL_CLIP;
}
/** Точка света в руке NPC (мировые координаты). */
function lampPoint(a) {
  const sit = a.kind === 'sitter' || a.kind === 'sitguard';
  if (a.lampType === 'beam') return [Math.round(a.x) + a.facing * 7, a.y - 25];
  if (a.lampType === 'headlamp') return [Math.round(a.x) + a.facing * 4, a.y - 35];
  return [Math.round(a.x) + a.facing * (sit ? 8 : 7), a.y - (sit ? 13 : 19)];
}
function actorSprite(a) {
  const s = SETS[a.set];
  if (a.kind === 'mutant') return s.walk[a.moving ? Math.floor(a.walkDist / 3) % 6 : 0];
  if (a.kind === 'pig') return a.moving ? s.walk[Math.floor(a.walkDist / 2) % 4] : s.idle[Math.floor(a.t / 0.6 + a.x) % 3 === 0 ? 1 : 0];   // 1.0
  if (a.kind === 'sitter' || a.kind === 'sitguard') return s.sit[Math.floor(a.t / 0.9) % 2];
  if (a.kind === 'sleeper') return s.lie[Math.floor(a.t / 1.6) % 2];
  if (a.moving) return s.walk[Math.floor(a.walkDist / CONFIG.PLAYER.STRIDE) % 8];
  if (a.blinkT < 0) return s.blink;
  return s.idle[Math.floor(a.t / 0.75) % 2];
}
/** Рисует спрайт с отражением по направлению; half — x оси персонажа внутри спрайта. */
function blit(g, spr, cx, top, facing, half) {
  if (facing >= 0) { g.drawImage(spr, cx - half, top); return; }
  const left = cx - (spr.width - half - 1);
  g.save(); g.translate(left + spr.width, top); g.scale(-1, 1); g.drawImage(spr, 0, 0); g.restore();
}

