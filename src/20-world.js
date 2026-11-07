/* ================================ WORLD ==================================
   Мир собирается один раз при загрузке в три канваса-слоя:
   back  (параллакс 0.9) — дальняя стена зала;
   main  (1.0)          — верхний ярус с комнатами, перекрытие, колонны, платформа, пути;
   fore  (1.22)         — тёмные силуэты переднего плана.
   Параллельно заполняются списки источников света и «светящихся» элементов. */
const SURF_H = 280 - (CONFIG.FLOORS.surface.y + 61);   // слой поверхности над станцией (0.9: земля поднята на 61 — небо прежней высоты)
const GROUND_Y = CONFIG.FLOORS.surface.y;
const surfRow = y => y + SURF_H;        // мировой y → строка канваса поверхности
// Области, за которые не выходит свет: зал (ниже перекрытия) и полоса верхнего яруса.
const HALL_CLIP = { x0: -Infinity, x1: Infinity, y0: 108, y1: 270 };   // 1.0: свет зала не уходит под пути, на ярус −2
const UPPER_CLIP = { x0: -Infinity, x1: Infinity, y0: 15, y1: 107 };
const SURF_CLIP = { x0: -Infinity, x1: Infinity, y0: -SURF_H, y1: CONFIG.FLOORS.surface.y + 11 };
const VEST_CLIP = { x0: -Infinity, x1: Infinity, y0: 19 + CONFIG.FLOORS.vestibule.y - CONFIG.FLOORS.upper.y, y1: 100 + CONFIG.FLOORS.vestibule.y - CONFIG.FLOORS.upper.y };
/** 1.0: ярус −2 — отдельный заранее нарисованный канвас во всю ширину мира, y [270, WORLD_BOTTOM). */
const UTIL = { y0: H, y1: CONFIG.FLOORS.utility.y + 24 };
const WORLD_BOTTOM = UTIL.y1;
const UTIL_CLIP = { x0: -Infinity, x1: Infinity, y0: 19 + CONFIG.FLOORS.utility.y - CONFIG.FLOORS.upper.y, y1: 100 + CONFIG.FLOORS.utility.y - CONFIG.FLOORS.upper.y };
/** 0.9: слой вестибюля — отдельный заранее нарисованный канвас в мировых координатах [VX0, VX1) × [VY0, 0). */
const VEST = { x0: 1160, x1: 1880, y0: CONFIG.FLOORS.surface.y - 4, shell: [1170, 1870, -106] };
const WORLD = { sky: null, ruins: null, surface: null, vest: null, util: null, rubble: null, foreBare: null, gate: null, back: null, main: null, fore: null, lights: [], emissive: [], drips: [], fire: null, spark: null };

/** Регистрирует источник света. layer: 'main' | 'back'. circuit — цепь питания; не задана — определится по зоне
    (assignCircuits), null — неэлектрический источник. */
function addLight(x, y, r, color, mode = 'steady', power = 1, layer = 'main', circuit) {
  const l = { x, y: y + ROOM_DY, r, c: color, mode, power, layer, circuit, seed: (rand() * 1000) | 0, i: 1, pool: false };
  WORLD.lights.push(l); return l;
}
/** Регистрирует светящийся элемент (лампочка, экран, индикатор), рисуемый поверх освещения. */
function addEmissive(x, y, w, h, color, light = null, layer = 'main', mode = null, circuit) {
  WORLD.emissive.push({ x, y: y + ROOM_DY, w, h, c: color, light, layer, mode, circuit, seed: (rand() * 1000) | 0 });
}
/** Красный аварийный маяк: корпус на слое, свечение и свет — в цепи emergency (горит только от аккумулятора). */
function addBeacon(g, x, y) {
  R(g, x - 3, y - 1, 7, 5, '#2a1a18'); R(g, x - 2, y, 5, 3, '#4a2420');
  const room = roomAt(x, y + ROOM_DY);
  const l = addLight(x, y + 1, room ? 52 : 78, [255, 48, 36], 'pulse', 1.3, 'main', 'emergency');
  l.clip = room ? roomClip(room) : HALL_CLIP;
  addEmissive(x - 2, y, 5, 3, [255, 66, 48], l, 'main', null, 'emergency');
}
/** Аварийный светильник в помещении (0.8.1): короб с красноватым стеклом, ровный свет цепи emergency, только внутри комнаты. */
function addEmergencyLamp(g, e) {
  const r = ROOMS.find(x => x.id === e.room), { x, y } = e;                 // координаты мировые (у вестибюля y < 0)
  R(g, x - 4, y - 2, 9, 5, '#2a2e30'); R(g, x - 3, y - 1, 7, 3, '#5a3430'); R(g, x - 4, y - 2, 9, 1, '#4a4e50');
  const l = addLight(x, y + 3, 54, [255, 104, 80], 'steady', 0.85, 'main', 'emergency');
  l.clip = roomClip(r);
  addEmissive(x - 3, y - 1, 7, 2, [255, 128, 104], l, 'main', null, 'emergency');
}
const BEACONS = [[500, 142], [980, 142], [1460, 142], [800, 30], [1010, 30], [1430, 30]];   // [x, y] на колоннах и в комнатах
/** 0.9: этаж по мировому y (свет, цепи, клипы — по этажам, а не по знаку y). */
function floorAtY(y) {
  if (y < GROUND_Y + 12) return 'surface';
  if (y < 8) return 'vestibule';
  if (y < 108) return 'upper';
  return y < 276 ? 'platform' : 'utility';
}
/** Комната яруса или вестибюля в точке мира. */
function roomAt(x, y) {
  const f = floorAtY(y);
  return ROOM_FLOORS.includes(f) ? ROOMS.find(r => roomFloor(r) === f && x >= r.x && x < r.x + r.w) || null : null;
}
/** Прямоугольник, за который не выходит свет комнаты. */
function roomClip(r) { const dy = roomDY(r); return { x0: r.x + 4, x1: r.x + r.w - 4, y0: 19 + dy, y1: 100 + dy }; }
/** Цепи для приборов, у которых она не задана: огонь — null, свечение с источником — как у источника, остальное — по зоне. */
function assignCircuits() {
  const zone = (x, y, layer) => {
    const mx = layer === 'back' ? (x - 25) / CONFIG.PARALLAX.BACK : x;
    const f = floorAtY(y);
    if (f === 'surface') return CONFIG.CIRCUIT_ZONES.surface;
    if (ROOM_FLOORS.includes(f)) { const r = roomAt(mx, y); return r ? r.circuit : 'technical'; }
    return CONFIG.CIRCUIT_ZONES.hall.find(([to]) => mx < to)[1];
  };
  for (const l of WORLD.lights) if (l.circuit === undefined) l.circuit = l.mode === 'fire' ? null : zone(l.x, l.y, l.layer);
  for (const e of WORLD.emissive) if (e.circuit === undefined) e.circuit = e.light ? e.light.circuit : zone(e.x, e.y, e.layer);
}

/* ---------- MAIN: базовые текстуры (камень, перекрытие, платформа, пути) ---------- */
function mainTexel(x, y, o) {
  const n = (hash(x, y) - 0.5) * 10;
  if (y < 15 && x >= VEST.shell[0] && x < VEST.shell[1]) {          // 0.9: плита между вестибюлем и ярусом 0
    let v = 68 + n * 1.2; if (x % 48 === 0 || x % 48 === 1) v -= 13; if (y >= 13) v -= 30;
    return setC(o, v - 4, v, v + 1);
  }
  if (y < 108) {                                    // толща грунта/бетона вокруг верхнего яруса
    const s = Math.sin(y * 0.45 + Math.sin(x * 0.021) * 2.2) * 3;
    const crack = hash(x >> 3, y >> 1) > 0.985 ? -8 : 0;
    return setC(o, 25, 27, 31, n * 0.8 + s + crack);
  }
  if (y < 122) {                                    // межэтажное перекрытие
    if (y === 108) return setC(o, 112, 114, 106, n);
    if (y === 109) return setC(o, 86, 90, 87, n);
    if (y >= 119) return setC(o, 30, 33, 36, n * 0.6);
    let v = 68 + n * 1.2;
    if (x % 48 === 0 || x % 48 === 1) v -= 13;      // швы опалубки
    if (hash(x >> 1, 5) > 0.93 && y > 112) v -= 11; // потёки
    return setC(o, v - 4, v, v + 1);
  }
  if (y < 214) return false;                        // зал — прозрачен, там видна дальняя стена
  if (y < 222) {                                    // настил платформы: два ряда плит
    const row = y < 218 ? 0 : 1, tw = row ? 26 : 22, off = row ? 9 : 0;
    const seam = (x + off) % tw === 0 || y === 214 || y === 218;
    let v = (((x + off) / tw | 0) + row) % 2 ? 90 : 82;
    if (seam) v -= 28;
    if (y === 214) v -= 18;
    if (hash(x >> 2, y >> 1) > 0.94) v -= 14;       // грязь, сколы
    return setC(o, v + 6, v, v - 10, n * 0.9);
  }
  if (y === 222) return setC(o, 128, 120, 100, n);  // гранитная кромка
  if (y === 223) {                                  // стёртая жёлтая полоса
    const dash = (x % 14) < 9 && hash(x >> 1, 223) > 0.22;
    return dash ? setC(o, 184, 156, 84, n) : setC(o, 104, 98, 82, n);
  }
  if (y === 224) return setC(o, 90, 84, 72, n);
  if (y === 225) return setC(o, 44, 42, 40, n * 0.5);
  if (y < 231) {                                    // торец платформы
    const stain = hash(x >> 1, 7) > 0.9 ? -8 : 0;
    return setC(o, 30, 33, 36, n * 0.7 + stain);
  }
  // Путевая зона на переднем плане.
  if (y < 236) return setC(o, 19, 22, 25, n * 0.5);
  if (y === 236) return setC(o, 78, 72, 58, n);     // кожух контактного рельса
  if (y === 237) return setC(o, 54, 50, 42, n);
  if (y < 240) return setC(o, (x % 50) < 4 ? 70 : 34, (x % 50) < 4 ? 66 : 36, (x % 50) < 4 ? 58 : 38, n);
  if (y === 247) return setC(o, 156, 152, 140, n);  // дальний рельс
  if (y === 248) return setC(o, 110, 108, 100, n);
  if (y === 249 || y === 250) return setC(o, 62, 60, 56, n);
  if (y === 258) return setC(o, 176, 170, 152, n);  // ближний рельс
  if (y === 259) return setC(o, 132, 126, 112, n);
  if (y >= 260 && y <= 262) return setC(o, 76, 72, 64, n);
  if (y >= 251 && y <= 257 && (x % 22) < 12) {      // шпалы
    const edge = (x % 22) === 0 || (x % 22) === 11 || y === 251;
    return setC(o, edge ? 42 : 60, edge ? 36 : 50, edge ? 30 : 40, n);
  }
  // Балласт; к низу кадра темнее (дизеринг).
  const dark = dither(x, y) < (y - 240) / 40 ? 0.62 : 1;
  const stone = hash(x >> 1, y >> 1) > 0.7 ? 8 : 0;
  // Лужи с отражением.
  if (y >= 264 && y <= 267 && Math.sin(x * 0.013) > 0.72) return setC(o, 44, 56, 64, n * 0.6 + (y === 264 ? 10 : 0));
  return setC(o, (32 + stone) * dark, (34 + stone) * dark, (35 + stone) * dark, n * 0.7);
}

