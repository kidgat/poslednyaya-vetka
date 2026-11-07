/* ================================ PLAYER ================================== */
const Player = {
  floor: CONFIG.PLAYER.HOME.floor, state: 'walk',      // state: 'walk' | 'passage' | 'gate' (1.0.1: открытых маршей нет)
  x: CONFIG.PLAYER.HOME.x, prevX: CONFIG.PLAYER.HOME.x,
  y: CONFIG.FLOORS[CONFIG.PLAYER.HOME.floor].y, prevY: CONFIG.FLOORS[CONFIG.PLAYER.HOME.floor].y,
  vx: 0, facing: 1, path: null, gate: null, alpha: 1,
  target: null,                          // 1.1А-UX2: точка назначения касанием (мировой x на текущем этаже); не сохраняется
  flashlightOn: false,                   // 1.1А-UX1: личный фонарь (после перезагрузки — выключен)
  /** Состояние фонаря для игровой логики (будущие скрытность, NPC): включён ли, откуда и куда светит, дальность в мировых px.
      lit — виден ли свет сейчас (во время прохода и ворот луч скрыт). */
  flashlight() {
    const F = CONFIG.FLASHLIGHT, lit = this.flashlightOn && this.state === 'walk' && this.alpha > 0.5;
    return { on: this.flashlightOn, lit, floor: this.floor, x: Math.round(this.x) + this.facing * F.HAND[0], y: this.y - F.HAND[1], facing: this.facing, range: F.RANGE };
  },
  toggleFlashlight() { this.flashlightOn = !this.flashlightOn; Flashlight.render(); return this.flashlightOn; },
  walkDist: 0, frame: 0, idleT: 0, blinkT: 3, onStep: null,
  reset() {
    this.floor = 'platform'; this.state = 'walk'; this.path = null; this.gate = null; this.pass = null; this.alpha = 1;
    this.x = this.prevX = CONFIG.PLAYER.START_X; this.y = this.prevY = CONFIG.FLOORS.platform.y;
    this.vx = 0; this.walkDist = 0;
  },
  /** 1.1А: поставить героя на этаж и x (старт, загрузка сохранения) — обычная ходьба, без прохода и ворот. */
  place(floor, x, facing = 1) {
    this.floor = floor; this.state = 'walk'; this.path = null; this.gate = null; this.pass = null; this.alpha = 1;
    this.x = this.prevX = x; this.y = this.prevY = Scene.floor(floor).y; this.facing = facing; this.vx = 0; this.walkDist = 0;
  },
  /** Что рядом: лестница { kind:'stair', stair, dir } или гермоворота { kind:'gate', from, to, dir }; иначе null. */
  interaction() {
    if (this.state !== 'walk' || Scene.id !== 'ST') return null;      // фаза А: снаружи станции действий нет (гараж, тайник, ворота — только на ST)
    const inside = (x, [a, b]) => x >= a && x <= b;
    for (const q of CONFIG.PASSAGES)                                      // 1.0.1: служебные проходы
      for (const [from, to] of [[q.a, q.b], [q.b, q.a]])
        if (this.floor === from.floor && Math.abs(this.x - from.x) <= q.radius) return { kind: 'passage', passage: q, from, to, dir: from.dir };
    for (const gt of CONFIG.GATES)
      for (const [from, to] of [[gt.a, gt.b], [gt.b, gt.a]])
        if (this.floor === from.floor && Math.abs(this.x - from.x) <= gt.radius) return { kind: 'gate', from, to, dir: from.dir };
    const G = CONFIG.GENERATOR;
    if (this.floor === G.floor && inside(this.x, G.trigger)) return { kind: 'generator', dir: 'use' };
    for (const item of CONFIG.INSPECTS) {
      if (this.floor !== item.floor) continue;
      if (item.trigger) { if (inside(this.x, item.trigger)) return { kind: 'inspect', item, dir: 'use' }; continue; }
      const a = npcById(item.npc);                                       // разговор: от текущей позиции NPC
      if (a && Math.abs(this.x - a.x) <= item.radius) return { kind: 'inspect', item, dir: 'use' };
    }
    for (const spot of CONFIG.SCAVENGE.SPOTS)
      if (this.floor === spot.floor && inside(this.x, spot.trigger)) return { kind: 'scavenge', item: spot, dir: 'use' };
    return null;
  },
  update(dt, dir, action) {
    this.prevX = this.x; this.prevY = this.y;
    if (this.state === 'scene') { this.vx = 0; return; }               // фаза А: смена сцены — ввод игнорируется
    if (this.state === 'gate') { this.updateGate(dt); return; }
    if (this.state === 'passage') { this.updatePassage(dt); return; }   // 1.0.1: ввод во время прохода игнорируется
    if (action) {
      const it = this.interaction();
      if (it && (action === 'use' || action === it.dir)) {
        if (it.kind === 'gate') { this.startGate(it); return; }
        if (it.kind === 'passage') { this.startPassage(it); return; }
      }
    }
    this.updateWalk(dt, dir);
  },
  /** Разгон, торможение, разворот и границы текущего этажа. Анимация привязана к пройденному пути — ноги не скользят. */
  updateWalk(dt, dir) {
    const P = CONFIG.PLAYER, F = Scene.floor(this.floor);
    if (dir !== 0) {
      const a = Math.sign(this.vx) === -dir && this.vx !== 0 ? P.TURN : P.ACCEL;
      this.vx = clamp(this.vx + dir * a * dt, -P.MAX_SPEED, P.MAX_SPEED);
      this.facing = dir;
    } else {
      const s = Math.max(0, Math.abs(this.vx) - P.DECEL * dt); this.vx = Math.sign(this.vx) * s;
    }
    this.x += this.vx * dt;
    if (this.x < F.minX) { this.x = F.minX; this.vx = 0; }
    if (this.x > F.maxX) { this.x = F.maxX; this.vx = 0; }
    const moving = Math.abs(this.vx) > 4;
    if (moving) {
      this.walkDist += Math.abs(this.vx) * dt;
      const f = Math.floor(this.walkDist / P.STRIDE) % 8;
      if (f !== this.frame && (f === 2 || f === 6) && this.onStep) this.onStep(this.x, this.facing, this.y);
      this.frame = f; this.idleT = 0;
    } else {
      this.walkDist = 0; this.frame = 0; this.idleT += dt;
    }
    this.blinkT -= dt; if (this.blinkT < -0.12) this.blinkT = 2.5 + Math.random() * 3;
  },
  /** 1.0.1: служебный проход. align — подойти к центру арки; turn — спиной к зрителю; enter — шаги вглубь (темнеет, уходит выше);
      transit — лестница за стеной (героя не видно, камера едет); exit — из глубины арки лицом к зрителю; settle — снова боком. */
  startPassage({ passage, from, to }) {
    this.state = 'passage'; this.vx = 0; this.pass = { passage, from, to, at: from, phase: 'align', t: 0, k: 0, step: 0 };
  },
  updatePassage(dt) {
    const s = this.pass, C = CONFIG.PASSAGE; s.t += dt;
    if (s.phase === 'align') {
      const d = s.from.x - this.x, st = C.ALIGN_SPEED * dt;
      if (Math.abs(d) > 0.5) { this.facing = Math.sign(d); this.x += Math.sign(d) * Math.min(Math.abs(d), st); this.walkDist += Math.min(Math.abs(d), st); this.frame = Math.floor(this.walkDist / CONFIG.PLAYER.STRIDE) % 8; return; }
      this.x = s.from.x; s.phase = 'turn'; s.t = 0;
    } else if (s.phase === 'turn' && s.t >= C.TURN) { s.phase = 'enter'; s.t = 0; }
    else if (s.phase === 'enter') {
      s.k = Math.min(1, s.t / C.ENTER); s.step = Math.floor(s.t / 0.2);
      if (s.t >= C.ENTER) {                                                // скрылся в арке — переходим на другой этаж
        s.phase = 'transit'; s.t = 0; s.k = 1; this.floor = s.to.floor; s.at = s.to;
        this.x = this.prevX = s.to.x; this.y = this.prevY = CONFIG.FLOORS[s.to.floor].y;
      }
    } else if (s.phase === 'transit' && s.t >= C.TRANSIT) { s.phase = 'exit'; s.t = 0; }
    else if (s.phase === 'exit') {
      s.k = Math.max(0, 1 - s.t / C.EXIT); s.step = Math.floor(s.t / 0.2);
      if (s.t >= C.EXIT) { s.phase = 'settle'; s.t = 0; s.k = 0; }
    } else if (s.phase === 'settle' && s.t >= C.SETTLE) {
      this.state = 'walk'; this.pass = null; this.vx = 0; this.walkDist = 0; this.frame = 0; this.idleT = 0;
    }
  },
  startGate({ from, to }) { this.state = 'gate'; this.vx = 0; this.gate = { from, to, phase: 'open', t: 0 }; },
  /** Проход через ворота: открыть → уйти внутрь (затемнение) → камера едет → выйти с другой стороны. */
  updateGate(dt) {
    const s = this.gate; s.t += dt;
    if (s.phase === 'open' || s.phase === 'enter') this.x += (s.from.x - this.x) * Math.min(1, dt * 10);
    if (s.phase === 'open' && s.t >= (s.from.floor === 'vestibule' ? 0.7 : 0.25)) { s.phase = 'enter'; s.t = 0; }
    else if (s.phase === 'enter') {
      this.alpha = Math.max(0, 1 - s.t / 0.45);
      if (s.t >= 0.45) {
        s.phase = 'travel'; s.t = 0; this.alpha = 0; this.floor = s.to.floor;
        this.x = this.prevX = s.to.x; this.y = this.prevY = CONFIG.FLOORS[s.to.floor].y;
      }
    } else if (s.phase === 'travel' && s.t >= 1.1) { s.phase = 'exit'; s.t = 0; }
    else if (s.phase === 'exit') {
      this.alpha = Math.min(1, s.t / 0.45);
      if (s.t >= 0.45) { this.alpha = 1; this.state = 'walk'; this.gate = null; this.idleT = 0; }
    }
  },
  /** Должны ли быть открыты гермоворота в шлюзе (персонаж проходит через них). */
  gateOpenTarget() {
    if (this.state !== 'gate') return 0;
    const s = this.gate, side = s.phase === 'open' || s.phase === 'enter' ? s.from.floor : s.to.floor;
    return side === 'vestibule' ? 1 : 0;                                // 0.9: створки — в зале вестибюля
  },
  sprite() {
    if (this.state === 'scene') return SPRITES.idle[0];
    if (this.state === 'gate') return this.gate.phase === 'travel' ? null : this.gate.phase === 'exit' ? SPRITES.idle[0] : SPRITES.back;
    if (this.state === 'passage') {                                        // 1.0.1: спиной — при входе, лицом — при выходе
      const s = this.pass;
      if (s.phase === 'align') return SPRITES.walk[this.frame];
      if (s.phase === 'turn') return SPRITES.backWalk[0];
      if (s.phase === 'enter') return SPRITES.backWalk[s.step % 2 ? 1 : 2];
      if (s.phase === 'transit') return null;
      if (s.phase === 'exit') return SPRITES.frontWalk[s.step % 2 ? 1 : 2];
      return SPRITES.idle[0];
    }
    if (Math.abs(this.vx) > 4) return SPRITES.walk[this.frame];
    if (this.blinkT < 0) return SPRITES.blink;
    return SPRITES.idle[Math.floor(this.idleT / 0.7) % 2];
  },
};

