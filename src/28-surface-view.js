/* ============================ ST-VIEW-002 ============================ */
/* Поверхность над «Гагаринской» — отдельная длинная сцена SURF (как «Дворы»): завал · рабочий вход в метро ·
   длинный дом · проход «Во дворы» · торцевой дом · заброшенный павильон · завал. Гибрид: панорама-картинка
   (data URI из src/29-stview-art.js, подготовка tools/art/prep_stview.py из art/ST-ART-001) + Canvas-дорога.
   Композиция и масштаб — с утверждённого рисунка: панорама слева на ART_X0, этаж ≈ 64 px (Глеб 40 px).
   Резерв: пока картинка не декодирована, при ошибке или с ?surf=proc — процедурная заглушка. */
const ART_X0 = 70;                    // мировой x левого края панорамы (двери: x = ART_X0 + src·K; см. CONFIG.SCENES.SURF и tools/art/prep_stview.py)
const ART_GROUND = 239;              // строка линии земли внутри panorama.png (meta.ground при текущем K) → GROUND_Y

const SurfArt = {
  state: 'idle', imgs: null, ms: 0, error: '', WAIT_MS: 10000,
  start() {
    if (this.state !== 'idle') return;
    if (/[?&]surf=proc(?:&|$)/.test(location.search) || typeof Image === 'undefined' || typeof STVIEW_ART_SRC === 'undefined') { this.state = 'off'; return; }
    this.state = 'loading';
    const t0 = performance.now();
    setTimeout(() => { if (this.state === 'loading') { this.state = 'failed'; this.error = 'timeout'; console.warn('ST-VIEW: панорама не успела загрузиться, заглушка'); this.swap(); } }, this.WAIT_MS);
    Promise.all(Object.keys(STVIEW_ART_SRC).map(k => {
      const im = new Image(); im.src = STVIEW_ART_SRC[k];
      return (im.decode ? im.decode() : new Promise((ok, no) => { im.onload = ok; im.onerror = no; })).then(() => [k, im]);
    })).then(list => {
      if (this.state !== 'loading') return;
      this.imgs = Object.fromEntries(list); this.state = 'ready'; this.ms = Math.round(performance.now() - t0); this.swap();
    }).catch(e => { if (this.state !== 'loading') return; this.state = 'failed'; this.error = String(e && e.message || e); console.warn('ST-VIEW: панорама не загрузилась, заглушка', e); this.swap(); });
  },
  /** Какая поверхность нужна: картинка / процедурная заглушка (резерв). */
  kind() { return this.state === 'ready' ? 'art' : 'proc'; },
  /** SURF уже в кэше сцен другого вида — пересобрать на месте; иначе соберётся при входе. */
  swap() {
    const old = Scene.cache.get('SURF');
    if (!old || old.kind === this.kind()) return;
    const w = buildOutdoor('SURF');
    Scene.cache.set('SURF', w); Scene.builds++;
    if (old.canvases) for (const c of old.canvases) { c.width = 0; c.height = 0; }
  },
};