/* ---------- MAIN: верхний ярус (декоративные помещения в разрезе) ---------- */
const ROOMS = [
  { id: 'hero-room',  x: 10,   w: 180, label: 'КОМНАТА',    type: 'hero',     tint: [98, 78, 58],  light: [255, 188, 118], circuit: 'living' },   // 1.1А: дом героя, точка старта
  { id: 'habitation', x: 200,  w: 270, label: 'ЖИЛОЙ БЛОК', type: 'bunks',    tint: [92, 76, 60],  light: [255, 196, 130], circuit: 'living' },   // 1.1А: 140/290 → 200/270
  { id: 'kitchen',    x: 480,  w: 250, label: 'СТОЛОВАЯ',   type: 'kitchen',  tint: [96, 80, 60],  light: [255, 190, 120], circuit: 'living' },   // 1.1А: 440/290 → 480/250
  { id: 'stairwell',  x: 740,  w: 120, label: 'ЛЕСТНИЦА', plate: null, type: 'stairwell', tint: [72, 74, 72], light: [255, 206, 150], circuit: 'platform' },  // 1.0: без крупной таблички (указатели ЖИЛЬЁ/ТЕХ остаются)
  { id: 'workshop',   x: 870,  w: 280, label: 'МАСТЕРСКАЯ', type: 'workshop', tint: [62, 84, 74],  light: [255, 206, 150], circuit: 'technical' },
  { id: 'medical',    x: 1160, w: 150, label: 'МЕДПУНКТ',   type: 'medbay',   tint: [78, 92, 94],  light: [220, 236, 236], circuit: 'critical' },
  { id: 'power',      x: 1320, w: 220, label: 'ЭНЕРГОБЛОК', type: 'power',    tint: [60, 68, 82],  light: [200, 222, 240], circuit: 'technical' },
  { id: 'airlock-room', x: 1550, w: 170, label: 'ШЛЮЗ', plate: null, type: 'lock', tint: [58, 62, 66],  light: [214, 226, 236], circuit: 'technical' },  // 1.0: табличка «ШЛЮЗ» — у гермоворот в зале вестибюля
  { id: 'hq',         x: 1730, w: 260, label: 'НАЧАЛЬНИК СТАНЦИИ', type: 'chief', tint: [86, 80, 66], light: [255, 206, 150], circuit: 'critical' },   // ST-001: бывшая насосная; работа / сон / оружейка за решёткой
  // 0.9: вестибюль +1. Рисуются тем же кодом, что комнаты яруса, со сдвигом по y (FLOORS.vestibule.y − FLOORS.upper.y).
  { id: 'quarantine',     floor: 'vestibule', x: 1180, w: 150, label: 'КАРАНТИН',    type: 'quarantine', tint: [80, 94, 92],  light: [214, 234, 230], circuit: 'critical' },
  { id: 'equipment',      floor: 'vestibule', x: 1340, w: 110, label: 'ЭКИПИРОВКА',  type: 'equipment',  tint: [70, 76, 70],  light: [226, 222, 200], circuit: 'technical' },
  { id: 'checkpoint',     floor: 'vestibule', x: 1460, w: 136, label: 'КПП',         type: 'checkpoint', tint: [66, 72, 78],  light: [214, 226, 236], circuit: 'technical' },
  { id: 'vestibule-hall', floor: 'vestibule', x: 1606, w: 144, label: 'ШЛЮЗ', type: 'hall',   // 1.0.1: табличка и HUD — «Шлюз» (id прежний)
      tint: [70, 74, 78],  light: [222, 226, 228], circuit: 'technical' },
  { id: 'guardroom',      floor: 'vestibule', x: 1760, w: 100, label: 'КАРАУЛЬНАЯ',  type: 'guardroom',  tint: [88, 76, 62],  light: [255, 200, 140], circuit: 'living' },
  // 1.0: ярус −2 — тот же код комнат со сдвигом на +270 по y (под путями). id совпадают с прежними planned-записями генплана.
  { id: 'sanitary',     floor: 'utility', x: 0,    w: 290, label: 'САНБЛОК',      type: 'sanblock',  tint: [70, 78, 76],  light: [220, 214, 190], circuit: 'living',    future: [] },   // SAN-001 R2: от западного края мира; умывальная, прачечная, сушилка
  { id: 'living-pods',  floor: 'utility', x: 300,  w: 220, label: 'ЖИЛЫЕ ЯЧЕЙКИ', type: 'cells',     tint: [86, 72, 58],  light: [255, 190, 120], circuit: 'living',    future: [] },
  { id: 'mushrooms',    floor: 'utility', x: 530,  w: 200, label: 'ГРИБНИЦА',     type: 'mushrooms', tint: [58, 64, 56],  light: [196, 214, 180], circuit: 'technical', future: [] },
  { id: 'tea-ferment',  floor: 'utility', x: 740,  w: 180, label: 'ФЕРМЕНТАЦИЯ',  type: 'ferment',   tint: [92, 74, 56],  light: [255, 200, 140], circuit: 'technical', future: [] },
  { id: 'pigsty',       floor: 'utility', x: 930,  w: 210, label: 'СВИНАРНИК',    type: 'piggery',   tint: [84, 74, 60],  light: [255, 206, 150], circuit: 'living',    future: [] },
  { id: 'storeroom',    floor: 'utility', x: 1150, w: 220, label: 'СКЛАД',        type: 'storage',   tint: [70, 72, 70],  light: [230, 226, 206], circuit: 'technical', future: ['station-stock'] },
  { id: 'utility-stairwell', floor: 'utility', x: 1380, w: 240, label: 'ЛЕСТНИЦА', plate: null, type: 'utilstairs', tint: [66, 68, 68], light: [255, 206, 150], circuit: 'technical', future: [] },
  { id: 'drainage',     floor: 'utility', x: 1630, w: 140, label: 'ДРЕНАЖНАЯ',    type: 'drainage',  tint: [56, 66, 70],  light: [200, 220, 230], circuit: 'technical', future: ['drain-service'] },
  { id: 'water',        floor: 'utility', x: 1780, w: 210, label: 'НАСОСНАЯ',     type: 'pumps',     tint: [56, 68, 74],  light: [190, 214, 228], circuit: 'technical', future: [] },   // ST-001: с яруса 0 на −2, id прежний
];
/** Этаж и сдвиг комнаты: комнаты вестибюля рисуются по шаблону яруса, сдвинутые на dy. */
const roomFloor = r => r.floor || 'upper';
const ROOM_FLOORS = ['upper', 'vestibule', 'utility'];                 // 1.0: этажи, где есть комнаты
/** 1.0: видимая табличка над дверью. label — название помещения (HUD, реестр); plate: null — таблички нет. */
const roomPlate = r => (r.plate === undefined ? r.label : r.plate);
const roomDY = r => CONFIG.FLOORS[roomFloor(r)].y - CONFIG.FLOORS.upper.y;
let ROOM_DY = 0;                         // сдвиг мировых y для света/свечения, пока рисуется комната вестибюля
function drawRoom(g, r) {
  const dy = roomDY(r); ROOM_DY = dy; g.save(); g.translate(0, dy);
  drawRoomBody(g, r); g.restore(); ROOM_DY = 0;
}
function drawRoomBody(g, r) {
  const { x, w } = r, cx = x + w / 2, dy = ROOM_DY;
  R(g, x, 15, w, 92, '#3b4042'); R(g, x, 15, w, 1, '#5c6264');          // бетонная рама
  R(g, x + 4, 19, w - 8, 81, rgb(r.tint));                               // стена
  paintRegion(g, x + 4, 19, w - 8, 81, (px, py, o) => {                  // фактура стены + затемнение к углам
    const n = (hash(px, py) - 0.5) * 8, edge = Math.min(py - 19, px - x - 4, x + w - 5 - px);
    const k = edge < 6 && dither(px, py) < (6 - edge) / 8 ? 0.72 : 1;
    const panel = (px - x) % 24 === 0 ? 0.86 : 1;
    const top = py < 23 ? 0.7 : 1;
    o[0] = r.tint[0] * k * panel * top + n; o[1] = r.tint[1] * k * panel * top + n; o[2] = r.tint[2] * k * panel * top + n; return true;
  });
  R(g, x + 4, 96, w - 8, 4, '#4e463c'); R(g, x + 4, 96, w - 8, 1, '#7a6c58'); // пол
  R(g, x + 4, 100, w - 8, 1, '#24221f');
  const firstLight = WORLD.lights.length;
  let lamps = w > 200 ? [x + Math.round(w * 0.22), x + Math.round(w * 0.78)] : [x + Math.round(w * 0.8)];
  const ph = roomPlate(r) ? (textWidth(roomPlate(r)) + 12) / 2 : 0;                               // 0.9: лампа не прячется под табличку (узкие комнаты вестибюля)
  if (lamps.length === 1 && Math.abs(lamps[0] - cx) < ph + 5) lamps = [cx + ph + 6 <= x + w - 9 ? Math.round(cx + ph + 6) : Math.round(cx - ph - 6)];
  lamps.forEach(lx => {
    R(g, lx, 19, 1, 7, '#1d1f21'); R(g, lx - 4, 26, 9, 2, '#5a6062'); R(g, lx - 4, 26, 9, 1, '#7a8082');
    const l = addLight(lx, 30, 62, r.light, 'steady', 0.85);
    addEmissive(lx - 2, 28, 5, 1, [255, 240, 200], l);
  });
  ROOM_DRAW[r.type](g, r);
  for (let i = firstLight; i < WORLD.lights.length; i++) WORLD.lights[i].clip = { x0: x + 4, x1: x + w - 4, y0: 19 + dy, y1: 100 + dy };
  if (roomPlate(r)) plate(g, cx, 22, roomPlate(r), '#1e2426', '#e0c48c', '#4a5254');   // 1.0: табличка может отличаться от названия или отсутствовать
}
const ROOM_DRAW = {
  bunks(g, r) {
    for (let i = 0; i < 3; i++) {
      const bx = r.x + 14 + i * 76;
      R(g, bx, 56, 2, 40, '#4a4844'); R(g, bx + 52, 56, 2, 40, '#4a4844');
      [[70, '#7a3b34'], [88, '#465a6c']].forEach(([y, blanket], k) => {
        R(g, bx + 2, y, 50, 4, '#8c7b60'); R(g, bx + 2, y + 4, 50, 1, '#3a352e');
        R(g, bx + 16 + k * 4, y - 2, 36 - k * 4, 4, blanket); R(g, bx + 16 + k * 4, y - 2, 36 - k * 4, 1, rgb([150, 110, 100], 0.9));
        R(g, bx + 4, y - 3, 10, 3, '#c0b69c');
      });
      R(g, bx + 8, 94, 6, 2, '#2a2622');                                // ботинки под нарами
    }
    const lx = r.x + r.w - 34;                                          // шкафчик
    R(g, lx, 52, 22, 44, '#55625f'); R(g, lx, 52, 22, 1, '#7a8784'); R(g, lx + 11, 53, 1, 43, '#3a4442');
    for (let k = 0; k < 3; k++) { R(g, lx + 3, 57 + k * 3, 6, 1, '#2e3432'); R(g, lx + 14, 57 + k * 3, 6, 1, '#2e3432'); }
    R(g, r.x + 236, 36, 10, 12, '#b8a98a'); R(g, r.x + 237, 37, 8, 7, '#6a7a6a');   // фотография на стене
  },
  kitchen(g, r) {
    const tx = r.x + 30;
    R(g, tx, 80, 120, 3, '#7a5a3e'); R(g, tx, 80, 120, 1, '#9c7a58'); R(g, tx, 83, 120, 1, '#4e3a28');
    R(g, tx + 4, 84, 2, 12, '#3e2e20'); R(g, tx + 114, 84, 2, 12, '#3e2e20');
    R(g, tx + 6, 88, 44, 2, '#5e4630'); R(g, tx + 66, 88, 44, 2, '#5e4630');
    for (let k = 0; k < 5; k++) R(g, tx + 12 + k * 22, 78, 6, 2, '#c8bfa8');                 // миски
    const sx = r.x + r.w - 72;                                          // буржуйка
    R(g, sx, 66, 30, 30, '#45474a'); R(g, sx - 1, 64, 32, 2, '#6e7072'); R(g, sx + 6, 76, 18, 12, '#1e1f21');
    R(g, sx + 24, 19, 4, 45, '#36383a'); R(g, sx + 8, 57, 14, 7, '#6a6f72'); R(g, sx + 8, 57, 14, 1, '#8a9092');
    const fl = addLight(sx + 15, 82, 40, [255, 130, 60], 'fire', 0.6);
    addEmissive(sx + 7, 80, 16, 7, [255, 128, 48], fl, 'main', 'fire');
    const shx = sx - 50;                                                // полка с банками (1.1А: от буржуйки, не заходит на трубу)
    R(g, shx, 42, 64, 2, '#6a5038');
    ['#8a6a3a', '#5a7a5a', '#9a8a5a', '#6a5a7a', '#8a4a3a', '#7a8a8a'].forEach((c, k) => R(g, shx + 4 + k * 10, 35, 6, 7, c));
    for (let k = 0; k < 3; k++) { R(g, r.x + 40 + k * 14, 34, 1, 6, '#2a2a2a'); R(g, r.x + 37 + k * 14, 40, 8, 5, '#5c6266'); }
  },
  /** 1.1А: комната героя — кровать, гитара, книги, плакат и фото, стол с лампой, шкафчик, рюкзак, мелочи; рисунок крыльев. */
  hero(g, r) {
    const x = r.x;
    // кровать: металлический каркас, матрас, одеяло, подушка
    R(g, x + 10, 74, 2, 22, '#4a4844'); R(g, x + 70, 80, 2, 16, '#4a4844'); R(g, x + 10, 74, 2, 1, '#6a6862');
    R(g, x + 12, 86, 58, 2, '#3e3c38'); R(g, x + 12, 92, 58, 1, '#33312d');
    R(g, x + 12, 81, 58, 5, '#8c7b60'); R(g, x + 12, 81, 58, 1, '#a8977a');                       // матрас
    R(g, x + 30, 79, 40, 6, '#5a6a4a'); R(g, x + 30, 79, 40, 1, '#76885e'); R(g, x + 44, 80, 1, 5, '#4a5a3c');   // одеяло
    R(g, x + 14, 78, 13, 4, '#d0c6aa'); R(g, x + 14, 78, 13, 1, '#e4dcc2');                     // подушка
    R(g, x + 18, 92, 12, 4, '#6a5038'); R(g, x + 18, 92, 12, 1, '#8a6a48');                     // ящик с вещами под кроватью
    R(g, x + 36, 93, 6, 3, '#2a2622'); R(g, x + 43, 93, 6, 3, '#2a2622');                       // ботинки
    // гитара у изножья кровати
    R(g, x + 77, 58, 2, 18, '#5a3e24'); R(g, x + 76, 56, 4, 3, '#3a2a1a');                      // гриф и голова
    R(g, x + 73, 76, 10, 9, '#a8743c'); R(g, x + 72, 85, 12, 10, '#b07a40'); R(g, x + 73, 76, 10, 1, '#c89458');
    R(g, x + 77, 80, 2, 2, '#2a1e12'); R(g, x + 75, 89, 6, 1, '#4a321c');                       // розетка, подставка струн
    // полка с книгами над кроватью
    R(g, x + 12, 46, 34, 2, '#6a5038');
    ['#7a3b34', '#465a6c', '#8a7a4a', '#5a6a4a', '#6a4a5a', '#8a5a3a'].forEach((c, k) => R(g, x + 14 + k * 5, 38 + (k % 3), 4, 8 - (k % 3), c));
    R(g, x + 45, 41, 3, 5, '#c8bfa8');                                                          // сувенир с поверхности — обломок таблички
    // плакат: стилизованная Волга и город, без копий готовых изображений
    R(g, x + 52, 36, 30, 22, '#c8b48a'); R(g, x + 53, 37, 28, 20, '#8aa0a8'); R(g, x + 53, 37, 28, 4, '#c89a6a');   // закат
    R(g, x + 53, 50, 28, 7, '#4a6a84'); for (let k = 0; k < 4; k++) R(g, x + 55 + k * 7, 52 + (k % 2), 4, 1, '#9ab8c8');   // река
    [[56, 44, 4], [61, 41, 3], [66, 45, 5], [72, 42, 3], [76, 46, 3]].forEach(([dx, y, w]) => R(g, x + dx, y, w, 50 - y, '#5a5a62'));   // силуэт города
    R(g, x + 62, 38, 1, 3, '#5a5a62');                                                          // шпиль
    // фотографии
    R(g, x + 86, 34, 9, 11, '#b8a98a'); R(g, x + 87, 35, 7, 7, '#6a7a6a');
    R(g, x + 86, 48, 9, 8, '#b8a98a'); R(g, x + 87, 49, 7, 5, '#7a6a5a');
    // рисунок крыльев на листке
    R(g, x + 100, 40, 16, 12, '#d8d0bc'); R(g, x + 100, 40, 16, 1, '#ece4d2');
    for (let k = 0; k < 5; k++) { R(g, x + 107 - k, 45 - (k >> 1), 1, 1 + (k >> 1), '#4a4440'); R(g, x + 109 + k, 45 - (k >> 1), 1, 1 + (k >> 1), '#4a4440'); }
    R(g, x + 108, 44, 1, 5, '#4a4440');
    // часы на стене
    R(g, x + 124, 32, 7, 7, '#3a3834'); R(g, x + 125, 33, 5, 5, '#d8d0bc'); R(g, x + 127, 34, 1, 2, '#2a2622'); R(g, x + 127, 35, 2, 1, '#2a2622');
    // письменный стол: кружка, блокнот, записи, фонарик, лампа
    R(g, x + 96, 78, 46, 3, '#7a5a3e'); R(g, x + 96, 78, 46, 1, '#9c7a58'); R(g, x + 96, 81, 46, 1, '#4e3a28');
    R(g, x + 98, 82, 2, 14, '#3e2e20'); R(g, x + 138, 82, 2, 14, '#3e2e20'); R(g, x + 124, 82, 14, 8, '#5e4630');   // ножки, тумба
    R(g, x + 128, 85, 6, 1, '#3e2e20');
    R(g, x + 102, 75, 9, 3, '#d8d0bc'); R(g, x + 104, 74, 8, 1, '#c8bfa8');                     // записи
    R(g, x + 113, 74, 7, 4, '#6a3a2a'); R(g, x + 113, 74, 7, 1, '#8a4a34');                     // блокнот
    R(g, x + 122, 74, 4, 4, '#8a8a84'); R(g, x + 126, 75, 1, 2, '#8a8a84');                     // кружка
    R(g, x + 128, 76, 6, 2, '#3a4448'); R(g, x + 133, 76, 1, 2, '#c8c0a0');                     // фонарик
    R(g, x + 138, 64, 1, 14, '#3a3834'); R(g, x + 134, 63, 7, 3, '#5a5a52'); R(g, x + 136, 77, 5, 1, '#3a3834');   // настольная лампа
    const dl = addLight(x + 137, 67, 26, [255, 196, 120], 'steady', 0.55);                     // свет у стола (цепь living)
    addEmissive(x + 135, 66, 5, 1, [255, 226, 170], dl);
    R(g, x + 104, 88, 10, 2, '#5e4630'); R(g, x + 105, 90, 1, 6, '#3e2e20'); R(g, x + 112, 90, 1, 6, '#3e2e20');   // табурет
    R(g, x + 116, 92, 9, 4, '#4a5258'); R(g, x + 116, 92, 9, 1, '#6a7278'); R(g, x + 118, 91, 5, 1, '#8a8a84');   // ящик с инструментами
    // рюкзак на крючке и личный шкафчик
    R(g, x + 146, 56, 2, 2, '#6a6862');
    R(g, x + 143, 58, 8, 12, '#5a5a3a'); R(g, x + 143, 58, 8, 1, '#7a7a52'); R(g, x + 144, 63, 6, 4, '#4a4a30'); R(g, x + 145, 69, 1, 2, '#3a3a28');
    const lx = x + 154;
    R(g, lx, 52, 22, 44, '#55625f'); R(g, lx, 52, 22, 1, '#7a8784'); R(g, lx + 11, 53, 1, 43, '#3a4442');
    for (let k = 0; k < 3; k++) { R(g, lx + 3, 57 + k * 3, 6, 1, '#2e3432'); R(g, lx + 14, 57 + k * 3, 6, 1, '#2e3432'); }
    R(g, lx + 8, 72, 1, 3, '#a8a8a0'); R(g, lx + 13, 72, 1, 3, '#a8a8a0');                     // ручки
  },
  /** Лестничная клетка: завал разобран (проход на запад открыт), обломки сложены на стене-полке; таблички направлений. */
  /** 1.0.1: бывшая лестничная клетка — холл с аркой служебной лестницы на перрон (арка — drawArches). */
  stairwell(g, r) {
    drawText(g, '◀ ЖИЛЬЕ', r.x + 5, 52, '#c8b88a', 'rgba(0,0,0,.45)');
    drawText(g, 'ТЕХ▶', r.x + r.w - 27, 48, '#c8b88a', 'rgba(0,0,0,.45)');
    R(g, r.x + 8, 80, 18, 16, '#4a4e50'); R(g, r.x + 8, 80, 18, 1, '#6a6e70'); R(g, r.x + 10, 84, 14, 1, '#2e3234');   // ящик с песком
    R(g, r.x + r.w - 22, 64, 10, 32, '#5a2e28'); R(g, r.x + r.w - 20, 60, 6, 4, '#3a2a24'); R(g, r.x + r.w - 21, 70, 8, 6, '#c8b88a');   // огнетушитель
  },
  workshop(g, r) {
    R(g, r.x + 20, 78, 136, 5, '#76553e'); R(g, r.x + 20, 78, 136, 1, '#9a7656');
    R(g, r.x + 24, 83, 3, 13, '#312c2b'); R(g, r.x + 150, 83, 3, 13, '#312c2b');
    for (let k = 0; k < 6; k++) { R(g, r.x + 30 + k * 20, 46, 1, 20, '#b9b2a0'); R(g, r.x + 26 + k * 20, 54, 9, 2, '#8b958c'); }
    R(g, r.x + 62, 72, 14, 6, '#4a5258'); R(g, r.x + 66, 69, 6, 3, '#6a7278');
    R(g, r.x + 176, 72, 32, 24, '#6e5236'); R(g, r.x + 176, 72, 32, 1, '#8e7050'); R(g, r.x + 176, 83, 32, 1, '#4e3a26');
    const mx = r.x + r.w - 64;
    R(g, mx, 60, 32, 24, '#2a3237'); R(g, mx + 14, 84, 4, 12, '#2a3237');
    const l = addLight(mx + 15, 70, 34, [110, 200, 180], 'screen', 0.55);
    addEmissive(mx + 3, 63, 26, 15, [120, 196, 176], l, 'main', 'screen');
  },
  medbay(g, r) {
    const cx = Math.round(r.x + r.w / 2);
    R(g, cx - 2, 36, 5, 15, '#9a3b34'); R(g, cx - 7, 41, 15, 5, '#9a3b34');
    R(g, r.x + 12, 80, 58, 4, '#d0cfc4'); R(g, r.x + 12, 84, 58, 2, '#7e8a8c'); R(g, r.x + 14, 86, 2, 10, '#5e6a6c');
    R(g, r.x + 66, 86, 2, 10, '#5e6a6c'); R(g, r.x + 14, 77, 12, 3, '#e6e4da');
    R(g, r.x + 54, 78, 5, 2, '#7a6646'); R(g, r.x + 55, 77, 3, 1, '#9a8458'); R(g, r.x + 56, 73, 1, 4, '#e8e0cc');   // подсвечник на столе (0.8.1)
    WORLD.candle = { x: r.x + 56, y: 72, lamp: 0, want: false, delay: 0, clip: { x0: r.x + 4, x1: r.x + r.w - 4, y0: 19, y1: 100 } };
    R(g, r.x + 74, 50, 1, 46, '#9aa4a6'); R(g, r.x + 71, 52, 7, 9, '#b8d0cc');
    R(g, r.x + r.w - 36, 54, 24, 42, '#b8bcb4'); R(g, r.x + r.w - 33, 58, 18, 16, '#6c9090'); R(g, r.x + r.w - 33, 78, 18, 14, '#9ca09a');
  },
  power(g, r) {
    const gx = r.x + 18;
    R(g, gx, 62, 100, 34, '#4a5456'); R(g, gx, 62, 100, 2, '#6e7a7c'); R(g, gx, 94, 100, 2, '#2a3032');
    for (let k = 0; k < 5; k++) { R(g, gx + 8 + k * 17, 55, 11, 8, '#5c686a'); R(g, gx + 8 + k * 17, 55, 11, 1, '#7e8a8c'); }
    disc(g, gx + 112, 78, 15, '#3a4244'); disc(g, gx + 112, 78, 11, '#576064'); disc(g, gx + 112, 78, 3, '#2a3032');
    R(g, gx + 20, 19, 6, 36, '#3a4244'); R(g, gx + 20, 19, 1, 36, '#5a6264');
    R(g, gx + 3, 65, 5, 4, '#1e2426'); addEmissive(gx + 4, 66, 3, 2, [110, 230, 120], null, 'main', 'gen', null);   // лампа «работает»
    const px = r.x + r.w - 54;
    R(g, px, 50, 44, 46, '#3e4a50'); R(g, px, 50, 44, 1, '#5e6a70');
    for (let k = 0; k < 3; k++) { disc(g, px + 9 + k * 13, 62, 4, '#c8c4b0'); R(g, px + 9 + k * 13, 59, 1, 3, '#2a2a2a'); }
    for (let k = 0; k < 4; k++) addEmissive(px + 7 + k * 9, 78, 3, 2, k === 2 ? [255, 170, 60] : [110, 230, 120], null, 'main', 'blink');
    for (let k = 0; k < r.w - 8; k++) R(g, r.x + 4 + k, 92, 1, 4, ((k >> 2) % 2) ? '#b8922e' : '#1c1c1c');
  },
  /** Шлюз: гермоворота в задней стене (створки рисуются в кадре — они открываются), оружейная стойка. */
  /* ---- 1.0: ярус −2 (координаты шаблона комнаты яруса: пол 96, потолок 19) ---- */
  /** Жилые ячейки: двухъярусные нары за занавесками, ящики, личные вещи, самодельная лампа. */
  /** SAN-001 R2: «САНБЛОК» от западного края мира (x 0–290). Слева направо: умывальная, прачечная, сушилка; западная стена со стояком и бойлером. */
  sanblock(g, r) {
    const x = r.x;                                                          // внутренняя часть стены — r.x + 4 … r.x + 286 (w 290)
    R(g, x + 4, 33, r.w - 8, 4, '#5a4a3c'); R(g, x + 4, 33, r.w - 8, 1, '#8a6a4a'); R(g, x + 4, 36, r.w - 8, 1, '#2e2620');   // ржавая магистраль под потолком
    for (const hx of [x + 40, x + 104, x + 168, x + 232]) R(g, hx, 31, 3, 7, '#3a3632');                                     // хомуты
    // Западная стена: стояк от магистрали до пола, вентиль, потёки
    R(g, x + 6, 37, 4, 59, '#5a4a3c'); R(g, x + 6, 37, 1, 59, '#7a6a52'); R(g, x + 4, 52, 8, 3, '#3e3430'); disc(g, x + 8, 47, 3, '#8a3a30'); disc(g, x + 8, 47, 1, '#3a2a24');
    for (let y = 60; y < 96; y += 3) if (hash(y, 3) > 0.4) R(g, x + 11, y, 1, 2, '#3e4a48');
    // А. Умывальная (r.x + 14 … 100): кафель, бойлер, четыре раковины, два зеркала, полка с мылом, мокрый пол
    for (let ty = 48; ty < 84; ty += 6) for (let tx = x + 16; tx < x + 98; tx += 6)
      R(g, tx, ty, 5, 5, hash(tx, ty) > 0.9 ? '#55605e' : (hash(tx + 1, ty) > 0.5 ? '#8e9a96' : '#86928e'));
    R(g, x + 16, 84, 82, 1, '#4a5452');
    R(g, x + 16, 40, 14, 6, '#3e4644'); R(g, x + 17, 39, 12, 1, '#5e6664'); R(g, x + 22, 46, 1, 2, '#3a3e3c');                  // бойлер над раковинами
    for (let k = 0; k < 4; k++) {
      const sx = x + 20 + k * 19;
      R(g, sx + 6, 52, 1, 8, '#6a6e6c'); R(g, sx + 4, 59, 5, 2, '#8a8e8c'); R(g, sx + 6, 61, 1, 2, '#9aa0a0');                  // кран
      R(g, sx, 64, 14, 5, '#c8ccc4'); R(g, sx, 64, 14, 1, '#e0e2da'); R(g, sx + 2, 65, 10, 2, '#7a8684');                       // раковина
      R(g, sx + 6, 69, 2, 27, '#5a5e5c'); R(g, sx + 4, 76, 6, 3, '#4a4e4c');                                                    // слив и сифон
      if (k === 1 || k === 2) { R(g, sx, 40, 14, 10, '#3a3e3c'); R(g, sx + 1, 41, 12, 8, '#7a8a8e'); R(g, sx + 2, 42, 4, 2, '#a8b8bc'); }   // мутные зеркала
    }
    R(g, x + 92, 56, 6, 1, '#5a4632'); R(g, x + 93, 54, 3, 2, '#c8b88a');                                                       // полка с мылом
    R(g, x + 18, 94, 76, 2, '#2e3a3e'); R(g, x + 34, 94, 20, 1, '#5a7480'); R(g, x + 66, 95, 12, 1, '#5a7480');                 // мокрый пол
    R(g, x + 102, 44, 3, 52, '#4a4e4c'); R(g, x + 102, 44, 1, 52, '#6a6e6c');                                                   // перегородка-стойка
    // Б. Прачечная (r.x + 110 … 192): бак на подставке, корыто со стиральной доской, таз, ведро, мешок с бельём
    const bx = x + 112;
    R(g, bx, 40, 26, 34, '#5e6a66'); R(g, bx, 40, 26, 2, '#7e8a86'); R(g, bx + 2, 50, 22, 1, '#46504c'); R(g, bx + 2, 62, 22, 1, '#46504c');
    for (let k = 0; k < 3; k++) R(g, bx + 5 + k * 7, 44, 2, 2, '#8a5a3a');                                                   // ржавые заклёпки
    R(g, bx + 3, 74, 2, 22, '#3a3632'); R(g, bx + 21, 74, 2, 22, '#3a3632'); R(g, bx + 26, 66, 5, 2, '#6a6e6c'); R(g, bx + 29, 66, 2, 4, '#6a6e6c');   // ножки, кран бака
    const tx = x + 146;
    R(g, tx, 76, 36, 10, '#6a6e6a'); R(g, tx, 76, 36, 1, '#9a9e98'); R(g, tx + 2, 78, 32, 3, '#4a6a74');                       // корыто с водой
    R(g, tx + 3, 86, 2, 10, '#3a3632'); R(g, tx + 31, 86, 2, 10, '#3a3632');
    R(g, tx + 23, 64, 9, 16, '#7a6248'); for (let k = 0; k < 5; k++) R(g, tx + 24, 66 + k * 3, 7, 1, '#5a4632');                 // стиральная доска
    R(g, tx + 6, 90, 15, 5, '#5a6a72'); R(g, tx + 7, 89, 13, 1, '#7a8a92');                                                     // таз на полу
    R(g, x + 184, 86, 7, 10, '#5a5e5c'); R(g, x + 184, 86, 7, 1, '#7a7e7c');                                                   // ведро
    R(g, x + 140, 88, 5, 8, '#7a7060'); R(g, x + 139, 87, 7, 2, '#8a8070');                                                     // мешок с бельём
    // В. Сушилка (r.x + 196 … 284): тёплая труба, две верёвки с бельём, деревянная решётка
    R(g, x + 196, 88, 88, 4, '#7a4a3a'); R(g, x + 196, 88, 88, 1, '#9a6a52');                                                   // тёплая труба отопления
    for (const ry of [44, 58]) { L(g, x + 198, ry, x + 282, ry, '#2a2622'); R(g, x + 197, ry - 1, 2, 3, '#4a4440'); R(g, x + 281, ry - 1, 2, 3, '#4a4440'); }
    const cloth = [[201, 44, 9, 12, '#8a8070'], [213, 44, 7, 9, '#6a7a8a'], [223, 44, 11, 14, '#9a6a5a'], [237, 44, 8, 10, '#7a8a6a'], [248, 44, 12, 11, '#a89a80'], [263, 44, 8, 8, '#5a6a7a'],
      [204, 58, 10, 10, '#6a5a4a'], [218, 58, 7, 13, '#8a7a9a'], [229, 58, 12, 9, '#b8ae94'], [244, 58, 10, 12, '#7a5a4a'], [258, 58, 12, 10, '#6a7a6a']];
    for (const [cx, cy, cw, ch, c] of cloth) { R(g, x + cx, cy + 1, cw, ch, c); R(g, x + cx, cy + 1, cw, 1, '#d8d0c0'); R(g, x + cx + 2, cy, 1, 2, '#3a3632'); }
    R(g, x + 232, 74, 32, 2, '#6a5034'); R(g, x + 232, 81, 32, 2, '#6a5034'); R(g, x + 234, 72, 2, 16, '#5a4630'); R(g, x + 260, 72, 2, 16, '#5a4630');   // сушильная решётка
    R(g, x + 238, 70, 9, 4, '#8a8070'); R(g, x + 249, 77, 8, 4, '#6a7a8a');                                                     // носки и полотенце
  },
  cells(g, r) {
    for (let i = 0; i < 2; i++) {
      const bx = r.x + 12 + i * 70;
      R(g, bx, 54, 2, 42, '#4a4440'); R(g, bx + 52, 54, 2, 42, '#4a4440');
      [[70, i ? '#6a5a3a' : '#5a4a6a'], [88, i ? '#4a5a4a' : '#7a3b34']].forEach(([y, blanket], k) => {
        R(g, bx + 2, y, 50, 4, '#7c6c52'); R(g, bx + 2, y + 4, 50, 1, '#36302a');
        R(g, bx + 16 + k * 4, y - 2, 36 - k * 4, 4, blanket); R(g, bx + 4, y - 3, 10, 3, '#b8ae94');
      });
      for (let y = 50; y < 92; y += 2) R(g, bx + 55, y, 5, 1, i ? '#8a6a4a' : '#6a7a6a');   // занавеска
      R(g, bx + 54, 49, 8, 1, '#3a3632');
      R(g, bx + 30, 38, 14, 10, '#b8a98a'); R(g, bx + 31, 39, 12, 6, i ? '#7a6a5a' : '#5a6a7a');   // картинка/фото
    }
    crate(g, r.x + 160, 82, 18, 14); crate(g, r.x + 180, 86, 14, 10); crate(g, r.x + 164, 72, 12, 10);
    R(g, r.x + 156, 64, 50, 1, '#2a2622');                                   // верёвка с бельём
    [[160, '#8a8070'], [172, '#6a7a8a'], [186, '#9a6a5a']].forEach(([x, c]) => R(g, r.x + x, 65, 8, 9, c));
    R(g, r.x + 196, 76, 8, 6, '#3a3e40'); R(g, r.x + 198, 74, 4, 2, '#2a2e30');   // примус
    // самодельная лампа на проводе: тёплый слабый свет жилой цепи
    L(g, r.x + 150, 19, r.x + 150, 34, '#1a1c1e'); R(g, r.x + 148, 34, 5, 4, '#d8b070');
    const l = addLight(r.x + 150, 38, 30, [255, 176, 100], 'flicker', 0.45); addEmissive(r.x + 149, 35, 3, 2, [255, 214, 150], l);
  },
  /** Грибница: стеллажи с ящиками субстрата, бледные шляпки, влажные стены, трубы, бак. Капли — в FX. */
  mushrooms(g, r) {
    for (let k = 0; k < 7; k++) {                                            // сырые потёки по стене
      const x = r.x + 10 + ((hash(k, 51) * (r.w - 20)) | 0);
      for (let y = 22; y < 92; y++) if (hash(x, y) > 0.35) R(g, x, y, 1, 1, rgb([40, 50, 44], 0.9));
    }
    R(g, r.x + 6, 24, r.w - 12, 3, '#4a5250'); R(g, r.x + 6, 24, r.w - 12, 1, '#6a7270');   // труба под потолком
    for (let x = r.x + 20; x < r.x + r.w - 10; x += 40) R(g, x, 27, 2, 3, '#3a4240');
    for (let sh = 0; sh < 2; sh++) {
      const sx = r.x + 14 + sh * 84;
      R(g, sx, 44, 2, 52, '#4a4034'); R(g, sx + 68, 44, 2, 52, '#4a4034');
      for (let t = 0; t < 3; t++) {
        const y = 50 + t * 16;
        R(g, sx, y + 8, 70, 2, '#5a4a36');
        R(g, sx + 3, y + 2, 64, 6, '#3e3226'); R(g, sx + 3, y + 2, 64, 1, '#56463a');     // ящик субстрата
        for (let m = 0; m < 6; m++) {
          const mx = sx + 6 + m * 10 + ((hash(m, t + sh * 3) * 4) | 0);
          R(g, mx, y + 1, 1, 2, '#b8b0a0'); R(g, mx - 2, y - 1, 5, 2, hash(m, t) > 0.5 ? '#d8d0bc' : '#c8bca4');   // шляпки
        }
      }
    }
    R(g, r.x + r.w - 26, 70, 18, 26, '#5a6a70'); R(g, r.x + r.w - 26, 70, 18, 1, '#7a8a90'); R(g, r.x + r.w - 20, 66, 6, 4, '#4a5a60');   // бак
    R(g, r.x + r.w - 24, 94, 22, 2, '#2e3a40');                              // лужа
  },
  /** Ферментационная: бочки, большой чан, полки с банками, сушилка с листьями. */
  ferment(g, r) {
    for (let k = 0; k < 4; k++) barrel(g, r.x + 10 + k * 15, 80, k % 2 ? [92, 64, 40] : [104, 74, 46]);
    R(g, r.x + 74, 62, 34, 34, '#6a5034'); R(g, r.x + 74, 62, 34, 2, '#8a6a46'); R(g, r.x + 72, 70, 38, 2, '#3a2a1a'); R(g, r.x + 72, 84, 38, 2, '#3a2a1a');   // чан
    R(g, r.x + 80, 58, 22, 4, '#4a3a2a');
    for (let t = 0; t < 2; t++) {                                            // полки с банками
      const y = 44 + t * 14;
      R(g, r.x + 116, y + 8, 56, 2, '#5a4632');
      for (let j = 0; j < 7; j++) { const c = [[150, 110, 50], [120, 80, 40], [170, 140, 60], [90, 110, 60]][(j + t) % 4]; R(g, r.x + 119 + j * 7, y + 2, 5, 6, rgb(c)); R(g, r.x + 119 + j * 7, y + 1, 5, 1, '#c8c0b0'); }
    }
    R(g, r.x + 116, 74, 56, 1, '#2a2622'); R(g, r.x + 116, 74, 1, 22, '#4a3a2a'); R(g, r.x + 171, 74, 1, 22, '#4a3a2a');   // сушилка
    for (let j = 0; j < 9; j++) { const x = r.x + 120 + j * 6; R(g, x, 75, 3, 6 + (j % 3), j % 2 ? '#6a7a3a' : '#7a6a32'); }
    R(g, r.x + 122, 88, 44, 8, '#4a3a2a'); R(g, r.x + 124, 86, 12, 2, '#a89878'); R(g, r.x + 140, 86, 10, 2, '#a89878');   // стол с посудой
  },
  /** Свинарник: загон из досок, кормушка, солома, вентиляционная труба. Свиньи — актёры в пределах загона. */
  piggery(g, r) {
    const x0 = r.x + 30, x1 = r.x + 194;
    for (let x = x0; x < x1; x++) if (hash(x, 95) > 0.35) R(g, x, 93 + ((hash(x, 7) * 3) | 0), 1, 3, hash(x, 9) > 0.5 ? '#a8904a' : '#8a7438');   // солома
    [80, 88].forEach(y => { R(g, x0, y, x1 - x0, 2, '#6a5034'); R(g, x0, y, x1 - x0, 1, '#8a6a46'); });   // жерди загона
    for (let x = x0; x <= x1; x += 41) R(g, x, 76, 3, 20, '#4a3624');
    R(g, x0 + 120, 90, 26, 6, '#5a5e5c'); R(g, x0 + 120, 90, 26, 1, '#7a7e7a'); R(g, x0 + 122, 91, 22, 2, '#7a6a3a');   // кормушка
    R(g, r.x + 10, 22, 6, 74, '#5a6266'); R(g, r.x + 10, 22, 2, 74, '#7a8286'); R(g, r.x + 6, 30, 14, 6, '#4a5256');   // вентиляция
    for (let k = 0; k < 3; k++) R(g, r.x + 8, 32 + k * 2, 10, 1, '#2a3034');
    R(g, r.x + r.w - 36, 56, 22, 18, '#3a3430'); R(g, r.x + r.w - 33, 59, 16, 3, '#6a5a3a'); R(g, r.x + r.w - 33, 64, 16, 3, '#6a5a3a');   // мешки с кормом на полке
  },
  /** Склад: стеллажи с подписанными полками, мешки, металлические ящики, канистры, детали. */
  storage(g, r) {
    for (let k = 0; k < 2; k++) {
      const sx = r.x + 10 + k * 70;
      R(g, sx, 36, 2, 60, '#5a5e5c'); R(g, sx + 60, 36, 2, 60, '#5a5e5c');
      for (let t = 0; t < 3; t++) {
        const y = 54 + t * 14; R(g, sx, y, 62, 2, '#6a6e6c');
        for (let j = 0; j < 4; j++) { const c = [[80, 90, 70], [110, 90, 60], [90, 80, 70], [70, 80, 90]][(j + t + k) % 4]; R(g, sx + 4 + j * 14, y - 9, 11, 9, rgb(c)); R(g, sx + 4 + j * 14, y - 9, 11, 1, rgb(c, 1.3)); }
      }
      const lab = k ? 'ДЕТАЛИ' : 'ПРОДУКТЫ', lw = textWidth(lab) + 4;           // подпись стеллажа — на верхней полке
      R(g, sx + 31 - lw / 2, 36, lw, 9, '#2a2e2c'); drawText(g, lab, sx + 33 - lw / 2, 37, '#d8d0b0', null);
    }
    for (let k = 0; k < 3; k++) { R(g, r.x + 152 + k * 9, 84, 9, 12, '#a89870'); R(g, r.x + 152 + k * 9, 84, 9, 2, '#c8b890'); }   // мешки
    R(g, r.x + 150, 74, 30, 10, '#4a5258'); R(g, r.x + 150, 74, 30, 1, '#6a7278'); R(g, r.x + 163, 76, 4, 2, '#2a3236');   // металлический ящик
    for (let k = 0; k < 3; k++) { const cx = r.x + 184 + k * 10; R(g, cx, 82, 8, 14, '#8a2e24'); R(g, cx + 2, 80, 3, 2, '#5a1e18'); R(g, cx, 82, 8, 1, '#aa4a3a'); }   // канистры — у стены, отдельно
    drawText(g, 'НЕ КУРИТЬ', r.x + 150, 40, '#c84a3a', 'rgba(0,0,0,.5)');
  },
  /** Лестничный холл яруса −2: низ лестницы на платформу, указатели, трубы. */
  /** Лестничный холл яруса −2: арка служебной лестницы на перрон (drawArches), указатели, трубы, лавка, шкафчики. */
  utilstairs(g, r) {
    R(g, r.x + 8, 26, r.w - 16, 3, '#4a4e50'); R(g, r.x + 8, 26, r.w - 16, 1, '#6a6e70');
    for (let x = r.x + 20; x < r.x + r.w; x += 46) R(g, x, 29, 2, 4, '#3a3e40');
    drawText(g, '◀ ЖИЛЬЕ', r.x + 8, 62, '#c8b88a', 'rgba(0,0,0,.45)');
    drawText(g, 'ВОДОУЗЕЛ ▶', r.x + r.w - 9 - textWidth('ВОДОУЗЕЛ ▶'), 44, '#c8b88a', 'rgba(0,0,0,.45)');   // ST-001: комплекс «Дренажная» + «Насосная»; выше шкафчиков (длиннее прежней надписи)
    R(g, r.x + 26, 86, 44, 3, '#6a5038'); R(g, r.x + 26, 86, 44, 1, '#8a6a48'); R(g, r.x + 29, 89, 2, 7, '#3e2e20'); R(g, r.x + 65, 89, 2, 7, '#3e2e20');   // лавка
    for (let k = 0; k < 2; k++) { const lx = r.x + 150 + k * 16; R(g, lx, 52, 14, 44, '#55625f'); R(g, lx, 52, 14, 1, '#7a8784'); R(g, lx + 2, 58, 4, 1, '#2e3432'); R(g, lx + 2, 61, 4, 1, '#2e3432'); }   // шкафчики
  },
  /** Дренажная: насосы, большие трубы, шкафы, задвижки, решётка, лужи, тревожная лампа. */
  drainage(g, r) {                                                         // ST-001: компактнее (140), насосы ушли в соседнюю насосную
    R(g, r.x + 6, 30, r.w - 12, 8, '#4a5a5e'); R(g, r.x + 6, 30, r.w - 12, 2, '#6a7a7e'); R(g, r.x + 6, 37, r.w - 12, 1, '#2a3236');   // магистраль
    for (let x = r.x + 30; x < r.x + r.w - 20; x += 54) { R(g, x, 28, 6, 12, '#3a464a'); }
    const px = r.x + 16;                                                    // дренажный насос с задвижкой
    R(g, px, 70, 40, 26, '#3e5a64'); R(g, px, 70, 40, 2, '#5e7a84'); disc(g, px + 12, 83, 8, '#2e4a54'); disc(g, px + 12, 83, 4, '#6a8a94');
    R(g, px + 30, 38, 6, 32, '#4a5a5e'); R(g, px + 28, 50, 10, 4, '#3a4a4e');
    disc(g, px + 33, 58, 4, '#8a3a30'); R(g, px + 31, 57, 5, 1, '#c85a4a');
    R(g, r.x + r.w - 36, 44, 26, 40, '#4a5258'); R(g, r.x + r.w - 36, 44, 26, 1, '#6a7278'); R(g, r.x + r.w - 23, 45, 1, 39, '#2e3438');   // шкаф
    for (let k = 0; k < 3; k++) addEmissive(r.x + r.w - 32 + k * 6, 50, 2, 1, k === 2 ? [255, 90, 60] : [110, 230, 120], null, 'main', 'blink');
    R(g, r.x + 48, 92, 26, 4, '#1a1e20'); for (let x = r.x + 49; x < r.x + 74; x += 3) R(g, x, 92, 1, 4, '#4a5254');   // решётка приямка (ST-001 C: левее, у осмотра «приямок»)
    R(g, r.x + 8, 94, 30, 2, '#2e4048'); R(g, r.x + 60, 94, 34, 2, '#2e4048'); R(g, r.x + 62, 94, 10, 1, '#5a7480');   // лужи
    R(g, r.x + 56, 40, 8, 6, '#3a3e40'); const l = addLight(r.x + 60, 46, 40, [255, 120, 50], 'pulse', 0.5); addEmissive(r.x + 57, 41, 6, 4, [255, 150, 70], l);   // лампа уровня воды (над приямком)
  },
  /** 0.9: шлюз яруса 0 — нижний пост у прохода в вестибюль (1.0.1: служебная арка). Гермоворота — наверху, в зале «ШЛЮЗ». */
  lock(g, r) {
    R(g, r.x + 10, 52, 22, 32, '#3a3430'); R(g, r.x + 10, 52, 22, 1, '#5a5048');            // оружейная стойка
    for (let k = 0; k < 4; k++) { L(g, r.x + 14 + k * 5, 55, r.x + 14 + k * 5, 80, '#1c1e20'); R(g, r.x + 13 + k * 5, 76, 3, 5, '#4a3a2a'); }
    // 1.0.1: указатель «▲ КПП» — над служебной аркой (drawArches)
  },
  /** Карантин: две койки за занавесками, стойка санконтроля, бак для фильтров. */
  quarantine(g, r) {
    for (let k = 0; k < 2; k++) {
      const bx = r.x + 12 + k * 52;
      R(g, bx, 80, 40, 4, '#d0cfc4'); R(g, bx, 84, 40, 2, '#7e8a8c'); R(g, bx + 2, 86, 2, 10, '#5e6a6c'); R(g, bx + 36, 86, 2, 10, '#5e6a6c'); R(g, bx + 2, 77, 10, 3, '#e6e4da');
      R(g, bx + 44, 40, 1, 56, '#8a9496');                                // стойка занавески
      for (let y = 44; y < 90; y += 2) R(g, bx + 42, y, 4, 1, k ? '#7a9a94' : '#8aa49e');
    }
    R(g, r.x + r.w - 40, 56, 26, 40, '#b8bcb4'); R(g, r.x + r.w - 40, 56, 26, 1, '#d4d8d0');
    drawText(g, 'САН', r.x + r.w - 37, 60, '#7a2e28', null); R(g, r.x + r.w - 36, 70, 18, 8, '#6c9090');
    R(g, r.x + r.w - 12, 82, 8, 14, '#4a5a4a'); R(g, r.x + r.w - 12, 82, 8, 1, '#6a7a6a');   // бак с хлоркой
  },
  /** Склад экипировки: противогазы, фильтры, защитные костюмы на крючках. */
  equipment(g, r) {
    for (let row = 0; row < 2; row++) {
      R(g, r.x + 8, 50 + row * 18, 52, 2, '#5a4a36');
      for (let k = 0; k < 5; k++) { const mx = r.x + 12 + k * 10, my = 42 + row * 18; disc(g, mx, my + 3, 3, '#3e4a44'); R(g, mx - 1, my + 3, 3, 3, '#1e2420'); R(g, mx - 1, my + 6, 2, 2, '#5a6a5a'); }
    }
    for (let k = 0; k < 6; k++) R(g, r.x + 12 + k * 8, 82, 5, 14, k % 2 ? '#6a6a4a' : '#5a5a3e');   // фильтры
    for (let k = 0; k < 2; k++) {                                         // костюмы
      const sx = r.x + 68 + k * 18;
      R(g, sx + 4, 36, 2, 4, '#2a2a2a'); R(g, sx, 40, 12, 26, k ? '#7a6a3a' : '#6a7a4a'); R(g, sx - 2, 42, 3, 18, k ? '#6a5a32' : '#5a6a42'); R(g, sx + 11, 42, 3, 18, k ? '#6a5a32' : '#5a6a42');
      R(g, sx + 1, 66, 4, 26, k ? '#6a5a32' : '#5a6a42'); R(g, sx + 7, 66, 4, 26, k ? '#6a5a32' : '#5a6a42');
    }
  },
  /** КПП: будка дежурного с окном, журнал, шлагбаум к залу. В восточной части — служебная арка вниз, на ярус 0 (1.0.1). */
  checkpoint(g, r) {
    R(g, r.x + 8, 52, 34, 44, '#4a5458'); R(g, r.x + 8, 52, 34, 1, '#6a7478'); R(g, r.x + 12, 58, 26, 14, '#1e2a2e'); R(g, r.x + 12, 58, 26, 1, '#3a4a4e');
    const l = addLight(r.x + 25, 66, 26, [140, 190, 200], 'screen', 0.4); addEmissive(r.x + 14, 60, 22, 10, [120, 170, 180], l, 'main', 'screen');
    R(g, r.x + 44, 78, 18, 3, '#6a5038'); R(g, r.x + 46, 81, 2, 15, '#3e2e20'); R(g, r.x + 47, 75, 10, 3, '#d8d0b8');   // стол с журналом
  },
  /** Центральный зал: гермоворота наверх (в павильон), турникеты, указатели. */
  hall(g, r) {
    const gx = 1650;
    R(g, gx - 28, 40, 56, 56, '#262b2e'); R(g, gx - 28, 40, 56, 1, '#4a5054'); R(g, gx - 28, 40, 2, 56, '#3a4044');
    R(g, gx - 23, 44, 46, 52, '#07080a');                                       // проём за створками
    for (let y = 44; y < 60; y++) R(g, gx - 23, y, 46, 1, rgb([60, 66, 70], 0.5 - (y - 44) / 40));   // ступени наверх, в павильон
    for (let x = gx - 28; x < gx + 28; x++) R(g, x, 92, 1, 4, ((x >> 2) % 2) ? '#b8922e' : '#1e1e1e');
    for (let k = 0; k < 3; k++) { const tx = r.x + r.w - 52 + k * 14; R(g, tx, 76, 2, 20, '#7a7e7a'); R(g, tx - 4, 80, 10, 2, '#9a9e96'); R(g, tx - 4, 86, 10, 1, '#6a6e6a'); }   // турникеты
    const wx = r.x + r.w - 52; R(g, wx, 61, textWidth('ВЫХОД') + 6, 11, '#2f5660'); R(g, wx, 61, textWidth('ВЫХОД') + 6, 1, '#6f9a98'); drawText(g, 'ВЫХОД', wx + 3, 63, '#dfe6d6', null);
    addBeacon(g, gx, 36);                                                     // аварийный маяк над воротами (переехал из шлюза яруса 0)
    WORLD.gate = { x: gx, top: 44 + ROOM_DY, open: 0 };
  },
  /** Караульная: шкаф с оружием, стол с журналом дежурств, лавка. */
  guardroom(g, r) {
    R(g, r.x + 8, 46, 26, 50, '#3a3430'); R(g, r.x + 8, 46, 26, 1, '#5a5048'); R(g, r.x + 20, 47, 1, 49, '#22201e');
    for (let k = 0; k < 3; k++) L(g, r.x + 12 + k * 3, 52, r.x + 12 + k * 3, 80, '#1c1e20');
    R(g, r.x + 44, 78, 36, 3, '#6a5038'); R(g, r.x + 46, 81, 2, 15, '#3e2e20'); R(g, r.x + 76, 81, 2, 15, '#3e2e20');
    R(g, r.x + 52, 74, 12, 4, '#d8d0b8'); R(g, r.x + 66, 73, 4, 5, '#8a6a3a');   // журнал и кружка
  },

  /** ST-001: «НАЧАЛЬНИК СТАНЦИИ» (260): рабочая зона слева, спальная в середине, оружейка-ниша за решёткой справа (запертая дверь).
      Решётка — в плоскости задней стены, Глеб проходит перед ней; доступа внутрь нет. Базовая графика этапа B. */
  chief(g, r) {
    const x = r.x;
    // A. Рабочая: план станции на стене, шкаф документов, стол с бумагами, телефон, лампа, стул
    R(g, x + 12, 30, 44, 26, '#3a3a32'); R(g, x + 13, 31, 42, 24, '#c8bfa0');
    for (let k = 0; k < 5; k++) R(g, x + 16, 34 + k * 4, 36, 1, '#6a6450');                        // ярусы на плане
    R(g, x + 22, 33, 1, 18, '#6a6450'); R(g, x + 40, 33, 1, 18, '#6a6450'); R(g, x + 30, 42, 3, 3, '#a83a2a');   // переходы и отметка
    R(g, x + 62, 46, 22, 50, '#4e5a56'); R(g, x + 62, 46, 22, 1, '#6e7a76'); for (let k = 0; k < 3; k++) { R(g, x + 64, 52 + k * 14, 18, 1, '#2e3634'); R(g, x + 72, 55 + k * 14, 3, 1, '#a8a8a0'); }   // шкаф документов
    R(g, x + 10, 76, 48, 3, '#6a4e34'); R(g, x + 10, 76, 48, 1, '#8c6c4a'); R(g, x + 12, 79, 2, 17, '#3e2e20'); R(g, x + 54, 79, 2, 17, '#3e2e20'); R(g, x + 38, 79, 16, 9, '#5a4230');
    R(g, x + 14, 73, 12, 3, '#d8d0bc'); R(g, x + 16, 72, 10, 1, '#c8bfa8'); R(g, x + 28, 73, 7, 3, '#2a2e2c'); R(g, x + 29, 72, 5, 1, '#3a3e3c');   // бумаги, телефон
    R(g, x + 47, 62, 1, 14, '#3a3834'); R(g, x + 43, 61, 7, 3, '#5a5a52');                          // настольная лампа
    const dl = addLight(x + 46, 65, 24, [255, 200, 130], 'steady', 0.45); addEmissive(x + 44, 64, 5, 1, [255, 226, 170], dl);
    R(g, x + 26, 84, 10, 2, '#4a3a2a'); R(g, x + 26, 72, 2, 12, '#4a3a2a'); R(g, x + 27, 86, 1, 10, '#3a2a1a'); R(g, x + 34, 86, 1, 10, '#3a2a1a');   // стул
    // B. Спальная: кровать, тумба, личные вещи
    R(g, x + 100, 76, 2, 20, '#4a4844'); R(g, x + 160, 80, 2, 16, '#4a4844'); R(g, x + 102, 86, 58, 2, '#3e3c38');
    R(g, x + 102, 81, 58, 5, '#7a6e58'); R(g, x + 120, 79, 40, 6, '#4a5242'); R(g, x + 104, 78, 13, 4, '#c8bfa4');   // матрас, одеяло, подушка
    R(g, x + 166, 80, 14, 16, '#5a4632'); R(g, x + 166, 80, 14, 1, '#7a6248'); R(g, x + 170, 76, 5, 4, '#8a8a84');   // тумба и кружка
    R(g, x + 112, 40, 12, 14, '#b8a98a'); R(g, x + 113, 41, 10, 9, '#6a6a5a');                       // фото на стене
    // C. Оружейка: ниша в задней стене, стойки за решёткой, решётчатая дверь на замке
    const ax = x + 196, aw = 56;
    R(g, ax, 30, aw, 66, '#1c1f20'); R(g, ax, 30, aw, 2, '#4a4e50'); R(g, ax, 94, aw, 2, '#2a2c2c');   // глубина ниши
    for (let k = 0; k < 3; k++) { const sx = ax + 6 + k * 16; R(g, sx, 44, 10, 46, '#2e3436'); R(g, sx + 2, 48, 2, 36, '#4a3a2a'); R(g, sx + 6, 52, 1, 30, '#3a3e40'); }   // стойки с силуэтами
    R(g, ax + 2, 84, 20, 10, '#3e4a3a'); R(g, ax + 2, 84, 20, 1, '#5a6a52');                       // ящик экипировки
    for (let bx = ax; bx <= ax + aw; bx += 4) R(g, bx, 30, 1, 66, '#7a8084');                         // прутья решётки
    for (const by of [30, 52, 74, 95]) R(g, ax, by, aw + 1, 1, '#8a9094');                            // поперечины
    const dx = ax + 34;                                                                              // дверь в решётке
    R(g, dx, 40, 18, 1, '#9aa0a4'); R(g, dx, 40, 1, 56, '#9aa0a4'); R(g, dx + 18, 40, 1, 56, '#9aa0a4');
    R(g, dx + 13, 64, 5, 5, '#b8923a'); R(g, dx + 14, 61, 3, 3, '#7a7e80'); R(g, dx + 15, 66, 1, 2, '#3a2a1a');   // навесной замок
    R(g, ax - 2, 28, aw + 5, 2, '#5a6062');                                                          // рама
  },
  /** ST-001: насосная на −2 (210): магистраль, два насосных агрегата, вентили, шкаф автоматики, манометр. Базовая графика этапа B. */
  pumps(g, r) {
    const px = r.x + 104;                                                   // второй агрегат с вентилем — насосная стала просторнее
    R(g, px, 72, 46, 24, '#47595f'); R(g, px, 72, 46, 1, '#6a7e84'); R(g, px + 46, 76, 18, 20, '#3a4448');
    R(g, px + 20, 57, 6, 15, '#566c74'); disc(g, px + 23, 64, 5, '#8a3a30'); disc(g, px + 23, 64, 2, '#3a4a50');
    R(g, r.x + 4, 48, r.w - 8, 9, '#566c74'); R(g, r.x + 4, 48, r.w - 8, 2, '#7a929a'); R(g, r.x + 4, 56, r.w - 8, 1, '#34444a');
    R(g, r.x + 20, 48, 9, 48, '#566c74'); R(g, r.x + 20, 48, 2, 48, '#7a929a'); R(g, r.x + 18, 60, 13, 3, '#3e5058'); R(g, r.x + 18, 82, 13, 3, '#3e5058');
    R(g, r.x + 36, 72, 46, 24, '#47595f'); R(g, r.x + 36, 72, 46, 1, '#6a7e84'); R(g, r.x + 82, 76, 18, 20, '#3a4448');
    disc(g, r.x + 60, 64, 7, '#8a3a30'); disc(g, r.x + 60, 64, 5, '#3a4a50'); disc(g, r.x + 60, 64, 1, '#8a3a30');
    R(g, r.x + r.w - 36, 36, 30, 60, '#3f5258'); R(g, r.x + r.w - 36, 36, 30, 1, '#5e747a');
    R(g, r.x + r.w - 25, 46, 6, 40, '#1e282c'); addEmissive(r.x + r.w - 24, 62, 4, 23, [80, 150, 180], null, 'main', 'water');
    const gx = r.x + r.w - 30;                                              // ST-001 C: манометр — на щите автоматики (там же осмотр «щит»)
    disc(g, gx, 44, 5, '#d8d0bc'); disc(g, gx, 44, 4, '#2a2e30'); R(g, gx, 41, 1, 3, '#c85a4a'); R(g, gx - 1, 49, 3, 2, '#2e3a3e');
  },
};

