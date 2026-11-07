
/** Сцены: ST — станция (её WORLD строится один раз и не выгружается: это дом, там NPC и цепи питания).
    Наружные строятся по требованию; в памяти — только текущая и предыдущая сцена (CONFIG.SCENE.CACHE = 2),
    остальные наружные освобождаются (холст обнуляется). */
const Scene = {
  id: 'ST', prev: null, cache: new Map(), builds: 0, disposed: 0, buildLog: [],
  def() { return CONFIG.SCENES[this.id]; },
  floors() { return sceneFloors(CONFIG, this.id); },
  floor(f) { return this.floors()[f]; },
  W() { return this.def().W; },
  world() { return this.id === 'ST' ? WORLD : this.cache.get(this.id); },
  enter(id) {
    if (id === this.id) return;
    if (id !== 'ST' && !this.cache.has(id)) {
      const w = buildOutdoor(id); this.cache.set(id, w); this.builds++;
      this.buildLog.push({ id, ms: Math.round(w.buildMs * 10) / 10 }); if (this.buildLog.length > 20) this.buildLog.shift();
    }
    this.prev = this.id; this.id = id;
    const keep = [this.id, this.prev].slice(0, CONFIG.SCENE.CACHE);
    for (const [k, w] of [...this.cache]) if (!keep.includes(k)) {      // не текущая и не предыдущая — освободить
      for (const c of w.canvases || [w.surface]) if (c) { c.width = 0; c.height = 0; } this.cache.delete(k); this.disposed++;
    }
  },
  /** Байты пикселей холстов: станция (WORLD, постоянная) и кэш наружных сцен. */
  bytes() {
    let st = 0; for (const v of Object.values(WORLD)) if (v && v.width && v.getContext) st += v.width * v.height * 4;
    let out = 0; for (const w of this.cache.values()) for (const c of w.canvases || [w.surface]) if (c) out += c.width * c.height * 4;
    return { station: st, outdoor: out, cached: [...this.cache.keys()] };
  },
};

function buildWorld() {
  const main = makeCanvas(W, H), gm = main.getContext('2d', { willReadFrequently: true });
  paintRegion(gm, 0, 0, W, H, mainTexel);
  ROOMS.filter(r => roomFloor(r) === 'upper').forEach(r => drawRoom(gm, r));
  drawDoorways(gm);
  drawArcade(gm);
  COLUMNS.forEach((cx, i) => drawColumn(gm, cx, i));
  drawHallLamps(gm);
  BEACONS.forEach(([x, y]) => addBeacon(gm, x, y));
  CONFIG.EMERGENCY_LAMPS.filter(e => roomFloor(ROOMS.find(r => r.id === e.room)) === 'upper').forEach(e => addEmergencyLamp(gm, e));
  CONFIG.EMERGENCY_GLOW.forEach(e => { const l = addLight(e.x, e.y, e.r, [255, 52, 40], 'pulse', 0.75, 'main', 'emergency'); l.clip = HALL_CLIP; l.pool = true; });
  drawEnds(gm);
  drawProps(gm);
  drawArches(gm, ['upper', 'platform']);                                   // 1.0.1: служебные арки яруса 0 и платформы
  const back = makeCanvas(W, H), gb = back.getContext('2d', { willReadFrequently: true });
  paintRegion(gb, 0, 122, W, 92, backTexel);
  drawBackDecor(gb);
  const fw = Math.ceil(W * CONFIG.PARALLAX.FORE) + 40, fore = makeCanvas(fw, H), gf = fore.getContext('2d');
  drawFore(gf, fw);
  buildSurface(); buildVestibule(); buildUtility();
  WORLD.main = main; WORLD.back = back; WORLD.fore = fore;
  // 1.0: щебень низа кадра. Обычно — в том же слое, что и раньше (один drawImage, как в 0.9);
  //      когда камера смотрит ниже путей — слой без щебня + щебень с прозрачностью.
  WORLD.foreBare = makeCanvas(fw, H); drawFore(WORLD.foreBare.getContext('2d'), fw);
  WORLD.rubble = makeCanvas(fw, H); drawRubble(WORLD.rubble.getContext('2d'), fw);
  drawRubble(gf, fw);
  WORLD.lights.forEach(l => { if (!l.clip) l.clip = HALL_CLIP; });
  assignCircuits();
  WORLD.drips = [470, 1238, 1560].map((x, i) => ({ x, y: 0, v: 0, wait: 0.5 + i * 0.9, active: false }));
  const UY = CONFIG.FLOORS.utility.y;                                     // 1.0: сырые потолки грибницы и дренажной
  [[566, 0.3], [668, 1.1], [1700, 0.7], [1792, 1.6]].forEach(([x, w]) => WORLD.drips.push({ x, y: 0, v: 0, wait: w, active: false, y0: UY - 76, y1: UY - 2 }));
}