/** Поверхность SURF из панорамы: слой зданий (картинка) + Canvas мокрая дорога + передний план. Слои {c, p, y0} как в S1. */
function buildSurfaceArtScene(I) {
  const t0 = performance.now(), sc = CONFIG.SCENES.SURF, W = sc.W, TOP = CONFIG.STREET.TOP, GY = GROUND_Y;
  const ctx = c => { const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return g; };
  const rng = makeRng(1402);

  // ---------- слой зданий (параллакс 1): панорама целиком, линия земли на GROUND_Y ----------
  const pano = I.panorama, bw = ART_X0 + pano.width, bh = pano.height;
  const bC = makeCanvas(bw, bh), gb = ctx(bC);
  gb.drawImage(pano, ART_X0, 0);
  const buildings = { c: bC, p: 1, y0: GY - ART_GROUND };                 // строка ART_GROUND → мировой GROUND_Y

  // ---------- игровая плоскость (1): мокрый асфальт, бордюр, лужи, мусор, трава под ногами ----------
  const pc = makeCanvas(W, -TOP), g = ctx(pc); g.setTransform(1, 0, 0, 1, 0, -TOP);
  const road0 = GY + 2;                                                   // дорога начинается сразу под линией земли
  { const gr = g.createLinearGradient(0, road0, 0, 0); gr.addColorStop(0, '#3a362f'); gr.addColorStop(0.5, '#2c2a25'); gr.addColorStop(1, '#232120'); g.fillStyle = gr; g.fillRect(0, road0, W, -road0); }
  g.fillStyle = '#4a463d'; g.fillRect(0, GY, W, 2);                       // бордюр — светлая бетонная кромка на линии земли
  g.fillStyle = 'rgba(20,18,16,.5)'; g.fillRect(0, GY + 2, W, 1);
  for (let x = 0; x < W; x += 7 + ((rng() * 5) | 0)) {                    // влажный блеск плит (горизонтальные штрихи)
    const y = road0 + ((rng() * (-road0 - 2)) | 0), l = 90 + ((rng() * 50) | 0);
    g.fillStyle = `rgba(${l},${l + 2},${l + 8},${0.04 + rng() * 0.06})`; g.fillRect(x, y, 3 + ((rng() * 5) | 0), 1);
  }
  const puddle = (x, y, pw) => {                                         // лужа: отражение пасмурного неба, тёмный край (как в S1)
    const ph = 3 + ((rng() * 5) | 0);
    for (let j = 0; j < ph; j++) { const q = Math.sqrt(1 - ((j + 0.5 - ph / 2) / (ph / 2)) ** 2), lw = Math.round(pw * q), lx = x + ((pw - lw) >> 1);
      g.fillStyle = j === 0 ? '#2b2924' : j === 1 ? '#9fa1a6' : j < ph - 1 ? (j % 2 ? '#8b8d92' : '#7d7f84') : '#45433d'; g.fillRect(lx, y + j, lw, 1); }
    if (pw > 40) { g.fillStyle = 'rgba(200,202,206,.5)'; g.fillRect(x + (pw >> 2), y + 2, pw >> 2, 1); }
  };
  const clump = (x, y, k) => {                                           // клок травы/бурьяна
    const hC = 60 + ((rng() * 30) | 0), ww = (14 * k) | 0, hh = (12 * k) | 0;
    for (let i = 0; i < 6 * k; i++) { const bx = x + ((rng() * ww) | 0), by = y - ((rng() * hh) | 0); g.fillStyle = `rgb(${hC - 20},${hC},${40 + (rng() * 20 | 0)})`; g.fillRect(bx, by, 1, hh - (by - y + hh)); }
  };
  for (let x = 12; x < W; x += 42 + ((rng() * 90) | 0)) {                // передний план дороги: лужи, трава, кирпич, камни
    const y = GY + 6 + ((rng() * (-GY - 16)) | 0), t = rng();
    if (t < 0.3) puddle(x, y, 22 + ((rng() * 64) | 0));
    else if (t < 0.56) clump(x, y, 0.6 + rng() * 0.5);
    else if (t < 0.78) for (let i = 0; i < 3 + rng() * 4; i++) { const bx = x + ((rng() * 22) | 0), by = y + ((rng() * 6) | 0); g.fillStyle = ['#7a4434', '#8c5040', '#6a3a2e'][(rng() * 3) | 0]; g.fillRect(bx, by, 5, 3); g.fillStyle = 'rgba(20,18,16,.5)'; g.fillRect(bx, by + 3, 5, 1); }
    else for (let i = 0; i < 6 + rng() * 8; i++) { const sx = x + ((rng() * 40) | 0), sy = y + ((rng() * 8) | 0), c = 96 + ((rng() * 50) | 0); g.fillStyle = `rgb(${c},${c - 2},${c - 6})`; g.fillRect(sx, sy, 2 + ((rng() * 2) | 0), 2); g.fillStyle = 'rgba(18,16,14,.55)'; g.fillRect(sx, sy + 2, 2, 1); }
  }
  const play = { c: pc, p: 1, y0: TOP };

  // ---------- передний план (1,15): трава и обломки ниже ступней (верх не выше −112) ----------
  const fw = Math.ceil(W * 1.15 + 200), fc = makeCanvas(fw, 150), gf = ctx(fc);
  for (let x = 0; x < fw; x += 120 + ((rng() * 220) | 0)) {
    const base = 112 + ((rng() * 26) | 0), hC = 58 + ((rng() * 28) | 0), ww = 18 + ((rng() * 16) | 0), hh = 14 + ((rng() * 12) | 0);
    for (let i = 0; i < 10; i++) { const bx = x + ((rng() * ww) | 0), by = base - ((rng() * hh) | 0); gf.fillStyle = `rgb(${hC - 18},${hC},${44 + (rng() * 22 | 0)})`; gf.fillRect(bx, by, 1, base - by); }
  }
  const front = { c: fc, p: 1.15, y0: -150 };

  const cv = [bC, pc, fc];
  return { layered: true, art: true, kind: 'art', layers: [buildings, play], front, canvases: cv, lights: [], emissive: [],
    buildMs: performance.now() - t0, bytes: cv.reduce((a, c) => a + c.width * c.height * 4, 0) };
}

/** Заглушка поверхности (резерв): ровная улица с подписями у дверей и точек сбора — для проверки переходов и сохранений. */
function buildSurfPlaceholder() {
  const t0 = performance.now(), sc = CONFIG.SCENES.SURF, w = sc.W, F = sc.floors.surface;
  const surf = makeCanvas(w, SURF_H), gm = surf.getContext('2d', { willReadFrequently: true });
  const R2 = (x, y, ww, hh, c) => R(gm, x, surfRow(y), ww, hh, c);
  paintStreet(gm, w);
  drawBlock(R2, 180, 300, 5, 11, [92, 86, 74]);                          // рабочий павильон слева (у входа в метро)
  drawBlock(R2, 560, 900, 5, 22, [96, 90, 78]);                          // длинный дом
  drawBlock(R2, 1500, 320, 5, 33, [92, 88, 80]);                         // торцевой дом
  drawBlock(R2, 1860, 260, 2, 44, [90, 86, 80]);                         // заброшенный павильон справа
  R2(F.minX - 40, GROUND_Y - 70, 60, 70, '#2a2724'); R2(w - 40, GROUND_Y - 70, 60, 70, '#2a2724');   // завалы по краям
  for (const d of sc.doors) { const lbl = d.label.replace(/^[^ ]+ /, ''); drawText(gm, lbl, d.x - (textWidth(lbl) >> 1), surfRow(GROUND_Y - 80), '#d8c090', 'rgba(0,0,0,.5)'); R2(d.x - 1, GROUND_Y - 76, 2, 76, '#d8c090'); }
  for (const s of CONFIG.SCAVENGE.SPOTS) { const cx = (s.trigger[0] + s.trigger[1]) >> 1; drawText(gm, s.title, cx - (textWidth(s.title) >> 1), surfRow(GROUND_Y - 50), '#9a9488', null); }
  return { surface: surf, lights: [], emissive: [], kind: 'proc', canvases: [surf], buildMs: performance.now() - t0, bytes: w * SURF_H * 4 };
}