/* ---------- MAIN: аркада и колонны зала ---------- */
function drawArcade(g) {
  for (let x = 36; x < 1966; x++) {
    let bottom = 131;
    if (x >= COLUMNS[0] && x <= COLUMNS[COLUMNS.length - 1]) {
      const left = COLUMNS[0] + Math.floor((x - COLUMNS[0]) / 160) * 160, t = ((x - left) / 160) * 2 - 1;
      bottom = 122 + Math.round(9 * t * t);
    }
    for (let y = 122; y < bottom; y++) R(g, x, y, 1, 1, rgb([62, 66, 68], 0.92 + hash(x, y) * 0.16));
    if (bottom > 122) { R(g, x, bottom - 1, 1, 1, '#8c928e'); R(g, x, bottom, 1, 1, 'rgba(0,0,0,.35)'); }
  }
}
const COLUMN_RAMP = [[150,156,148],[134,142,134],[122,130,123],[116,124,118],[112,120,114],[108,116,110],
  [104,112,106],[100,108,102],[94,102,97],[88,96,91],[82,89,85],[74,80,77],[62,67,65],[46,50,49]];
function drawColumn(g, cx, idx) {
  for (let dx = 0; dx < 14; dx++) R(g, cx - 7 + dx, 131, 1, 75, rgb(COLUMN_RAMP[dx]));
  for (let k = 0; k < 7; k++) {                                         // прожилки мрамора
    let vx = cx - 6 + ((hash(idx, k) * 12) | 0), vy = 134 + ((hash(k, idx) * 60) | 0);
    for (let s = 0; s < 10; s++) { R(g, vx, vy, 1, 1, 'rgba(40,46,44,.35)'); vy++; if (hash(vx, vy) > 0.6) vx += hash(vy, vx) > 0.5 ? 1 : -1; vx = clamp(vx, cx - 6, cx + 5); }
  }
  for (let y = 176; y < 206; y++) for (let dx = 0; dx < 14; dx++)    // грязь внизу
    if (dither(cx + dx, y) < (y - 176) / 44) R(g, cx - 7 + dx, y, 1, 1, 'rgba(18,20,22,.38)');
  R(g, cx - 9, 127, 18, 4, '#7e8680'); R(g, cx - 9, 127, 18, 1, '#aab2aa'); R(g, cx - 8, 131, 16, 1, '#454b49');
  R(g, cx - 9, 206, 18, 8, '#5a605c'); R(g, cx - 9, 206, 18, 1, '#8a908a'); R(g, cx - 9, 213, 18, 1, '#2a2e2c');
  if (cx < 740) {                                                       // жилой сектор: ткань и записки
    R(g, cx - 7, 150, 14, 9, '#7a3b34'); R(g, cx - 7, 150, 14, 1, '#9a5448');
    for (let k = 0; k < 14; k += 4) R(g, cx - 7 + k, 154, 2, 1, '#c09a5a');
    R(g, cx - 4, 168, 7, 9, '#b8b098'); R(g, cx - 3, 170, 5, 1, '#6a6458'); R(g, cx - 3, 172, 4, 1, '#6a6458');
  } else if (cx > 1300) {                                               // техзона: кабели, полосы
    R(g, cx + 3, 131, 2, 75, '#17191b'); R(g, cx + 5, 131, 1, 75, '#2a2e30');
    for (let y = 196; y < 206; y++) for (let dx = 0; dx < 14; dx++)
      R(g, cx - 7 + dx, y, 1, 1, ((dx + y) >> 2) % 2 ? '#b8922e' : '#1e1e1e');
  }
  if (idx === 6) {                                                      // скол — сквозь него видна стена
    g.clearRect(cx + 2, 158, 5, 10); g.clearRect(cx + 4, 157, 3, 13);
    L(g, cx + 3, 157, cx + 6, 170, '#7a4a30'); L(g, cx + 5, 156, cx + 5, 171, '#6a3e28');
  }
}
const HALL_LAMPS = [                                                     // лампы зала: состояние задаёт характер участков
  [260, 'steady'], [420, 'steady'], [580, 'flicker'], [708, 'steady'], [900, 'steady'],
  [1060, 'steady'], [1220, 'steady'], [1380, 'dead'], [1540, 'flicker'], [1700, 'steady'],
];
function drawHallLamps(g) {
  HALL_LAMPS.forEach(([lx, mode]) => {
    const cold = lx > 1300, col = cold ? [200, 224, 236] : [255, 206, 140];
    R(g, lx, 122, 1, 9, '#1c1e20');
    R(g, lx - 4, 131, 9, 1, '#3a3e40'); R(g, lx - 5, 132, 11, 2, '#545a5c'); R(g, lx - 5, 132, 11, 1, '#70767a');
    const l = addLight(lx, 138, 92, col, mode, 1);
    l.pool = true;
    addEmissive(lx - 2, 134, 5, 1, cold ? [230, 246, 255] : [255, 236, 190], l);
  });
}

