/* =========================== OUTDOOR SCENES (фаза А) =======================
   S1 «Дворы» и S2 «К Дуплету»: свой слой улицы шириной сцены и высотой SURF_H (тот же уровень земли GROUND_Y,
   что у улицы станции), небо и дальние руины — общие слои станции (параллакс). Здания — фон без коллизий и без входов. */
function paintStreet(gm, w) {
  paintRegion(gm, 0, surfRow(GROUND_Y), w, -GROUND_Y, (x, row, o) => {          // тот же грунт и асфальт, что у улицы станции
    const y = row - SURF_H, n = (hash(x, y + 777) - 0.5) * 10;
    if (y === GROUND_Y) return setC(o, 104, 100, 90, n);
    const dy = y - GROUND_Y;
    if (dy < 11) return setC(o, 56, 55, 52, n + (hash(x >> 1, y) > 0.95 ? -16 : 0));
    if (dy < 17) return setC(o, 62, 52, 42, n);
    const st = Math.sin(y * 0.4 + Math.sin(x * 0.02) * 2) * 4, stone = hash(x >> 2, y >> 2) > 0.9 ? 10 : 0, k = Math.max(0.35, 0.9 - (dy - 17) / 120);
    return setC(o, (48 + stone) * k, (40 + stone) * k, (34 + stone) * k, n * 0.6 + st);
  });
}
/** Панельный дом: этажи по 18 px, окна парами, часть заколочена или выбита; подъезд с козырьком (закрыт — фон). */
function drawBlock(R2, x0, w, floors, seed, tone) {
  const h = floors * 18 + 8, top = GROUND_Y - h, base = rgb(tone);
  R2(x0, top, w, h, base); R2(x0, top, w, 2, rgb(tone, 1.2)); R2(x0 - 2, top - 3, w + 4, 3, rgb(tone, 0.8));   // стена, парапет
  for (let x = x0 + 30; x < x0 + w; x += 30) R2(x, top + 2, 1, h - 2, rgb(tone, 0.86));                     // швы панелей
  for (let f = 0; f < floors; f++) for (let x = x0 + 8; x < x0 + w - 12; x += 15) {
    const wy = top + 6 + f * 18, r = hash(x + seed, f), c = r > 0.86 ? '#2a1e14' : r > 0.7 ? '#5a4a36' : r > 0.12 ? '#1a1e22' : '#3a4a52';
    R2(x, wy, 8, 9, c); R2(x, wy + 9, 8, 1, rgb(tone, 0.7));
    if (r > 0.7 && r <= 0.86) for (let k = 0; k < 3; k++) R2(x, wy + 1 + k * 3, 8, 1, '#3e3226');               // доски на окне
  }
  for (let f = 1; f < floors; f += 2) { const bx = x0 + 16 + ((hash(seed, f) * (w - 60)) | 0); R2(bx, top + f * 18 + 14, 22, 2, rgb(tone, 0.75)); R2(bx, top + f * 18 + 10, 1, 4, rgb(tone, 0.7)); R2(bx + 21, top + f * 18 + 10, 1, 4, rgb(tone, 0.7)); }   // балконы
  const dx = x0 + (w >> 1) - 7;                                                                               // подъезд
  R2(dx - 4, GROUND_Y - 24, 22, 2, rgb(tone, 0.7)); R2(dx, GROUND_Y - 22, 14, 22, '#14181a'); R2(dx, GROUND_Y - 22, 14, 1, '#2a3032');
  for (let x = x0; x < x0 + w; x++) if (hash(x, seed + 9) > 0.92) R2(x, top + 2 + ((hash(seed, x) * (h - 10)) | 0), 1, 3 + ((hash(x, 3) * 8) | 0), 'rgba(20,18,16,.35)');   // потёки
}
function buildOutdoor(id) {
  if (id === 'S1') { const k = S1Art.kind(); return k === 'art' ? buildStreetS1Art(S1Art.imgs) : k === 'wait' ? buildStreetS1Wait() : Object.assign(buildStreetS1(), { kind: 'proc' }); }   // S1-ART; резерв — процедурная S1 (ШТАБ-022)
  if (id === 'SURF') return SurfArt.kind() === 'art' ? buildSurfaceArtScene(SurfArt.imgs) : buildSurfPlaceholder();   // ST-VIEW-002: панорама; резерв — заглушка
  const t0 = performance.now(), sc = CONFIG.SCENES[id], w = sc.W;
  const surf = makeCanvas(w, SURF_H), gm = surf.getContext('2d', { willReadFrequently: true });
  const R2 = (x, y, ww, hh, c) => R(gm, x, surfRow(y), ww, hh, c);
  paintStreet(gm, w);
  for (let x = 0; x < w; x += 1) if (hash(x + w, 31) > 0.86) R2(x, GROUND_Y - 1 - ((hash(x, 32) * 3) | 0), 1, 2 + ((hash(x, 33) * 2) | 0), '#5a5636');   // сухая трава
  const tree = (tx, d) => { L(gm, tx, surfRow(GROUND_Y), tx + d * 2, surfRow(GROUND_Y - 44), '#2a2420', 3); L(gm, tx + d * 2, surfRow(GROUND_Y - 30), tx + d * 14, surfRow(GROUND_Y - 46), '#2a2420', 2); L(gm, tx + d, surfRow(GROUND_Y - 20), tx - d * 10, surfRow(GROUND_Y - 34), '#2a2420', 2); };
  if (id === 'S1') {
    for (let x = w - 70; x < w; x++) {                                    // продолжение завала с улицы станции — Глеб перебирается через него
      const hh = Math.max(0, Math.round(34 - Math.abs(x - (w - 10)) * 0.55 + (hash(x, 7) - 0.5) * 8));
      for (let y = 0; y < hh; y++) R2(x, GROUND_Y - y, 1, 1, rgb([70, 66, 60], 0.55 + hash(x, y) * 0.5 - y / 180));
    }
    drawBlock(R2, 1500, 240, 5, 11, [92, 88, 80]);                        // пятиэтажка № 1
    tree(1470, -1);
    // спортплощадка: сетка-забор, ворота, турник, скамья
    for (let x = 1140; x <= 1440; x += 30) R2(x, GROUND_Y - 30, 2, 30, '#3a3c3c');
    for (let x = 1140; x < 1440; x++) for (let y = 2; y < 30; y += 6) if (((x + y) % 6) < 1) R2(x, GROUND_Y - 30 + y, 1, 1, 'rgba(120,124,120,.7)');
    R2(1140, GROUND_Y - 31, 300, 1, '#4a4c4a');
    R2(1180, GROUND_Y - 18, 2, 18, '#6a5a4a'); R2(1180, GROUND_Y - 18, 26, 2, '#6a5a4a'); R2(1205, GROUND_Y - 18, 2, 18, '#6a5a4a');   // ворота (ржавые)
    R2(1300, GROUND_Y - 26, 2, 26, '#4a4c4c'); R2(1326, GROUND_Y - 26, 2, 26, '#4a4c4c'); R2(1300, GROUND_Y - 26, 28, 1, '#5e6060');      // турник
    R2(1380, GROUND_Y - 7, 30, 2, '#5a4632'); R2(1382, GROUND_Y - 5, 2, 5, '#3a2e22'); R2(1406, GROUND_Y - 5, 2, 5, '#3a2e22');          // скамья
    drawBlock(R2, 840, 240, 5, 23, [86, 84, 78]);                         // пятиэтажка № 2
    tree(800, 1);
    // «Универсам-3»: низкий одноэтажный корпус, ленточная витрина (заколочена), вывеска; вход x ≈ 520 — только рисунок (фаза А)
    const ux = 280, uw = 480, uh = 44, ut = GROUND_Y - uh;
    R2(ux, ut, uw, uh, '#6e6a62'); R2(ux, ut, uw, 2, '#86827a'); R2(ux - 4, ut - 6, uw + 8, 6, '#5a5650'); R2(ux - 4, ut - 6, uw + 8, 1, '#7a766e');
    for (let x = ux + 10; x < ux + uw - 10; x += 40) { if (Math.abs(x + 20 - 520) < 30) continue; R2(x, ut + 12, 34, 22, '#1c2024'); R2(x, ut + 12, 34, 1, '#3a4248');
      for (let k = 0; k < 4; k++) if (hash(x, k) > 0.35) R2(x + 1, ut + 14 + k * 5, 32, 2, '#4e3e2c'); }                                    // доски на витринах
    R2(508, GROUND_Y - 26, 24, 26, '#16191b'); R2(519, GROUND_Y - 26, 1, 26, '#2a2e30'); R2(504, GROUND_Y - 29, 32, 3, '#5a5650');     // двери входа
    R2(ux + 140, ut - 20, 200, 13, '#2a2e2c'); R2(ux + 140, ut - 20, 200, 1, '#4a4e4c');
    drawText(gm, 'УНИВЕРСАМ', ux + 240 - (textWidth('УНИВЕРСАМ') >> 1), surfRow(ut - 17), '#c8b88a', 'rgba(0,0,0,.5)');
    for (let k = 0; k < 5; k++) R2(ux + 30 + k * 90, GROUND_Y - 4, 10, 4, '#4a4440');                     // мусор у фасада
  } else {
    drawBlock(R2, 1080, 300, 5, 37, [90, 86, 80]);                        // пятиэтажка № 3
    tree(1050, -1); tree(1420, 1);
    // дорога: бордюры, разметка, брошенная машина (фон)
    R2(760, GROUND_Y - 1, 240, 1, '#3e3e3c'); R2(758, GROUND_Y - 3, 3, 3, '#8a8680'); R2(999, GROUND_Y - 3, 3, 3, '#8a8680');
    for (let x = 772; x < 990; x += 22) R2(x, GROUND_Y + 3, 12, 1, '#a8a49a');
    const cx = 830; R2(cx, GROUND_Y - 13, 50, 9, '#3e4a52'); R2(cx + 8, GROUND_Y - 21, 30, 8, '#34404a'); R2(cx + 11, GROUND_Y - 19, 10, 5, '#16181a'); R2(cx + 24, GROUND_Y - 19, 10, 5, '#16181a');
    disc(gm, cx + 9, surfRow(GROUND_Y - 3), 4, '#1a1a1a'); disc(gm, cx + 41, surfRow(GROUND_Y - 3), 4, '#1a1a1a');
    // восьмиэтажка с «ДУПЛЕТОМ» на первом этаже; вход x ≈ 420 — только рисунок (фаза А)
    drawBlock(R2, 140, 540, 8, 53, [84, 82, 80]);
    R2(330, GROUND_Y - 30, 180, 30, '#4a443c'); R2(330, GROUND_Y - 30, 180, 2, '#6a6258');                // первый этаж — магазин
    R2(345, GROUND_Y - 24, 50, 18, '#1a1e22'); R2(445, GROUND_Y - 24, 50, 18, '#1a1e22');                  // витрины с решётками
    for (const vx of [345, 445]) for (let k = 0; k < 50; k += 5) R2(vx + k, GROUND_Y - 24, 1, 18, '#3a3a38');
    R2(408, GROUND_Y - 26, 24, 26, '#14171a'); R2(408, GROUND_Y - 26, 24, 1, '#2e3234');                    // дверь
    R2(360, GROUND_Y - 42, 120, 11, '#1e2224'); R2(360, GROUND_Y - 42, 120, 1, '#5a3a2a');
    drawText(gm, 'ДУПЛЕТ', 420 - (textWidth('ДУПЛЕТ') >> 1), surfRow(GROUND_Y - 40), '#d8a860', 'rgba(0,0,0,.5)');
    for (let x = 0; x < 140; x++) if (hash(x, 77) > 0.5) R2(x, GROUND_Y - 8 - ((hash(x, 78) * 10) | 0), 1, 8 + ((hash(x, 78) * 10) | 0), 'rgba(40,36,30,.6)');   // кусты у края
  }
  return { surface: surf, lights: [], emissive: [], buildMs: performance.now() - t0, bytes: w * SURF_H * 4 };
}
