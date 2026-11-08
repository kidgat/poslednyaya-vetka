/* ================================ S1-ART ================================ */
/* S1-ART: улица S1 «Дворы» из утверждённых рисунков ART-SURF-001 (гибрид: картинки + Canvas 2D).
   Картинки — data URI из src/24-s1-art.js (внутри index.html: офлайн и sw.js без изменений).
   Каркас прежний: те же слои {c, p, y0}, длина 3600, переходы, geo 2, сохранения.
   Резерв: пока картинки не декодированы, при ошибке или с ?s1=proc — процедурная S1 (buildStreetS1). */
const S1Art = {
  state: 'idle', imgs: null, ms: 0, error: '', WAIT_MS: 10000,
  start() {
    if (this.state !== 'idle') return;
    if (/[?&]s1=proc(?:&|$)/.test(location.search) || typeof Image === 'undefined') { this.state = 'off'; return; }
    this.state = 'loading';
    const t0 = performance.now();
    setTimeout(() => { if (this.state === 'loading') { this.state = 'failed'; this.error = 'timeout'; console.warn('S1-ART: картинки не успели загрузиться, процедурная S1'); this.swap(); } }, this.WAIT_MS);
    Promise.all(Object.keys(S1_ART_SRC).map(k => {
      const im = new Image(); im.src = S1_ART_SRC[k];
      return (im.decode ? im.decode() : new Promise((ok, no) => { im.onload = ok; im.onerror = no; })).then(() => [k, im]);
    })).then(list => {
      if (this.state !== 'loading') return;
      this.imgs = Object.fromEntries(list); this.state = 'ready'; this.ms = Math.round(performance.now() - t0); this.swap();
    }).catch(e => { if (this.state !== 'loading') return; this.state = 'failed'; this.error = String(e && e.message || e); console.warn('S1-ART: картинки не загрузились, процедурная S1', e); this.swap(); });
  },
  /** Какая S1 нужна сейчас: картинки / ожидание (дымка) / процедурная (резерв). */
  kind() { return this.state === 'ready' ? 'art' : this.state === 'loading' ? 'wait' : 'proc'; },
  /** S1 уже в кэше сцен (старт игры в S1) другого вида — пересобрать на месте; иначе соберётся при входе. */
  swap() {
    const old = Scene.cache.get('S1');
    if (!old || old.kind === this.kind()) return;
    const w = buildOutdoor('S1');
    Scene.cache.set('S1', w); Scene.builds++;
    for (const c of old.canvases) { c.width = 0; c.height = 0; }
  },
};

/** Пока картинки декодируются (секунды на старте игры прямо в S1): дымка и земля, без тяжёлой процедурной сборки. */
function buildStreetS1Wait() {
  const W = CONFIG.SCENES.S1.W, TOP = CONFIG.STREET.TOP, GY = GROUND_Y;
  const sky = makeCanvas(Math.ceil(W * 0.06 + 800), -130 - TOP), gs = sky.getContext('2d');
  const gr = gs.createLinearGradient(0, 0, 0, sky.height); gr.addColorStop(0, '#5c5d63'); gr.addColorStop(1, '#9a9a98'); gs.fillStyle = gr; gs.fillRect(0, 0, sky.width, sky.height);
  const pc = makeCanvas(W, -TOP), g = pc.getContext('2d');
  g.fillStyle = '#9a9a98'; g.fillRect(0, 0, W, GY - TOP); g.fillStyle = '#3a3a38'; g.fillRect(0, GY - TOP, W, -GY);
  const fc = makeCanvas(1, 1);
  return { layered: true, kind: 'wait', layers: [{ c: sky, p: 0.06, y0: TOP }, { c: pc, p: 1, y0: TOP }], front: { c: fc, p: 1.15, y0: -150 },
    canvases: [sky, pc, fc], lights: [], emissive: [], buildMs: 0, bytes: (sky.width * sky.height + W * -TOP + 1) * 4 };
}

/** Мировой x → x на слое с параллаксом p (объект оказывается за героем, когда камера на нём). */
const s1L = (x, p) => Math.round(330 + (x - 330) * p);   // 330 ≈ половина кадра iPhone в игровых px