/* ---------- MAIN: торцы станции ---------- */
function drawEnds(g) {
  // Запад: пост 1 «К Спортивной» — бетонный торец с гермодверью, щит с бойницами, мешки, закрытый тоннель над путями.
  paintRegion(g, 0, 122, 62, 92, (x, y, o) => setC(o, 52, 54, 56, (hash(x, y) - 0.5) * 12 + ((y - 122) % 18 === 0 ? -10 : 0) + (x === 61 ? 18 : 0)));
  drawBlastGate(g, 2000 - 1878 - 92, true);                                  // 1.0.1: гермоворота как у Поста 2, зеркально (рама 30–122)
  drawText(g, 'ПОСТ 1', 60, 150, '#c8b88a', 'rgba(0,0,0,.5)');               // трафарет на створке, как «ПОСТ 2»
  addBeacon(g, 32, 158);                                                     // аварийный маяк (0.8) — на прежнем месте, на раме ворот
  R(g, 126, 146, 2, 8, '#2a2c2e'); R(g, 123, 153, 9, 3, '#545a5c'); R(g, 123, 153, 9, 1, '#70767a');   // служебная лампа — у рамы, зеркально лампе Поста 2
  const wl = addLight(128, 158, 74, [210, 226, 236], 'steady', 0.9, 'main', 'technical');
  addEmissive(125, 156, 5, 1, [230, 246, 255], wl);
  R(g, 68, 174, 66, 22, '#4c5254'); R(g, 68, 174, 66, 1, '#6c7274');                                  // бронещит с бойницами
  for (let y = 177; y < 196; y += 3) R(g, 68, y, 66, 1, 'rgba(0,0,0,.16)');
  R(g, 82, 181, 12, 3, '#0c0e10'); R(g, 108, 181, 12, 3, '#0c0e10'); R(g, 96, 178, 6, 12, 'rgba(122,70,40,.5)');
  for (let k = 0; k < 7; k++) { const bx = 68 + k * 10; L(g, bx, 174, bx + 5, 168, '#6a6a68'); L(g, bx + 5, 168, bx + 10, 174, '#6a6a68'); }
  for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) {                                   // мешки с песком
    const bx = 64 + k * 13 + (row % 2) * 6, by = 207 - row * 6;
    R(g, bx, by, 12, 6, '#776c52'); R(g, bx + 1, by, 10, 1, '#9a8e6c'); R(g, bx, by + 5, 12, 1, '#4a4232');
  }
  plate(g, 82, 128, 'К СПОРТИВНОЙ', '#2f5660', '#dfe6d6', '#6f9a98');
  tunnelGrille(g, 0, 34);
  // Восток: гермозатвор (1.0.1 — общая функция, рисунок прежний).
  drawBlastGate(g, 1878);
  paintRegion(g, 1970, 122, 30, 92, (x, y, o) => setC(o, 40, 42, 44, (hash(x, y) - 0.5) * 12));
  plate(g, 1924, 140, 'К МОСКОВСКОЙ', '#2f5660', '#dfe6d6', '#6f9a98');                       // пост 2: будущий тоннельный КПП
  drawText(g, 'ПОСТ 2', 1908, 180, '#c8b88a', 'rgba(0,0,0,.5)');
  R(g, 1874, 146, 2, 8, '#2a2c2e'); R(g, 1868, 153, 9, 3, '#545a5c'); R(g, 1868, 153, 9, 1, '#70767a');
  const el = addLight(1872, 158, 74, [210, 226, 236], 'steady', 0.9, 'main', 'technical');       // служебная лампа поста
  addEmissive(1870, 156, 5, 1, [230, 246, 255], el);
  for (let row = 0; row < 2; row++) for (let k = 0; k < 3; k++) {                                  // низкие мешки у затвора
    const bx = 1852 + k * 11 + (row % 2) * 5, by = 208 - row * 6;
    R(g, bx, by, 11, 6, '#776c52'); R(g, bx + 1, by, 9, 1, '#9a8e6c'); R(g, bx, by + 5, 11, 1, '#4a4232');
  }
  tunnelGrille(g, 1966, 2000);
  R(g, 1920, 124, 9, 4, '#2a1a18');
  const red = addLight(1924, 128, 70, [255, 60, 40], 'pulse', 0.9, 'main', 'emergency');
  addEmissive(1921, 125, 7, 2, [255, 70, 50], red);
}

