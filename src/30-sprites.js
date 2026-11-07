/* ============================ PLAYER_SPRITE ===============================
   Персонаж рисуется кодом в кадры 26×42 (лицом вправо), затем к силуэту
   добавляется тёмный контур для читаемости на любом фоне. */
const SPRITE_W = 26, SPRITE_H = 42;
const HERO_PAL = {
  skin: '#c99878', skinSh: '#9c6c52', hair: '#3f322b', hairHi: '#5a473b', eye: '#1d1a18',
  scarf: '#a85343', scarfSh: '#7d3a30', jacket: '#5d6a58', jacketHi: '#76846e', jacketSh: '#44503f', zip: '#8d9a86',
  belt: '#2e2a26', buckle: '#b39a62', pack: '#4f574a', packHi: '#626b5a', packSh: '#3a4136', roll: '#7e725a', rollSh: '#5f5644',
  pants: '#39404c', pantsSh: '#2a2f39', boot: '#1f2024', bootHi: '#3a3a40', glove: '#8a7a64', outline: '#0b0d10',
};
/** NPC-001: детали силуэта жителей. Рисуются только при заданных опциях — прежние спрайты (Глеб, охрана, жители) не меняются.
    dy — сдвиг головы (сидя +6). Лицо смотрит вправо: лоб x 11–17, глаз x 16, затылок x 10–11. */
