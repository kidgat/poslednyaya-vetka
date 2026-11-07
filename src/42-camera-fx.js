/* ================================ CAMERA ================================== */
/** Критически демпфированное сглаживание (как SmoothDamp): плавно, без перелёта. */
function damp(cur, target, state, smoothTime, dt) {
  const omega = 2 / smoothTime, x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target, temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * e;
  return target + (change + temp) * e;
}
const Camera = {
  x: 0, prevX: 0, vel: { v: 0 }, look: 0, viewW: 480,
  y: 0, prevY: 0, velY: { v: 0 }, viewH: 270,
  /** По X — следование с упреждением; по Y — станция целиком или улица, если герой на поверхности. */
  update(dt, player) {
    this.prevX = this.x; this.prevY = this.y;
    const C = CONFIG.CAMERA, moving = Math.abs(player.vx) > 4;
    const lookTarget = player.facing * (moving ? C.LOOK_AHEAD : C.LOOK_AHEAD * 0.4);
    this.look += (lookTarget - this.look) * (1 - Math.exp(-dt * C.LOOK_RATE));
    this.x = this.clampX(damp(this.x, this.clampX(player.x + this.look - this.viewW / 2), this.vel, C.SMOOTH_TIME, dt));
    this.y = damp(this.y, this.targetY(player), this.velY, C.SMOOTH_Y, dt);
  },
  clampX(x) { return clamp(x, 0, Math.max(0, Scene.W() - this.viewW)); },   // фаза А: ширина активной сцены
  /** 0.9: цель по y — у каждого этажа своя (FLOORS[f].cam — доля высоты кадра для ступней; нет — низ станции).
      1.0.1: при служебном проходе этаж меняется, пока героя не видно, — камера плавно догоняет новую цель. */
  floorY(f) {
    if (Scene.def().layered) { const F = Scene.floor(f); return clamp(F.y - this.viewH * F.cam, CONFIG.STREET.TOP, -this.viewH); }   // ШТАБ-022: камера улицы — ступни на cam всех масштабов, кадр в границах слоёв
    const maxY = H - this.viewH, F = Scene.floor(f);
    if (Zoom.factor() > 1) return clamp(F.y - this.viewH * CONFIG.ZOOM.FEET, -SURF_H, WORLD_BOTTOM - this.viewH);   // 1.1А-UX1: кадр меньше — у каждого этажа ступни на FEET высоты
    if (F.bottom) return Math.max(-SURF_H, WORLD_BOTTOM - this.viewH);    // 1.0: ярус −2 — низ кадра = низ мира
    return F.cam ? clamp(F.y - this.viewH * F.cam, -SURF_H, maxY) : maxY;   // старые этажи — как в 0.9
  },
  targetY(p) { return this.floorY(p.floor); },                         // 1.0.1: при проходе этаж меняется, когда героя не видно — камера плавно догоняет
  snap(player) {
    this.look = player.facing * CONFIG.CAMERA.LOOK_AHEAD * 0.4;
    this.x = this.prevX = this.clampX(player.x + this.look - this.viewW / 2); this.vel.v = 0;
    this.y = this.prevY = this.targetY(player); this.velY.v = 0;
  },
};