/** 1.0.1: гермоворота торца платформы (рама 92×92, створка, заклёпки, полоса, штурвал, щель).
    x0 — левый край рамы; mirror — щель приоткрытой створки слева (западный торец). */
function drawBlastGate(g, x0, mirror = false) {
  const lx = x0 + 8, cx = x0 + 46;
  R(g, x0, 122, 92, 92, '#2c3134'); R(g, x0, 122, 92, 1, '#4a5054');
  R(g, lx, 130, 76, 84, '#566064'); R(g, lx, 130, 76, 1, '#7a868a'); R(g, mirror ? lx + 74 : lx, 130, 2, 84, '#6c787c');
  for (let y = 136; y < 196; y += 12) for (let x = lx + 6; x < lx + 72; x += 10) R(g, x, y, 1, 1, '#3a4246');
  for (let y = 196; y < 206; y++) for (let x = lx; x < lx + 76; x++) R(g, x, y, 1, 1, ((x + y) >> 2) % 2 ? '#b8922e' : '#1e1e1e');
  disc(g, cx, 168, 11, '#3a4246'); disc(g, cx, 168, 9, '#6a767a'); disc(g, cx, 168, 7, '#3a4246');
  L(g, cx - 9, 168, cx + 9, 168, '#6a767a'); L(g, cx, 159, cx, 177, '#6a767a');
  R(g, mirror ? x0 + 2 : lx + 76, 130, 6, 84, '#0c0e10');               // щель приоткрытой створки
}
/** 1.0.1: линия стыка задней стены с полом у этажа (низ проёма арки). */
const ARCH_BASE = { vestibule: 96 + CONFIG.FLOORS.vestibule.y - CONFIG.FLOORS.upper.y, upper: 96, platform: 214, utility: 366 };
const ARCH_H = 46;
/** Прямоугольник проёма служебной арки (мировые координаты, без косяков). */
function archRect(e) { const base = ARCH_BASE[e.floor]; return { x0: e.x - 11, x1: e.x + 11, top: base - ARCH_H, base }; }
/** Служебная арка: бетонный пилон с табличкой, полукруглый проём, внутри — лестничный марш сбоку (ступени уходят вверх
    вглубь, поручень, тёплая лампа на стене шахты). Дверей и створок нет. Одинаковая для всех проходов. */
