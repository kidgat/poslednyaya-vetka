/* STREET:BEGIN — ШТАБ-022: улица S1 «Дворы» в РЕАЛЬНОМ масштабе (Глеб 40 мировых px = 1,75 м, 1 м ≈ 22,9 px).
   Процедурный пиксель-арт без внешних файлов (офлайн работает как раньше): небо, дальний город, средний план,
   игровая плоскость (пятиэтажки, двор, спортплощадка, машины, деревья), передний план. Каждый слой — свой холст
   и свой параллакс; размер дальних домов задан глубиной (s), а не коэффициентом параллакса. */
const SQ = c => [c[0] & ~3, c[1] & ~3, c[2] & ~3];                       // палитра ступенями по 4 — «пиксельный» цвет без градиентной каши
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const css = c => `rgb(${clamp(c[0], 0, 255) | 0},${clamp(c[1], 0, 255) | 0},${clamp(c[2], 0, 255) | 0})`;
const put = (o, c) => { o[0] = clamp(c[0], 0, 255); o[1] = clamp(c[1], 0, 255); o[2] = clamp(c[2], 0, 255); return true; };
function vnoise(x, y, s) {                                                // плавный 2D-шум 0..1 (значения в узлах — hash)
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), o = s * 7919;
  const a = hash(xi + o, yi), b = hash(xi + 1 + o, yi), c = hash(xi + o, yi + 1), d = hash(xi + 1 + o, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, s + i * 13); n += a; a *= 0.5; f *= 2.03; } return t / n; }
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Толстая пиксельная линия (квадратный штамп) — ветви, арматура, стойки. Без сглаживания. */
function pline(g, x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), wi = Math.max(1, Math.round(w)), h = wi >> 1;
  g.fillStyle = c;
  for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round(x0 + (x1 - x0) * t) - h, Math.round(y0 + (y1 - y0) * t) - h, wi, wi); }
}
const SP = { sky0: [58, 61, 68], sky1: [148, 148, 146], cloudD: [72, 75, 82], cloudL: [170, 168, 164], haze: [138, 140, 140],
  conc: [146, 139, 126], plinth: [100, 97, 91], rust: [118, 74, 48], rustD: [78, 50, 36], dark: [28, 28, 30], frame: [164, 156, 142],
  frameW: [112, 88, 64], trunk: [56, 48, 42], leafA: [118, 104, 58], leafB: [92, 90, 54], leafC: [140, 112, 62], grassA: [112, 100, 62],
  grassB: [86, 84, 54], grassD: [70, 60, 44], asph: [70, 68, 64], dirt: [78, 68, 54] };

