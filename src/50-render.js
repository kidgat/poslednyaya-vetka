/* ================================ RENDER ==================================
   Сцена рисуется в маленький буфер (viewW+1 × viewH игровых пикселей), потом
   растягивается на экран с ЦЕЛЫМ коэффициентом и сдвигом на дробную часть камеры —
   пиксели одинаковые и чёткие, а прокрутка плавная. */
const Render = {
  canvas: null, ctx: null, buf: null, g: null, light: null, gl: null, vignette: null, fireLayer: null, occ: [],
  scale: 1, viewW: 480, viewH: 270, yoff: 0, devW: 0, devH: 0, dpr: 1, drawnLights: 0,
  init(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.fireLayer = makeCanvas(64, 100); this.beamTex = this.makeBeam(); this.resize(); },
  /** Пятно света радиуса r того же профиля, что blob(); создаётся один раз на радиус и цвет. */
  lampDisc(r, c) {
    const key = r + ':' + c; this.discs = this.discs || {};
    if (this.discs[key]) return this.discs[key];
    const t = makeCanvas(2 * r, 2 * r), b = t.getContext('2d'), grd = b.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); grd.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},.5)`); grd.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    b.fillStyle = grd; b.fillRect(0, 0, 2 * r, 2 * r); return (this.discs[key] = t);
  },
  /** Масштаб луча (0.8.2): если стена комнаты ближе длины луча, луч укорачивается целиком и плавно гаснет у стены,
      вместо резкого вертикального среза. Не короче 40% — у самой стены остаётся короткое пятно. */
  beamFit(a, clip, scale) {
    const [hx] = lampPoint(a), L = 120 * scale;
    const room = a.facing > 0 ? (clip.x1 < 1e9 ? clip.x1 - hx : Infinity) : (clip.x0 > -1e9 ? hx - clip.x0 : Infinity);
    return room >= L ? 1 : Math.max(0.4, room / L);
  },
  /** Текстура луча ручного фонаря (один раз): конус длиной 120 с затуханием; вершина — в точке (2, 18). */
  makeBeam() {
    const L = 120, c = makeCanvas(L + 4, 60), b = c.getContext('2d'), ax = 2, ay = 18;
    b.beginPath(); b.moveTo(ax, ay); b.lineTo(ax + L, ay - 16); b.lineTo(ax + L, ay + 40); b.closePath(); b.clip();
    const grd = b.createRadialGradient(ax, ay, 0, ax, ay, L);
    grd.addColorStop(0, 'rgba(235,240,255,.9)'); grd.addColorStop(0.5, 'rgba(200,212,235,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = grd; b.fillRect(0, 0, c.width, c.height); return c;
  },
  /** Подбор целочисленного масштаба под экран; вызывается при повороте/изменении размера. */
  resize() {
    const vv = window.visualViewport, cssW = Math.round(vv ? vv.width : innerWidth), cssH = Math.round(vv ? vv.height : innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.devW = Math.round(cssW * this.dpr); this.devH = Math.round(cssH * this.dpr);
    this.canvas.width = this.devW; this.canvas.height = this.devH;
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.baseScale = Math.max(1, Math.floor(this.devH / H));
    this.scale = this.baseScale * Zoom.factor();                         // 1.1А-UX1: увеличение — игровой рендер и камера, не CSS
    // На iPhone (×4 по высоте) все уровни дают целый масштаб (4/5/6/7); на других экранах — кратный ступени, выборка nearest.
    this.viewH = Math.ceil(this.devH / this.scale) + 1;                 // +1 строка под дробный сдвиг камеры по Y
    this.viewW = Math.min(W, Math.ceil(this.devW / this.scale));
    this.buf = makeCanvas(this.viewW + 1, this.viewH); this.g = this.buf.getContext('2d');
    this.light = makeCanvas(this.viewW + 1, this.viewH); this.gl = this.light.getContext('2d');
    // Буфер свечения: сюда попадают лампочки, табло, маяки, искры и ореолы, которые оказались позади персонажа;
    // из буфера вырезаются силуэты, поэтому светящиеся пиксели стены не ложатся поверх одежды.
    // Создаётся только при изменении размера; очищается лишь использованный прямоугольник.
    this.glow = makeCanvas(this.viewW + 1, this.viewH); this.gg = this.glow.getContext('2d');
    this.vignette = this.makeVignette();
    Camera.viewW = this.viewW; Camera.viewH = this.devH / this.scale;
    this.ctx.imageSmoothingEnabled = false;
    this.zoomed = Zoom.factor() > 1;
  },
  makeVignette() {
    const c = makeCanvas(this.viewW + 1, this.viewH), g = c.getContext('2d'), w = c.width, h = c.height;
    const grd = g.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.72);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `rgba(0,0,0,${Visual.preset().vignette})`);   // край — по режиму яркости
    g.fillStyle = grd; g.fillRect(0, 0, w, h); return c;
  },
  /** Перевод мировой координаты в координату буфера для слоя с параллаксом p. */
  sx(x, p, camX, frac) { return Math.round(x - camX * p + frac); },
  frame(alpha, t) {
    if (Scene.id !== 'ST') return this.frameOutdoor(alpha, t);           // фаза А: наружные сцены — свой короткий кадр
    const g = this.g, camX = Camera.prevX + (Camera.x - Camera.prevX) * alpha, camY = Camera.prevY + (Camera.y - Camera.prevY) * alpha;
    const camI = Math.floor(camX), frac = camX - camI, camYI = Math.floor(camY), fracY = camY - camYI;
    const yo = this.yoff = -camYI, vw = this.viewW + 1, vh = this.viewH;
    const PB = CONFIG.PARALLAX.BACK, PF = CONFIG.PARALLAX.FORE;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#16181b'; g.fillRect(0, 0, vw, vh);
    // 1. Поверхность: небо, дальние руины, улица с вестибюлем (видна, когда камера поднята).
    if (yo > 0) {
      g.drawImage(WORLD.sky, this.sx(0, CONFIG.PARALLAX.SKY, camX, frac), yo - SURF_H);
      g.drawImage(WORLD.ruins, this.sx(0, CONFIG.PARALLAX.RUINS, camX, frac), yo - SURF_H);
      g.drawImage(WORLD.surface, -camI, yo - SURF_H);
      if (WORLD.vest && VEST.x1 - camI > 0 && VEST.x0 - camI < vw) g.drawImage(WORLD.vest, VEST.x0 - camI, VEST.y0 + yo);   // 0.9: вестибюль в грунте
    }
    // 2. Станция и створки гермоворот.
    g.drawImage(WORLD.back, this.sx(0, PB, camX, frac), yo);
    g.drawImage(WORLD.main, -camI, yo);
    if (WORLD.util && yo + H < vh - 1) g.drawImage(WORLD.util, -camI, yo + H);   // 1.0: ярус −2 — только когда виден (последняя строка буфера — запас под дробный сдвиг)
    this.drawGate(g, camI, yo);
    if (yo > 0) this.drawScavenge(g, camI, yo);
    // 3. Динамика под освещением (освещается картой света).
    g.fillStyle = 'rgb(222,212,190)';
    for (const d of FX.dust) { g.globalAlpha = d.a; g.fillRect(Math.round(d.x - camI), Math.round(d.y + yo), 1, 1); }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(170,200,215,.85)';
    for (const d of WORLD.drips) if (d.active) g.fillRect(d.x - camI, Math.round(d.y) + yo, 1, 2);
    for (const s of FX.splashes) g.fillRect(Math.round(s.x - camI), Math.round(s.y) + yo, 1, 1);
    g.fillStyle = 'rgba(150,140,120,.5)';
    for (const p of FX.puffs) { g.globalAlpha = p.life * 1.4; g.fillRect(Math.round(p.x - camI), Math.round(p.y) + yo, 2, 1); }
    g.globalAlpha = 1;
    if (yo > 0) { g.fillStyle = 'rgba(200,194,180,.8)'; for (const a of FX.ash) g.fillRect(Math.round(a.x - camI), Math.round(a.y) + yo, 1, 1); }
    // 4. Жители, охрана, мутанты, затем герой.
    this.occ.length = 0;
    this.drawActors(g, camI, yo);
    const px = Math.round(Player.prevX + (Player.x - Player.prevX) * alpha) - camI;
    const fy = Math.round(Player.prevY + (Player.y - Player.prevY) * alpha) + yo;
    if (Player.state === 'walk') {
      g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(px - 8, fy, 17, 1); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px - 6, fy + 1, 13, 1);
    }
    const spr = Player.sprite();
    const inArch = Player.state === 'passage' && Player.pass.phase !== 'align' && Player.pass.phase !== 'settle';
    const pFacing = Player.state === 'gate' || inArch ? 1 : Player.facing;
    this.playerOcc = null;
    this.archDY = 0;
    if (spr && inArch) this.drawInArch(g, spr, px, fy, Player.pass, camI, yo);          // 1.0.1: глубина арки — затемнение, подъём, обрезка косяками
    else if (spr) {
      this.hdHero = HD.on && HD.map.has(spr) ? { spr: HD.map.get(spr), px, top: fy - 40, facing: pFacing, alpha: Player.alpha } : null;   // ART-TECH-001: рисуется позже, в экранном разрешении
      if (!this.hdHero) { g.globalAlpha = Player.alpha; blit(g, spr, px, fy - 40, pFacing, 13); g.globalAlpha = 1; }
      this.playerOcc = { spr, cx: px, top: fy - 40, facing: pFacing, half: 13, alpha: Player.alpha };
      this.occ.push(this.playerOcc);
    }
    const mk = Game.mark;                                                // 1.1А-UX2: маркер цели — маленький золотой ромб на полу (мировой x), пока цель жива
    if (mk && mk.floor === Player.floor) {
      const mx = Math.round(mk.x) - camI, my = CONFIG.FLOORS[mk.floor].y + yo, a = mk.fading ? Math.max(0, mk.t / CONFIG.TOUCH.MARK) : 1;
      g.globalAlpha = 0.85 * a; g.fillStyle = '#e8b86a';
      g.fillRect(mx - 3, my, 2, 1); g.fillRect(mx + 2, my, 2, 1); g.fillRect(mx - 1, my - 1, 3, 1); g.fillRect(mx - 1, my + 1, 3, 1);
      g.globalAlpha = 1;
    }
    // 5. Карта освещения: тёмный фон + сложение источников, затем умножение на сцену.
    this.drawLightmap(camX, frac, t, px, fy);
    g.globalCompositeOperation = 'multiply'; g.drawImage(this.light, 0, 0);
    g.globalCompositeOperation = 'source-over';
    // 6. Светящиеся элементы поверх темноты.
    this.drawEmissive(camX, frac, t);
    // 7. Передний план и виньетка.
    const below = vh - 1 - yo - H;                                      // 1.0: сколько кадра ниже путей (ярус −2); запасную строку буфера не считаем
    if (below <= 0) g.drawImage(WORLD.fore, this.sx(0, PF, camX, frac), yo);   // как в 0.9
    else {
      if (below < 30) { g.globalAlpha = 1 - below / 30; g.drawImage(WORLD.rubble, this.sx(0, PF, camX, frac), yo); g.globalAlpha = 1; }
      g.drawImage(WORLD.foreBare, this.sx(0, PF, camX, frac), yo);
    }
    if (Player.state === 'passage' && Player.pass.phase === 'transit') {   // 1.0.1: короткое затемнение, пока герой на лестнице за стеной
      g.fillStyle = `rgba(0,0,0,${(0.4 * Math.sin(Math.PI * Math.min(1, Player.pass.t / CONFIG.PASSAGE.TRANSIT))).toFixed(3)})`; g.fillRect(0, 0, vw, vh);
    }
    g.drawImage(this.vignette, 0, 0);
    this.drawFade(g, vw, vh);
    // 8. На экран: целый масштаб, сдвиг на дробные части камеры по X и Y.
    const s = this.scale;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buf, Math.round(-frac * s), Math.round(-fracY * s), vw * s, vh * s);
    if (this.hdHero) this.drawHeroHD(this.hdHero, s, frac, fracY);
  },
  /** ART-TECH-001: HD-герой поверх кадра в экранных пикселях. Рост тот же (42 мировых px). Освещение — множитель карты света в точке груди
      (одним цветом: прототип не повторяет градиент луча по фигуре). snap — целый размер экранного пикселя (при 125 % / 175 % герой меньше на 1/5 и 1/7). */
  drawHeroHD(h, s, frac, fracY) {
    const t0 = performance.now(), ctx = this.ctx;
    const k = HD.snap ? Math.max(1, Math.floor(s / 2)) : s / 2;
    if (!HD.tmp) HD.tmp = makeCanvas(HD_W, HD_H);
    const tg = HD.tmp.getContext('2d', { willReadFrequently: true });
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, HD_W, HD_H); tg.drawImage(h.spr, 0, 0);
    const ly = Math.max(0, Math.min(this.viewH - 1, h.top + 20)), lx = Math.max(0, Math.min(this.viewW, h.px));
    const L = this.gl.getImageData(lx, ly, 1, 1).data;                  // свет в точке груди
    tg.globalCompositeOperation = 'multiply'; tg.fillStyle = `rgb(${L[0]},${L[1]},${L[2]})`; tg.fillRect(0, 0, HD_W, HD_H);
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(h.spr, 0, 0); tg.globalCompositeOperation = 'source-over';
    const ox = Math.round(-frac * s), oy = Math.round(-fracY * s), w = HD_W * k, hh = HD_H * k;
    const x = ox + h.px * s - (HD_W / 2) * k, y = oy + (h.top + 42) * s - hh;   // ноги на той же линии пола
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = h.alpha;
    if (h.facing >= 0) ctx.drawImage(HD.tmp, Math.round(x), Math.round(y), w, hh);
    else { ctx.save(); ctx.translate(Math.round(x) + w, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(HD.tmp, 0, 0, w, hh); ctx.restore(); }
    ctx.globalAlpha = 1;
    HD.frameMs += performance.now() - t0; HD.frames++;
  },
  /** Фаза А: затемнение перехода между сценами (только во время перехода). */
  drawFade(g, vw, vh) {
    const a = Game.fadeAlpha();
    if (a > 0.001) { g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; g.fillRect(0, 0, vw, vh); }
  },
  /** ШТАБ-022: кадр слоистой улицы. Небо, дальний город, средний план, игровая плоскость, герой, передний план. Свет нейтральный:
      атмосфера — в самой палитре и дымке слоёв (без общего бурого затемнения); виньетка — по режиму яркости. */
  frameStreet(alpha, t) {
    const g = this.g, sw = Scene.world(), camX = Camera.prevX + (Camera.x - Camera.prevX) * alpha, camY = Camera.prevY + (Camera.y - Camera.prevY) * alpha;
    const camI = Math.floor(camX), frac = camX - camI, camYI = Math.floor(camY), fracY = camY - camYI;
    const yo = this.yoff = -camYI, vw = this.viewW + 1, vh = this.viewH;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#8c8c8a'; g.fillRect(0, 0, vw, vh);
    for (const l of sw.layers) {
      g.drawImage(l.c, l.p === 1 ? -camI : this.sx(0, l.p, camX, frac), yo + l.y0);
      if (l === sw.layers[0]) {                                        // вороны над дальним городом (живое небо)
        g.fillStyle = 'rgba(36,36,40,.85)';
        for (let i = 0; i < 6; i++) {
          const span = vw + 160, bx = ((i * 197 + t * (6 + i % 3 * 2)) % span) - 80 - camX * 0.12 % span, by = yo - 330 + i * 11 + Math.sin(t * 0.7 + i) * 4, up = Math.floor(t * 3.2 + i * 0.7) % 2;
          const x0 = Math.round(((bx % span) + span) % span - 80), y0 = Math.round(by);
          g.fillRect(x0, y0, 1, 1); g.fillRect(x0 - 1, y0 - up, 1, 1); g.fillRect(x0 + 1, y0 - up, 1, 1); g.fillRect(x0 - 2, y0 - up * 2 + 1 - (1 - up), 1, 1); g.fillRect(x0 + 2, y0 - up * 2 + 1 - (1 - up), 1, 1);
        }
      }
    }
    g.fillStyle = 'rgba(150,140,120,.5)';
    for (const p of FX.puffs) { g.globalAlpha = p.life * 1.4; g.fillRect(Math.round(p.x - camI), Math.round(p.y) + yo, 2, 1); }
    g.globalAlpha = 1;
    this.occ.length = 0; this.archDY = 0; this.playerOcc = null;
    const px = Math.round(Player.prevX + (Player.x - Player.prevX) * alpha) - camI;
    const fy = Math.round(Player.prevY + (Player.y - Player.prevY) * alpha) + yo;
    g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(px - 9, fy, 19, 1); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(px - 7, fy + 1, 15, 1);
    const spr = Player.sprite();
    if (spr) { g.globalAlpha = Player.alpha; blit(g, spr, px, fy - 40, Player.facing, 13); g.globalAlpha = 1; }
    const mk = Game.mark;
    if (mk && mk.floor === Player.floor) {
      const mx = Math.round(mk.x) - camI, my = Scene.floor(mk.floor).y + yo, a = mk.fading ? Math.max(0, mk.t / CONFIG.TOUCH.MARK) : 1;
      g.globalAlpha = 0.85 * a; g.fillStyle = '#e8b86a';
      g.fillRect(mx - 3, my, 2, 1); g.fillRect(mx + 2, my, 2, 1); g.fillRect(mx - 1, my - 1, 3, 1); g.fillRect(mx - 1, my + 1, 3, 1);
      g.globalAlpha = 1;
    }
    g.drawImage(sw.front.c, this.sx(0, sw.front.p, camX, frac), yo + sw.front.y0);
    g.fillStyle = 'rgba(214,208,192,.32)';                             // пыль в воздухе
    for (let i = 0; i < 28; i++) { const dx = ((i * 89.7 + t * (2 + i % 4) - camX * (0.6 + (i % 3) * 0.2)) % vw + vw) % vw, dy = ((i * 53.3 + t * (1.2 + i % 3) + Math.sin(t * 0.6 + i) * 6) % vh + vh) % vh; g.fillRect(Math.round(dx), Math.round(dy), 1, 1); }
    let n = 0;
    if (Player.flashlight().lit) {                                     // днём фонарь едва заметен
      const F = CONFIG.FLASHLIGHT, x = px + Player.facing * F.HAND[0], y = fy - F.HAND[1], k = F.RANGE / 120;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16; g.translate(x, y); g.scale(Player.facing * k, k); g.drawImage(this.beamTex, -2, -18); g.restore(); n++;
    }
    this.drawnLights = n; this.litLamps = 0;
    g.drawImage(this.vignette, 0, 0);
    this.drawFade(g, vw, vh);
    const s = this.scale;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buf, Math.round(-frac * s), Math.round(-fracY * s), vw * s, vh * s);
  },
  /** Фаза А: кадр наружной сцены (S1, S2): небо и дальние руины станции (параллакс), улица сцены, герой, естественный свет
      поверхности (без цепей станции), личный фонарь, виньетка, затемнение. Свет, NPC и искры станции сюда не попадают. */
  frameOutdoor(alpha, t) {
    if (Scene.world().layered) return this.frameStreet(alpha, t);
    const g = this.g, sw = Scene.world(), camX = Camera.prevX + (Camera.x - Camera.prevX) * alpha, camY = Camera.prevY + (Camera.y - Camera.prevY) * alpha;
    const camI = Math.floor(camX), frac = camX - camI, camYI = Math.floor(camY), fracY = camY - camYI;
    const yo = this.yoff = -camYI, vw = this.viewW + 1, vh = this.viewH;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#2a221c'; g.fillRect(0, 0, vw, vh);                  // ниже слоя улицы — грунт (высокие экраны)
    g.drawImage(WORLD.sky, this.sx(0, CONFIG.PARALLAX.SKY, camX, frac), yo - SURF_H);
    g.drawImage(WORLD.ruins, this.sx(0, CONFIG.PARALLAX.RUINS, camX, frac), yo - SURF_H);
    g.drawImage(sw.surface, -camI, yo - SURF_H);
    g.fillStyle = 'rgba(150,140,120,.5)';
    for (const p of FX.puffs) { g.globalAlpha = p.life * 1.4; g.fillRect(Math.round(p.x - camI), Math.round(p.y) + yo, 2, 1); }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(200,194,180,.8)'; for (const a of FX.ash) g.fillRect(Math.round(a.x - camI), Math.round(a.y) + yo, 1, 1);
    this.occ.length = 0;
    const px = Math.round(Player.prevX + (Player.x - Player.prevX) * alpha) - camI;
    const fy = Math.round(Player.prevY + (Player.y - Player.prevY) * alpha) + yo;
    g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(px - 8, fy, 17, 1); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px - 6, fy + 1, 13, 1);
    const spr = Player.sprite();
    this.archDY = 0; this.playerOcc = null;
    if (spr) { g.globalAlpha = Player.alpha; blit(g, spr, px, fy - 40, Player.facing, 13); g.globalAlpha = 1; }
    const mk = Game.mark;
    if (mk && mk.floor === Player.floor) {
      const mx = Math.round(mk.x) - camI, my = Scene.floor(mk.floor).y + yo, a = mk.fading ? Math.max(0, mk.t / CONFIG.TOUCH.MARK) : 1;
      g.globalAlpha = 0.85 * a; g.fillStyle = '#e8b86a';
      g.fillRect(mx - 3, my, 2, 1); g.fillRect(mx + 2, my, 2, 1); g.fillRect(mx - 1, my - 1, 3, 1); g.fillRect(mx - 1, my + 1, 3, 1);
      g.globalAlpha = 1;
    }
    const gl = this.gl, VP = Visual.preset(), S = VP.surface;            // свет: пыльные сумерки поверхности, режим яркости игрока
    gl.globalCompositeOperation = 'source-over'; gl.globalAlpha = 1;
    gl.fillStyle = `rgb(${S[0]},${S[1]},${S[2]})`; gl.fillRect(0, 0, vw, vh);
    gl.globalCompositeOperation = 'lighter';
    let n = 0;
    if (Player.flashlight().lit) {                                     // личный фонарь — та же текстура, без стен (улица)
      const F = CONFIG.FLASHLIGHT, x = px + Player.facing * F.HAND[0], y = fy - F.HAND[1], k = F.RANGE / 120;
      gl.save(); gl.globalAlpha = F.SPOT_ALPHA; gl.drawImage(this.lampDisc(F.SPOT, [205, 222, 255]), x - F.SPOT, y + 4 - F.SPOT);
      gl.globalAlpha = F.ALPHA; gl.translate(x, y); gl.scale(Player.facing * k, k); gl.drawImage(this.beamTex, -2, -18); gl.restore(); n += 2;
    }
    gl.save(); gl.globalAlpha = 0.5; gl.drawImage(this.lampDisc(50, [160, 150, 128]), px - 50, fy - 23 - 50); gl.restore(); n++;
    this.drawnLights = n; this.litLamps = 0;
    g.globalCompositeOperation = 'multiply'; g.drawImage(this.light, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.vignette, 0, 0);
    this.drawFade(g, vw, vh);
    const s = this.scale;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buf, Math.round(-frac * s), Math.round(-fracY * s), vw * s, vh * s);
  },
  /** 1.0.1: герой в служебной арке. k — глубина (0 — у порога, 1 — скрылся), при входе растёт, при выходе убывает; движение
      задаёт направление арки, у которой стоит герой: «вверх» — поднимается по ступеням на DEPTH px; «вниз» — проходит площадку
      и опускается на SINK px за её кромку (кромка закрывает ноги). Спрайт темнеет и обрезается проёмом, размер не меняется. */
  drawInArch(g, spr, px, fy, s, camI, yo) {
    const C = CONFIG.PASSAGE, k = s.k, e = s.at, a = archRect(e);
    if (!this.archTmp) this.archTmp = makeCanvas(SPRITE_W, SPRITE_H);
    const t = this.archTmp, tg = t.getContext('2d');
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, SPRITE_W, SPRITE_H); tg.drawImage(spr, 0, 0);
    if (k > 0.01) { tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = `rgba(9,11,13,${(C.DARK * k).toFixed(3)})`; tg.fillRect(0, 0, SPRITE_W, SPRITE_H); }
    let lift, bottom;
    if (e.dir === 'down') {                                                     // спуск: по площадке к кромке, затем вниз за кромку
      const L0 = C.LANDING_K, on = Math.min(1, k / L0), dn = Math.max(0, (k - L0) / (1 - L0));
      lift = Math.round(ARCH_LANDING * on - C.SINK * dn);
      bottom = dn > 0 ? a.base - ARCH_LANDING + yo : Math.round(fy + 2 - (fy + 2 - (a.base + yo)) * on);
    } else {                                                                    // подъём: по ступеням вверх, вглубь
      lift = Math.round(C.DEPTH * k); bottom = Math.round(fy + 2 - (fy + 2 - (a.base + yo)) * Math.min(1, k * 3));
    }
    this.archDY = lift;                                                        // для pvDebug.player(): смещение героя в арке (+ вверх, − вниз)
    g.save(); g.beginPath(); g.rect(a.x0 - camI, a.top + yo, a.x1 - a.x0, bottom - (a.top + yo)); g.clip();
    g.drawImage(t, px - 13, fy - 40 - lift);
    g.restore();
  },
  /** Створки гермоворот шлюза: уезжают в стены по мере открытия. */
  drawGate(g, camI, yo) {
    const G = WORLD.gate, x = G.x - camI;
    if (x < -40 || x > this.viewW + 40) return;
    const lw = Math.round(23 * (1 - G.open * 0.9)), top = G.top + yo;
    const leaf = (lx) => {
      R(g, lx, top, lw, 52, '#566064'); R(g, lx, top, lw, 1, '#7a868a');
      for (let y = top + 6; y < top + 44; y += 10) R(g, lx + 2, y, Math.max(0, lw - 4), 1, '#46505a');
      for (let yy = top + 44; yy < top + 50; yy++) for (let xx = lx; xx < lx + lw; xx++) R(g, xx, yy, 1, 1, ((xx + yy) >> 2) % 2 ? '#b8922e' : '#1e1e1e');
    };
    if (lw > 0) { leaf(x - 23); leaf(x + 23 - lw); }
    if (lw > 10) { disc(g, x + 23 - Math.round(lw / 2), top + 22, 5, '#3a4448'); disc(g, x + 23 - Math.round(lw / 2), top + 22, 3, '#6a767a'); }
  },
  drawActors(g, camI, yo) {
    const vw = this.viewW + 1, vh = this.viewH;
    for (const a of ACTORS) {
      const spr = actorSprite(a);
      if (a.kind === 'sleeper') {
        const x = a.bed[0] - camI - spr.bb.x, y = a.bed[1] + yo - (spr.bb.y + spr.bb.h);
        if (x < vw && x + spr.c.width > 0 && y < vh && y + spr.c.height > 0) g.drawImage(spr.c, x, y);
        continue;
      }
      const x = Math.round(a.x) - camI, foot = a.y + yo, top = foot - (a.kind === 'mutant' ? 39 : a.kind === 'pig' ? PIG_H : 40);
      if (x + 20 < 0 || x - 20 > vw || top > vh || foot < 0) continue;
      if (a.kind !== 'sitter' && a.kind !== 'sitguard') { g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(x - 8, foot, 17, 1); }
      const half = a.kind === 'mutant' ? 17 : a.kind === 'pig' ? 10 : 13;
      blit(g, spr, x, top, a.facing, half);
      this.occ.push({ spr, cx: x, top, facing: a.facing, half, alpha: 1 });
    }
  },
  drawLightmap(camX, frac, t, playerSX, playerFY) {
    const gl = this.gl, yo = this.yoff, vw = this.viewW + 1, m = PowerView.main, VP = Visual.preset(), D = VP.blackout;
    const A = VP.ambient.map((v, k) => Math.round(D[k] + (v - D[k]) * m));   // без сети внизу темнее (режим яркости — VP)
    gl.globalCompositeOperation = 'source-over'; gl.globalAlpha = 1;
    gl.fillStyle = `rgb(${A[0]},${A[1]},${A[2]})`; gl.fillRect(0, 0, vw, this.viewH);
    const gy = Math.min(this.viewH, yo + GROUND_Y + 11);                // снаружи — светлее: пыльные сумерки (0.9: от уровня земли)
    if (gy > 0) { const S = VP.surface; gl.fillStyle = `rgb(${S[0]},${S[1]},${S[2]})`; gl.fillRect(0, 0, vw, gy); }
    gl.globalCompositeOperation = 'lighter';
    let n = 0;
    /** Мягкое пятно света; clip — прямоугольник мира, за который свет не выходит (стены, перекрытия). */
    const blob = (x, y, r, c, a, sy = 1, clip = null, p = 1) => {
      if (a <= 0.01 || x + r < 0 || x - r > vw || y + r < 0 || y - r > this.viewH) return;
      let cx0 = 0, cx1 = vw, cy0 = 0, cy1 = this.viewH;
      if (clip) {
        cx0 = clip.x0 > -1e9 ? this.sx(clip.x0, p, camX, frac) : 0; cx1 = clip.x1 < 1e9 ? this.sx(clip.x1, p, camX, frac) : vw;
        cy0 = clip.y0 + yo; cy1 = clip.y1 < 1e9 ? clip.y1 + yo : this.viewH;
        if (cy0 >= this.viewH || cy1 <= 0 || cx0 >= vw || cx1 <= 0) return;   // 1.0: свет за краем кадра (комнаты −2 под платформой) не рисуем
      }
      gl.save();
      if (clip) { gl.beginPath(); gl.rect(cx0, cy0, cx1 - cx0, cy1 - cy0); gl.clip(); }
      gl.translate(x, y); if (sy !== 1) gl.scale(1, sy);
      const rr = Math.round(r);                                          // 0.8.1: готовое пятно того же профиля вместо градиента в каждом кадре
      gl.globalAlpha = Math.min(1, a); gl.drawImage(this.lampDisc(rr, c), -rr, -rr); gl.restore(); n++;
    };
    for (const l of WORLD.lights) {
      const p = l.layer === 'back' ? CONFIG.PARALLAX.BACK : 1;
      const x = this.sx(l.x, p, camX, frac), y = l.y + yo;
      l.i = lightIntensity(l, t) * powerLevel(l.circuit);            // общий уровень цепи для света, свечения и ореола
      blob(x, y, l.r, l.c, l.i * l.power * 0.85, 1, l.clip, p);
      if (l.pool) blob(x, 215 + yo, l.r * 0.75, l.c, l.i * 0.55, 0.22, l.clip, p);  // пятно света на полу
    }
    // Ручные фонари и свечи NPC: свой свет, не зависит от сети; не выходит за стены комнаты и перекрытия.
    const cx = camX + this.viewW / 2;                                    // не больше LAMP_CAP огней: охрана первой, затем ближние к центру
    const lit = ACTORS.filter(a => a.lamp >= 0.01 && a.x > camX - 130 && a.x < camX + this.viewW + 130 && a.y + yo > -20 && a.y - 60 + yo < this.viewH)
      .sort((p, q) => (p.lampType === 'beam' ? 0 : 1000) + Math.abs(p.x - cx) - (q.lampType === 'beam' ? 0 : 1000) - Math.abs(q.x - cx))
      .slice(0, CONFIG.LAMP_CAP);
    this.litLamps = lit.length;
    for (const a of lit) {
      const [wx, wy] = lampPoint(a), x = this.sx(wx, 1, camX, frac), y = wy + yo, clip = actorClip(a);
      const fl = a.lampType === 'candle' ? 0.82 + 0.18 * noise1(t * 7, a.x) : 1;
      const disc = (r, c, al, dy = 0) => {                              // готовое пятно света (кэш текстур, без градиента в кадре)
        const tex = this.lampDisc(r, c), cc = clip;
        gl.save();
        const cx0 = cc.x0 > -1e9 ? this.sx(cc.x0, 1, camX, frac) : 0, cx1 = cc.x1 < 1e9 ? this.sx(cc.x1, 1, camX, frac) : vw;
        gl.beginPath(); gl.rect(cx0, cc.y0 + yo, cx1 - cx0, (cc.y1 < 1e9 ? cc.y1 + yo : this.viewH) - (cc.y0 + yo)); gl.clip();
        gl.globalAlpha = Math.min(1, al); gl.drawImage(tex, x - r, y + dy - r); gl.restore(); n++;
      };
      if (a.lampType === 'headlamp') {                                  // налобный фонарь: короче и уже, от головы
        disc(18, [200, 210, 225], 0.3 * a.lamp, 10);
        gl.save();
        const c = clip, cx0 = c.x0 > -1e9 ? this.sx(c.x0, 1, camX, frac) : 0, cx1 = c.x1 < 1e9 ? this.sx(c.x1, 1, camX, frac) : vw;
        gl.beginPath(); gl.rect(cx0, c.y0 + yo, cx1 - cx0, (c.y1 < 1e9 ? c.y1 + yo : this.viewH) - (c.y0 + yo)); gl.clip();
        const k = 0.7 * this.beamFit(a, clip, 0.7);
        gl.globalAlpha = 0.85 * a.lamp; gl.translate(x, y); gl.scale(a.facing * k, k); gl.drawImage(this.beamTex, -2, -18);
        gl.restore(); n++;
      } else if (a.lampType === 'beam') {
        disc(26, [200, 210, 225], 0.35 * a.lamp, 6);                          // рассеянный свет вокруг охранника
        gl.save();                                                       // конус из готовой текстуры: от руки к тоннелю, чуть вниз
        const c = clip, cx0 = c.x0 > -1e9 ? this.sx(c.x0, 1, camX, frac) : 0, cx1 = c.x1 < 1e9 ? this.sx(c.x1, 1, camX, frac) : vw;
        gl.beginPath(); gl.rect(cx0, c.y0 + yo, cx1 - cx0, (c.y1 < 1e9 ? c.y1 + yo : this.viewH) - (c.y0 + yo)); gl.clip();
        gl.globalAlpha = a.lamp;
        const k = this.beamFit(a, clip, 1);                                // 0.8.2: луч гаснет у стены, а не обрезается ею
        gl.translate(x, y); gl.scale(a.facing * k, k); gl.drawImage(this.beamTex, -2, -18);
        gl.restore(); n++;
      } else disc(a.lampType === 'lantern' ? 46 : 36, [255, 172, 96], (a.lampType === 'lantern' ? 0.8 : 0.7) * a.lamp * fl);
    }
    const cd = WORLD.candle;                                             // свеча на столе медпункта: только когда зажжена
    if (cd && cd.lamp > 0.01) {
      const x = this.sx(cd.x, 1, camX, frac), y = cd.y + yo, c = cd.clip, tex = this.lampDisc(40, [255, 176, 100]);
      gl.save();
      gl.beginPath(); gl.rect(this.sx(c.x0, 1, camX, frac), c.y0 + yo, c.x1 - c.x0, c.y1 - c.y0); gl.clip();
      gl.globalAlpha = 0.8 * cd.lamp * (0.82 + 0.18 * noise1(t * 7, 33)); gl.drawImage(tex, x - 40, y - 40); gl.restore(); n++;
    }
    const fl = Player.flashlight();                                      // 1.1А-UX1: личный фонарь — та же текстура луча, что у охраны
    if (fl.lit) {
      const F = CONFIG.FLASHLIGHT, P = { x: Player.x, y: Player.y, floor: Player.floor, facing: Player.facing, lampType: 'beam', kind: 'walker' };
      const clip = actorClip(P), x = playerSX + Player.facing * F.HAND[0], y = playerFY - F.HAND[1];
      const cx0 = clip.x0 > -1e9 ? this.sx(clip.x0, 1, camX, frac) : 0, cx1 = clip.x1 < 1e9 ? this.sx(clip.x1, 1, camX, frac) : vw;
      const cy0 = clip.y0 > -1e9 ? clip.y0 + yo : 0, cy1 = clip.y1 < 1e9 ? clip.y1 + yo : this.viewH;
      gl.save(); gl.beginPath(); gl.rect(cx0, cy0, cx1 - cx0, cy1 - cy0); gl.clip();              // свет не выходит за стены и перекрытия
      gl.globalAlpha = F.SPOT_ALPHA; gl.drawImage(this.lampDisc(F.SPOT, [205, 222, 255]), x - F.SPOT, y + 4 - F.SPOT);   // пятно у руки
      const k = (F.RANGE / 120) * this.beamFit(P, clip, F.RANGE / 120);                       // у стены луч короче и гаснет
      gl.globalAlpha = F.ALPHA; gl.translate(x, y); gl.scale(Player.facing * k, k); gl.drawImage(this.beamTex, -2, -18);
      gl.restore(); n += 2;
    }
    const pClip = Player.state !== 'walk' ? null : { surface: SURF_CLIP, vestibule: VEST_CLIP, upper: UPPER_CLIP, utility: UTIL_CLIP }[Player.floor] || HALL_CLIP;
    blob(playerSX, playerFY - 23, 50, [160, 150, 128], 0.5 * (0.35 + 0.65 * PowerView.main), 1, pClip);   // в блэкаут слабее                 // мягкая подсветка героя для читаемости
    this.drawnLights = n;
  },
  drawEmissive(camX, frac, t) {
    const g = this.g, gg = this.gg, yo = this.yoff, vw = this.viewW + 1, vh = this.viewH;
    // Прямоугольники персонажей: свечение, которое их не задевает, рисуется прямо в кадр (как раньше, без затрат);
    // задевающее — в буфер, из которого потом вырезаются силуэты.
    const boxes = this.occ.map(o => [o.cx - o.half - 1, o.top, o.cx + o.half + 1, o.top + SPRITE_H]);
    let d = null;
    const route = (x0, y0, x1, y1) => {
      for (const b of boxes) if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) {
        if (!d) d = [x0, y0, x1, y1]; else { d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0); d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1); }
        return gg;
      }
      return g;
    };
    for (const e of WORLD.emissive) {
      const p = e.layer === 'back' ? CONFIG.PARALLAX.BACK : 1, x = this.sx(e.x, p, camX, frac);
      if (x + e.w < 0 || x > vw || e.y + yo > vh || e.y + yo + e.h < 0) continue;
      let k = e.light ? e.light.i : 1;
      if (e.mode === 'blink') k = noise1(t * 1.5, e.seed) > 0.35 ? 1 : 0.25;
      if (e.mode === 'garland') k = 0.55 + 0.45 * Math.sin(t * 2 + e.seed);
      if (e.mode === 'water') k = 0.7;
      if (!e.light) k *= powerLevel(e.circuit);                       // у свечения с источником уровень уже в e.light.i
      const c = e.mode === 'gen' ? (Power.running() ? [110, 230, 120] : [230, 80, 60]) : e.c;
      if (k < 0.12) continue;
      if (e.mode === 'garland' && this.behindColumn(x, e.w, e.y, camX, frac)) continue;   // 0.8.2: лампочка за колонной не видна
      const tg = route(x, e.y + yo, x + e.w, e.y + yo + e.h);
      tg.fillStyle = rgb(c, 0.35 + 0.65 * k);
      tg.fillRect(x, e.y + yo, e.w, e.h);
      if (e.mode === 'screen') { tg.fillStyle = 'rgba(10,30,26,.5)'; for (let y = e.y + yo + 1; y < e.y + yo + e.h; y += 2) tg.fillRect(x, y, e.w, 1); }
    }
    const camI = Math.floor(camX);
    for (const s of FX.sparks) {
      const x = Math.round(s.x - camI), y = Math.round(s.y) + yo, tg = route(x, y, x + 1, y + 1);
      tg.fillStyle = '#d8ecff'; tg.fillRect(x, y, 1, 1);
    }
    // Мягкие ореолы ламп (сложение).
    for (const l of WORLD.lights) {
      if (l.i < 0.2 || l.mode === 'garland' || l === WORLD.fire.light) continue;   // у бочки ореол не рисуем: он лёг бы на героя
      const p = l.layer === 'back' ? CONFIG.PARALLAX.BACK : 1, x = this.sx(l.x, p, camX, frac), y = l.y - 3 + yo, r = l.mode === 'fire' ? 16 : 10;
      if (x + r < 0 || x - r > vw || y + r < 0 || y - r > vh) continue;
      const tg = route(x - r, y - r, x + r, y + r);
      const grd = tg.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${0.32 * l.i * l.power})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      tg.globalCompositeOperation = 'lighter'; tg.fillStyle = grd; tg.fillRect(x - r, y - r, r * 2, r * 2); tg.globalCompositeOperation = 'source-over';
    }
    const cd = WORLD.candle;                                             // пламя свечи медпункта — тоже позади персонажей
    if (cd && cd.lamp > 0.05) {
      const x = cd.x - camI, y = cd.y + yo, tg = route(x - 1, y - 2, x + 2, y + 2);
      tg.globalAlpha = cd.lamp; tg.fillStyle = noise1(t * 9, 7) > 0.5 ? '#ffe2a0' : '#ffb860'; tg.fillRect(x, y - 1, 1, 2);
      tg.fillStyle = 'rgba(255,200,120,.45)'; tg.fillRect(x - 1, y - 1, 3, 2); tg.globalAlpha = 1;
    }
    if (d) this.flushGlow(d, this.occ);                                    // персонажи стоят перед стеной: свечение — за ними
    this.drawFireLayer(camX, frac, t, camI, yo);
    g.fillStyle = '#dcec78';                                             // глаза мутантов — часть самого мутанта
    for (const a of ACTORS) if (a.kind === 'mutant') g.fillRect(Math.round(a.x) - camI + (a.facing >= 0 ? 11 : -11), a.y + yo - 26, 1, 1);
    this.drawHandLights(camI, yo, t);
    this.drawBubbles(camI, yo);
  },
  /** Закрыта ли точка дальней стены колонной зала (колонны — на основном слое, ствол 14 px, капитель 18 px). */
  behindColumn(x, w, y, camX, frac) {
    if (y < 127 || y > 214) return false;
    const i = Math.round((x + camX - COLUMNS[0]) / 160);                // колонны через 160 px: проверяем одну ближайшую
    if (i < 0 || i >= COLUMNS.length) return false;
    const s = this.sx(COLUMNS[i], 1, camX, frac);
    return x + w > s - 9 && x < s + 9;
  },
  /** Вырезать силуэты из использованного прямоугольника буфера, перенести его в кадр и очистить. */
  flushGlow(d, list) {
    const vw = this.viewW + 1, vh = this.viewH;
    const x0 = clamp(Math.floor(d[0]) - 1, 0, vw), y0 = clamp(Math.floor(d[1]) - 1, 0, vh), x1 = clamp(Math.ceil(d[2]) + 1, 0, vw), y1 = clamp(Math.ceil(d[3]) + 1, 0, vh);
    if (x1 <= x0 || y1 <= y0) { this.gg.clearRect(0, 0, vw, vh); return; }
    this.cutOut(this.gg, list.filter(o => o.cx + o.half >= x0 && o.cx - o.half <= x1 && o.top <= y1 && o.top + SPRITE_H >= y0));
    this.g.drawImage(this.glow, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    this.gg.clearRect(x0, y0, x1 - x0, y1 - y0);
  },
  /** Вырезать силуэты (список occ) из буфера свечения: те же кадры, зеркало и прозрачность, что на сцене. */
  cutOut(c, list) {
    c.globalCompositeOperation = 'destination-out';
    for (const o of list) { c.globalAlpha = o.alpha; blit(c, o.spr, o.cx, o.top, o.facing, o.half); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
  /** Светящиеся точки фонарей и свечей в руках NPC. Герой всегда стоит перед NPC, поэтому из этого слоя вырезается только он. */
  drawHandLights(camI, yo, t) {
    const gg = this.gg, vw = this.viewW + 1, po = this.playerOcc;
    const pb = po ? [po.cx - po.half - 1, po.top, po.cx + po.half + 1, po.top + SPRITE_H] : null;
    let d = null;
    for (const a of ACTORS) {
      if (a.lamp < 0.05) continue;
      const [wx, wy] = lampPoint(a), x = wx - camI, y = wy + yo;
      if (x < -4 || x > vw + 4 || y < -4 || y > this.viewH + 4) continue;
      let tg = this.g;                                                  // точка за героем — через буфер с вырезом, иначе сразу в кадр
      if (pb && x - 4 < pb[2] && x + 5 > pb[0] && y - 4 < pb[3] && y + 4 > pb[1]) {
        tg = gg; d = d ? [Math.min(d[0], x - 4), Math.min(d[1], y - 4), Math.max(d[2], x + 5), Math.max(d[3], y + 4)] : [x - 4, y - 4, x + 5, y + 4];
      }
      tg.globalAlpha = a.lamp;
      if (a.lampType === 'headlamp') { tg.fillStyle = '#f2f6ff'; tg.fillRect(x, y, 1, 1); }
      else if (a.lampType === 'beam') { tg.fillStyle = '#3a3e40'; tg.fillRect(x - a.facing * 3, y, 4, 2); tg.fillStyle = '#f2f6ff'; tg.fillRect(x + (a.facing > 0 ? 1 : -1), y, 1, 2); }
      else if (a.lampType === 'lantern') { tg.fillStyle = '#4a3a2a'; tg.fillRect(x - 1, y - 3, 3, 1); tg.fillStyle = '#ffd08a'; tg.fillRect(x - 1, y - 2, 3, 3); }
      else { tg.fillStyle = '#e8e0cc'; tg.fillRect(x, y, 1, 3); tg.fillStyle = noise1(t * 9, a.x) > 0.5 ? '#ffe2a0' : '#ffb860'; tg.fillRect(x, y - 2, 1, 2); }
      tg.globalAlpha = 1;
    }
    if (d) this.flushGlow(d, [po]);                                       // герой стоит перед NPC — вырезается только он
    const fl = Player.flashlight();                                      // 1.1А-UX1: фонарь в руке героя — корпус и линза поверх спрайта
    if (fl.lit && po) {
      const x = po.cx + Player.facing * CONFIG.FLASHLIGHT.HAND[0], y = po.top + 40 - CONFIG.FLASHLIGHT.HAND[1];
      this.g.fillStyle = '#3a3e40'; this.g.fillRect(x - Player.facing * 3, y, 4, 2);
      this.g.fillStyle = '#eef4ff'; this.g.fillRect(x + (Player.facing > 0 ? 1 : -1), y, 1, 2);
    }
  },
  /** Канистры и состояние точек поиска на поверхности (меняются после сбора). */
  drawScavenge(g, camI, yo) {
    const y0 = GROUND_Y + yo;
    if (y0 < -40 || y0 > this.viewH + 40) return;
    const can = (x, foot) => {                                            // красная канистра 7×9
      R(g, x, foot - 9, 7, 9, '#8a2a22'); R(g, x, foot - 9, 7, 1, '#b84a3a'); R(g, x + 1, foot - 7, 1, 5, '#a8463a');
      R(g, x + 4, foot - 11, 2, 2, '#3a2a24'); R(g, x + 1, foot - 10, 3, 1, '#5a2a22');
    };
    const sx = x => x - camI;
    if (Scavenge.available('garage')) {                                     // створка закрыта
      R(g, sx(1186), y0 - 28, 30, 28, '#5a5e5a'); for (let k = 0; k < 7; k++) R(g, sx(1186), y0 - 26 + k * 4, 30, 1, '#464a48');
      R(g, sx(1200), y0 - 14, 3, 2, '#2a2c2c');
    } else { R(g, sx(1186), y0 - 28, 30, 4, '#5a5e5a'); R(g, sx(1190), y0 - 12, 22, 2, '#3a3430'); R(g, sx(1192), y0 - 20, 1, 8, '#3a3430'); }
    if (Scavenge.available('car')) can(sx(1468), y0);                     // канистра у багажника
    else { L(g, sx(1460), y0 - 13, sx(1468), y0 - 22, '#4e3a2e', 2); }   // открытый багажник
    if (Scavenge.available('cache')) can(sx(1933), y0 - 16);
  },
  /** Короткие реплики жителей над головой (поверх темноты, чтобы читались и в блэкаут). */
  drawBubbles(camI, yo) {
    const g = this.g;
    for (const a of ACTORS) {
      if (!a.bubble) continue;
      const w = textWidth(a.bubble.text) + 4, x = Math.round(a.x) - camI - (w >> 1), y = a.y + yo - 52;
      if (x + w < 0 || x > this.viewW + 1 || y < 0 || y > this.viewH) continue;
      if (!a.bubble.img || a.bubble.imgText !== a.bubble.text) {        // 0.8.1: текст пузыря рисуется один раз, дальше — готовой картинкой
        const c = makeCanvas(w, 11), b = c.getContext('2d');
        b.fillStyle = 'rgba(8,10,12,.82)'; b.fillRect(0, 0, w, 11); drawText(b, a.bubble.text, 2, 2, '#f0e4c4');
        a.bubble.img = c; a.bubble.imgText = a.bubble.text;
      }
      g.drawImage(a.bubble.img, x, y);
    }
  },
  /** Пламя и искры бочки — в отдельном маленьком слое, из которого вырезаются силуэты героя и жителей:
      бочка стоит позади персонажей, поэтому огонь никогда не оказывается поверх тела. Свет огня — в карте освещения. */
  drawFireLayer(camX, frac, t, camI, yo) {
    const fx = this.sx(WORLD.fire.x, 1, camX, frac), ox = fx - 32, oy = WORLD.fire.y + yo - 92;
    if (ox > this.viewW + 1 || ox + 64 < 0 || oy > this.viewH || oy + 100 < 0) return;
    const f = this.fireLayer.getContext('2d');
    f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1; f.clearRect(0, 0, 64, 100);
    this.drawFire(f, 32, 92, t);
    for (const e of FX.embers) { f.fillStyle = e.life > 0.6 ? '#ffd27a' : '#e0703a'; f.fillRect(Math.round(e.x - camI) - ox, Math.round(e.y) + yo - oy, 1, 1); }
    f.globalCompositeOperation = 'destination-out';
    for (const o of this.occ) {
      if (o.cx + 20 < ox || o.cx - 20 > ox + 64 || o.top > oy + 100 || o.top + SPRITE_H < oy) continue;
      f.globalAlpha = o.alpha; blit(f, o.spr, o.cx - ox, o.top - oy, o.facing, o.half);
    }
    f.globalAlpha = 1; f.globalCompositeOperation = 'source-over';
    this.g.drawImage(this.fireLayer, ox, oy);
  },
  drawFire(g, x, y, t) {
    for (let i = -5; i <= 5; i++) {
      const h = Math.round((3 + noise1(t * 9 + i * 1.7, 77) * 9) * (1 - Math.abs(i) / 6.5));
      for (let k = 0; k < h; k++) {
        const r = k / Math.max(1, h);
        g.fillStyle = r < 0.35 ? '#ffe6a0' : r < 0.7 ? '#ff9a3c' : '#c8461e';
        g.fillRect(x + i, y - k, 1, 1);
      }
    }
  },
};