function drawServiceArch(g, e) {
  const { x0, x1, top, base } = archRect(e), cx = e.x, R0 = (x1 - x0) / 2;
  const conc = (x, y, v) => R(g, x, y, 1, 1, rgb([v + (hash(x, y + 77) - 0.5) * 9, v - 2, v - 5]));
  // пилон: выступающий бетонный блок от пола до таблички
  const px0 = cx - ARCH_HALF, px1 = cx + ARCH_HALF, ptop = top - 22;
  for (let y = ptop; y < base; y++) for (let x = px0; x < px1; x++) {
    let v = 92;
    if (x === px0) v = 118; else if (x === px1 - 1) v = 58; else if (x === px1 - 2) v = 70;
    if (y === ptop) v = 124; if (y === ptop + 1) v = 104;
    if ((y - ptop) % 16 === 15) v -= 10;                                         // швы опалубки
    if (y > base - 6) v -= 12;                                                   // грязь у пола
    conc(x, y, v);
  }
  // проём: полукруглый свод, глубина шахты
  const inside = (x, y) => { if (y >= top + R0) return x >= x0 && x < x1; const dy = top + R0 - y, dx = x + 0.5 - cx; return dx * dx + dy * dy <= R0 * R0; };
  for (let y = top - 3; y < base; y++) for (let x = x0 - 3; x < x1 + 3; x++) {
    if (inside(x, y)) {
      const depth = (y - top) / ARCH_H, v = Math.round(8 + 12 * depth + (x - x0) * 0.25);
      R(g, x, y, 1, 1, `rgb(${v},${v + 2},${v + 4})`);
    } else if (inside(x - 3, y) || inside(x + 3, y) || inside(x, y + 3)) conc(x, y, x > cx ? 76 : 132);   // обрамление: свет слева, тень справа
  }
  if (e.dir === 'down') drawArchDown(g, x0, x1, top, base, cx, R0, inside);
  else {
    // ПОДЪЁМ — марш сбоку: ступени от порога поднимаются слева направо вглубь, поручень параллельно
    const st = 3, n = 9;
    for (let k = 0; k < n; k++) {
      const sx = x0 + 1 + k * 2, sy = base - 1 - k * st;
      if (sy < top + R0) break;
      const c = 78 - k * 6;
      R(g, sx, sy - 1, x1 - sx - 1, 1, rgb([c + 18, c + 16, c + 12]));          // проступь
      R(g, sx, sy, x1 - sx - 1, st - 1, rgb([c - 20, c - 22, c - 24]));          // подступенок
    }
    L(g, x0 + 1, base - 14, x1 - 2, base - 14 - Math.round((x1 - x0 - 3) * 1.5), '#5a564e');   // поручень
    for (let k = 0; k < 3; k++) { const hx = x0 + 3 + k * 7; R(g, hx, base - 13 - k * 10, 1, 9, '#3a3834'); }    // стойки поручня
  }
  // тёплая лампа на стене шахты
  const lx = x1 - 3, ly = top + R0 + 4;
  R(g, lx - 1, ly - 1, 3, 4, '#2a2622'); R(g, lx, ly, 1, 2, '#ffd890');
  const il = addLight(lx, ly + 1, 18, [255, 196, 120], 'steady', 0.5);
  il.clip = { x0, x1, y0: top, y1: base }; addEmissive(lx, ly, 1, 2, [255, 222, 160], il);
  // порог и потёки
  R(g, x0 - 3, base - 1, x1 - x0 + 6, 1, '#3a3632');
  for (let k = 0; k < 3; k++) {
    const x = px0 + 2 + ((hash(e.x, k) * (px1 - px0 - 4)) | 0), len = 5 + ((hash(k, e.x) * 12) | 0);
    for (let y = ptop + 14; y < ptop + 14 + len; y++) if (!inside(x, y)) R(g, x, y, 1, 1, 'rgba(40,34,26,.3)');
  }
  // табличка направления на пилоне: стрелка пикселями (▲/▼ нет в шрифте) + текст
  const tw = textWidth(e.sign) + 14, sx = Math.round(cx - tw / 2), sy = ptop + 4, up = e.dir === 'up';
  R(g, sx, sy, tw, 11, '#2f3c3e'); R(g, sx, sy, tw, 1, '#4a5254'); R(g, sx, sy + 10, tw, 1, '#1a2224');
  for (let k = 0; k < 4; k++) R(g, sx + 6 - k, up ? sy + 3 + k : sy + 6 - k, 1 + 2 * k, 1, '#e0c48c');
  drawText(g, e.sign, sx + 11, sy + 2, '#e0c48c', 'rgba(0,0,0,.5)');
}
/** СПУСК — взгляд с верхней площадки вниз, в шахту (перспектива, не отражение марша «вверх»):
    у порога горизонтальная площадка (ARCH_LANDING px вглубь), за её кромкой — провал; стены, потолок и марш сходятся
    к точке схода ниже уровня глаз. Ступени видны только проступями (подступенки смотрят от зрителя), вглубь они уже и темнее;
    поручни идут вдоль площадки и у начала марша ломаются вниз, в глубину. Отверстий в полу нет — всё внутри проёма. */
function drawArchDown(g, x0, x1, top, base, cx, R0, inside) {
  const edge = base - ARCH_LANDING, vy = base - 14, ix0 = cx - 4, ix1 = cx + 4, iy0 = top + 12;   // дальний конец шахты — малый прямоугольник
  for (let y = top; y < edge; y++) for (let x = x0; x < x1; x++) {
    if (!inside(x, y)) continue;
    const X = x + 0.5, Y = y + 0.5;
    const sL = (X - x0) / (ix0 - x0), sR = (x1 - X) / (x1 - ix1), sT = (Y - top) / (iy0 - top), sB = (edge - Y) / (edge - vy);
    const sm = Math.min(sL, sR, sT, sB), d = 1 - Math.min(1, sm);             // d: 1 — у проёма, 0 — дальний конец
    let v;
    if (sm >= 1) v = y < vy - 6 ? 12 : 3;                                       // дальняя стена; ниже — провал, марш идёт дальше вниз
    else if (sm === sB) { const r = edge - 1 - y; v = r === 0 ? 2 : ([2, 4, 6, 7, 8].includes(r) ? 16 + 54 * d : 4 + 5 * d); }   // проступи и щели
    else if (sm === sT) v = 7 + 10 * d;                                         // потолок марша
    else { v = 15 + 36 * d + (sm === sR ? 7 * d : 0); if (Math.abs(Y - (base - 22) - (vy + 1 - (base - 22)) * (1 - d)) < 0.6) v -= 8; }   // стены, шов на высоте поручня
    v = Math.round(v); R(g, x, y, 1, 1, `rgb(${v},${v + 1},${v + 3})`);
  }
  for (let r = 0; r < ARCH_LANDING; r++) {                                      // площадка: светлая у порога, кромка над провалом
    const y = base - 1 - r, ins = r, v = r === ARCH_LANDING - 1 ? 92 : 70 - r * 7;
    R(g, x0 + Math.floor(ins / 2), y, x1 - x0 - 2 * Math.floor(ins / 2), 1, rgb([v + 4, v + 2, v - 2]));
  }
  for (const sgn of [-1, 1]) {                                                  // поручни: вдоль площадки, затем вниз, в глубину
    const nx = sgn < 0 ? x0 + 1 : x1 - 2, kx = sgn < 0 ? x0 + 4 : x1 - 5, fx2 = sgn < 0 ? cx - 4 : cx + 3;
    L(g, nx, base - 14, kx, base - 16, '#5e5a52'); L(g, kx, base - 16, fx2, base - 12, '#4a4740');
    R(g, nx + (sgn < 0 ? 1 : -1), base - 14, 1, 10, '#3a3834');                // стойка на площадке
  }
}
function drawArches(g, floors) {
  for (const q of CONFIG.PASSAGES) for (const e of [q.a, q.b]) if (floors.includes(e.floor)) drawServiceArch(g, e);
}
/** Закрытый тоннель над путями у торца: тёмный портал с решёткой и предупреждающей полосой. */
function tunnelGrille(g, x0, x1) {
  R(g, x0, 228, x1 - x0, 42, '#07090b');
  for (let x = x0; x < x1; x++) R(g, x, 228, 1, 3, ((x >> 2) % 2) ? '#b8922e' : '#1e1e1e');
  for (let x = x0 + 2; x < x1; x += 5) R(g, x, 231, 1, 36, '#3a3e40');
  R(g, x0, 242, x1 - x0, 1, '#3a3e40'); R(g, x0, 256, x1 - x0, 1, '#3a3e40');
}
/** Место собраний: помост, трибуна, громкоговоритель, доска объявлений. Ниже роста героя — не загораживает путь. */
function drawAssembly(g) {
  R(g, 844, 206, 46, 8, '#5e4630'); R(g, 844, 206, 46, 1, '#8a6a48'); R(g, 844, 213, 46, 1, '#2a1e14');
  for (let x = 853; x < 890; x += 9) R(g, x, 207, 1, 6, '#3e2e20');
  R(g, 858, 188, 16, 18, '#6a4e34'); R(g, 858, 188, 16, 2, '#8c6c4c'); R(g, 860, 192, 12, 11, '#7a2e28');
  R(g, 865, 194, 2, 6, '#c8a050'); R(g, 863, 196, 6, 2, '#c8a050');
  R(g, 884, 176, 2, 30, '#3a3c3c'); R(g, 877, 172, 10, 6, '#6a6e70'); R(g, 875, 171, 3, 8, '#8a8e90');   // громкоговоритель
  R(g, 893, 170, 32, 8, '#2f3c3e'); R(g, 893, 170, 32, 1, '#4a5254'); drawText(g, 'СБОР', 899, 171, '#e0c48c', 'rgba(0,0,0,.5)');
  R(g, 894, 178, 30, 22, '#3e2e20'); R(g, 896, 180, 26, 18, '#8a7452');
  R(g, 897, 200, 2, 14, '#3e2e20'); R(g, 919, 200, 2, 14, '#3e2e20');
  [[898, 182, 7, 6, '#d8d0b8'], [907, 181, 6, 8, '#c8c0a8'], [915, 183, 6, 5, '#e0d8c0'], [899, 191, 9, 5, '#c8b898'], [911, 191, 9, 6, '#d8d0b8']]
    .forEach(([x, y, w, h, c]) => { R(g, x, y, w, h, c); R(g, x + 1, y + 2, w - 2, 1, '#6a6458'); });
}