/* ---------------- Небо (параллакс 0,06): свинцовые слоистые облака как в G1, светлее к горизонту ---------------- */
function streetSky(w, y0, h) {
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.setTransform(1, 0, 0, 1, 0, -y0);
  paintRegion(g, 0, y0, w, h, (x, y, o) => {
    const t = (y - y0) / h, base = mix(SP.sky0, SP.sky1, Math.pow(t, 1.25));
    const n = fbm(x / 120, (y - y0) / 34, 3, 4) + (0.16 - t * 0.3), cl = smooth(0.4, 0.6, n);
    const lit = fbm(x / 54, (y - y0) / 15 + 0.37, 9, 3) * 0.8 + t * 0.3;
    let col = mix(base, mix(SP.cloudD, SP.cloudL, clamp(lit, 0, 1)), cl * 0.92);
    const q = Math.floor((col[0] / 255 + (dither(x, y) - 0.5) * 0.035) * 46) / 46;   // ступени яркости — пиксельные полосы облаков
    col = shade(col, q / Math.max(0.01, col[0] / 255));
    return put(o, SQ(col));
  });
  return c;
}
/* ---------------- Дальний город (s ≈ 0,25, параллакс 0,22): плотные кварталы, высотки, краны и мачта в дымке ---------------- */
function streetFar(w, y0, h, seed) {
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, -y0);
  const rng = makeRng(seed);
  for (const row of [{ base: -152, haze: 0.74, k: 0.2 }, { base: -149, haze: 0.6, k: 0.26 }]) {
    for (let x = -20; x < w;) {
      const tall = rng() < 0.22, floors = tall ? 12 + ((rng() * 10) | 0) : rng() < 0.5 ? 9 : 5;
      const fh = 64 * row.k, bh = Math.round(floors * fh + 8 * row.k * 3), bw = Math.round((tall ? 50 + rng() * 40 : 90 + rng() * 210) * row.k * 4);
      const col = SQ(mix(mix([100, 102, 106], [124, 114, 100], rng()), SP.haze, row.haze)), top = row.base - bh;
      R(g, x, top, bw, bh, css(col));
      R(g, x, top, 1, bh, css(shade(col, 1.07))); R(g, x + bw - 1, top, 1, bh, css(shade(col, 0.94)));
      const win = SQ(mix(shade(col, 0.8), SP.haze, 0.2));
      for (let fy = top + 3; fy < row.base - 3; fy += Math.max(3, Math.round(fh))) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (hash(wx, fy + seed) > 0.22) R(g, wx, fy, 2, Math.max(1, Math.round(fh * 0.45)), css(win));
      if (rng() < 0.5) { const cw = Math.round(bw * (0.2 + rng() * 0.45)), cx = x + Math.round(rng() * (bw - cw)), d = Math.round(fh * (1 + rng() * 4));   // обрушенный верх — рваный край
        for (let k = 0; k < cw; k++) g.clearRect(cx + k, top - 1, 1, d * (0.4 + 0.6 * Math.abs(Math.sin(k * 0.45 + x))) + 1); }
      if (tall && rng() < 0.5) R(g, x + (bw >> 1), top - 10, 1, 10, css(col));
      x += bw + Math.round(rng() * 16) - 3;
    }
  }
  const lat = (x, base, hgt, col) => {                                                             // решётчатая мачта / брошенный башенный кран
    for (let y = 0; y < hgt; y += 3) { R(g, x - 2 + Math.round(y / hgt * 1.5), base - y, 1, 1, css(col)); R(g, x + 2 - Math.round(y / hgt * 1.5), base - y, 1, 1, css(col)); if (y % 6 === 0) R(g, x - 2, base - y, 5, 1, css(col)); }
  };
  const lc = SQ(mix([86, 86, 88], SP.haze, 0.55));
  for (let x = 140 + Math.round(rng() * 200); x < w; x += 420 + Math.round(rng() * 380)) {
    const hgt = 120 + rng() * 90, base = -150;
    lat(x, base, hgt, lc);
    if (rng() < 0.7) { const jib = 40 + rng() * 50, dir = rng() < 0.5 ? -1 : 1; R(g, Math.min(x, x + dir * jib), base - hgt, Math.round(jib), 2, css(lc)); R(g, x - dir * 14, base - hgt + 2, 6, 4, css(lc));
      for (let y = base - hgt + 2; y < base - hgt + 30 + rng() * 40; y += 2) R(g, x + dir * Math.round(jib * 0.7), y, 1, 1, css(lc)); }   // стрела, противовес и трос
  }
  paintRegion(g, 0, -152, w, y0 + h + 152, (x, y, o) => put(o, SQ(mix(SP.haze, [116, 110, 96], (y + 152) / 22 * 0.3 + (hash(x, y) - 0.5) * 0.04))));
  return c;
}
/* ---------------- Средний план (s ≈ 0,42, параллакс 0,5): соседние дворы — панельные и кирпичные дома, гаражи, ЛЭП, деревья ---------------- */
function midHouse(g, x, base, floors, secs, seed, haze) {
  const s = 0.42, F = CONFIG.STREET, fh = F.PITCH * s, pl = Math.round(F.PLINTH * s), bw = Math.round(secs * F.SECTION * s), bh = Math.round(pl + floors * fh + F.PARAPET * s), top = base - bh;
  const brick = hash(seed, 21) < 0.3, tone = brick ? [128, 84, 66] : mix([132, 128, 120], [116, 116, 114], hash(seed, 3)), col = SQ(mix(tone, SP.haze, haze));
  paintRegion(g, x, top, bw, bh, (px, py, o) => {
    const lx = px - x, hy = base - py, n = fbm(lx / 14, hy / 14, seed, 3);
    let c = shade(col, 0.86 + 0.18 * n);
    if (hy < pl) c = shade(mix(SP.plinth, SP.haze, haze), 0.95);
    if (brick) { if (hy % 2 === 0 && hash(lx, hy) > 0.35) c = shade(c, 1.08); }
    else if (lx % 32 === 0 || (hy - pl) % fh < 1) c = shade(c, 0.9);
    if (hash(lx >> 1, seed) > 0.88 && n < 0.5) c = shade(c, 0.85);
    if (n > 0.66 && hash(lx, hy) > 0.6) c = mix(c, SP.haze, 0.25);                                 // облезлые пятна
    return put(o, SQ(c));
  });
  const wd = SQ(mix([34, 34, 36], SP.haze, haze * 0.75)), wl = SQ(mix([112, 118, 124], SP.haze, haze * 0.7)), wf = css(SQ(mix(shade(SP.frame, 0.8), SP.haze, haze)));
  const balCols = new Set([1, 3].filter(b => hash(b, seed + 7) > 0.35));
  for (let f = 0; f < floors; f++) for (let b = 0; b < secs * 5; b++) {
    const wx = x + Math.round(b * 32 * (F.SECTION * s / 160) + 9), wy = base - pl - f * fh - (F.SILL + F.WIN_H) * s;
    if (wx + 13 > x + bw - 2) continue;
    const r = hash(b + seed * 31, f), cc = r < 0.6 ? wd : r < 0.76 ? wl : r < 0.86 ? SQ(mix([82, 66, 50], SP.haze, haze)) : SQ(mix([20, 18, 18], SP.haze, haze * 0.6));
    R(g, wx, wy, 13, 13, wf); R(g, wx + 1, wy + 1, 11, 11, css(cc)); R(g, wx + 8, wy + 1, 1, 11, wf);
    if (r > 0.94) for (let k = 0; k < 10; k++) R(g, wx - 1 - (k >> 2), wy - k, 15 + (k >> 1), 1, `rgba(20,18,16,${(0.4 * (1 - k / 10)).toFixed(2)})`);   // копоть
    if (f > 0 && balCols.has(b % 5)) { const bc = css(SQ(mix(hash(b + f, seed) > 0.5 ? SP.rust : [96, 100, 96], SP.haze, haze)));
      R(g, wx - 7, wy + 11, 27, 2, css(shade(col, 0.78))); R(g, wx - 7, wy + 5, 27, 6, bc); if (hash(f, b + seed) > 0.6) R(g, wx - 7, wy - 6, 27, 11, css(SQ(mix([90, 82, 70], SP.haze, haze)))); }
  }
  if (hash(seed, 9) > 0.4) {                                                                       // обрушенный угол — видно перекрытия
    const cw = Math.round(bw * (0.12 + hash(seed, 10) * 0.22)), ch = Math.round(fh * (1 + hash(seed, 11) * 3)), cx = hash(seed, 12) > 0.5 ? x : x + bw - cw;
    for (let k = 0; k < cw; k++) { const d = Math.round(ch * (cx === x ? 1 - k / cw : k / cw) + Math.abs(Math.sin(k * 0.7 + seed)) * 5); g.clearRect(cx + k, top - 1, 1, d + 1); }
    const sl = css(SQ(mix(shade(SP.conc, 0.7), SP.haze, haze)));
    for (let y = top + fh; y < top + ch; y += fh) R(g, cx, Math.round(y), cw, 1, sl);
  }
}
function midGarages(g, x, base, n, seed, haze) {             // ряд кирпичных гаражей 3 × 2,5 м (s 0,42 → 29 × 24 px), ржавые ворота
  const col = SQ(mix([116, 92, 76], SP.haze, haze));
  for (let i = 0; i < n; i++) {
    const gx = x + i * 30, open = hash(i, seed) > 0.8;
    R(g, gx, base - 24, 30, 24, css(shade(col, 0.92 + hash(i, seed + 1) * 0.14)));
    R(g, gx, base - 26, 30, 2, css(shade(col, 0.7)));
    R(g, gx + 4, base - 19, 22, 19, css(open ? SQ(mix([24, 22, 22], SP.haze, haze * 0.5)) : SQ(mix(hash(i, seed + 2) > 0.5 ? SP.rust : [84, 96, 88], SP.haze, haze))));
    if (!open) R(g, gx + 14, base - 19, 1, 19, css(SQ(mix(SP.rustD, SP.haze, haze))));
  }
}
function midPylon(g, x, base, seed, haze) {                  // опора ЛЭП и провисающие провода
  const c = css(SQ(mix([70, 70, 72], SP.haze, haze))), h = 150;
  for (let y = 0; y < h; y += 2) { const sp = Math.round(10 * (1 - y / h)) + 2; R(g, x - sp, base - y, 1, 1, c); R(g, x + sp, base - y, 1, 1, c); if (y % 10 === 0) pline(g, x - sp, base - y, x + sp, base - y - 8, 1, c); }
  R(g, x - 16, base - h + 10, 33, 2, c); R(g, x - 11, base - h + 24, 23, 2, c);
}
function streetMid(w, y0, h, seed) {
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, -y0);
  const rng = makeRng(seed), base = -140;
  for (let x = 260; x < w; x += 700 + Math.round(rng() * 600)) midPylon(g, x, base - 6, seed + x, 0.5);
  for (let x = -30; x < w;) {
    const nine = rng() < 0.3, secs = nine ? 1 + ((rng() * 2) | 0) : 2 + ((rng() * 3) | 0);
    midHouse(g, x, base - Math.round(rng() * 3), nine ? 9 : 5, secs, (seed + x) | 0, 0.42 + rng() * 0.1);
    const bw = Math.round(secs * CONFIG.STREET.SECTION * 0.42), gap = 90 + Math.round(rng() * 220);
    if (gap > 180 && rng() < 0.7) midGarages(g, x + bw + 20, base, Math.min(6, (gap - 40) / 30 | 0), (seed + x) | 0, 0.38);
    x += bw + gap;
  }
  paintRegion(g, 0, base - 2, w, y0 + h - base + 2, (x, y, o) => {
    const n = fbm(x / 10, y / 3, seed + 5, 3), t = (y - base) / 18;
    return put(o, SQ(mix(mix(SP.grassB, SP.grassA, n), SP.haze, 0.3 - t * 0.12)));
  });
  for (let x = 20; x < w; x += 34 + Math.round(rng() * 90)) streetTree(g, x, base + 1, 0.45, 70 + rng() * 110, (seed + x) | 0, 0.36);
  g.setTransform(1, 0, 0, 1, 0, 0);                                                                 // дымка: гуще у земли — глубина
  const fog = g.createLinearGradient(0, 0, 0, h); fog.addColorStop(0, 'rgba(138,140,140,0)'); fog.addColorStop(0.55, 'rgba(138,140,140,0.08)'); fog.addColorStop(1, 'rgba(138,140,140,0.32)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = fog; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  return c;
}
/* ---------------- Ближний задний план (s ≈ 0,72, параллакс 0,76): гаражи, трансформаторная будка, грузовик, деревья, заборы ---------------- */
function streetBack(w, y0, h, seed) {
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, -y0);
  const rng = makeRng(seed), s = 0.72, base = Math.round(-159 + 37 * s), hz = 0.2, M = v => Math.round(v * s);
  const tint = col => css(SQ(mix(col, SP.haze, hz)));
  const garages = (x, n) => {                                                                     // кирпичные гаражи 3 × 2,6 м
    const gw = M(69), gh = M(60);
    for (let i = 0; i < n; i++) {
      const gx = x + i * gw, open = hash(i, x) > 0.8, col = shade([122, 92, 74], 0.86 + hash(i, x + 1) * 0.2);
      paintRegion(g, gx, base - gh, gw, gh, (px, py, o) => { const lx = px - gx, ly = py - (base - gh); let cc = col; if (ly % 3 === 2 || (lx + ((ly / 3 | 0) & 1) * 3) % 7 === 0) cc = shade(col, 0.82); return put(o, SQ(mix(cc, SP.haze, hz))); });
      R(g, gx - 1, base - gh - 3, gw + 2, 3, tint([70, 66, 62]));
      const dc = open ? [22, 20, 20] : hash(i, x + 2) > 0.5 ? SP.rust : [86, 100, 92];
      paintRegion(g, gx + M(8), base - M(46), gw - M(16), M(46), (px, py, o) => put(o, SQ(mix(open ? dc : shade(dc, 0.75 + fbm((px - gx) / 4, py / 5, x + i, 2) * 0.5), SP.haze, hz))));
      if (!open) R(g, gx + (gw >> 1), base - M(46), 1, M(46), tint(SP.rustD));
      if (hash(i, x + 3) > 0.6) streetTreeAt(g, gx + M(30), base - gh - 2, 0.3, 30 + hash(i, x) * 30, gx, hz);   // поросль на крыше гаража
    }
    return n * gw;
  };
  const tp = x => {                                                                                // трансформаторная будка 4 × 4,5 м
    const bw = M(92), bh = M(103);
    paintRegion(g, x, base - bh, bw, bh, (px, py, o) => { const lx = px - x, ly = py - (base - bh); let cc = shade([150, 142, 128], 0.84 + fbm(lx / 8, ly / 8, x, 2) * 0.26); if (ly < 4) cc = shade(cc, 0.8); return put(o, SQ(mix(cc, SP.haze, hz))); });
    R(g, x + M(20), base - M(48), M(30), M(48), tint([72, 84, 80])); R(g, x + M(56), base - M(30), M(20), M(10), tint([40, 42, 44]));
    paintRegion(g, x + M(60), base - M(70), M(14), M(12), (px, py, o) => put(o, SQ(mix(Math.abs(px - x - M(67)) < (py - (base - M(70))) * 0.6 ? [190, 170, 60] : [150, 142, 128], SP.haze, hz))));   // жёлтый треугольник-знак
    cable(g, x + bw, x + bw + 220, base - bh + 8, 30, tint([50, 50, 52]));
    return bw;
  };
  const truck = x => {                                                                             // брошенный грузовик (ГАЗ-53-подобный силуэт) 6,4 × 2,2 м
    const tw = M(146), th = M(50), col = hash(x, 5) > 0.5 ? [96, 110, 84] : [120, 84, 60];
    paintRegion(g, x, base - th - M(10), tw, th, (px, py, o) => {
      const lx = px - x, hy = base - M(10) - py, cab = lx < M(40), bed = lx >= M(44);
      if (cab && hy > (lx < M(10) ? M(26) : M(48))) return false;
      if (!cab && !bed) return hy < M(20) ? put(o, SQ(mix([40, 40, 40], SP.haze, hz))) : false;
      if (bed && hy > M(34)) return false;
      let cc = shade(col, 0.75 + fbm(lx / 6, hy / 6, x, 2) * 0.4); if (fbm(lx / 5, hy / 5, x + 1, 2) > 0.6) cc = SP.rust;
      if (cab && lx > M(14) && hy > M(30) && hy < M(45)) cc = [30, 30, 32];
      if (bed && (lx - M(44)) % M(14) === 0) cc = shade(cc, 0.7);
      return put(o, SQ(mix(cc, SP.haze, hz)));
    });
    for (const wx of [M(24), M(110), M(128)]) { disc(g, x + wx, base - M(10), M(10), tint([30, 30, 30])); disc(g, x + wx, base - M(10), M(4), tint(SP.rustD)); }
    return tw;
  };
  for (let x = 30; x < w;) {
    const r = rng(); let used;
    if (r < 0.38) used = garages(x, 3 + ((rng() * 5) | 0));
    else if (r < 0.52) used = tp(x);
    else if (r < 0.64) used = truck(x);
    else { used = M(60 + rng() * 120); for (let k = x; k < x + used; k += 5) { const lean = Math.round((hash(k, seed) - 0.5) * 3); if (hash(seed, k) > 0.15) pline(g, k, base, k + lean, base - M(34) - hash(k, k) * 5, 1, tint([112, 92, 70])); } R(g, x, base - M(26), used, 1, tint([90, 74, 58])); }   // деревянный забор
    x += used + 40 + Math.round(rng() * 160);
  }
  for (let x = 10; x < w; x += 26 + Math.round(rng() * 70)) streetTreeAt(g, x, base, 0.72, 120 + rng() * 170, (seed + x) | 0, hz);
  for (let x = 0; x < w; x += 4) { const r = hash(x, seed + 7); if (r > 0.5) { const bh = Math.round(3 + r * 12); pline(g, x, base, x + Math.round((hash(seed, x) - 0.5) * 3), base - bh, 1, tint([SP.grassA, SP.grassB, SP.leafC][(r * 30 | 0) % 3])); } }
  paintRegion(g, 0, base, w, y0 + h - base, (x, y, o) => put(o, SQ(mix(mix(SP.dirt, SP.grassB, fbm(x / 8, y / 3, seed + 3, 2)), SP.haze, hz * 0.8))));
  return c;
}
const streetTreeAt = (g, x, base, s, height, seed, haze) => streetTree(g, x, base, s, height, seed, haze);
/* ---------------- Деревья: ветвление пиксельными штрихами; редкая сухая листва (поздняя осень) ---------------- */
function streetTree(g, x, base, s, height, seed, haze = 0) {
  const rng = makeRng(seed), bare = rng() < 0.35, birch = rng() < 0.18;
  const bark = SQ(mix(birch ? [184, 184, 178] : SP.trunk, SP.haze, haze)), barkD = SQ(mix(shade(SP.trunk, 0.7), SP.haze, haze));
  const leaves = [SP.leafA, SP.leafB, SP.leafC, SP.grassD].map(c => css(SQ(mix(c, SP.haze, haze))));
  const tips = [];
  const branch = (x0, y0, ang, len, wd, d) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len;
    pline(g, x0, y0, x1, y1, wd, wd > 2.5 ? css(bark) : css(SQ(mix(SP.trunk, SP.haze, haze))));
    if (birch && wd > 2.5) for (let k = 0; k < len; k += 5) if (hash(k, seed) > 0.5) R(g, Math.round(x0 + (x1 - x0) * k / len) - 1, Math.round(y0 + (y1 - y0) * k / len), 2, 1, css(barkD));
    if (d <= 0 || len < 4 * s) { tips.push([x1, y1]); return; }
    const n = d > 3 ? 2 : 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(x1, y1, ang + (rng() - 0.5) * 1.3 + (i - (n - 1) / 2) * 0.5, len * (0.62 + rng() * 0.18), Math.max(1, wd * 0.62), d - 1);
  };
  const trunkH = height * (0.32 + rng() * 0.12), wd = Math.max(2, Math.round(height / (birch ? 44 : 32)));
  pline(g, x, base, x + (rng() - 0.5) * 6, base - trunkH, wd, css(bark));
  for (let k = 0; k < 4; k++) R(g, x - wd + k * 2, base - 1, 2, 1, css(barkD));                    // корни
  branch(x, base - trunkH, Math.PI / 2 + (rng() - 0.5) * 0.3, height * 0.3, wd * 0.8, s >= 0.9 ? 6 : s >= 0.6 ? 5 : 4);   // дальние деревья — меньше мелких веток (их всё равно не различить)
  if (!bare) for (const [tx, ty] of tips) {                                                         // редкие кластеры листьев
    const r = 4 + rng() * 9 * s;
    for (let k = 0, nL = r * r * (s >= 0.9 ? 0.9 : 0.55); k < nL; k++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * r; g.fillStyle = leaves[(rng() * 4) | 0]; g.fillRect(Math.round(tx + Math.cos(a) * d), Math.round(ty - Math.sin(a) * d * 0.8), 1 + (rng() < 0.3 ? 1 : 0), 1); }
  }
}
/* ---------------- Пятиэтажка (игровая плоскость, s = 1): хрущёвка реальных размеров ---------------- */
function drawWindow(g, x, yb, w, h, kind, seed, opt = {}) {  // yb — мировой y нижней кромки проёма
  const yt = yb - h, wood = kind !== 'pvc' && hash(seed, 1) > 0.5, fr = kind === 'pvc' ? SQ(shade([196, 194, 186], 0.9 + hash(seed, 2) * 0.08)) : SQ(wood ? shade(SP.frameW, 0.9 + hash(seed, 2) * 0.2) : shade(SP.frame, 0.86 + hash(seed, 2) * 0.16));
  R(g, x - 1, yt - 1, w + 2, h + 2, css(shade(SP.conc, 0.6)));                                     // откос
  R(g, x - 1, yt - 3, w + 2, 2, css(shade(SP.conc, 0.82)));                                        // перемычка
  if (kind === 'empty') { R(g, x, yt, w, h, css(SP.dark)); R(g, x, yt, w, 3, css([18, 18, 20])); }
  else {
    R(g, x, yt, w, h, css(fr));
    const gx = x + 2, gy = yt + 2, gw = w - 4, gh = h - 4, mid = x + Math.round(w * 0.62);
    if (kind === 'board') {
      R(g, gx, gy, gw, gh, css([40, 36, 32]));
      for (let k = 0; k < gh; k += 4) { const c = SQ(shade([128, 100, 70], 0.75 + hash(k, seed) * 0.35)), off = Math.round((hash(k, seed + 1) - 0.5) * 3); R(g, gx - 1, gy + k, gw + 2, 3, css(c)); R(g, gx - 1 + off, gy + k + 2, gw + 2, 1, css(shade(c, 0.7))); R(g, gx + 2, gy + k + 1, 1, 1, css([58, 54, 50])); R(g, gx + gw - 3, gy + k + 1, 1, 1, css([58, 54, 50])); }
      if (hash(seed, 6) > 0.5) R(g, gx + 2, gy + gh - 8, gw - 4, 3, css([40, 36, 32]));             // выломанная доска
    } else {
      paintRegion(g, gx, gy, gw, gh, (px, py, o) => {
        const lx = px - gx, ly = py - gy;
        if (kind === 'sky' || kind === 'pvc') return put(o, SQ(mix([132, 138, 144], [70, 76, 84], ly / gh + (((lx + ly) % 11) < 2 ? -0.28 : 0) + (kind === 'sky' && fbm(lx / 4, ly / 4, seed, 2) > 0.62 ? 0.3 : 0))));   // отражение неба, грязь
        if (kind === 'curtain' && lx < gw * (0.35 + hash(seed, 5) * 0.3) && hash(lx >> 1, seed) > 0.2) return put(o, SQ(shade([[128, 98, 86], [104, 110, 96], [140, 128, 100]][(hash(seed, 6) * 3) | 0], 0.55 + (lx % 3) * 0.12)));
        let c = [24 + hash(lx, ly) * 10, 24 + hash(ly, lx) * 4, 26];
        if (ly < 3) c = [16, 16, 18];
        if (kind === 'broken' && (lx + ly * 0.6 < 4 || (gw - lx) + (gh - ly) * 0.8 < 5 + hash(seed, 4) * 4 || (lx > gw * 0.55 && ly < 4 && hash(lx, seed) > 0.4))) c = [100, 106, 112];
        return put(o, c);
      });
      R(g, mid, yt, 2, h, css(fr)); R(g, x, yt + Math.round(h * 0.34), mid - x, 1, css(fr));
      if (kind === 'burnt') { for (let k = 0; k < 40; k++) { g.globalAlpha = 0.55 * (1 - k / 40); R(g, x - 3 - (k >> 2), yt - k, w + 6 + (k >> 1), 1, css([28, 26, 24])); } g.globalAlpha = 1; R(g, x, yt, w, h, css([20, 18, 16])); R(g, x + 3, yt + h - 6, w - 6, 2, css([60, 40, 30])); }
    }
  }
  R(g, x - 2, yb, w + 4, 2, css(shade(SP.frame, 0.9))); R(g, x - 2, yb + 2, w + 4, 1, css([84, 80, 74]));   // отлив и тень
  if (opt.bars) {                                                                                  // решётка на окне 1-го этажа — «солнышко»
    const bc = css(SQ(shade(SP.rustD, 1.1)));
    for (let k = 1; k < w; k += 4) R(g, x + k, yt, 1, h, bc);
    R(g, x, yt + 1, w, 1, bc); R(g, x, yt + (h >> 1), w, 1, bc); R(g, x, yb - 2, w, 1, bc);
    for (let a = 0; a < 7; a++) { const ang = Math.PI * (a / 6); pline(g, x + w / 2, yb - 2, x + w / 2 + Math.cos(ang) * (w / 2 - 2), yb - 2 - Math.sin(ang) * (h / 3), 1, bc); }
  }
  const r = hash(seed, 7);
  if (r > 0.45) for (let k = 0; k < 7 + hash(seed, 8) * 22; k++) { g.globalAlpha = 0.4 * (1 - k / 29); R(g, x + 2 + Math.round(hash(seed, 9) * (w - 4)), yb + 3 + k, 1, 1, css(SP.rustD)); } g.globalAlpha = 1;
  if (opt.extras !== false) {
    const e = hash(seed, 11);
    if (e > 0.93 && kind !== 'board') { R(g, x + w + 3, yt + 6, 11, 9, css([150, 150, 146])); R(g, x + w + 4, yt + 7, 9, 7, css([110, 112, 110])); for (let k = 0; k < 4; k++) R(g, x + w + 5, yt + 8 + k * 2, 7, 1, css([80, 80, 80])); R(g, x + w + 8, yt + 15, 1, 8, css([60, 60, 60])); }   // кондиционер
    else if (e > 0.86 && kind !== 'board') { R(g, x + 2, yb - 4, w - 4, 4, css([104, 70, 52])); for (let k = 0; k < w - 6; k += 2) R(g, x + 3 + k, yb - 6 - ((hash(k, seed) * 4) | 0), 1, 3, css(hash(k, seed + 1) > 0.5 ? SP.leafB : SP.grassD)); }   // ящик с засохшими цветами
    else if (e > 0.8) { const dx = x + (hash(seed, 12) > 0.5 ? -9 : w + 2); disc(g, dx + 3, yt + 6, 3, css([160, 160, 156])); R(g, dx + 3, yt + 6, 4, 1, css([90, 90, 90])); }   // спутниковая тарелка
  }
}
function drawBalcony(g, x, floorY, seed) {                   // floorY — мировой y пола этажа; балкон 58 px (2,5 м)
  const F = CONFIG.STREET, kind = ['bars', 'sheet', 'glazed', 'bars', 'sheet', 'broken', 'brick', 'glazed', 'overgrown'][(hash(seed, 1) * 9) | 0];
  drawWindow(g, x + 30, floorY - F.SILL, 24, F.WIN_H, hash(seed, 3) > 0.5 ? 'broken' : 'empty', seed + 3, { extras: false });
  R(g, x + 8, floorY - 47, 15, 47, css(SP.frame)); R(g, x + 10, floorY - 45, 11, 43, css(SP.dark));   // балконная дверь
  if (kind === 'broken') {                                                                         // обрушенный балкон: обломок плиты и арматура
    R(g, x, floorY, 26, 4, css(SQ(shade(SP.conc, 0.85)))); R(g, x, floorY + 4, 26, 2, css([70, 66, 60]));
    for (let k = 0; k < 5; k++) pline(g, x + 26 + k * 6, floorY + 1, x + 30 + k * 6 + (hash(k, seed) - 0.5) * 6, floorY + 8 + hash(seed, k) * 10, 1, css(SP.rustD));
    for (let k = 0; k < 30; k++) { g.globalAlpha = 0.35 * (1 - k / 30); R(g, x + 26, floorY + 6 + k, 30, 1, css([60, 56, 50])); } g.globalAlpha = 1;
    return;
  }
  R(g, x, floorY, 58, 4, css(SQ(shade(SP.conc, 0.9)))); R(g, x, floorY, 58, 1, css(SQ(shade(SP.conc, 1.1)))); R(g, x, floorY + 4, 58, 3, css([70, 66, 60]));
  for (let k = 0; k < 20; k++) { g.globalAlpha = 0.28 * (1 - k / 20); R(g, x + 2 + ((hash(k, seed) * 54) | 0), floorY + 7 + k, 1, 1, css(SP.rust)); } g.globalAlpha = 1;   // ржавые потёки под плитой
  const top = floorY - 23;
  if (kind === 'bars') { R(g, x, top, 58, 2, css(SP.rust)); for (let k = 1; k < 58; k += 3) if (hash(k, seed + 2) > 0.08) R(g, x + k, top + 2, 1, 21, css(SQ(shade(SP.rustD, 0.9 + hash(k, seed) * 0.3)))); }
  else if (kind === 'sheet') { const c0 = hash(seed, 4) > 0.5 ? SP.rust : [104, 112, 106]; paintRegion(g, x, top, 58, 23, (px, py, o) => { const lx = px - x; return put(o, SQ(shade(c0, (lx % 4 < 2 ? 0.92 : 1.05) * (0.78 + fbm(lx / 6, (py - top) / 6, seed, 2) * 0.4)))); }); R(g, x, top, 58, 1, css(SP.rustD)); }
  else if (kind === 'brick') { paintRegion(g, x, top, 58, 23, (px, py, o) => { const lx = px - x, ly = py - top, row = ly >> 2, m = ly % 4 === 3 || (lx + (row & 1) * 4) % 8 === 0; return put(o, SQ(m ? [150, 140, 126] : shade([132, 72, 56], 0.85 + hash(lx >> 3, row) * 0.25))); }); }
  else if (kind === 'overgrown') { R(g, x, top, 58, 2, css(SP.rust)); for (let k = 1; k < 58; k += 3) R(g, x + k, top + 2, 1, 21, css(SP.rustD)); streetIvy(g, x + 4, floorY + 2, 30, 50, seed + 5, true); }
  else {                                                                                           // самодельное остекление: рамы разной высоты, часть стёкол выбита
    R(g, x, top - 22, 58, 45, css(SQ(shade(SP.frameW, 0.85)))); R(g, x, top + 8, 58, 15, css(SQ(shade(hash(seed, 6) > 0.5 ? [100, 96, 88] : [86, 98, 104], 0.9))));
    for (let k = 0; k < 4; k++) { const px = x + 2 + k * 14, r = hash(k, seed); R(g, px, top - 20, 12, 26, css(r > 0.55 ? [64, 70, 76] : r > 0.3 ? SP.dark : [92, 98, 104])); if (r > 0.3 && r < 0.55) R(g, px, top - 20, 4, 4, css([92, 98, 104])); }
  }
  const junk = hash(seed, 9);                                                                      // быт на балконе
  if (junk > 0.7) { cable(g, x + 2, x + 56, top - 14, 3, css([60, 60, 58])); for (let k = 0; k < 4; k++) { const cx = x + 8 + k * 12 + ((hash(k, seed + 3) * 4) | 0); R(g, cx, top - 12, 5, 6 + ((hash(k, seed) * 4) | 0), css(SQ([[150, 140, 120], [110, 120, 130], [140, 90, 80], [120, 120, 100]][k]))); } }
  else if (junk > 0.5 && kind !== 'glazed') { R(g, x + 40, top - 8, 12, 8, css([110, 88, 62])); R(g, x + 46, top - 14, 8, 6, css([90, 76, 60])); }
  else if (junk > 0.4 && kind !== 'glazed') { pline(g, x + 50, floorY - 2, x + 54, top - 14, 1, css([120, 110, 90])); pline(g, x + 52, floorY - 2, x + 56, top - 14, 1, css([140, 60, 50])); }   // старые лыжи
}
/** Плющ / дикий виноград: стебли ползут вверх с ответвлениями, листва пятнами (поздняя осень: оливковый, бурый, винный). */
function streetIvy(g, x, base, w, h, seed, hang = false) {
  const rng = makeRng(seed), leaves = [[86, 92, 50], [70, 74, 44], [118, 76, 50], [104, 56, 50], [126, 110, 60]].map(c => css(SQ(c))), stem = css([70, 56, 44]);
  for (let s = 0; s < Math.max(2, w / 9); s++) {
    let px = x + rng() * w, py = base;
    for (let k = 0; k < h; k++) {
      px += (rng() - 0.5) * 1.6; py += hang ? 1 : -1;
      g.fillStyle = stem; g.fillRect(Math.round(px), Math.round(py), 1, 1);
      if (rng() < 0.55) { g.fillStyle = leaves[(rng() * 5) | 0]; const lx = Math.round(px + (rng() - 0.5) * 6), ly = Math.round(py + (rng() - 0.5) * 4); g.fillRect(lx, ly, 2, 2); if (rng() < 0.5) g.fillRect(lx + 1, ly - 1, 1, 1); }
      if (rng() < 0.03) { const bx = px, by = py, dir = rng() < 0.5 ? -1 : 1; for (let j = 0; j < 12; j++) { g.fillStyle = leaves[(rng() * 5) | 0]; g.fillRect(Math.round(bx + dir * j), Math.round(by - j * 0.4 + (rng() - 0.5) * 2), 2, 1); } }
      if (rng() < 0.012) break;
    }
  }
}
function drawGraffiti(g, x, y, w, seed) {                    // выцветшие надписи-каракули (без читаемого текста)
  const rng = makeRng(seed), col = css(SQ([[118, 74, 70], [70, 86, 112], [84, 84, 84], [104, 100, 60]][(rng() * 4) | 0]));
  let px = x, py = y + rng() * 6;
  for (let k = 0; k < w * 1.5; k++) { const nx = px + 0.7 + rng() * 0.6, ny = clamp(py + (rng() - 0.5) * 4, y, y + 9); pline(g, px, py, nx, ny, 1, col); px = nx; py = ny; if (px > x + w) break; }
}
function drawPanelHouse(g, x0, secs, seed, damage) {
  const F = CONFIG.STREET, GY = GROUND_Y, H = F.PLINTH + F.FLOORS * F.PITCH + F.PARAPET, w = secs * F.SECTION, top = GY - H;
  const tone = mix(SP.conc, [150, 146, 136], hash(seed, 1));
  paintRegion(g, x0, top, w, H, (px, py, o) => {
    const lx = px - x0, hy = GY - py, fl = Math.floor((hy - F.PLINTH) / F.PITCH), panel = Math.floor(lx / 76) + fl * 1000, pr = (hy - F.PLINTH) % F.PITCH, pc = lx % 76;
    let c = shade(tone, 0.94 + hash(panel, seed) * 0.08);
    if (hy < F.PLINTH) {                                                                           // цоколь: облицовочная плитка рядами, сколы
      c = shade(SP.plinth, 0.9 + fbm(lx / 5, hy / 3, seed + 2, 2) * 0.2);
      if (hy % 6 === 0 || (lx + (Math.floor(hy / 6) & 1) * 6) % 12 === 0) c = shade(c, 0.82);
      if (fbm(lx / 8, hy / 5, seed + 3, 2) > 0.7) c = shade([84, 80, 74], 0.9);
    }
    c = shade(c, 0.8 + 0.22 * fbm(lx / 40, hy / 30, seed, 3));
    const st = vnoise(lx / 2.3, 0, seed + 6);
    if (st > 0.8 && fbm(lx / 3, hy / 32, seed + 7, 2) > 0.5) c = shade(c, 0.9 - (st - 0.8) * 0.8);
    if (hy < F.PLINTH + 34) c = mix(c, [86, 92, 74], (1 - hy / (F.PLINTH + 34)) * 0.24);
    if (hy > F.PLINTH) {                                                                           // панели: швы, светлая верхняя и левая кромка, тёмная нижняя
      if (pc === 0 || pc === 75 || pr === 0) c = shade(c, hash(lx, hy) > 0.85 ? 0.52 : 0.78);
      else if (pr === 1 || pc === 1) c = shade(c, 1.06);
      else if (pr === F.PITCH - 1) c = shade(c, 0.9);
    }
    const zone = fbm(lx / 90, hy / 70, seed + 12, 2);                                              // повреждения — гнёздами; шум считается только в «больных» зонах
    if (zone > 0.55) {
      const ch = fbm(lx / 6, hy / 6, seed + 9, 3);
      if (ch > 0.79) c = shade(tone, 1.08); else if (ch > 0.77) c = shade(c, 0.72);
      if (zone > 0.6 && Math.abs(fbm(lx / 18, hy / 18, seed + 11, 3) - 0.5) < 0.006) c = shade(c, 0.6);
      if (zone > 0.7 && fbm(lx / 3, hy / 3, seed + 14, 2) > 0.66) { c = [84, 80, 74]; if ((lx + hy) % 5 === 0) c = SP.rustD; }   // осыпавшийся бетон с арматурной сеткой
    }
    if (hy > H - F.PARAPET) c = shade(c, hy === H - 1 ? 1.15 : 0.9);
    if (lx < 3 || lx > w - 4) c = shade(c, 0.82);
    return put(o, SQ(shade(c, 1 + (hash(lx * 3, hy * 7) - 0.5) * 0.05)));
  });
  for (let s = 0; s < secs; s++) {
    const sx = x0 + s * F.SECTION, bays = [sx, sx + 76, sx + 200, sx + 276];
    for (let b = 0; b < 4; b++) {
      const balc = hash(s * 7 + b, seed + 40) > 0.45 && (b === 0 || b === 3), dbl = !balc && hash(s * 5 + b, seed + 41) > 0.72;
      for (let f = 0; f < F.FLOORS; f++) {
        const fy = GY - F.PLINTH - f * F.PITCH, id = seed * 131 + s * 37 + b * 11 + f;
        if (balc && f > 0) { drawBalcony(g, bays[b] + 9, fy, id); continue; }
        const r = hash(id, 5);
        let kind = r < 0.34 ? 'broken' : r < 0.54 ? 'empty' : r < 0.66 ? 'sky' : r < 0.76 ? 'board' : r < 0.84 ? 'curtain' : r < 0.92 ? 'burnt' : 'pvc';
        if (f === 0 && r > 0.72) kind = 'board';
        const opt = { bars: f === 0 && hash(id, 6) > 0.45 };
        if (dbl) { drawWindow(g, bays[b] + 8, fy - F.SILL, 28, F.WIN_H, kind, id, opt); drawWindow(g, bays[b] + 40, fy - F.SILL, 28, F.WIN_H, hash(id, 7) > 0.5 ? kind : 'broken', id + 1, opt); }   // сдвоенное окно комнаты
        else drawWindow(g, bays[b] + 23, fy - F.SILL, F.WIN_W, F.WIN_H, kind, id, opt);
      }
      if (hash(s, b + seed) > 0.25) { const vx = bays[b] + 30 + ((hash(b, s) - 0.5) * 20 | 0); R(g, vx, GY - 15, 12, 7, css([28, 28, 28])); for (let k = 0; k < 12; k += 3) R(g, vx + 1 + k, GY - 15, 1, 7, css(SP.rustD)); }
      if (hash(s * 3 + b, seed + 50) > 0.55) drawGraffiti(g, bays[b] + 4 + hash(b, seed) * 30, GY - 22, 24 + hash(s, b) * 20, seed + s * 10 + b);
    }
    const dx = sx + 152 + 13, dt = GY - F.PLINTH - F.DOOR_H;                                         // подъезд
    R(g, dx - 4, dt - 4, F.DOOR_W + 8, F.DOOR_H + 4, css([86, 82, 76]));
    const steel = hash(s, seed + 1) > 0.45;
    paintRegion(g, dx, dt, F.DOOR_W, F.DOOR_H, (px, py, o) => { const lx = px - dx, ly = py - dt; const open = hash(s, seed) > 0.55 && lx > 12;
      if (open) return put(o, ly > F.DOOR_H - 10 ? [34, 32, 30] : [18, 18, 20]);
      let c = SQ(shade(steel ? [74, 64, 58] : [70, 84, 76], 0.72 + fbm(lx / 4, ly / 6, seed + s, 2) * 0.5));
      if (steel && (ly === 16 || ly === 32 || lx === 2 || lx === F.DOOR_W - 3)) c = shade(c, 1.2);
      if (fbm(lx / 3, ly / 3, seed + s + 3, 2) > 0.68) c = mix(c, SP.rust, 0.7);
      return put(o, c); });
    R(g, dx + 3, dt + 22, 2, 3, css([150, 140, 110]));
    R(g, dx + F.DOOR_W + 6, dt + 14, 4, 6, css([60, 62, 66])); R(g, dx + F.DOOR_W + 7, dt + 15, 2, 2, css([120, 40, 30]));   // домофон
    R(g, dx - 14, dt - 10, F.DOOR_W + 28, 5, css(SQ(shade(SP.conc, 0.95)))); R(g, dx - 14, dt - 10, F.DOOR_W + 28, 1, css(SQ(shade(SP.conc, 1.12)))); R(g, dx - 14, dt - 5, F.DOOR_W + 28, 3, css([60, 56, 52]));   // козырёк
    for (let k = 0; k < F.DOOR_W + 24; k += 3) if (hash(k, seed + s) > 0.5) R(g, dx - 12 + k, dt - 12 - ((hash(seed, k) * 4) | 0), 1, 2 + ((hash(k, k) * 3) | 0), css(SQ(hash(k, s) > 0.5 ? SP.grassA : SP.leafB)));   // трава на козырьке
    R(g, dx - 2, dt - 20, 26, 7, css([168, 160, 144])); R(g, dx + 6, dt - 19, 10, 5, css([60, 70, 96]));   // табличка с номером подъезда
    R(g, dx + 8, dt - 4, 6, 3, css([90, 88, 80])); R(g, dx + 9, dt - 1, 4, 1, css([200, 190, 150]));       // лампа над дверью (разбита)
    R(g, dx - 20, dt + 8, 12, 14, css([120, 112, 96])); for (let k = 0; k < 5; k++) R(g, dx - 19 + ((hash(k, s) * 8) | 0), dt + 9 + ((hash(s, k) * 10) | 0), 3, 3, css([196, 192, 180]));   // доска объявлений с обрывками
    for (let k = 0; k < 4; k++) {
      const sw = 40 + (k + 1) * 8, sy = GY - F.PLINTH + k * 6;
      paintRegion(g, dx + 11 - sw / 2, sy, sw, 6, (px, py, o) => put(o, SQ(shade(SP.conc, (py - sy) === 0 ? 1.12 : 0.9 - (hash(px, py) > 0.88 ? 0.22 : 0)))));
    }
    R(g, dx + 11 + 22, GY - 9, 10, 9, css(SQ(shade(SP.conc, 0.7))));                               // отколотая ступень
    pline(g, dx - 18, GY - 1, dx - 10, GY - F.PLINTH - 10, 1, css(SP.rust)); pline(g, dx - 18, GY - 12, dx - 18, GY - 1, 1, css(SP.rust));
    for (let k = 1; k <= 4; k++) {
      const wy = GY - F.PLINTH - k * F.PITCH - 8;
      if (wy - 22 < top + F.PARAPET) continue;
      drawWindow(g, sx + 166, wy, 20, 22, hash(k, s + seed) > 0.4 ? 'empty' : 'broken', seed + s * 9 + k, { extras: false });
    }
  }
  for (const px of [x0 + 4, x0 + w - 8]) {
    R(g, px, top + 6, 3, H - 10, css(SQ(shade(SP.rustD, 1.05))));
    for (let y = top + 10; y < GY; y += 22) R(g, px - 1, y, 5, 2, css(SP.rust));
    if (hash(px, seed) > 0.4) { const gy0 = top + 60 + hash(seed, px) * 120; R(g, px, gy0, 3, 26, css(SQ(shade(tone, 0.8)))); R(g, px - 2, gy0 + 26, 6, 3, css(SP.rust)); }   // кусок трубы оторван
  }
  for (let x = x0 + 10; x < x0 + w - 10; x += 6 + ((hash(x, seed) * 30) | 0)) {
    const r = hash(x, seed + 2);
    if (r > 0.85) { pline(g, x, top, x, top - 18 - r * 10, 1, css([90, 90, 92])); R(g, x - 4, top - 14, 9, 1, css([90, 90, 92])); }
    else if (r > 0.6) streetTree(g, x, top, 0.25, 18 + r * 26, x + seed, 0);
    else R(g, x, top - 2, 3 + ((r * 6) | 0), 2, css(shade(SP.conc, 0.8)));
  }
  for (let k = 0; k < secs * 2; k++) {                                                             // плющ: с торцов и местами по фасаду от земли
    const ix = k === 0 ? x0 + 2 : k === 1 ? x0 + w - 34 : x0 + 40 + hash(k, seed + 60) * (w - 80);
    if (k > 1 && hash(k, seed + 61) < 0.5) continue;
    streetIvy(g, ix, GY - 1, 30 + hash(k, seed) * 30, 60 + hash(seed, k) * 150, seed + 70 + k);
  }
  if (damage) {
    const cw = 120, cx = damage === 'left' ? x0 : x0 + w - cw, ch = F.PITCH * 1.6 + F.PARAPET;
    g.clearRect(cx, top - 30, cw, 30);
    paintRegion(g, cx, top, cw, ch, (px, py, o) => {
      const lx = damage === 'left' ? px - cx : cx + cw - px, edge = ch * (1 - lx / cw) + Math.sin(lx * 0.5) * 4 + (hash(lx, 1) - 0.5) * 6, d = py - top;
      if (d > edge) return false;
      const slab = ((GY - py - F.PLINTH) % F.PITCH + F.PITCH) % F.PITCH < 4;
      if (lx < 10 && d < edge - 6) { o[3] = 0; return true; }
      return put(o, slab ? SQ(shade(SP.conc, 0.8)) : [34 + hash(px, py) * 10, 32, 30]);
    });
    for (let k = 0; k < 9; k++) { const rx = cx + 12 + k * 12, ry = top + ch * (1 - (damage === 'left' ? (rx - cx) : (cx + cw - rx)) / cw); pline(g, rx, ry, rx + (hash(k, 2) - 0.5) * 10, ry + 8 + hash(k, 3) * 12, 1, css(SP.rustD)); }
    streetRubble(g, cx - (damage === 'left' ? 40 : -20), cx + 100, seed + 90);
  }
}
/* ---------------- Предметы двора (s = 1) ---------------- */
function streetCar(g, x, seed, opt = {}) {                    // легковушка ≈ 4,1 × 1,4 м → 94 × 32 px; ржавчина, спущенные колёса
  const GY = GROUND_Y, body = [[96, 108, 120], [150, 146, 132], [124, 62, 50], [96, 104, 72], [182, 176, 160]][(hash(seed, 1) * 5) | 0];
  const prof = lx => (lx < 6 ? 12 + lx : lx < 26 ? 18 : lx < 34 ? 18 + (lx - 26) * 1.6 : lx < 66 ? 31 : lx < 76 ? 31 - (lx - 66) * 1.3 : lx < 90 ? 18 : 18 - (lx - 90) * 2);
  const lift = opt.bricks ? 9 : opt.flat ? 3 : 6, by = GY - lift;
  paintRegion(g, x, GY - 32 - lift, 94, 32, (px, py, o) => {
    const lx = px - x, hy = by - py, ph = prof(lx);
    if (hy < 0 || hy > ph) return false;
    const win = lx > 28 && lx < 72 && hy > 20 && hy < ph - 2 && Math.abs(lx - 50) > 1;
    if (win) return put(o, opt.burnt || hash(seed, 3) > 0.4 ? [24, 24, 26] : [84, 92, 100]);
    let c = opt.burnt ? [64, 52, 44] : body;
    const rust = fbm(lx / 6, hy / 4, seed, 3);
    if (rust > 0.55 || hy < 4 && rust > 0.4) c = mix(SP.rust, SP.rustD, fbm(lx / 3, hy / 3, seed + 1, 2));
    if (hy === Math.round(ph) || hy === 19) c = shade(c, 1.15);
    if (hy < 8) c = shade(c, 0.8);
    return put(o, SQ(shade(c, 0.78 + fbm(lx / 20, hy / 10, seed + 4, 2) * 0.35)));
  });
  for (const wx of [x + 18, x + 76]) {
    if (opt.bricks) { R(g, wx - 6, GY - 9, 12, 9, css([120, 64, 50])); R(g, wx - 6, GY - 5, 12, 1, css([80, 44, 36])); continue; }
    disc(g, wx, GY - 8 + (opt.flat ? 2 : 0), 8, css([30, 30, 30])); R(g, wx - 8, GY - 2, 17, 2, css([24, 24, 24]));
    disc(g, wx, GY - 8 + (opt.flat ? 2 : 0), 4, css(SP.rustD)); R(g, wx - 1, GY - 9, 2, 2, css(SP.rust));
  }
  R(g, x + 2, GY - lift - 15, 4, 3, css([180, 170, 130])); R(g, x + 89, GY - lift - 15, 4, 3, css([140, 50, 40]));   // фары
  if (!opt.burnt) R(g, x + 41, GY - lift - 18, 1, 14, css(shade(body, 0.6)));                       // дверь
  for (let k = 0; k < 14; k++) R(g, x + ((hash(k, seed) * 94) | 0), GY - 1 - ((hash(seed, k) * 6) | 0), 1, 1 + ((hash(k, k) * 5) | 0), css(SP.grassA));   // трава сквозь кузов
}
function streetBench(g, x, seed) {                            // скамья 1,8 м → 42 px, сиденье 0,45 м, спинка 0,85 м
  const GY = GROUND_Y, wood = SQ(shade([112, 88, 66], 0.8 + hash(seed, 1) * 0.3)), metal = css(SP.rustD);
  R(g, x + 2, GY - 10, 2, 10, metal); R(g, x + 38, GY - 10, 2, 10, metal); R(g, x + 2, GY - 20, 2, 10, metal); R(g, x + 38, GY - 20, 2, 10, metal);
  for (let k = 0; k < 2; k++) if (hash(seed, k) > 0.25) R(g, x, GY - 11 + k * 2, 42, 2, css(shade(wood, 1 - k * 0.1)));
  for (let k = 0; k < 3; k++) if (hash(seed, k + 4) > 0.3) R(g, x, GY - 20 + k * 3, 42, 2, css(wood));
}
function streetSwing(g, x, seed) {                            // качели: рама 2,3 м → 52 px, ширина 2,6 м → 60 px
  const GY = GROUND_Y, m = css(SQ(shade(SP.rust, 0.9))), d = css(SP.rustD);
  pline(g, x, GY, x + 6, GY - 52, 2, m); pline(g, x + 12, GY, x + 6, GY - 52, 2, m);
  pline(g, x + 60, GY, x + 54, GY - 52, 2, m); pline(g, x + 48, GY, x + 54, GY - 52, 2, m);
  R(g, x + 5, GY - 53, 51, 2, m);
  for (let y = GY - 51; y < GY - 14; y += 2) { R(g, x + 22, y, 1, 1, d); if (hash(y, seed) > 0.2) R(g, x + 38, y + (hash(seed, 1) > 0.5 ? 2 : 0), 1, 1, d); }
  R(g, x + 20, GY - 14, 20, 2, css([90, 76, 60])); if (hash(seed, 2) > 0.5) pline(g, x + 38, GY - 14, x + 40, GY - 4, 1, d);
}
function streetDumpster(g, x, seed) {                         // контейнер 1,5 × 1,2 м → 34 × 27 px + мусор вокруг
  const GY = GROUND_Y;
  paintRegion(g, x, GY - 27, 34, 25, (px, py, o) => put(o, SQ(shade(mix([82, 96, 84], SP.rust, fbm((px - x) / 5, (py - GY) / 5, seed, 2)), 0.75 + ((px - x) % 6 < 1 ? -0.1 : 0.1)))));
  R(g, x - 1, GY - 28, 36, 2, css(SP.rustD)); R(g, x + 3, GY - 2, 3, 2, css([30, 30, 30])); R(g, x + 28, GY - 2, 3, 2, css([30, 30, 30]));
  streetTrash(g, x - 20, 74, seed + 3, 1.6);
}
function streetTrash(g, x, w, seed, density = 1) {            // кирпичи, обломки, покрышки, пакеты, арматура
  const GY = GROUND_Y, rng = makeRng(seed);
  for (let i = 0; i < w * 0.18 * density; i++) {
    const px = x + rng() * w, r = rng();
    if (r < 0.25) { const c = SQ(shade([132, 70, 54], 0.8 + rng() * 0.3)); R(g, px, GY - 3 - ((rng() * 3) | 0) * 3, 6, 3, css(c)); R(g, px, GY - 1, 6, 1, css(shade(c, 0.7))); }
    else if (r < 0.45) { const s = 3 + rng() * 7; paintRegion(g, Math.round(px), Math.round(GY - s), Math.round(s * 1.6), Math.round(s), (qx, qy, o) => { const lx = qx - px, ly = GY - qy; if (ly > s - Math.abs(lx - s * 0.8) * 0.7) return false; return put(o, SQ(shade(SP.conc, 0.7 + fbm(lx / 3, ly / 3, seed + i, 2) * 0.4))); }); }
    else if (r < 0.55) { disc(g, Math.round(px), GY - 7, 7, css([28, 28, 30])); disc(g, Math.round(px), GY - 7, 3, css([60, 56, 50])); }   // покрышка 0,6 м
    else if (r < 0.65) { const c = [[40, 40, 44], [70, 80, 90], [120, 110, 90]][(rng() * 3) | 0]; disc(g, Math.round(px), GY - 4, 4, css(c)); R(g, px - 4, GY - 1, 9, 1, css(shade(c, 0.7))); }   // пакеты
    else if (r < 0.72) pline(g, px, GY - 1, px + (rng() - 0.5) * 16, GY - 6 - rng() * 14, 1, css(SP.rustD));    // арматура
    else if (r < 0.8) { R(g, px, GY - 2, 14, 2, css([96, 78, 60])); R(g, px, GY - 4, 14, 1, css([110, 90, 70])); }   // доски
    else streetGrass(g, px, 6 + rng() * 10, seed + i);
  }
}
function streetGrass(g, x, h, seed) {                         // пучок сухой травы и сорняков
  const GY = GROUND_Y;
  for (let k = 0; k < 7; k++) { const bx = Math.round(x + (hash(k, seed) - 0.5) * 8), bh = Math.round(h * (0.4 + hash(seed, k) * 0.6)), c = [SP.grassA, SP.grassB, SP.leafC, SP.grassD][(hash(k + 3, seed) * 4) | 0];
    pline(g, bx, GY, bx + Math.round((hash(k, seed + 1) - 0.5) * 4), GY - bh, 1, css(SQ(c))); }
}
function streetBush(g, x, w, h, seed) {                       // кустарник: плотный, тёмный, с сухими ветками
  const GY = GROUND_Y, rng = makeRng(seed);
  for (let i = 0; i < 6; i++) pline(g, x + w / 2, GY, x + rng() * w, GY - h * (0.6 + rng() * 0.4), 1, css(SP.trunk));
  for (let i = 0; i < w * h * 0.7; i++) { const px = x + rng() * w, ph = rng() * h * (1 - Math.pow((px - x - w / 2) / (w / 2), 2) * 0.7); g.fillStyle = css(SQ([SP.leafB, SP.grassD, SP.leafA, [64, 66, 46]][(rng() * 4) | 0])); g.fillRect(Math.round(px), Math.round(GY - ph), 1, 1); }
}
function streetLamp(g, x, seed) {                             // бетонная опора освещения ≈ 8 м → 183 px, кронштейн, разбитый плафон
  const GY = GROUND_Y, h = 183;
  paintRegion(g, x - 3, GY - h, 7, h, (px, py, o) => { const w = 3 + Math.round((py - (GY - h)) / h * 1.5); if (Math.abs(px - x) > w / 2 + 0.5) return false; return put(o, SQ(shade([124, 120, 112], 0.82 + (px - x + 2) * 0.06 + hash(px, py) * 0.05))); });
  pline(g, x, GY - h + 2, x + 22, GY - h - 6, 2, css([90, 88, 84])); R(g, x + 18, GY - h - 6, 12, 4, css([70, 70, 72])); R(g, x + 20, GY - h - 2, 8, 2, css([150, 150, 140]));
  R(g, x - 4, GY - 40, 9, 12, css([84, 88, 90]));                                                    // щиток
}
function streetFence(g, x0, x1, seed) {                      // ограждение спортплощадки: рабица 2,5 м → 57 px, стойки через 2,5 м, дыры и завалившийся пролёт
  const GY = GROUND_Y, h = 57, post = css(SQ(shade(SP.rustD, 1.1)));
  for (let x = x0; x <= x1; x += 57) R(g, x, GY - h, 2, h, post);
  for (let x = x0; x < x1; x++) {
    const span = Math.floor((x - x0) / 57), fallen = hash(span, seed) > 0.85, hole = fbm((x - x0) / 30, 0, seed, 2);
    if (fallen) { if ((x - x0) % 4 === 0) R(g, x, GY - 6 - ((x * 7) % 5), 1, 1, css(SP.rustD)); continue; }
    const sag = Math.round(Math.sin(((x - x0) % 57) / 57 * Math.PI) * 4);
    R(g, x, GY - h + sag, 1, 1, css(SP.rust));
    for (let y = GY - h + 2 + sag; y < GY - 1; y++) {
      const v = y - GY, holeHere = hole > 0.62 && y > GY - h * (0.3 + hole * 0.5);
      if (!holeHere && ((x + v) % 6 === 0 || (x - v) % 6 === 0)) { g.fillStyle = hash(x, y) > 0.4 ? 'rgba(128,120,108,.75)' : 'rgba(96,66,48,.8)'; g.fillRect(x, y, 1, 1); }
    }
  }
}
function streetGoal(g, x, seed) {                             // ворота мини-футбола 3 × 2 м → 69 × 46 px, рваная сетка
  const GY = GROUND_Y, f = css(SQ([176, 170, 156])), r = css(SP.rust);
  R(g, x, GY - 46, 3, 46, f); R(g, x + 66, GY - 46, 3, 46, f); R(g, x, GY - 46, 69, 3, f);
  for (let k = 0; k < 69; k += 9) R(g, x + k, GY - 46, 2, 2, r);
  for (let y = GY - 43; y < GY; y++) for (let k = 3; k < 66; k++) if (((k + y) % 5 === 0 || (k - y) % 5 === 0) && fbm(k / 9, y / 9, seed, 2) < 0.6) { g.fillStyle = 'rgba(200,196,186,.55)'; g.fillRect(x + k, y, 1, 1); }
}
function streetBars(g, x, seed) {                             // турник 2,4 м → 55 px и брусья
  const GY = GROUND_Y, m = css(SQ(shade(SP.rust, 0.85)));
  R(g, x, GY - 55, 2, 55, m); R(g, x + 46, GY - 55, 2, 55, m); R(g, x, GY - 55, 48, 2, css([140, 136, 128]));
  R(g, x + 70, GY - 30, 2, 30, m); R(g, x + 96, GY - 30, 2, 30, m); R(g, x + 66, GY - 31, 36, 2, m); R(g, x + 66, GY - 24, 36, 1, css(SP.rustD));
}
function streetRubble(g, x0, x1, seed) {                      // завал у края — продолжение завала станции
  const GY = GROUND_Y, rng = makeRng(seed), w = x1 - x0;
  paintRegion(g, x0, GY - 80, w, 80, (px, py, o) => {
    const lx = (px - x0) / w, hgt = 74 * Math.sin(Math.PI * Math.min(1, lx * 1.4)) * (0.7 + fbm(px / 9, 0, seed, 2) * 0.5), hy = GY - py;
    if (hy > hgt) return false;
    const n = fbm(px / 5, py / 4, seed + 1, 3);
    return put(o, SQ(n > 0.62 ? shade(SP.conc, 0.9) : n > 0.5 ? [120, 72, 56] : shade([90, 86, 80], 0.7 + n * 0.5)));
  });
  for (let i = 0; i < 12; i++) { const px = x0 + rng() * w, py = GY - 10 - rng() * 50; pline(g, px, py, px + (rng() - 0.5) * 30, py - rng() * 20, 1, css(SP.rustD)); }
  for (let i = 0; i < 6; i++) { const px = x0 + rng() * w * 0.8, py = GY - 6 - rng() * 40, sw = 18 + rng() * 22; R(g, px, py, sw, 6, css(SQ(shade(SP.conc, 0.85 + rng() * 0.2)))); R(g, px, py + 6, sw, 1, css([60, 56, 52])); }
}
/* ---------------- Ещё дворовые предметы (s = 1, реальные размеры) ---------------- */
function streetSlide(g, x, seed) {                            // детская горка: высота площадки 1,5 м → 34 px, скат 3 м
  const GY = GROUND_Y, m = css(SQ(shade(SP.rust, 0.9))), d = css(SP.rustD), p = css(SQ(shade([96, 120, 128], 0.75)));
  R(g, x, GY - 34, 2, 34, m); R(g, x + 16, GY - 34, 2, 34, m); R(g, x, GY - 35, 18, 3, p);
  for (let k = 0; k < 5; k++) R(g, x + 2, GY - 6 - k * 6, 14, 1, d);                              // лесенка
  pline(g, x + 18, GY - 34, x + 64, GY - 4, 3, p); pline(g, x + 18, GY - 37, x + 64, GY - 7, 1, d);
  if (hash(seed, 1) > 0.5) R(g, x + 38, GY - 22, 8, 4, css([60, 60, 58]));                         // дыра в скате
  R(g, x, GY - 45, 2, 10, m); R(g, x + 16, GY - 45, 2, 10, m); R(g, x, GY - 45, 18, 1, m);
}
function streetSandbox(g, x, seed) {                          // песочница с грибком: 2 × 2 м, грибок 2,3 м
  const GY = GROUND_Y, wood = css(SQ([104, 82, 60]));
  R(g, x, GY - 6, 46, 6, wood); R(g, x, GY - 6, 46, 1, css([130, 104, 78])); for (let k = 0; k < 46; k += 9) R(g, x + k, GY - 6, 1, 6, css([70, 56, 44]));
  R(g, x + 22, GY - 52, 2, 46, css(SQ(shade(SP.rustD, 1.1))));
  paintRegion(g, x + 6, GY - 60, 34, 10, (px, py, o) => { const lx = px - x - 23, ly = py - (GY - 60); if (Math.abs(lx) > 3 + ly * 1.6) return false; return put(o, SQ(shade(hash(seed, 2) > 0.5 ? [130, 64, 50] : [96, 110, 84], 0.7 + (Math.abs(lx) % 6 < 3 ? 0.15 : 0) + hash(px, py) * 0.1))); });
}
function streetCarousel(g, x, seed) {                         // карусель: диск 2 м, поручни
  const GY = GROUND_Y, m = css(SQ(shade(SP.rust, 0.85)));
  R(g, x + 22, GY - 10, 3, 10, css(SP.rustD)); R(g, x, GY - 12, 48, 3, css(SQ(shade([110, 104, 96], 0.85))));
  for (const k of [2, 14, 32, 44]) R(g, x + k, GY - 24, 2, 12, m);
  R(g, x + 2, GY - 24, 44, 2, m);
}
function streetTireBed(g, x, seed) {                          // клумба из старых покрышек, крашенных когда-то в яркие цвета
  const GY = GROUND_Y, cols = [[150, 110, 60], [90, 120, 140], [150, 80, 70], [210, 200, 180]];
  for (let k = 0; k < 3; k++) { const cx = x + 8 + k * 17, c = SQ(shade(cols[(hash(k, seed) * 4) | 0], 0.6 + hash(seed, k) * 0.2));
    R(g, cx - 8, GY - 7, 16, 7, css(c)); R(g, cx - 8, GY - 7, 16, 1, css(shade(c, 1.2))); R(g, cx - 5, GY - 7, 10, 2, css([50, 44, 36]));
    for (let j = 0; j < 6; j++) R(g, cx - 4 + j * 2, GY - 9 - ((hash(j, seed + k) * 6) | 0), 1, 3 + ((hash(k, j) * 4) | 0), css(SQ(hash(j, k) > 0.5 ? SP.grassA : SP.leafC))); }
}
function streetSofa(g, x, seed) {                             // выброшенный диван 2 м → 46 px
  const GY = GROUND_Y, c = SQ(shade([[110, 84, 70], [80, 90, 96], [116, 104, 80]][(hash(seed, 1) * 3) | 0], 0.75));
  paintRegion(g, x, GY - 20, 46, 18, (px, py, o) => { const lx = px - x, ly = py - (GY - 20); if (ly < 8 && (lx < 3 || lx > 42 ? false : ly < 6 && lx > 4 && lx < 41 ? false : false)) return false;
    let col = shade(c, 0.8 + fbm(lx / 5, ly / 4, seed, 2) * 0.4); if (fbm(lx / 4, ly / 4, seed + 1, 2) > 0.7) col = [150, 140, 116]; return put(o, SQ(col)); });
  R(g, x, GY - 24, 6, 8, css(shade(c, 0.9))); R(g, x + 40, GY - 24, 6, 8, css(shade(c, 0.9))); R(g, x + 2, GY - 2, 3, 2, css([40, 36, 30])); R(g, x + 41, GY - 2, 3, 2, css([40, 36, 30]));
  R(g, x + 8, GY - 12, 30, 1, css(shade(c, 0.6)));
}
function streetFridge(g, x, seed) {                           // холодильник 1,5 м → 34 px, на боку или стоя
  const GY = GROUND_Y, lying = hash(seed, 1) > 0.5, w = lying ? 34 : 14, h = lying ? 14 : 34;
  paintRegion(g, x, GY - h, w, h, (px, py, o) => { const lx = px - x, ly = py - (GY - h); let c = shade([176, 172, 160], 0.75 + hash(lx >> 2, ly >> 2) * 0.1); if (fbm(lx / 4, ly / 4, seed, 2) > 0.62) c = mix(SP.rust, SP.rustD, 0.5); if (!lying && ly === 11) c = [80, 80, 76]; if (lying && lx === 22) c = [80, 80, 76]; return put(o, SQ(c)); });
}
function streetBarrel(g, x, seed) {                           // ржавая бочка 0,9 м → 20 px
  const GY = GROUND_Y;
  paintRegion(g, x, GY - 20, 14, 20, (px, py, o) => { const lx = px - x, ly = py - (GY - 20); let c = shade(mix(SP.rust, [70, 84, 80], hash(seed, 2) > 0.6 ? 0.7 : 0.1), 0.7 + Math.sin(lx / 13 * Math.PI) * 0.35); if (ly === 3 || ly === 16) c = shade(c, 0.7); return put(o, SQ(c)); });
  if (hash(seed, 3) > 0.6) for (let k = 0; k < 6; k++) R(g, x + 2 + k * 2, GY - 22 - ((hash(k, seed) * 4) | 0), 1, 3, css([60, 56, 50]));
}
function streetPallets(g, x, seed) {                          // штабель поддонов и досок
  const GY = GROUND_Y, n = 2 + ((hash(seed, 1) * 3) | 0);
  for (let k = 0; k < n; k++) { const y = GY - 6 - k * 6, c = css(SQ(shade([140, 116, 84], 0.7 + hash(k, seed) * 0.25))); R(g, x + (k % 2), y, 28, 2, c); R(g, x + (k % 2), y + 4, 28, 2, c); for (const j of [1, 13, 25]) R(g, x + (k % 2) + j, y + 2, 2, 2, css([90, 74, 56])); }
}
function streetCart(g, x, seed) {                             // брошенная магазинная тележка
  const GY = GROUND_Y, m = css([140, 140, 136]);
  for (let k = 0; k < 20; k += 3) R(g, x + k, GY - 18, 1, 12, m);
  R(g, x, GY - 18, 20, 1, m); R(g, x, GY - 7, 20, 1, m); pline(g, x + 20, GY - 18, x + 25, GY - 22, 1, m);
  disc(g, x + 3, GY - 2, 2, css([40, 40, 40])); disc(g, x + 17, GY - 2, 2, css([40, 40, 40]));
}
function streetClothesline(g, x, w, seed) {                   // столбы для белья (Т-образные) и рваные тряпки
  const GY = GROUND_Y, m = css(SQ(shade(SP.rustD, 1.15)));
  for (const px of [x, x + w]) { R(g, px, GY - 52, 2, 52, m); R(g, px - 8, GY - 52, 18, 2, m); }
  for (const dy of [-50, -46]) cable(g, x - 6, x + w + 6, GY + dy, 6, css([70, 70, 66]));
  for (let k = 0; k < 3; k++) { const cx = x + 20 + hash(k, seed) * (w - 40); R(g, cx, GY - 46 + 4, 6 + ((hash(seed, k) * 6) | 0), 8 + ((hash(k, k) * 8) | 0), css(SQ(shade([[140, 130, 110], [120, 90, 80], [100, 110, 120]][k], 0.7)))); }
}
function streetWoodFence(g, x0, x1, seed) {                   // кривой штакетник палисадника 1,2 м → 27 px
  const GY = GROUND_Y;
  R(g, x0, GY - 20, x1 - x0, 2, css(SQ([92, 76, 58]))); R(g, x0, GY - 9, x1 - x0, 2, css(SQ([92, 76, 58])));
  for (let x = x0; x < x1; x += 5) {
    const r = hash(x, seed); if (r < 0.15) continue;
    const lean = Math.round((hash(seed, x) - 0.5) * 4), h = 22 + ((r * 7) | 0);
    pline(g, x, GY, x + lean, GY - h, 2, css(SQ(shade([116, 96, 72], 0.7 + r * 0.35))));
  }
}
function streetTireStack(g, x, seed) {                        // стопка покрышек
  const GY = GROUND_Y, n = 2 + ((hash(seed, 1) * 3) | 0);
  for (let k = 0; k < n; k++) { const y = GY - 6 - k * 6, ox = Math.round((hash(k, seed) - 0.5) * 4); R(g, x + ox, y, 26, 6, css([30, 30, 32])); R(g, x + ox + 1, y, 24, 1, css([58, 58, 58])); R(g, x + ox + 8, y + 2, 10, 2, css([16, 16, 16])); }
}
function streetSign(g, x, seed) {                             // покосившийся дорожный знак (круглый, выцветший, без надписи)
  const GY = GROUND_Y, lean = (hash(seed, 1) - 0.5) * 8;
  pline(g, x, GY, x + lean, GY - 60, 2, css([110, 110, 106]));
  disc(g, Math.round(x + lean), GY - 66, 8, css([150, 70, 60])); disc(g, Math.round(x + lean), GY - 66, 6, css(SQ([170, 168, 160])));
  R(g, Math.round(x + lean) - 4, GY - 67, 9, 2, css([150, 70, 60]));
}
function streetLeaves(g, x0, x1, seed) {                      // палая листва и мелкий мусор на дорожке и у стен
  const GY = GROUND_Y, cols = [[132, 104, 56], [110, 76, 50], [96, 90, 54], [150, 128, 70]].map(c => css(SQ(c)));
  for (let x = x0; x < x1; x++) for (let d = 0; d < 3; d++) { const r = hash(x, seed + d); if (r > 0.86) { g.fillStyle = cols[(r * 37 | 0) % 4]; g.fillRect(x, GY - 1 - d, 1 + (r > 0.95 ? 1 : 0), 1); } }
}
/* ---------------- Игровая плоскость S1 ---------------- */
function streetGround(g, w, seed) {                          // дорожка: разбитый асфальт, лужи, люки; к зрителю — грунт, щебень, сухая трава
  const GY = GROUND_Y;
  paintRegion(g, 0, GY, w, -GY, (x, y, o) => {
    const d = y - GY, n = (hash(x, y) - 0.5) * 0.08;
    if (d === 0) return put(o, SQ(shade([108, 104, 96], 1 + n)));
    if (d < 18) {
      const crack = Math.abs(fbm(x / 11, d / 4, seed, 3) - 0.5) < 0.03, patch = fbm(x / 40, d / 6, seed + 1, 2), pud = fbm(x / 34, d / 2.2, seed + 8, 3);
      let c = shade(SP.asph, (patch > 0.6 ? 1.12 : 0.95) + n);
      if (fbm(x / 7, d / 3, seed + 4, 2) > 0.74) c = mix(SP.dirt, SP.grassB, 0.5);
      if (crack) c = [42, 40, 38];
      if (pud > 0.7 && d > 3) c = pud > 0.72 ? SQ(mix([118, 122, 126], [86, 90, 96], d / 18 + (hash(x >> 2, d) - 0.5) * 0.2)) : [48, 46, 44];   // лужа отражает небо
      return put(o, SQ(c));
    }
    if (d < 21) return put(o, SQ(shade([112, 108, 100], hash(x >> 3, 3) > 0.25 ? 1 : 0.6)));
    const k = 1 - (d - 21) / 101 * 0.6, gr = fbm(x / 9, d / 4, seed + 2, 3), st = fbm(x / 4, d / 3, seed + 3, 2);
    let c = mix(SP.dirt, mix(SP.grassB, SP.grassA, gr), smooth(0.48, 0.66, gr) * 0.7);
    if (st > 0.68) c = shade([96, 92, 86], 0.8 + st * 0.3);
    return put(o, SQ(shade(c, k * (0.88 + n * 2))));
  });
  for (let x = 380; x < w; x += 640 + ((hash(x, seed) * 300) | 0)) {                             // канализационные люки
    R(g, x, GY + 6, 22, 4, css([44, 42, 40])); R(g, x + 1, GY + 6, 20, 1, css([82, 80, 76])); for (let k = 3; k < 20; k += 4) R(g, x + k, GY + 7, 2, 2, css([60, 58, 54]));
  }
  for (let x = 0; x < w; x += 2) { const r = hash(x, seed + 9); if (r > 0.9) streetGrass(g, x, 3 + r * 9, x); }
  streetLeaves(g, 0, w, seed + 12);
}
function buildStreetS1() {
  const t0 = performance.now(), sc = CONFIG.SCENES.S1, W = sc.W, TOP = CONFIG.STREET.TOP, GY = GROUND_Y, S = 1022, F = CONFIG.STREET;
  const layer = (p, y0, h, c) => ({ c, p, y0 });
  const sky = layer(0.06, TOP, -130 - TOP, streetSky(Math.ceil(W * 0.06 + 800), TOP, -130 - TOP));
  const far = layer(0.22, -440, 310, streetFar(Math.ceil(W * 0.22 + 800), -440, 310, S + 1));
  const mid = layer(0.5, -470, 348, streetMid(Math.ceil(W * 0.5 + 800), -470, 348, S + 2));
  const back = layer(0.76, -440, 318, streetBack(Math.ceil(W * 0.76 + 800), -440, 318, S + 3));
  const pc = makeCanvas(W, -TOP), g = pc.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, -TOP);
  const L = sc.layout, h1 = L.house1[0], h1e = h1 + L.house1[1] * F.SECTION, h2 = L.house2[0], h2e = h2 + L.house2[1] * F.SECTION;
  streetTree(g, h1 + 60, GY, 1, 380, S + 30); streetTree(g, h1 + 720, GY, 1, 300, S + 31);
  drawPanelHouse(g, h1, L.house1[1], S + 10, 'left');
  drawPanelHouse(g, h2, L.house2[1], S + 20, null);
  // спортплощадка: рабица, ворота, турник/брусья; перед ней — детская площадка
  streetFence(g, L.sport[0], L.sport[1], S + 40);
  streetGoal(g, L.sport[0] + 170, S + 41); streetBars(g, L.sport[0] + 330, S + 42);
  for (let x = L.sport[0]; x < L.sport[1]; x += 9) { const r = hash(x, S + 43); if (r > 0.35) streetGrass(g, x, 10 + r * 22, x + 5); }   // бурьян вдоль сетки
  streetSlide(g, L.play[0] + 20, S + 44); streetSandbox(g, L.play[0] + 110, S + 45); streetCarousel(g, L.play[0] + 190, S + 46);
  streetRubble(g, L.edgeR[0], L.edgeR[1], S + 50);
  for (const [x, h, sd] of L.trees) streetTree(g, x, GY, 1, h, S + sd);
  for (const [x, w, h] of L.bushes) streetBush(g, x, w, h, S + x);
  // у подъездов: клумбы из покрышек, палисадники, мусор
  for (let s = 0; s < L.house1[1]; s++) {
    const dx = h1 + s * F.SECTION + 165;
    streetTireBed(g, dx - 84, S + s * 7);
    if (hash(s, S) > 0.35) streetWoodFence(g, dx + 96, dx + 96 + 40 + ((hash(S, s) * 50) | 0), S + s * 11);
    streetTrash(g, dx - 30, 22, S + s * 13, 1.4);
  }
  for (const x of L.lamps) streetLamp(g, x, S + x);
  for (let i = 0; i + 1 < L.lamps.length; i++) cable(g, L.lamps[i] + 1, L.lamps[i + 1] + 1, GY - 178, 14, css([40, 40, 42]));
  cable(g, h1 + 8, L.lamps[2] + 1, GY - 300, 26, css([44, 44, 46])); cable(g, h1e - 8, L.lamps[4] + 1, GY - 260, 18, css([44, 44, 46]));   // провода с дома на опоры
  for (const x of L.benches) streetBench(g, x, S + x);
  streetClothesline(g, L.yard.cloth, 70, S + 62);
  streetSwing(g, L.swing, S + 60); streetDumpster(g, L.dumpster, S + 61); streetTrash(g, L.dumpster - 40, 110, S + 63, 2.2); streetTireStack(g, L.dumpster + 40, S + 64);
  for (const [x, o] of L.cars) streetCar(g, x, S + x, o);
  for (const [k, x] of L.junk) ({ sofa: streetSofa, fridge: streetFridge, barrel: streetBarrel, pallets: streetPallets, cart: streetCart, tires: streetTireStack, sign: streetSign })[k](g, x, S + x);
  for (let x = 0; x < W; x += 10) { const r = hash(x, S), z = fbm(x / 140, 0, S + 4, 2); if (r > 1.05 - z) streetGrass(g, x + r * 10, 3 + r * 10 + z * 14, x); if (r > 0.84) streetTrash(g, x, 24, x + S, 0.9); }   // заросли пятнами: где гуще, где почти голо
  for (const [a, b] of [[h1, h1e], [h2, h2e]]) for (let x = a; x < b; x += 5) { const r = hash(x, S + 3), z = fbm(x / 60, 1, S + 5, 2); if (r > 1.1 - z) streetGrass(g, x, 3 + r * 8, x + 9); }   // трава у отмостки
  streetGround(g, W, S + 70);
  const play = layer(1, TOP, -TOP, pc);
  const fw = Math.ceil(W * 1.15 + 200), fc = makeCanvas(fw, 150), fg = fc.getContext('2d', { willReadFrequently: true }); fg.setTransform(1, 0, 0, 1, 0, 150);   // передний план: только ниже ступней героя
  const rng = makeRng(S + 80);
  for (let x = 0; x < fw; x += 10 + Math.round(rng() * 46)) {
    const r = rng(), base = -48 - Math.round(rng() * 34), maxH = base + 112;   // верх не выше −112: ступни героя на −122 всегда открыты
    if (r < 0.4) {
      const s = Math.min(maxH, 8 + rng() * 22), wd = s * (1.6 + rng() * 1.4), tilt = (rng() - 0.5) * 0.8, sd = x | 0;
      paintRegion(fg, Math.round(x), Math.round(base - s - wd * 0.4), Math.round(wd), Math.round(s + wd * 0.4), (px, py, o) => {
        const lx = px - x, ly = base - py, top = s * (0.55 + 0.45 * vnoise(lx / 6, 0, sd)) + tilt * (lx - wd / 2);
        if (ly < 0 || ly > top) return false;
        const edge = top - ly < 1.5, c = edge ? [116, 114, 108] : shade([62, 60, 56], 0.75 + fbm(lx / 4, ly / 4, sd, 2) * 0.5);
        return put(o, SQ(hash(px, py) > 0.97 ? SP.rustD : c));
      });
      if (rng() < 0.4) pline(fg, x + wd * 0.3, base - s * 0.6, x + wd * 0.3 + (rng() - 0.5) * 14, base - s - 6 - rng() * 8, 1, css(SP.rustD));   // торчащая арматура
    } else if (r < 0.5) { R(fg, x, base - 6, 7, 3, css([96, 56, 44])); R(fg, x + 4, base - 3, 7, 3, css([84, 50, 40])); R(fg, x - 3, base - 3, 6, 3, css([104, 60, 48])); }   // битый кирпич
    else for (let k = 0; k < 12; k++) { const bx = x + (rng() - 0.5) * 16, bh = Math.min(maxH, 6 + rng() * 24); pline(fg, bx, base, bx + (rng() - 0.5) * 7, base - bh, 1, css(SQ(shade([SP.grassD, SP.grassB, [50, 48, 40], SP.leafC][(rng() * 4) | 0], 0.6)))); }
  }
  const front = { c: fc, p: 1.15, y0: -150 };
  const cv = [sky, far, mid, back, play, front].map(l => l.c);
  return { layered: true, layers: [sky, far, mid, back, play], front, canvases: cv, lights: [], emissive: [],
    buildMs: performance.now() - t0, bytes: cv.reduce((a, c) => a + c.width * c.height * 4, 0) };
}
/* STREET:END */