/* ================================== FX ==================================== */
const FX = {
  dust: [], puffs: [], embers: [], sparks: [], splashes: [], ash: [],
  init() {
    for (let i = 0; i < 70; i++) this.ash.push({ x: rand() * 600, y: -SURF_H + rand() * (SURF_H + GROUND_Y), vx: 3 + rand() * 4, vy: 5 + rand() * 7, ph: rand() * 6.28 });
    for (let i = 0; i < 90; i++) this.dust.push({ x: rand() * 600, y: 128 + rand() * 84, vx: (rand() - 0.5) * 3, vy: (rand() - 0.5) * 1.5, ph: rand() * 6.28, a: 0.25 + rand() * 0.45 });
  },
  step(x, facing, y) {
    for (let k = 0; k < 2; k++) this.puffs.push({ x: x - facing * 2 + (rand() - 0.5) * 4, y, vx: -facing * (4 + rand() * 6), vy: -2 - rand() * 3, life: 0.5 });
  },
  update(dt, t, camX, viewW) {
    for (const d of this.dust) {                                        // пыль висит в зале и «заворачивается» в кадр
      d.x += d.vx * dt + Math.sin(t * 0.4 + d.ph) * 0.06; d.y += d.vy * dt + Math.cos(t * 0.3 + d.ph) * 0.04;
      const span = viewW + 40;
      if (d.x < camX - 20) d.x += span; else if (d.x > camX + viewW + 20) d.x -= span;
      if (d.y < 128) d.y = 211; else if (d.y > 212) d.y = 128;
    }
    for (const a of this.ash) {                                         // пепел над улицей
      a.x += (a.vx + Math.sin(t * 0.7 + a.ph) * 3) * dt; a.y += a.vy * dt;
      if (a.y > GROUND_Y - 1) { a.y = -SURF_H + rand() * 20; a.x = camX + rand() * viewW; }
      const span = viewW + 40;
      if (a.x < camX - 20) a.x += span; else if (a.x > camX + viewW + 20) a.x -= span;
    }
    this.puffs = this.puffs.filter(p => (p.life -= dt) > 0 && ((p.x += p.vx * dt), (p.y += p.vy * dt), (p.vx *= 0.92), true));
    // Огонь в бочке выбрасывает искры.
    if (rand() < dt * 7) this.embers.push({ x: WORLD.fire.x + (rand() - 0.5) * 8, y: WORLD.fire.y - 4, vx: (rand() - 0.5) * 6, vy: -14 - rand() * 12, life: 1 + rand() });
    this.embers = this.embers.filter(e => (e.life -= dt) > 0 && ((e.x += e.vx * dt + Math.sin(t * 5 + e.y) * 0.08), (e.y += e.vy * dt), true));
    // Капли с потолка.
    for (const d of WORLD.drips) {
      if (!d.active) { d.wait -= dt; if (d.wait <= 0) { d.active = true; d.y = d.y0 || 132; d.v = 0; } continue; }
      d.v += 260 * dt; d.y += d.v * dt;
      const fl = d.y1 || 214;                                            // 1.0: у капли свой потолок и пол
      if (d.y >= fl) { d.active = false; d.wait = 1.4 + rand() * 2.2;
        for (let k = 0; k < 3; k++) this.splashes.push({ x: d.x, y: fl - 1, vx: (rand() - 0.5) * 24, vy: -18 - rand() * 14, life: 0.35, floor: fl - 1 }); }
    }
    this.splashes = this.splashes.filter(s => (s.life -= dt) > 0 && ((s.vy += 200 * dt), (s.x += s.vx * dt), (s.y += s.vy * dt), true));
    // Оборванный кабель искрит.
    const sp = WORLD.spark; sp.timer -= dt;
    if (sp.timer <= 0 && Power.level('technical') > 0) {
      sp.timer = 2 + rand() * 4; sp.flash.i = 1;
      for (let k = 0; k < 14; k++) this.sparks.push({ x: sp.x, y: sp.y, vx: (rand() - 0.5) * 70, vy: -10 - rand() * 40, life: 0.3 + rand() * 0.5 });
    }
    sp.flash.i = Math.max(0, sp.flash.i - dt * 7);
    this.sparks = this.sparks.filter(s => (s.life -= dt) > 0 && ((s.vy += 160 * dt), (s.x += s.vx * dt), (s.y = Math.min(213, s.y + s.vy * dt)), true));
  },
};

/** Яркость источника в момент t по его режиму. */
function lightIntensity(l, t) {
  switch (l.mode) {
    case 'steady':  return 1 - noise1(t * 3, l.seed) * 0.05;
    case 'flicker': { const slow = noise1(t * 0.5, l.seed) < 0.3 ? 0.08 : 1; return (noise1(t * 9, l.seed + 1) > 0.3 ? 1 : 0.18) * slow; }
    case 'dead':    return 0;
    case 'fire':    return 0.78 + noise1(t * 9, l.seed) * 0.3 + Math.sin(t * 23 + l.seed) * 0.04;
    case 'pulse':   return 0.2 + 0.8 * Math.pow(Math.max(0, Math.sin(t * 3.1)), 2);
    case 'screen':  return 0.8 + (noise1(t * 14, l.seed) > 0.85 ? -0.4 : 0) + Math.sin(t * 40) * 0.03;
    case 'garland': return 0.75 + Math.sin(t * 1.2 + l.seed) * 0.25;
    case 'spark':   return l.i;
    default:        return 1;
  }
}