/* ---------- MAIN: обстановка на платформе по зонам ---------- */
function tent(g, x, w, h, cloth) {
  for (let k = 0; k <= h; k++) {
    const half = Math.round((w / 2) * (k / h)), y = 214 - h + k;
    R(g, x + w / 2 - half, y, half, 1, rgb(cloth, 0.78)); R(g, x + w / 2, y, half, 1, rgb(cloth));
  }
  for (let k = 0; k < h * 0.55; k++) { const half = Math.round(5 * (k / (h * 0.55))); R(g, x + w / 2 - half + 2, 214 - h * 0.55 + k, half * 2, 1, '#1c1a16'); }
  R(g, x + w / 2 + 6, 214 - h * 0.6, 7, 5, '#8a6a42');
  L(g, x + w / 2, 214 - h - 3, x + w / 2, 214 - h, '#3a3a36'); L(g, x - 4, 214, x + 4, 214 - h * 0.6, '#5a5446');
}
function crate(g, x, y, w, h) {
  R(g, x, y, w, h, '#6e5236'); R(g, x, y, w, 1, '#94744e'); R(g, x, y + h - 1, w, 1, '#3e2c1c');
  R(g, x, y, 1, h, '#4e3a26'); R(g, x + w - 1, y, 1, h, '#4e3a26'); L(g, x + 1, y + 1, x + w - 2, y + h - 2, '#5a4228');
}
function barrel(g, x, y, c = [74, 66, 58]) {
  R(g, x, y, 12, 16, rgb(c)); R(g, x, y, 2, 16, rgb(c, 1.25)); R(g, x + 10, y, 2, 16, rgb(c, 0.7));
  R(g, x, y + 3, 12, 1, '#7a4a2e'); R(g, x, y + 11, 12, 1, '#7a4a2e'); R(g, x, y, 12, 1, rgb(c, 1.4));
}
function bench(g, x) {
  R(g, x, 197, 44, 3, '#6a4e34'); R(g, x, 197, 44, 1, '#8c6c4c'); R(g, x, 189, 44, 2, '#6a4e34'); R(g, x, 189, 44, 1, '#8c6c4c');
  R(g, x + 3, 191, 2, 6, '#2e3032'); R(g, x + 39, 191, 2, 6, '#2e3032');
  R(g, x + 3, 200, 2, 14, '#2e3032'); R(g, x + 39, 200, 2, 14, '#2e3032');
}
function drawProps(g) {
  // --- Жилой сектор ---
  tent(g, 196, 52, 34, [104, 112, 82]);
  R(g, 262, 208, 38, 6, '#8c7b60'); R(g, 270, 205, 30, 4, '#7a3b34'); R(g, 263, 205, 7, 3, '#c0b69c');
  crate(g, 312, 198, 18, 16); crate(g, 330, 202, 14, 12); crate(g, 316, 186, 14, 12);
  cable(g, COLUMNS[1], COLUMNS[2], 150, 10, '#2a2a28');                  // бельевая верёвка
  [[366, 20, '#8a8070'], [388, 14, '#5a6a7a'], [414, 18, '#9a5a4a'], [440, 12, '#c8c0a8'], [464, 16, '#6a7a5a']].forEach(([cx, h, c]) => {
    const t = (cx - COLUMNS[1]) / 160, y = 151 + Math.round(40 * t * (1 - t));
    R(g, cx - 5, y, 11, h, c); R(g, cx - 5, y, 11, 1, rgb([230, 220, 200], 0.6));
  });
  for (let k = 0; k < 6; k++) R(g, 628 + k * 9, 140, 9, 68 + (k % 2) * 4, k % 2 ? '#6a4038' : '#7a4a40');   // занавес
  R(g, 626, 139, 58, 2, '#3a3a36');
  R(g, 540, 200, 34, 3, '#7a5a3e'); R(g, 543, 203, 2, 11, '#3e2e20'); R(g, 569, 203, 2, 11, '#3e2e20');      // столик
  R(g, 548, 196, 6, 4, '#5c6266'); R(g, 562, 196, 2, 4, '#e8e0c8');
  const candle = addLight(563, 194, 26, [255, 180, 100], 'fire', 0.55);
  addEmissive(563, 194, 1, 2, [255, 210, 120], candle, 'main', 'fire');
  barrel(g, 598, 198, [54, 80, 104]); barrel(g, 612, 200, [54, 80, 104]);
  // --- Центральная платформа ---
  bench(g, 790); bench(g, 1170);
  drawAssembly(g);
  R(g, 1108, 204, 18, 10, '#5a4a3a'); R(g, 1108, 204, 18, 1, '#7a6a52'); R(g, 1112, 196, 14, 8, '#4a5a6a'); R(g, 1115, 194, 6, 2, '#2a2a2a');   // чемоданы
  R(g, 1244, 206, 10, 8, '#22262a'); R(g, 1246, 204, 8, 4, '#2e3236');                                     // мешки с мусором
  barrel(g, 1034, 198, [70, 58, 50]);
  WORLD.fire = { x: 1040, y: 198, light: addLight(1040, 190, 84, [255, 140, 60], 'fire', 1.15) };
  crate(g, 1086, 200, 16, 14);
  // --- Техническая зона ---
  disc(g, 1374, 204, 10, '#4a3a2a'); disc(g, 1374, 204, 7, '#262a2c'); disc(g, 1374, 204, 2, '#6a5a3a');   // кабельный барабан
  R(g, 1440, 170, 24, 44, '#46525a'); R(g, 1440, 170, 24, 1, '#66727a'); R(g, 1451, 171, 1, 43, '#2e383e');  // электрошкаф
  for (let k = 0; k < 3; k++) addEmissive(1444 + k * 6, 176, 2, 1, k === 1 ? [255, 90, 60] : [110, 230, 120], null, 'main', 'blink');
  [1648, 1662].forEach(px => { R(g, px, 122, 6, 92, '#4e5a5e'); R(g, px, 122, 2, 92, '#6e7a7e');
    R(g, px - 2, 150, 10, 3, '#3a4448'); R(g, px - 2, 190, 10, 3, '#3a4448'); });
  disc(g, 1651, 172, 5, '#8a3a30'); disc(g, 1651, 172, 3, '#4e5a5e');
  for (let x = 1580; x < 1626; x++) R(g, x, 196, 1, 4, ((x >> 2) % 2) ? '#c8a03c' : '#1a1a1a');            // ограждение (1.0.1: снова на месте)
  R(g, 1582, 200, 2, 14, '#3a3a38'); R(g, 1622, 200, 2, 14, '#3a3a38');
  barrel(g, 1690, 198, [90, 62, 44]); barrel(g, 1704, 199, [80, 70, 54]);
  R(g, 1730, 206, 16, 8, '#6a2a24'); R(g, 1730, 206, 16, 1, '#8a3a30');                                     // ящик с инструментом
  L(g, 1772, 122, 1776, 150, '#1a1a1a', 2);                                                                 // оборванный кабель
  WORLD.spark = { x: 1776, y: 151, timer: 2, flash: addLight(1776, 152, 60, [170, 210, 255], 'spark', 1, 'main', 'technical') };
}

/* ---------- BACK: дальняя стена зала ---------- */
function backTexel(x, y, o) {
  if (y < 122 || y >= 214) return false;
  const mx = (x - 25) / CONFIG.PARALLAX.BACK, n = (hash(x, y) - 0.5) * 9;
  if (y < 128) return setC(o, 24, 27, 30, n * 0.6);
  if (y >= 196) {                                                       // гранитный цоколь
    if (y === 196) return setC(o, 78, 80, 78, n);
    if (y === 213) return setC(o, 18, 20, 22);
    return setC(o, 46, 48, 50, n + (hash(x >> 3, y >> 2) > 0.8 ? 6 : 0));
  }
  const grime = dither(x, y) < (y - 160) / 60 ? 0.8 : 1;
  const streak = hash(x >> 1, 11) > 0.92 && y < 128 + hash(x >> 1, 12) * 60 ? 0.84 : 1;
  const shadowTop = y < 132 ? 0.75 : 1;
  const k = grime * streak * shadowTop;
  if (mx < 740) {                                                       // жилой сектор: штукатурка, местами плитка
    const tile = y > 150 && ((x % 12 === 0) || (y % 8 === 0));
    return setC(o, (tile ? 70 : 82) * k, (tile ? 70 : 80) * k, (tile ? 64 : 70) * k, n);
  }
  if (mx < 1300) {                                                      // платформа: мраморные панели
    const panel = (x / 30) | 0, seam = x % 30 === 0 || y === 162;
    const base = panel % 2 ? [84, 98, 96] : [78, 92, 89];
    const vein = Math.sin(x * 0.19 + y * 0.31 + panel * 1.7) + Math.sin(x * 0.05 - y * 0.12 + panel) * 0.6 > 1.42 ? 1.16 : 1;
    const kk = k * vein * (seam ? 0.74 : 1);
    return setC(o, base[0] * kk, base[1] * kk, base[2] * kk, n);
  }
  const seam = x % 48 === 0 || (y - 128) % 24 === 0;                    // техзона: бетон с опалубкой
  const rust = hash(x >> 2, 13) > 0.9 && y > 140 && y < 140 + hash(x >> 2, 14) * 50 ? [1.18, 0.92, 0.8] : [1, 1, 1];
  return setC(o, 66 * k * rust[0] * (seam ? 0.78 : 1), 68 * k * rust[1] * (seam ? 0.78 : 1), 66 * k * rust[2] * (seam ? 0.78 : 1), n);
}
function drawBackDecor(g) {
  // Жилой сектор: ковры, полки, гирлянда.
  [[260, '#8a3a30', '#c09a5a'], [560, '#3a4a6a', '#b88a4a']].forEach(([mx, field, ornament]) => {
    const x = toBack(mx);
    R(g, x - 26, 138, 52, 2, '#3a3a36');
    R(g, x - 24, 140, 48, 34, '#4a2420'); R(g, x - 22, 142, 44, 30, field);
    for (let k = 0; k < 4; k++) { const cx = x - 15 + k * 10; R(g, cx, 152, 2, 2, ornament); R(g, cx - 2, 154, 6, 2, ornament); R(g, cx, 156, 2, 2, ornament); }
    for (let k = 0; k < 44; k += 3) { R(g, x - 22 + k, 144, 2, 1, ornament); R(g, x - 22 + k, 169, 2, 1, ornament); }
  });
  const sx = toBack(410);
  R(g, sx - 22, 160, 44, 2, '#5a4430');
  ['#8a6a3a', '#5a7a5a', '#9a8a5a', '#7a5a4a', '#6a7a8a'].forEach((c, k) => R(g, sx - 18 + k * 8, 153, 5, 7, c));
  const g0 = toBack(150), g1 = toBack(720);
  cable(g, g0, g1, 133, 3, '#2a2a28');
  for (let x = g0 + 6, k = 0; x < g1; x += 11, k++) {
    const t = (x - g0) / (g1 - g0), y = 134 + Math.round(12 * t * (1 - t) * ((x / 110) % 1));
    const c = [[255, 190, 90], [255, 120, 80], [180, 230, 120], [255, 220, 140]][k % 4];
    addEmissive(x, y, 1, 2, c, null, 'back', 'garland');
  }
  [220, 450, 660].forEach(mx => addLight(toBack(mx), 140, 46, [255, 180, 110], 'garland', 0.38, 'back'));
  // Платформа: ниши, таблички с названием, табло.
  [900, 1060, 1220].forEach((mx, k) => {
    const x = toBack(mx);
    for (let y = 0; y < 50; y++) {
      const half = y < 12 ? Math.round(Math.sqrt(144 - (12 - y) * (12 - y)) * 2.5) : 30;
      R(g, x - half, 140 + y, half * 2, 1, rgb([58, 68, 68], 0.9 + hash(k, y) * 0.1));
    }
    R(g, x - 30, 190, 60, 1, '#8a948e');
    if (k === 0 || k === 1) plate(g, x, 158, 'ГАГАРИНСКАЯ', '#2f5660', '#dfe6d6', '#6f9a98');   // ниша у лестницы (k=2) — схема
    if (k === 2) {
      R(g, x - 22, 150, 44, 28, '#1e2628'); R(g, x - 21, 151, 42, 26, '#c8c2ac');
      for (let i = 0; i < 6; i++) { R(g, x - 16 + i * 7, 166, 3, 3, i === 3 ? '#a03a30' : '#3a3a3a'); }
      R(g, x - 16, 167, 38, 1, '#3a3a3a');
      drawText(g, 'СХЕМА', x - 14, 155, '#3a3a3a');
      g.fillStyle = 'rgba(40,36,30,.35)'; for (let i = 0; i < 40; i++) g.fillRect(x - 21 + ((hash(i, 2) * 42) | 0), 151 + ((hash(2, i) * 26) | 0), 2, 1);
    }
  });
  // Техзона: трубы, щиты, «ОПАСНО».
  const t0 = toBack(1300), t1 = toBack(1880);
  [[136, 6, '#4e5a60'], [146, 4, '#5a4a3a']].forEach(([y, h, c]) => {
    R(g, t0, y, t1 - t0, h, c); R(g, t0, y, t1 - t0, 1, 'rgba(255,255,255,.12)'); R(g, t0, y + h - 1, t1 - t0, 1, 'rgba(0,0,0,.3)');
    for (let x = t0 + 20; x < t1; x += 60) R(g, x, y - 1, 3, h + 2, '#3a4448');
  });
  [1400, 1620].forEach(mx => { const x = toBack(mx); R(g, x, 160, 26, 34, '#4a545a'); R(g, x, 160, 26, 1, '#6a747a');
    R(g, x + 3, 164, 20, 4, '#b8922e'); R(g, x + 12, 170, 2, 20, '#2e363a'); });
  plate(g, toBack(1690), 170, 'ОПАСНО', '#6a2a22', '#f0d0a8', '#9a4a3a');   // 1.0.1: правее арки «▼ ХОЗБЛОК», чтобы при параллаксе не заходить за пилон
  cable(g, t0, t1, 152, 10, '#151617'); cable(g, t0 + 30, t1, 156, 14, '#1d1e20');
}

/* ---------- FORE: силуэты переднего плана ---------- */
function drawRubble(g, w) {
  for (let x = 0; x < w; x += 1) {                                      // щебень у нижнего края
    const h = Math.max(0, Math.round((noise1(x * 0.06, 41) - 0.55) * 26));
    if (h > 0) { R(g, x, H - h, 1, h, '#07090b'); R(g, x, H - h, 1, 1, '#1a1e22'); }
  }
}
function drawFore(g, w) {
  [520, 1180, 1640].forEach(mx => {                                     // ближние провисшие кабели под перекрытием
    const x = toFore(mx); cable(g, x, x + 90, 118, 9, '#0a0c0e'); cable(g, x + 10, x + 70, 119, 6, '#121518');
  });
}

/* ---------- MAIN: проёмы между комнатами верхнего яруса и лестница ---------- */
const DOORWAYS = [[186, 204], [466, 484], [726, 744], [856, 874], [1146, 1164], [1306, 1324], [1536, 1554], [1716, 1734]];   // [левый край, правый край] прохода
/** Проёмы между комнатами вестибюля (0.9), в координатах шаблона комнаты. */
const VEST_DOORWAYS = [[1326, 1344], [1446, 1464], [1592, 1610], [1746, 1764]];
function drawDoorways(g, list = DOORWAYS) {
  list.forEach(([a, b]) => {
    R(g, a, 50, b - a, 46, '#14171a');                                  // тёмный проём
    R(g, a - 1, 48, b - a + 2, 3, '#5c6264'); R(g, a - 1, 48, b - a + 2, 1, '#7a8082');   // перемычка
    R(g, a, 51, 1, 45, '#454b4d'); R(g, b - 1, 51, 1, 45, '#24282a');   // косяки
    R(g, a, 96, b - a, 4, '#4e463c'); R(g, a, 96, b - a, 1, '#8a8478'); R(g, a, 100, b - a, 1, '#24221f'); // порог
  });
}