function headExtras(g, o, PAL, y) {
  if (o.hairStyle === 'long') { R(g, 9, 4 + y, 3, 9, PAL.hair); R(g, 10, 13 + y, 2, 1, PAL.hair); R(g, 10, 2 + y, 1, 3, PAL.hairHi); }   // волосы до плеч
  if (o.hairStyle === 'bun') { R(g, 7, 2 + y, 4, 4, PAL.hair); R(g, 7, 2 + y, 4, 1, PAL.hairHi); }                        // пучок на затылке
  if (o.hairStyle === 'bald') { R(g, 12, 2 + y, 6, 3, PAL.skin); R(g, 13, 2 + y, 3, 1, PAL.skinSh); R(g, 17, 4 + y, 1, 1, PAL.skin); }   // лысина, виски остаются
  if (o.beard) { R(g, 13, 9 + y, 5, 3, o.beard); R(g, 14, 12 + y, 4, 1, o.beard); R(g, 16, 10 + y, 1, 1, PAL.skinSh); }   // борода, рот
  if (o.hood) { R(g, 9, 1 + y, 9, 3, o.hood); R(g, 9, 4 + y, 3, 9, o.hood); R(g, 17, 2 + y, 1, 2, o.hood); R(g, 9, 1 + y, 9, 1, 'rgba(255,255,255,.18)'); }   // капюшон / платок
  if (o.cap === 'beanie') { R(g, 10, 1 + y, 8, 3, o.capC); R(g, 10, 3 + y, 8, 1, 'rgba(0,0,0,.25)'); R(g, 13, 0 + y, 2, 1, o.capC); }   // вязаная шапка с помпоном
  if (o.cap === 'cap') { R(g, 10, 1 + y, 8, 3, o.capC); R(g, 17, 3 + y, 4, 1, o.capC); R(g, 10, 1 + y, 8, 1, 'rgba(255,255,255,.18)'); }   // кепка с козырьком
  if (o.cap === 'helmet') { R(g, 9, 1 + y, 10, 4, o.capC); R(g, 9, 1 + y, 10, 1, 'rgba(255,255,255,.2)'); R(g, 10, 5 + y, 10, 1, 'rgba(0,0,0,.35)'); R(g, 18, 4 + y, 2, 1, o.capC); }   // каска
  if (o.goggles) { R(g, 11, 4 + y, 8, 1, '#2a2e30'); R(g, 15, 3 + y, 3, 2, '#2a2e30'); R(g, 16, 3 + y, 1, 1, '#8aaab0'); }   // очки на лбу
}
function bodyExtras(g, o, PAL, b, sit) {
  const t = sit ? 20 + b : 14 + b, h = sit ? 11 - b : 11;
  if (o.vest) { R(g, 10, t + 1, 7, h - 2, o.vest); R(g, 10, t + 1, 7, 1, 'rgba(255,255,255,.18)'); if (/^#c/.test(o.vest)) R(g, 10, t + 6, 7, 1, '#e8e0b0'); }   // жилет (жёлтый — со светоотражающей полосой)
  if (o.apron) { R(g, 13, t + 3, 6, sit ? h - 1 : 14, o.apron); R(g, 13, t + 3, 1, sit ? h - 1 : 14, 'rgba(0,0,0,.18)'); L(g, 14, t, 17, t + 3, o.apron); }   // фартук
  if (o.cross) { R(g, 10, t + 3, 3, 1, '#b83a30'); R(g, 11, t + 2, 1, 3, '#b83a30'); }   // NPC-002: красный крест медика на груди
  if (o.bag && !sit) { L(g, 11, t + 1, 16, t + 10, '#3a3028', 1); R(g, 15, t + 10, 5, 5, o.bag); R(g, 15, t + 10, 5, 1, 'rgba(255,255,255,.18)'); }   // сумка через плечо
}
function drawPersonFrame(o, PAL = HERO_PAL) {
  const c = makeCanvas(SPRITE_W, SPRITE_H), g = c.getContext('2d', { willReadFrequently: true }), b = o.bob;
  const leg = (hx, fx, lift, col, colSh) => {
    const hy = 27 + b, fy = 38 - lift, kx = Math.round((hx + fx) / 2 + 1 + (lift ? 1 : 0)), ky = Math.round((hy + fy) / 2);
    L(g, hx, hy, kx, ky, col, 3); L(g, kx, ky, fx, fy, col, 3); R(g, fx - 1, fy - 2, 1, 2, colSh);
    R(g, fx - 1, fy + 1, 5, 2, PAL.boot); R(g, fx - 1, fy + 1, 5, 1, PAL.bootHi);
  };
  const arm = (hx, col) => {
    const sx = 13, sy = 16 + b, ex = 13 + Math.round(hx / 2), ey = 21 + b, wx = 13 + hx, wy = 25 + b;
    L(g, sx, sy, ex, ey, col, 3); L(g, ex, ey, wx, wy, col, 3); R(g, wx - 1, wy + 1, 3, 2, PAL.glove);
  };
  arm(o.armBack, PAL.jacketSh);                                          // дальняя рука
  leg(12, 12 + o.legBack.f, o.legBack.lift, PAL.pantsSh, PAL.boot);      // дальняя нога
  if (!o.noPack) {
  R(g, 3, 11 + b, 8, 4, PAL.roll); R(g, 3, 11 + b, 1, 4, PAL.rollSh); R(g, 10, 11 + b, 1, 4, PAL.rollSh); R(g, 3, 11 + b, 8, 1, '#9a8e72');
  R(g, 4, 15 + b, 6, 12, PAL.pack); R(g, 4, 15 + b, 6, 3, PAL.packHi); R(g, 9, 15 + b, 1, 12, PAL.packSh); R(g, 4, 26 + b, 6, 1, PAL.packSh);
  }
  R(g, 9, 14 + b, 9, 14, PAL.jacket); R(g, 9, 14 + b, 9, 2, PAL.jacketHi); R(g, 17, 16 + b, 1, 11, PAL.jacketSh);
  R(g, 15, 16 + b, 1, 9, PAL.zip); R(g, 13, 21 + b, 2, 2, PAL.jacketSh);
  R(g, 9, 25 + b, 9, 2, PAL.belt); R(g, 15, 25 + b, 2, 2, PAL.buckle); R(g, 9, 27 + b, 9, 1, PAL.jacketSh);
  if (!o.noPack) R(g, 10, 15 + b, 1, 10, PAL.packSh);                   // лямка рюкзака
  leg(14, 14 + o.legFront.f, o.legFront.lift, PAL.pants, PAL.pantsSh);  // ближняя нога
  R(g, 10, 12 + b, 8, 3, PAL.scarf); R(g, 10, 14 + b, 8, 1, PAL.scarfSh); R(g, 8 - o.tail, 14 + b, 2, 6, PAL.scarf); R(g, 8 - o.tail, 19 + b, 2, 1, PAL.scarfSh);
  R(g, 11, 4 + b, 7, 8, PAL.skin); R(g, 11, 11 + b, 7, 1, PAL.skinSh); R(g, 18, 8 + b, 1, 2, PAL.skin);
  R(g, 10, 2 + b, 8, 3, PAL.hair); R(g, 10, 5 + b, 2, 5, PAL.hair); R(g, 13, 2 + b, 3, 1, PAL.hairHi); R(g, 17, 4 + b, 1, 1, PAL.hair);
  R(g, 13, 8 + b, 1, 2, PAL.skinSh);                                    // ухо
  if (o.blink) R(g, 16, 7 + b, 2, 1, PAL.skinSh); else { R(g, 16, 7 + b, 1, 1, PAL.eye); R(g, 16, 6 + b, 2, 1, PAL.hair); }
  R(g, 17, 10 + b, 1, 1, PAL.skinSh);
  if (o.hat) { R(g, 9, 1 + b, 10, 4, o.hat); R(g, 9, 1 + b, 10, 1, 'rgba(255,255,255,.2)'); R(g, 10, 5 + b, 10, 1, 'rgba(0,0,0,.35)'); }
  headExtras(g, o, PAL, b); bodyExtras(g, o, PAL, b, false);            // NPC-001: только при заданных опциях
  if (o.coat) { R(g, 9, 27 + b, 9, 4, PAL.jacket); R(g, 17, 27 + b, 1, 4, PAL.jacketSh); R(g, 9, 30 + b, 9, 1, PAL.jacketSh); }   // длинная куртка / пальто поверх бёдер
  arm(o.armFront, PAL.jacket);                                          // ближняя рука
  if (o.gun) { L(g, 8, 27 + b, 21, 14 + b, '#222426', 2); R(g, 6, 26 + b, 4, 3, '#4a3a2a'); R(g, 15, 21 + b, 2, 4, '#222426'); R(g, 20, 13 + b, 2, 1, '#55595c'); }
  outline(g);
  return c;
}
function outline(g, SW = SPRITE_W, SH = SPRITE_H) {
  const img = g.getImageData(0, 0, SW, SH), d = img.data, a = i => d[i * 4 + 3] > 0;
  const add = [];
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const i = y * SW + x; if (a(i)) continue;
    if ((x > 0 && a(i - 1)) || (x < SW - 1 && a(i + 1)) || (y > 0 && a(i - SW)) || (y < SH - 1 && a(i + SW))) add.push(i);
  }
  add.forEach(i => { d[i * 4] = 11; d[i * 4 + 1] = 13; d[i * 4 + 2] = 16; d[i * 4 + 3] = 255; });
  g.putImageData(img, 0, 0);
}
/** Герой со спины (уходит в гермоворота). */
function drawBackFrame(PAL = HERO_PAL, step = 0) {                     // step: 0 — стоит, 1/2 — шаг левой/правой (1.0.1)
  const c = makeCanvas(SPRITE_W, SPRITE_H), g = c.getContext('2d', { willReadFrequently: true });
  const upL = false, upR = false;
  const leg = (hx, raised) => {
    if (raised) { L(g, hx, 27, hx, 35, PAL.pants, 3); R(g, hx - 2, 36, 4, 2, PAL.boot); R(g, hx - 2, 36, 4, 1, PAL.bootHi); }
    else { L(g, hx, 27, hx, 37, PAL.pants, 3); R(g, hx - 2, 38, 4, 2, PAL.boot); R(g, hx - 2, 38, 4, 1, PAL.bootHi); }
  };
  leg(11, step === 1); leg(15, step === 2);                              // шаг: одна нога приподнята
  R(g, 9, 14, 9, 14, PAL.jacket); R(g, 9, 14, 9, 2, PAL.jacketHi); R(g, 9, 25, 9, 2, PAL.belt); R(g, 9, 27, 9, 1, PAL.jacketSh);
  const arm = (sx, hx, up) => { const hy = up ? 2 : 13; L(g, sx, 15, hx, hy, PAL.jacket, 3); R(g, hx - 1, hy - 1, 3, 2, PAL.glove); };
  arm(9, upL ? 8 : 6, upL); arm(17, upR ? 18 : 20, upR);
  R(g, 8, 13, 11, 13, PAL.pack); R(g, 8, 13, 11, 3, PAL.packHi); R(g, 8, 25, 11, 1, PAL.packSh);
  R(g, 10, 18, 7, 5, PAL.packSh); R(g, 10, 18, 7, 1, '#6c7562');
  R(g, 7, 10, 13, 4, PAL.roll); R(g, 7, 10, 13, 1, '#9a8e72'); R(g, 7, 10, 1, 4, PAL.rollSh); R(g, 19, 10, 1, 4, PAL.rollSh);
  R(g, 10, 2, 7, 8, PAL.hair); R(g, 12, 2, 3, 1, PAL.hairHi); R(g, 9, 6, 1, 2, PAL.skinSh); R(g, 17, 6, 1, 2, PAL.skinSh);
  R(g, 16, 14, 2, 6, PAL.scarf); R(g, 16, 19, 2, 1, PAL.scarfSh);
  outline(g);
  return c;
}
/** 1.0.1: герой лицом к зрителю — та же фигура и палитра, что сбоку и со спины. step: 0 — стоит, 1/2 — шаг. */
function drawFrontFrame(PAL = HERO_PAL, step = 0) {
  const c = makeCanvas(SPRITE_W, SPRITE_H), g = c.getContext('2d', { willReadFrequently: true });
  const leg = (hx, raised) => {
    if (raised) { L(g, hx, 27, hx, 35, PAL.pants, 3); R(g, hx - 2, 36, 4, 2, PAL.boot); R(g, hx - 2, 36, 4, 1, PAL.bootHi); }
    else { L(g, hx, 27, hx, 37, PAL.pants, 3); L(g, hx + 1, 28, hx + 1, 37, PAL.pantsSh, 1); R(g, hx - 2, 38, 4, 2, PAL.boot); R(g, hx - 2, 38, 4, 1, PAL.bootHi); }
  };
  leg(11, step === 2); leg(15, step === 1);
  const arm = (sx, hx) => { L(g, sx, 15, hx, 25, PAL.jacket, 3); L(g, sx, 16, hx, 25, PAL.jacketSh, 1); R(g, hx - 1, 25, 3, 2, PAL.glove); };
  arm(9, step === 1 ? 6 : 7); arm(17, step === 2 ? 20 : 19);              // руки чуть качаются в шаге
  R(g, 9, 14, 9, 14, PAL.jacket); R(g, 9, 14, 9, 1, PAL.jacketHi); R(g, 9, 14, 1, 13, PAL.jacketHi); R(g, 17, 14, 1, 13, PAL.jacketSh);
  R(g, 13, 15, 1, 10, PAL.zip);                                          // молния
  R(g, 9, 16, 1, 9, PAL.pack); R(g, 17, 16, 1, 9, PAL.pack);             // лямки рюкзака
  R(g, 9, 25, 9, 2, PAL.belt); R(g, 12, 25, 3, 2, PAL.buckle); R(g, 9, 27, 9, 1, PAL.jacketSh);
  R(g, 10, 11, 7, 4, PAL.scarf); R(g, 10, 14, 7, 1, PAL.scarfSh); R(g, 14, 15, 2, 3, PAL.scarf);   // шарф, хвост шарфа
  R(g, 10, 3, 7, 8, PAL.skin); R(g, 10, 9, 7, 2, PAL.skinSh);            // лицо
  R(g, 10, 2, 7, 3, PAL.hair); R(g, 9, 3, 1, 5, PAL.hair); R(g, 17, 3, 1, 5, PAL.hair); R(g, 12, 2, 3, 1, PAL.hairHi);
  R(g, 11, 6, 2, 1, PAL.eye); R(g, 14, 6, 2, 1, PAL.eye); R(g, 13, 8, 1, 1, PAL.skinSh);   // глаза и нос
  outline(g);
  return c;
}
const SPRITES = { walk: [], idle: [], blink: null, back: null, backWalk: [], frontWalk: [] };
/* ART-TECH-001 — ИССЛЕДОВАТЕЛЬСКИЙ прототип детализированного Глеба (рабочий кандидат 52×84, НЕ утверждён). Только DEV / ?debug и только с ?hd.
   Тот же рост в мире (42 мировых px): исходная сетка вдвое мельче, рисуется поверх кадра в экранном разрешении.
   Детали нарисованы в сетке 52×84 (не растяжение 26×42): швы, карманы, зубцы молнии, лямки с пряжками, завязки скатки,
   пальцы перчаток, шнурки, подошвы, заплата на колене, вязка шарфа, пряди, бровь, нос, ухо. Мимики нет. */
const HD_W = 52, HD_H = 84;
function drawHeroHD(o, PAL = HERO_PAL) {
  const c = makeCanvas(HD_W, HD_H), g = c.getContext('2d', { willReadFrequently: true }), b = o.bob * 2;
  const P = (x, y, w, h, col) => R(g, x, y, w, h, col);
  const dk = (hex, k = 0.78) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16 & 255) * k | 0},${(n >> 8 & 255) * k | 0},${(n & 255) * k | 0})`; };
  const leg = (hx, fx, lift, col, colSh, near) => {
    const hy = 54 + b, fy = 76 - lift * 2, kx = Math.round((hx + fx) / 2 + 2 + (lift ? 2 : 0)), ky = Math.round((hy + fy) / 2);
    L(g, hx, hy, kx, ky, col, 6); L(g, kx, ky, fx, fy, col, 6);
    L(g, hx + 2, hy + 1, kx + 2, ky, colSh, 1); L(g, kx + 2, ky, fx + 2, fy, colSh, 1);                 // боковой шов штанины
    if (near) { P(kx - 2, ky - 2, 5, 4, dk(col, 0.85)); P(kx - 2, ky - 2, 5, 1, colSh); P(kx - 1, ky, 1, 1, '#b8a888'); P(kx + 2, ky, 1, 1, '#b8a888'); }   // заплата на колене со стежками
    P(fx - 3, fy - 3, 8, 3, colSh);                                                                      // подгиб над ботинком
    P(fx - 3, fy + 2, 11, 5, PAL.boot); P(fx - 3, fy + 2, 11, 1, PAL.bootHi); P(fx - 3, fy + 6, 12, 1, '#0e0f12');   // ботинок, подошва
    P(fx + 1, fy + 3, 1, 1, '#8a8478'); P(fx + 3, fy + 3, 1, 1, '#8a8478'); P(fx + 5, fy + 4, 2, 1, PAL.bootHi);       // шнурки, носок
  };
  const arm = (hx, col, near) => {
    const sx = 26, sy = 32 + b, ex = 26 + hx, ey = 42 + b, wx = 26 + hx * 2, wy = 50 + b;
    L(g, sx, sy, ex, ey, col, 6); L(g, ex, ey, wx, wy, col, 6);
    if (near) { L(g, sx + 2, sy, ex + 2, ey, dk(col, 1.15), 1); P(ex - 2, ey - 1, 5, 1, dk(col, 0.8)); }   // блик и складка на локте
    P(wx - 3, wy + 1, 7, 2, dk(col, 0.7));                                                              // манжета
    P(wx - 3, wy + 2, 6, 4, PAL.glove); P(wx - 3, wy + 5, 6, 1, dk(PAL.glove, 0.75)); P(wx - 1, wy + 2, 1, 4, dk(PAL.glove, 0.8)); P(wx + 1, wy + 2, 1, 4, dk(PAL.glove, 0.8));   // перчатка, пальцы
  };
  arm(o.armBack, PAL.jacketSh, false);
  leg(24, 24 + o.legBack.f * 2, o.legBack.lift, PAL.pantsSh, dk(PAL.pantsSh, 0.8), false);
  // рюкзак со скаткой
  P(6, 22 + b, 16, 8, PAL.roll); P(6, 22 + b, 2, 8, PAL.rollSh); P(20, 22 + b, 2, 8, PAL.rollSh); P(6, 22 + b, 16, 1, '#a89c7e');
  for (let k = 0; k < 3; k++) P(8 + k * 5, 23 + b, 1, 6, dk(PAL.roll, 0.82));                       // витки скатки
  P(10, 21 + b, 2, 10, '#3a3028'); P(17, 21 + b, 2, 10, '#3a3028');                                   // ремни скатки
  P(8, 30 + b, 12, 24, PAL.pack); P(8, 30 + b, 12, 5, PAL.packHi); P(18, 30 + b, 2, 24, PAL.packSh); P(8, 52 + b, 12, 2, PAL.packSh);
  P(9, 38 + b, 9, 7, dk(PAL.pack, 0.88)); P(9, 38 + b, 9, 1, PAL.packHi); P(13, 41 + b, 2, 2, '#9a8a5a');   // накладной карман с пряжкой
  // куртка
  P(18, 28 + b, 18, 28, PAL.jacket); P(18, 28 + b, 18, 3, PAL.jacketHi); P(34, 32 + b, 2, 22, PAL.jacketSh);
  P(18, 31 + b, 1, 23, dk(PAL.jacket, 0.9)); for (let y = 34; y < 52; y += 6) P(19, y + b, 6, 1, dk(PAL.jacket, 0.88));   // складки спины
  P(30, 32 + b, 2, 18, PAL.zip); for (let y = 33; y < 50; y += 2) P(31, y + b, 1, 1, dk(PAL.zip, 0.6));   // молния с зубцами
  P(24, 42 + b, 6, 5, PAL.jacketSh); P(24, 42 + b, 6, 1, dk(PAL.jacket, 0.7)); P(26, 43 + b, 2, 1, PAL.zip);   // карман с клапаном и кнопкой
  P(18, 50 + b, 18, 4, PAL.belt); P(30, 50 + b, 4, 4, PAL.buckle); P(31, 51 + b, 2, 2, dk(PAL.buckle, 0.7)); P(22, 50 + b, 1, 4, '#4a443c');   // ремень, пряжка, шлёвка
  P(18, 54 + b, 18, 2, PAL.jacketSh);
  P(20, 30 + b, 2, 20, PAL.packSh); P(20, 40 + b, 3, 3, '#7a7058');                                   // лямка рюкзака с пряжкой
  leg(28, 28 + o.legFront.f * 2, o.legFront.lift, PAL.pants, PAL.pantsSh, true);
  // шарф: вязка, хвост
  P(20, 24 + b, 16, 6, PAL.scarf); P(20, 28 + b, 16, 2, PAL.scarfSh); for (let x = 21; x < 36; x += 3) P(x, 25 + b, 1, 3, dk(PAL.scarf, 0.85));
  P(16 - o.tail * 2, 28 + b, 4, 12, PAL.scarf); P(16 - o.tail * 2, 38 + b, 4, 2, PAL.scarfSh); P(16 - o.tail * 2, 40 + b, 1, 2, PAL.scarf); P(18 - o.tail * 2, 40 + b, 1, 2, PAL.scarf);   // хвост с бахромой
  // голова
  P(22, 8 + b, 14, 16, PAL.skin); P(22, 22 + b, 14, 2, PAL.skinSh); P(36, 16 + b, 2, 4, PAL.skin); P(37, 18 + b, 1, 2, PAL.skinSh);   // лицо, нос
  P(26, 15 + b, 3, 5, PAL.skinSh); P(27, 16 + b, 1, 3, dk(PAL.skin, 0.65));                           // ухо
  P(20, 4 + b, 16, 6, PAL.hair); P(20, 10 + b, 4, 10, PAL.hair); P(34, 8 + b, 2, 2, PAL.hair);
  for (let x = 22; x < 34; x += 3) P(x, 4 + b, 1, 3, PAL.hairHi);                                      // пряди
  P(26, 4 + b, 6, 1, PAL.hairHi); P(21, 10 + b, 1, 8, PAL.hairHi);
  if (o.blink) P(32, 14 + b, 4, 1, PAL.skinSh); else { P(32, 14 + b, 2, 2, PAL.eye); P(34, 14 + b, 1, 1, '#e8e0d0'); }
  P(31, 12 + b, 5, 1, PAL.hair);                                                                       // бровь
  P(34, 20 + b, 2, 1, PAL.skinSh); P(23, 21 + b, 6, 1, dk(PAL.skin, 0.9));                              // рот, линия челюсти
  arm(o.armFront, PAL.jacket, true);
  outline(g, HD_W, HD_H);
  return c;
}
const HD = { on: false, map: new Map(), buildMs: 0, frameMs: 0, frames: 0, snap: false, tmp: null };
/** Прототип: те же позы, что у personSet героя (8 шагов, 2 стоя, моргание) — соответствие обычный кадр → HD-кадр. */
function buildHeroHD() {
  const t0 = performance.now(), mk = o => drawHeroHD(o, HERO_PAL);
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * Math.PI * 2, lift = q => (Math.cos(q) > 0.3 ? (Math.cos(q) > 0.8 ? 2 : 1) : 0);
    HD.map.set(SPRITES.walk[i], mk({ legFront: { f: Math.round(Math.sin(p) * 5), lift: lift(p) }, legBack: { f: Math.round(Math.sin(p + Math.PI) * 5), lift: lift(p + Math.PI) },
      armFront: Math.round(-Math.sin(p) * 4), armBack: Math.round(Math.sin(p) * 4), bob: Math.abs(Math.sin(p)) > 0.6 ? 1 : 0, tail: 1, blink: false }));
  }
  const stand = { legFront: { f: 1, lift: 0 }, legBack: { f: -1, lift: 0 }, armFront: 0, armBack: 1, tail: 0 };
  HD.map.set(SPRITES.idle[0], mk({ ...stand, bob: 0, blink: false })); HD.map.set(SPRITES.idle[1], mk({ ...stand, bob: 1, blink: false }));
  HD.map.set(SPRITES.blink, mk({ ...stand, bob: 0, blink: true }));
  HD.buildMs = performance.now() - t0;
}

/* Палитры жителей: та же фигура, другая одежда. */
const GUARD_PAL  = { ...HERO_PAL, jacket: '#4c535c', jacketHi: '#636b75', jacketSh: '#383e45', zip: '#2a2e33', scarf: '#33373c', scarfSh: '#26292d',
  pants: '#2f3338', pantsSh: '#24272b', hair: '#2a2420', skin: '#b88a6c', skinSh: '#8c6450' };
const WORKER_PAL = { ...HERO_PAL, jacket: '#8a6a3a', jacketHi: '#a3824e', jacketSh: '#6a5030', zip: '#5a4228', scarf: '#4a5a6a', scarfSh: '#36424e',
  pants: '#4a4030', pantsSh: '#3a3226', hair: '#3a2a20' };
const WORKER2_PAL = { ...HERO_PAL, jacket: '#3e5a6a', jacketHi: '#527484', jacketSh: '#2e4450', zip: '#9aa4a8', scarf: '#8a6a3a', scarfSh: '#6a5030',
  pants: '#3a3e44', pantsSh: '#2c2f34', skin: '#a87a5c', skinSh: '#7c5640', hair: '#1e1a18' };
const MEDIC_PAL  = { ...HERO_PAL, jacket: '#c4c6bc', jacketHi: '#dcded4', jacketSh: '#9a9c92', zip: '#8a8c84', scarf: '#c4c6bc', scarfSh: '#9a9c92',
  pants: '#3a4048', pantsSh: '#2c3138', hair: '#6a5040', skin: '#d4a484' };
const RES_A_PAL  = { ...HERO_PAL, jacket: '#6a5a4a', jacketHi: '#7e6c5a', jacketSh: '#4e4236', zip: '#4e4236', scarf: '#7a7a6a', scarfSh: '#5a5a4e', hair: '#5a4030' };
const RES_B_PAL  = { ...HERO_PAL, jacket: '#4a5a6a', jacketHi: '#5e7080', jacketSh: '#384450', zip: '#384450', scarf: '#a08a5a', scarfSh: '#7a6a44',
  hair: '#1e1a18', skin: '#a87a5c', skinSh: '#7c5640' };
const RES_C_PAL  = { ...HERO_PAL, jacket: '#7a4a4a', jacketHi: '#905a58', jacketSh: '#5a3636', zip: '#5a3636', scarf: '#b8a888', scarfSh: '#8a7c64',
  hair: '#8a6a4a', hairHi: '#a88a62', skin: '#d8a888' };

/** Сидящий житель: табурет, согнутые ноги, руки на коленях. b — дыхание. */
function drawSitFrame(PAL, b, o = {}) {
  const c = makeCanvas(SPRITE_W, SPRITE_H), g = c.getContext('2d', { willReadFrequently: true });
  R(g, 7, 34, 12, 2, '#5e4630'); R(g, 7, 34, 12, 1, '#7a5c40'); R(g, 8, 36, 2, 5, '#3e2e20'); R(g, 16, 36, 2, 5, '#3e2e20');
  R(g, 11, 31, 9, 3, PAL.pantsSh); R(g, 18, 31, 3, 8, PAL.pantsSh); R(g, 18, 39, 5, 2, PAL.boot);
  L(g, 12, 22 + b, 18, 29, PAL.jacketSh, 3);                            // дальняя рука
  R(g, 9, 20 + b, 9, 13 - b, PAL.jacket); R(g, 9, 20 + b, 9, 2, PAL.jacketHi); R(g, 15, 22 + b, 1, 8 - b, PAL.zip); R(g, 9, 31, 9, 2, PAL.belt);
  R(g, 12, 32, 10, 3, PAL.pants); R(g, 19, 32, 3, 7, PAL.pants); R(g, 19, 39, 5, 2, PAL.boot); R(g, 19, 39, 5, 1, PAL.bootHi);
  R(g, 10, 18 + b, 8, 3, PAL.scarf); R(g, 10, 20 + b, 8, 1, PAL.scarfSh);
  R(g, 11, 10 + b, 7, 8, PAL.skin); R(g, 11, 17 + b, 7, 1, PAL.skinSh); R(g, 18, 14 + b, 1, 2, PAL.skin);
  R(g, 10, 8 + b, 8, 3, PAL.hair); R(g, 10, 11 + b, 2, 5, PAL.hair); R(g, 13, 8 + b, 3, 1, PAL.hairHi); R(g, 13, 14 + b, 1, 2, PAL.skinSh);
  if (o.blink) R(g, 16, 13 + b, 2, 1, PAL.skinSh); else { R(g, 16, 13 + b, 1, 1, PAL.eye); R(g, 16, 12 + b, 2, 1, PAL.hair); }
  R(g, 17, 16 + b, 1, 1, PAL.skinSh);
  if (o.hat) { R(g, 9, 7 + b, 10, 4, o.hat); R(g, 9, 7 + b, 10, 1, 'rgba(255,255,255,.2)'); R(g, 10, 11 + b, 10, 1, 'rgba(0,0,0,.35)'); }
  headExtras(g, o, PAL, 6 + b); bodyExtras(g, o, PAL, b, true);         // NPC-001: только при заданных опциях
  L(g, 13, 22 + b, 16, 27, PAL.jacket, 3); L(g, 16, 27, 19, 30, PAL.jacket, 3); R(g, 18, 30, 3, 2, PAL.glove);   // ближняя рука на колене
  if (o.gun) { R(g, 6, 29, 17, 2, '#222426'); R(g, 4, 29, 3, 3, '#4a3a2a'); }
  outline(g);
  return c;
}
/** Границы непрозрачной части канваса. */
function alphaBox(c) {
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++)
    if (d[(y * c.width + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** Спящий: кадр стоя с закрытыми глазами, повёрнутый на 90° (голова слева), под одеялом. rise — дыхание одеяла. */
function makeLying(PAL, rise, blanket, look = {}) {                    // look — детали облика NPC-001 (голова); прежние спящие — без них
  const src = drawPersonFrame({ ...look, legFront: { f: 1, lift: 0 }, legBack: { f: -1, lift: 0 }, armFront: 0, armBack: 1, tail: 0, bob: 0, blink: true, noPack: true }, PAL);
  const c = makeCanvas(SPRITE_H, SPRITE_W), g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false; g.translate(0, SPRITE_W); g.rotate(-Math.PI / 2); g.drawImage(src, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
  const bb = alphaBox(c), bx = bb.x + Math.round(bb.w * 0.34);
  R(g, bx, bb.y + 1 - rise, bb.x + bb.w - bx, bb.h - 1 + rise, blanket); R(g, bx, bb.y + 1 - rise, bb.x + bb.w - bx, 1, 'rgba(255,255,255,.16)');
  R(g, bx, bb.y + 1 - rise, 1, bb.h - 1 + rise, '#0b0d10');
  return { c, bb: alphaBox(c) };
}
/** Мутант: сгорбленный, длинные руки до земли. 6 кадров походки, лицом вправо. */
const MUT_W = 34, MUT_H = 40;
/** 1.0: свинья 22×13 — шаг (4 кадра) и поворот головы (head 1 — морда к земле). */
const PIG_W = 22, PIG_H = 13;
function drawPigFrame(i, head) {
  const c = makeCanvas(PIG_W, PIG_H), g = c.getContext('2d'), body = '#c49a8a', sh = '#9a7468', dark = '#5e4038', hi = '#dcb4a2';
  const lg = [[1, 0], [0, 1], [-1, 0], [0, -1]][i % 4];
  [[4, lg[0]], [8, -lg[0]], [13, lg[1]], [17, -lg[1]]].forEach(([x, o]) => R(g, x + o, 9, 2, 4, sh));   // ноги
  R(g, 3, 3, 16, 7, body); R(g, 4, 2, 14, 1, body); R(g, 4, 3, 13, 1, hi); R(g, 3, 9, 16, 1, sh);
  R(g, 1, 4, 2, 2, sh); R(g, 0, 3, 1, 1, sh);                            // хвостик
  const hy = head ? 5 : 3;
  R(g, 18, hy, 4, 5, body); R(g, 21, hy + 2, 1, 3, '#b07c70'); R(g, 21, hy + 3, 1, 1, dark);   // голова и пятачок
  R(g, 18, hy - 1, 2, 2, sh); R(g, 19, hy + 1, 1, 1, dark);              // ухо и глаз
  return c;
}
function drawMutantFrame(i) {
  const c = makeCanvas(MUT_W, MUT_H), g = c.getContext('2d', { willReadFrequently: true }), p = (i / 6) * Math.PI * 2;
  const skin = '#8a9578', sh = '#5f6b55', dark = '#2e352b', rag = '#4a3e34', ragSh = '#352c24';
  const leg = (hx, ff, lift, col) => { const fy = 37 - lift; R(g, hx - 1, 26, 3, 5, col); L(g, hx, 30, hx + ff, fy, col, 3); R(g, hx + ff - 1, fy + 1, 5, 2, dark); };
  const f = Math.round(Math.sin(p) * 5);
  leg(13, -f, Math.cos(p + Math.PI) > 0.3 ? 1 : 0, sh);
  for (let y = 11; y <= 28; y++) { const t = (y - 11) / 17, cx = Math.round(23 - t * 9), half = Math.round(4 + Math.sin(t * Math.PI) * 2.5);
    R(g, cx - half, y, half * 2, 1, y < 22 ? skin : rag); }
  for (let k = 0; k < 4; k++) R(g, 18 - k * 2, 12 + k * 3, 1, 1, sh);   // позвонки
  R(g, 11, 24, 12, 1, ragSh);
  disc(g, 27, 15, 4, skin); R(g, 27, 18, 5, 2, sh); R(g, 29, 19, 3, 1, '#1a1a14'); R(g, 28, 13, 1, 1, '#1a1a14');
  leg(16, f, Math.cos(p) > 0.3 ? 1 : 0, skin);
  const sw = Math.round(-Math.sin(p) * 3);
  L(g, 22, 15, 24 + sw, 25, skin, 2); L(g, 24 + sw, 25, 26 + sw, 34, skin, 2); R(g, 25 + sw, 35, 3, 2, dark);
  outline(g, MUT_W, MUT_H);
  return c;
}
/** Набор кадров одного персонажа: ходьба, дыхание, моргание; по запросу — сидя и лёжа. */
/** NPC-001: наборы кадров всех обликов CONFIG.LOOKS — ключ «архетип.номер». Тот же генератор personSet, что у Глеба и прежних жителей. */
/** NPC-001: лист галереи — по строке на архетип: 3 облика × (стоит, шаг, сидит, лежит). Подпись — «[ПРЕДЛОЖЕНИЕ]». */
function lookSheet(k = 3) {
  const A = Object.entries(CONFIG.LOOKS.ARCHETYPES), cw = 26 * 3 + 42 + 14, rh = 66, lw = 120;
  const c = makeCanvas((lw + cw * 3) * k, (A.length * rh + 22) * k), g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.scale(k, k); g.fillStyle = '#14181a'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#e0c48c'; g.font = '9px monospace'; g.fillText(`NPC-002 · ${A.length} архетипов × 3 облика · временная техническая база [ПРЕДЛОЖЕНИЕ]`, 6, 12);
  A.forEach(([id, a], r) => {
    const y = 22 + r * rh; g.fillStyle = '#c8c0a8'; g.fillText(a.label, 6, y + 28); g.fillStyle = '#7a8284'; g.fillText(id, 6, y + 40);
    a.variants.forEach((v, i) => {
      const s = SETS[id + '.' + i], x = lw + i * cw; g.fillStyle = '#1e2426'; g.fillRect(x, y, cw - 6, rh - 6);
      g.drawImage(s.idle[0], x + 2, y + 4); g.drawImage(s.walk[2], x + 28, y + 4); g.drawImage(s.sit[0], x + 54, y + 4);
      g.drawImage(s.lie[0].c, x + 80, y + 18); g.fillStyle = '#7a8284'; g.fillText(id + '.' + i, x + 2, y + 56);
    });
  });
  return c;
}
/** NPC-001: отчёт по обликам для проверок (?debug): кадры, общая граница непрозрачных пикселей, отпечаток пикселей набора. */
function lookReport() {
  const fp = cs => { let h = 0x811c9dc5; for (const c of cs) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 3) { h ^= d[i]; h = Math.imul(h, 0x01000193) >>> 0; } } return h.toString(16); };
  const out = {};
  for (const [id, s] of Object.entries(SETS)) {
    if (!s.walk || !s.idle || id === 'pig' || id === 'mutant') continue;
    const frames = [...s.walk, ...s.idle, s.blink, ...(s.sit || []), ...(s.lie || []).map(l => l.c)].filter(Boolean);
    const st = [...s.walk, ...s.idle, s.blink, ...(s.sit || [])].filter(Boolean).map(alphaBox);
    out[id] = { frames: frames.length, sit: (s.sit || []).length, lie: (s.lie || []).length, w: frames[0].width, h: frames[0].height,
      box: { x0: Math.min(...st.map(b => b.x)), y0: Math.min(...st.map(b => b.y)), x1: Math.max(...st.map(b => b.x + b.w)), y1: Math.max(...st.map(b => b.y + b.h)) }, fp: fp(frames) };
  }
  out.hero = { fp: fp([...SPRITES.walk, ...SPRITES.idle, SPRITES.blink, SPRITES.back, ...SPRITES.backWalk, ...SPRITES.frontWalk]) };
  return out;
}
function buildLookSets() {
  const L = CONFIG.LOOKS; let k = 0;
  for (const [id, A] of Object.entries(L.ARCHETYPES)) A.variants.forEach((v, i) => {
    const { pack, ...rest } = v.opts;
    SETS[id + '.' + i] = personSet({ ...HERO_PAL, ...v.pal }, { ...rest, look: true, noPack: !pack, sit: true, blanket: L.BLANKETS[k++ % L.BLANKETS.length] });
  });
}
function personSet(pal, o = {}) {
  const set = { walk: [], idle: [], blink: null, sit: [], lie: [] };
  for (let i = 0; i < 8; i++) {                                          // 8 кадров ходьбы
    const p = (i / 8) * Math.PI * 2, lift = q => (Math.cos(q) > 0.3 ? (Math.cos(q) > 0.8 ? 2 : 1) : 0);
    set.walk.push(drawPersonFrame({ ...o, legFront: { f: Math.round(Math.sin(p) * 5), lift: lift(p) }, legBack: { f: Math.round(Math.sin(p + Math.PI) * 5), lift: lift(p + Math.PI) },
      armFront: Math.round(-Math.sin(p) * 4), armBack: Math.round(Math.sin(p) * 4), bob: Math.abs(Math.sin(p)) > 0.6 ? 1 : 0, tail: 1, blink: false }, pal));
  }
  const stand = { ...o, legFront: { f: 1, lift: 0 }, legBack: { f: -1, lift: 0 }, armFront: o.gun ? 3 : 0, armBack: 1, tail: 0 };
  set.idle.push(drawPersonFrame({ ...stand, bob: 0, blink: false }, pal), drawPersonFrame({ ...stand, bob: 1, blink: false }, pal));
  set.blink = drawPersonFrame({ ...stand, bob: 0, blink: true }, pal);
  if (o.sit) set.sit.push(drawSitFrame(pal, 0, o), drawSitFrame(pal, 1, o));
  if (o.blanket) { const look = o.look ? { hairStyle: o.hairStyle, beard: o.beard, hood: o.hood, cap: o.cap, capC: o.capC } : {};   // NPC-001
    set.lie.push(makeLying(pal, 0, o.blanket, look), makeLying(pal, 1, o.blanket, look)); }
  return set;
}
const SETS = {};
function buildSprites() {
  Object.assign(SPRITES, personSet(HERO_PAL));
  SPRITES.back = drawBackFrame();
  SPRITES.backWalk = [0, 1, 2].map(k => drawBackFrame(HERO_PAL, k));      // 1.0.1: шаги вглубь арки
  SPRITES.frontWalk = [0, 1, 2].map(k => drawFrontFrame(HERO_PAL, k));    // 1.0.1: шаги из арки к зрителю
  SETS.guard   = personSet(GUARD_PAL,   { hat: '#3e4636', gun: true, noPack: true, sit: true });
  SETS.worker  = personSet(WORKER_PAL,  { hat: '#c8a03c', noPack: true });
  SETS.worker2 = personSet(WORKER2_PAL, { hat: '#b8b8b0', noPack: true });
  SETS.medic   = personSet(MEDIC_PAL,   { noPack: true });
  SETS.resA    = personSet(RES_A_PAL,   { noPack: true, sit: true, blanket: '#7a3b34' });
  SETS.resB    = personSet(RES_B_PAL,   { noPack: true, sit: true, blanket: '#465a6c' });
  SETS.resC    = personSet(RES_C_PAL,   { noPack: true, sit: true });
  SETS.mutant  = { walk: [0, 1, 2, 3, 4, 5].map(drawMutantFrame) };
  buildLookSets();                                                        // NPC-001: 8 архетипов × 3 облика
  SETS.pig     = { walk: [0, 1, 2, 3].map(i => drawPigFrame(i, 0)), idle: [drawPigFrame(0, 0), drawPigFrame(0, 1)] };   // 1.0
}