function buildStreetS1Art(I) {
  const t0 = performance.now(), sc = CONFIG.SCENES.S1, W = sc.W, TOP = CONFIG.STREET.TOP, GY = GROUND_Y, L = sc.layout, M = S1_ART_META.cells;
  const rng = makeRng(2207);
  const ctx = c => { const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return g; };
  const layer = (p, y0, c) => ({ c, p, y0 });
  /** Картинка с плавно проявляющимся левым краем (бесшовная стыковка повторов). */
  const fadeLeft = (im, n) => {
    const c = makeCanvas(im.width, im.height), g = ctx(c);
    g.drawImage(im, 0, 0);
    const gr = g.createLinearGradient(0, 0, n, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, n, im.height);
    g.fillStyle = '#000'; g.fillRect(n, 0, im.width - n, im.height);
    return c;
  };
  const tile = (g, im, x0, x1, y, overlap) => {                     // повтор по горизонтали со смешиванием стыков
    const soft = fadeLeft(im, overlap);
    for (let x = x0, first = true; x < x1; x += im.width - overlap, first = false) g.drawImage(first ? im : soft, x, y);
  };
  const flipDraw = (g, im, x, y, flip, w = im.width, h = im.height) => {
    if (!flip) { g.drawImage(im, x, y, w, h); return; }
    g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(im, 0, 0, w, h); g.restore();
  };
  const haze = (g, w, h, a) => { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(140,140,138,${a})`; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; };

  // ---------- небо (0,06) ----------
  const skyC = makeCanvas(Math.ceil(W * 0.06 + 800), -130 - TOP); ctx(skyC).drawImage(I.sky, 0, 0);
  // ---------- дальний город (0,22): весь силуэт без повторов ----------
  const farC = makeCanvas(Math.ceil(W * 0.22 + 800), 310); ctx(farC).drawImage(I.far, 0, 310 - I.far.height);
  // ---------- средний план (0,5): длинный дом в дымке ----------
  const midC = makeCanvas(Math.ceil(W * 0.5 + 800), 348), gm = ctx(midC);
  tile(gm, I.mid, 0, midC.width, 348 - 14 - I.mid.height, 60);
  haze(gm, midC.width, 348, 0.22);
  { const gr = gm.createLinearGradient(0, 300, 0, 348); gr.addColorStop(0, 'rgba(140,140,138,0)'); gr.addColorStop(1, 'rgba(140,140,138,1)'); gm.fillStyle = gr; gm.fillRect(0, 300, midC.width, 48); }
  // ---------- задний план (0,76): двор с площадкой, гаражи, башня ----------
  const backC = makeCanvas(Math.ceil(W * 0.76 + 800), 318), gb = ctx(backC);
  gb.imageSmoothingEnabled = true; gb.imageSmoothingQuality = 'high';
  const k76 = 0.76;
  flipDraw(gb, I.houseB, s1L(60, k76) - 60, 318 - Math.round(I.houseB.height * k76), false, Math.round(I.houseB.width * k76), Math.round(I.houseB.height * k76));
  flipDraw(gb, I.houseA, s1L(1880, k76) - 70, 318 - Math.round(I.houseA.height * k76), true, Math.round(I.houseA.width * k76), Math.round(I.houseA.height * k76));
  gb.imageSmoothingEnabled = false;
  gb.drawImage(I.yard, s1L(1320, k76) - (I.yard.width >> 1), 318 - I.yard.height);
  gb.imageSmoothingEnabled = true;
  for (const [x, f] of [[1700, false], [1762, true], [1824, false]]) flipDraw(gb, I.garage, s1L(x, k76), 318 - Math.round(I.garage.height * k76), f, Math.round(I.garage.width * k76), Math.round(I.garage.height * k76));
  gb.imageSmoothingEnabled = false;
  haze(gb, backC.width, 318, 0.16);

  // ---------- игровая плоскость (1): асфальт, пятиэтажки, предметы ----------
  const pc = makeCanvas(W, -TOP), g = ctx(pc); g.setTransform(1, 0, 0, 1, 0, -TOP);
  for (let r = 0, y = GY - 8; y < 0; r++, y += I.asphalt.height - 6) {   // асфальт из рисунка до низа кадра, к зрителю темнее
    const sh = makeCanvas(W, I.asphalt.height), gs = ctx(sh);
    tile(gs, I.asphalt, -((r * 397) % 600), W, 0, 80);
    if (r) { gs.globalCompositeOperation = 'source-atop'; gs.fillStyle = `rgba(20,20,22,${Math.min(0.55, 0.12 * r)})`; gs.fillRect(0, 0, W, sh.height); }
    g.drawImage(sh, 0, y);
  }
  const cell = (img, r, dx, dy, dw, dh) => g.drawImage(I[img], r[0], r[1], r[2], r[3], dx, dy, dw, dh);
  /** Пятиэтажка: секции по 352 px из колонок исходников (без зеркал), 5 этажей по 64 px, первый этаж с цоколем, подъезды по центру секций. */
  const house = (x0, sections, seed) => {
    const hr = makeRng(seed), hp = a => a[(hr() * a.length) | 0], F = CONFIG.STREET, SEC = F.SECTION, GH = 68, UH = 64, RH = 41;
    const top = GY - GH - 4 * UH;
    let prev = { balc: null, win: null };
    for (let s = 0; s < sections; s++) {
      const sx = x0 + s * SEC, types = ['balc', 'win', 'win', 'win', 'win', 'balc'];
      const cols = types.map(t => { let c; do c = hp(M.upper[t]); while (c === prev[t] && M.upper[t].length > 1); prev[t] = c; return { t, c, w: c.r[0][2] }; });
      const sum = cols.reduce((a, c) => a + c.w, 0);
      let acc = 0;
      for (const col of cols) {
        const xa = sx + Math.round(acc * SEC / sum); acc += col.w; const xb = sx + Math.round(acc * SEC / sum), w = xb - xa;
        const order = [0, 1, 2, (hr() * 3) | 0]; for (let i = order.length - 1; i > 0; i--) { const j = (hr() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
        for (let f = 0; f < 4; f++) cell(col.c.img, col.c.r[order[f]], xa, top + f * UH, w, UH);
        const gc = hp(M.ground[col.t]); cell(gc.img, gc.r, xa, GY - GH, w, GH);
      }
      const e = M.entrance, ex = sx + (SEC >> 1) - (e.r[2] >> 1); cell(e.img, e.r, ex, GY - e.r[3], e.r[2], e.r[3]);
    }
    const x1 = x0 + sections * SEC;
    for (let x = x0, i = 0; x < x1; i++) { const r = M.roof[(i + seed) % 2]; const w = Math.min(r.r[2], x1 - x); cell(r.img, [r.r[0], r.r[1], w, r.r[3]], x, top - RH, w, RH); x += w; }
    for (const [end, ex] of [[M.endL, x0 - M.endL.r[2]], [M.endR, x1]]) {        // торцы: крыша, 4 этажа, первый этаж
      const [rx, ry, rw] = end.r;
      const ys = [[0, 41, top - RH, RH], [41, 64, top, UH], [105, 64, top + UH, UH], [41, 64, top + 2 * UH, UH], [170, 62, top + 3 * UH, UH], [231, 68, GY - GH, GH]];
      for (const [sy, sh, dy, dh] of ys) g.drawImage(I[end.img], rx, ry + sy, rw, sh, ex, dy, rw, dh);
    }
    const wk = M.walk; for (let x = x0 - 8; x < x1 + 8; x += wk.r[2]) { const w = Math.min(wk.r[2], x1 + 8 - x); cell(wk.img, [wk.r[0], wk.r[1], w, wk.r[3]], x, GY - 2, w, wk.r[3]); }
  };
  house(L.house1[0], L.house1[1], 31);
  house(L.house2[0], L.house2[1], 57);
  // двор и края
  for (const [x, f] of [[3430, false], [3500, true]]) flipDraw(g, I.rubble, x, GY - I.rubble.height + 4, f);
  flipDraw(g, I.garage, 880, GY - I.garage.height + 2, false);
  flipDraw(g, I.pole, 1735, GY - I.pole.height + 2, false);
  for (const [x, h, sd] of L.trees) {
    const k = Math.max(0.78, Math.min(1.12, h / 300)), w = Math.round(I.tree.width * k), hh = Math.round(I.tree.height * k);
    flipDraw(g, I.tree, x - (w >> 1), GY - hh + 2, sd % 2 === 1, w, hh);
  }
  for (const x of L.lamps) g.drawImage(I.lamp, x - 5, GY - I.lamp.height + 2);
  for (const x of L.benches) { g.drawImage(I.bench, x - 21, GY - I.bench.height + 1); g.drawImage(I.urn, x + 26, GY - I.urn.height + 1); }
  L.cars.forEach(([x], i) => flipDraw(g, I.car, x - 47, GY - I.car.height + 3, i % 2 === 1));
  const junk = { sofa: 'bags', fridge: 'bags', barrel: 'tires', tires: 'tires', pallets: 'crate', cart: 'crate', sign: null };
  for (const [k, x] of L.junk) { const n = junk[k]; if (n) flipDraw(g, I[n], x, GY - I[n].height + 2, rng() < 0.5); }
  flipDraw(g, I.tires, L.dumpster + 40, GY - I.tires.height + 2, false); flipDraw(g, I.bags, L.dumpster - 20, GY - I.bags.height + 2, true);
  for (let x = 20; x < W; x += 170 + ((rng() * 260) | 0)) {             // клочья травы и мусор у земли (за героем)
    const im = I['clump' + ((rng() * 4) | 0)];
    if (rng() < 0.55) flipDraw(g, im, x, GY - im.height + 6, rng() < 0.5);
  }
  const play = layer(1, TOP, pc);
  // ---------- передний план (1,15): трава и обломки ниже ступней героя (верх не выше −112) ----------
  const fw = Math.ceil(W * 1.15 + 200), fc = makeCanvas(fw, 150), gf = ctx(fc);
  for (let x = 0; x < fw; x += 120 + ((rng() * 220) | 0)) {
    const im = I['clump' + ((rng() * 4) | 0)], k = 0.8 + rng() * 0.25, w = Math.round(im.width * k), h = Math.round(im.height * k), base = 112 + ((rng() * 26) | 0);
    flipDraw(gf, im, x, Math.max(38, base - h), rng() < 0.5, w, h);
  }
  const front = { c: fc, p: 1.15, y0: -150 };
  const sky = layer(0.06, TOP, skyC), far = layer(0.22, -440, farC), mid = layer(0.5, -470, midC), back = layer(0.76, -440, backC);
  const cv = [sky, far, mid, back, play, front].map(l => l.c);
  return { layered: true, art: true, kind: 'art', layers: [sky, far, mid, back, play], front, canvases: cv, lights: [], emissive: [],
    buildMs: performance.now() - t0, bytes: cv.reduce((a, c) => a + c.width * c.height * 4, 0) };
}