/* ---------- VESTIBULE (0.9): этаж +1 в грунте под павильоном ---------- */
/** Корпус вестибюля: бетонная коробка в грунте (потолочная плита, тёмный бетон между комнатами, плита пола).
    Вокруг корпуса канвас прозрачный — там виден грунт слоя поверхности. */
function vestShellTexel(x, y, o) {
  const n = (hash(x, y + 91) - 0.5) * 10;
  if (y < VEST.shell[2] + 8) { const v = 72 + n * 1.2 - (y === VEST.shell[2] ? -20 : 0) - ((x % 48) < 2 ? 12 : 0); return setC(o, v - 4, v, v + 1); }
  if (y >= -5) { const v = 70 + n * 1.2 - ((x % 48) < 2 ? 12 : 0) - (y === -5 ? -22 : 0); return setC(o, v - 4, v, v + 1); }
  return setC(o, 25, 27, 31, n * 0.8 + Math.sin(y * 0.45 + Math.sin(x * 0.021) * 2.2) * 3);
}
function buildVestibule() {
  const c = makeCanvas(VEST.x1 - VEST.x0, -VEST.y0), g = c.getContext('2d', { willReadFrequently: true });
  g.translate(-VEST.x0, -VEST.y0);                                       // рисуем в мировых координатах
  const [sx0, sx1, sy0] = VEST.shell;
  paintRegion(g, sx0, sy0, sx1 - sx0, -sy0, vestShellTexel);
  const dy = CONFIG.FLOORS.vestibule.y - CONFIG.FLOORS.upper.y;
  ROOMS.filter(r => roomFloor(r) === 'vestibule').forEach(r => drawRoom(g, r));
  g.save(); g.translate(0, dy); drawDoorways(g, VEST_DOORWAYS); g.restore();
  CONFIG.EMERGENCY_LAMPS.filter(e => ROOMS.find(r => r.id === e.room && roomFloor(r) === 'vestibule')).forEach(e => addEmergencyLamp(g, e));
  drawArches(g, ['vestibule']);                                          // 1.0.1: служебная арка КПП
  WORLD.vest = c;
}

/* ---------- UTILITY (1.0): ярус −2 под путями ---------- */
/** Плита под путями, толща грунта между комнатами, плита пола. */
function utilTexel(x, y, o) {
  const n = (hash(x, y + 377) - 0.5) * 10, F = CONFIG.FLOORS.utility.y;
  if (y < H + 15) {                                                      // плита под путевой зоной
    let v = 64 + n * 1.2; if (x % 48 === 0 || x % 48 === 1) v -= 12; if (y === H) v -= 26; if (y >= H + 13) v -= 30;
    return setC(o, v - 4, v, v + 1);
  }
  if (y >= F + 9) {                                                      // плита пола
    let v = 58 + n * 1.2; if (x % 48 === 0 || x % 48 === 1) v -= 12; if (y === F + 9) v += 22;
    return setC(o, v - 4, v, v + 1);
  }
  const wet = Math.sin(x * 0.05 + Math.sin(y * 0.2)) > 0.92 ? -5 : 0;    // сырые потёки в грунте
  return setC(o, 24, 26, 29, n * 0.8 + Math.sin(y * 0.45 + Math.sin(x * 0.021) * 2.2) * 3 + wet);
}
/** Проёмы между комнатами яруса −2 (в координатах шаблона комнаты). */
const UTIL_DOORWAYS = [[286, 304], [516, 534], [726, 744], [916, 934], [1136, 1154], [1366, 1384], [1616, 1634], [1766, 1784]];   // ST-001: дренажная ↔ насосная
function buildUtility() {
  const c = makeCanvas(W, UTIL.y1 - UTIL.y0), g = c.getContext('2d', { willReadFrequently: true });
  g.translate(0, -UTIL.y0);                                              // мировые координаты
  paintRegion(g, 0, UTIL.y0, W, UTIL.y1 - UTIL.y0, utilTexel);
  const dy = CONFIG.FLOORS.utility.y - CONFIG.FLOORS.upper.y;
  ROOMS.filter(r => roomFloor(r) === 'utility').forEach(r => drawRoom(g, r));
  g.save(); g.translate(0, dy); drawDoorways(g, UTIL_DOORWAYS); g.restore();
  CONFIG.EMERGENCY_LAMPS.filter(e => ROOMS.find(r => r.id === e.room && roomFloor(r) === 'utility')).forEach(e => addEmergencyLamp(g, e));
  drawArches(g, ['utility']);                                            // 1.0.1: служебная арка лестничного холла
  WORLD.util = c;
}

/* ---------- SURFACE: улица над станцией и павильон ---------- */
function buildSurface() {
  // Небо: пыльные сумерки, ступенчатый градиент с дизерингом и полосами облаков.
  const skyW = 1400, sky = makeCanvas(skyW, SURF_H), gs = sky.getContext('2d', { willReadFrequently: true });
  paintRegion(gs, 0, 0, skyW, SURF_H, (x, y, o) => {
    const t = clamp(y / (SURF_H - 70) + (dither(x, y) - 0.5) * 0.09, 0, 1), band = Math.round(t * 9) / 9;
    const cloud = Math.sin(x * 0.011 + Math.sin(y * 0.08) * 2.2) * Math.sin(y * 0.19) > 0.58 ? 9 : 0;
    o[0] = 30 + band * 112 + cloud; o[1] = 28 + band * 98 + cloud; o[2] = 30 + band * 66 + cloud * 0.5; return true;
  });
  disc(gs, 820, surfRow(GROUND_Y - 135), 14, 'rgba(236,224,186,.35)'); disc(gs, 820, surfRow(GROUND_Y - 135), 9, '#e2d8b4');
  // Дальние руины многоэтажек (параллакс 0.5).
  const ruins = makeCanvas(W, SURF_H), gr = ruins.getContext('2d');
  for (let x = -10, i = 0; x < W; i++) {
    const w = 34 + ((hash(i, 1) * 58) | 0), h = 46 + ((hash(i, 2) * 112) | 0), base = surfRow(GROUND_Y) + 2, top = base - h;
    const col = hash(i, 3) > 0.5 ? [58, 54, 50] : [50, 48, 46];
    R(gr, x, top, w, h, rgb(col)); R(gr, x, top, 1, h, rgb(col, 1.18));
    for (let wy = top + 5; wy < base - 6; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6)
      R(gr, wx, wy, 3, 4, hash(wx, wy) > 0.985 ? '#7a6a44' : rgb(col, 0.62));
    for (let k = 0; k < w; k += 3) if (hash(i * 50 + k, 4) > 0.45) gr.clearRect(x + k, top, 3, (hash(k, i) * 18) | 0);   // обломанные этажи
    x += w + 6 + ((hash(i, 5) * 40) | 0);
  }
  // Улица, грунт и вестибюль (параллакс 1).
  const surf = makeCanvas(W, SURF_H), gm = surf.getContext('2d', { willReadFrequently: true });
  const R2 = (x, y, w, h, c) => R(gm, x, surfRow(y), w, h, c);
  paintRegion(gm, 0, surfRow(GROUND_Y), W, -GROUND_Y, (x, row, o) => {
    const y = row - SURF_H, n = (hash(x, y + 777) - 0.5) * 10;
    if (y === GROUND_Y) return setC(o, 104, 100, 90, n);                // бордюр
    const dy = y - GROUND_Y;                                              // 0.9: слои грунта — от уровня земли
    if (dy < 11) return setC(o, 56, 55, 52, n + (hash(x >> 1, y) > 0.95 ? -16 : 0));   // асфальт с трещинами
    if (dy < 17) return setC(o, 62, 52, 42, n);                          // подсыпка
    const st = Math.sin(y * 0.4 + Math.sin(x * 0.02) * 2) * 4, stone = hash(x >> 2, y >> 2) > 0.9 ? 10 : 0, k = Math.max(0.35, 0.9 - (dy - 17) / 120);
    return setC(o, (48 + stone) * k, (40 + stone) * k, (34 + stone) * k, n * 0.6 + st);
  });
  for (let x = 0; x < W; x += 1) if (hash(x, 31) > 0.86) R2(x, GROUND_Y - 1 - ((hash(x, 32) * 3) | 0), 1, 2 + ((hash(x, 33) * 2) | 0), '#5a5636');   // сухая трава
  for (let x = 1020; x < 1140; x++) {                                     // завал из обломков — граница слева
    const h = Math.max(0, Math.round(64 - Math.abs(x - 1092) * 0.85 + (hash(x, 7) - 0.5) * 12));
    for (let y = 0; y < h; y++) R2(x, GROUND_Y - y, 1, 1, rgb([70, 66, 60], 0.55 + hash(x, y) * 0.5 - y / 180));
  }
  L(gm, 1060, surfRow(GROUND_Y - 40), 1120, surfRow(GROUND_Y - 58), '#4a4440', 3);
  [[1250, 1], [1888, -1]].forEach(([tx, d]) => {                          // мёртвые деревья
    L(gm, tx, surfRow(GROUND_Y), tx + d * 2, surfRow(GROUND_Y - 44), '#2a2420', 3);
    L(gm, tx + d * 2, surfRow(GROUND_Y - 30), tx + d * 14, surfRow(GROUND_Y - 46), '#2a2420', 2);
    L(gm, tx + d, surfRow(GROUND_Y - 20), tx - d * 10, surfRow(GROUND_Y - 34), '#2a2420', 2);
    L(gm, tx + d * 2, surfRow(GROUND_Y - 44), tx - d * 4, surfRow(GROUND_Y - 58), '#2a2420', 1);
  });
  [[1330, 1], [1774, -1]].forEach(([lx, d]) => {                          // погнутые фонари
    R2(lx, GROUND_Y - 44, 2, 44, '#3a3c3c'); L(gm, lx, surfRow(GROUND_Y - 44), lx + d * 10, surfRow(GROUND_Y - 52), '#3a3c3c', 2);
    R2(lx + d * 10 - 3, GROUND_Y - 52, 7, 2, '#4a4c4c');
  });
  // Гараж-ракушка (поиск топлива): корпус здесь, створка — в кадре (открыта, когда обыскан).
  R2(1176, GROUND_Y - 32, 50, 32, '#4a4e4c'); R2(1174, GROUND_Y - 35, 54, 4, '#5e625e'); R2(1174, GROUND_Y - 35, 54, 1, '#7a7e78');
  for (let x = 1178; x < 1226; x += 4) R2(x, GROUND_Y - 31, 1, 31, '#3e4240');
  R2(1186, GROUND_Y - 28, 30, 28, '#141618'); R2(1185, GROUND_Y - 29, 32, 1, '#2a2c2c');
  for (let k = 0; k < 6; k++) R2(1178 + k * 8, GROUND_Y - 34 + (k % 2), 4, 2, 'rgba(110,60,40,.55)');   // ржавчина
  drawText(gm, '17', 1218, surfRow(GROUND_Y - 27), '#8a8a80', null);
  // Тайник разведчиков у забора: мешки, ящик, мелом — знак «Р».
  for (let k = 0; k < 4; k++) { R2(1918 + k * 11, GROUND_Y - 6, 12, 6, '#776c52'); R2(1919 + k * 11, GROUND_Y - 6, 10, 1, '#9a8e6c'); }
  R2(1926, GROUND_Y - 16, 22, 10, '#5a4630'); R2(1926, GROUND_Y - 16, 22, 1, '#7a6040'); R2(1926, GROUND_Y - 11, 22, 1, '#3e3020');
  drawText(gm, 'Р', 1934, surfRow(GROUND_Y - 15), '#d8d0c0', null);
  const cx = 1420;                                                        // сгоревшая машина
  R2(cx, GROUND_Y - 13, 46, 9, '#4e3a2e'); R2(cx + 9, GROUND_Y - 21, 24, 8, '#3e3028'); R2(cx + 12, GROUND_Y - 19, 8, 5, '#16181a'); R2(cx + 22, GROUND_Y - 19, 8, 5, '#16181a');
  R2(cx, GROUND_Y - 13, 46, 1, '#6a5040'); for (let k = 0; k < 8; k++) R2(cx + 3 + k * 5, GROUND_Y - 10, 3, 2, '#6a3e26');
  disc(gm, cx + 9, surfRow(GROUND_Y - 3), 4, '#1a1a1a'); disc(gm, cx + 37, surfRow(GROUND_Y - 3), 4, '#1a1a1a');
  for (let k = 0; k < 6; k++) R2(1980 + (k % 2), GROUND_Y - 30 + k * 5, 18, 1, '#4a4844');   // забор у края
  R2(1984, GROUND_Y - 32, 2, 32, '#3a3836'); R2(1996, GROUND_Y - 32, 2, 32, '#3a3836');
  // Вестибюль станции.
  const px0 = 1592, px1 = 1708, top = GROUND_Y - 51;
  R2(px0, top, px1 - px0, 51, '#5e5c56');
  for (let x = px0; x < px1; x += 12) R2(x, top, 1, 51, '#4e4c48');
  for (let k = 0; k < 14; k++) { const sx = px0 + ((hash(k, 61) * (px1 - px0)) | 0); R2(sx, top + 2, 1, 10 + ((hash(61, k) * 30) | 0), 'rgba(30,26,22,.35)'); }
  R2(px0 - 6, top - 6, px1 - px0 + 12, 6, '#6e6c66'); R2(px0 - 6, top - 6, px1 - px0 + 12, 1, '#8a8882'); R2(px0 - 6, top - 1, px1 - px0 + 12, 1, '#3a3836');
  [[px0 + 8, 38], [1664, 36]].forEach(([wx, ww]) => {
    R2(wx, GROUND_Y - 36, ww, 22, '#1a2022'); R2(wx, GROUND_Y - 36, ww, 1, '#3a4448');
    for (let k = 9; k < ww; k += 9) R2(wx + k, GROUND_Y - 36, 1, 22, '#3a3a38');
    L(gm, wx + 3, surfRow(GROUND_Y - 35), wx + 12, surfRow(GROUND_Y - 22), '#4a5a5e');
  });
  R2(1640, GROUND_Y - 32, 20, 32, '#3e4244'); R2(1642, GROUND_Y - 30, 16, 30, '#0b0d0f');           // двери
  for (let x = 1586; x < 1716; x += 4) { R2(x, top - 9, 3, 1, '#5a5a58'); R2(x + 1, top - 8, 1, 2, '#5a5a58'); }   // колючая проволока
  plate(gm, 1650, surfRow(top + 4), 'ГАГАРИНСКАЯ', '#2f5660', '#dfe6d6', '#6f9a98');
  R2(1649, top - 18, 2, 12, '#3a3a38'); R2(1640, top - 38, 20, 20, '#8a2a24'); R2(1640, top - 38, 20, 1, '#aa4038');
  drawText(gm, 'М', 1645, surfRow(top - 35), '#ece4d2', 'rgba(0,0,0,.4)', 2);
  for (let k = 0; k < 4; k++) { const sx = k < 2 ? 1612 + k * 12 : 1664 + (k - 2) * 12;          // мешки у входа
    R2(sx, GROUND_Y - 6, 13, 6, '#776c52'); R2(sx + 1, GROUND_Y - 6, 11, 1, '#9a8e6c'); }
  const lamp = addLight(1650, GROUND_Y - 34, 44, [255, 200, 140], 'flicker', 0.8);
  lamp.clip = SURF_CLIP;
  addEmissive(1649, GROUND_Y - 34, 3, 1, [255, 226, 170], lamp);
  R2(1647, GROUND_Y - 36, 7, 2, '#4a4a48');
  WORLD.sky = sky; WORLD.ruins = ruins; WORLD.surface = surf;
}

