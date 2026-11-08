/* ============================== ST-ART-001 ============================== */
/* ST-ART-001: поверхность над «Гагаринской» по утверждённому рисунку (гибрид: картинки + Canvas 2D, палитра «Дворов»).
   Заменяет надземную часть слоёв станции WORLD.sky / WORLD.ruins / WORLD.surface; подземный разрез, вестибюль,
   спуск (GATES, x 1650), проход во «Дворы» (левый край, x 1136), правая граница (1980) и точки поиска не меняются.
   Ходьба: x 1136–1980 (CONFIG.FLOORS.surface). Слева направо:
     длинный дом с витринами (уходит за левый край) · завал · закрытый павильон метро · ПРОХОД во «Дворы» (1136) ·
     торцевой дом (3 подъезда без света) · рабочий павильон (тёплый вход на 1-м этаже над спуском 1650) · завал до 1980.
   Небо и дальний город — те же картинки, что у «Дворов» (S1-ART). Резерв: процедурная поверхность (без картинок, с ?st=proc). */
/** Свет над землёй, когда поверхность из картинок: почти дневной, как во «Дворах» (там свет не умножается); запас — для тёплого входа. */
const ST_ART_DAY = [238, 236, 232];

const STArt = {
  state: 'idle', imgs: null, error: '',
  start() {
    if (this.state !== 'idle') return;
    if (S1Art.state === 'off' || /[?&]st=proc(?:&|$)/.test(location.search) || typeof Image === 'undefined') { this.state = 'off'; return; }
    this.state = 'loading';
    Promise.all(Object.keys(ST_ART_SRC).map(k => {
      const im = new Image(); im.src = ST_ART_SRC[k];
      return (im.decode ? im.decode() : new Promise((ok, no) => { im.onload = ok; im.onerror = no; })).then(() => [k, im]);
    })).then(list => { this.imgs = Object.fromEntries(list); this.state = 'decoded'; this.apply(); })
      .catch(e => { this.state = 'failed'; this.error = String(e && e.message || e); console.warn('ST-ART: картинки не загрузились, процедурная поверхность', e); });
  },
  /** Заменить надземную часть станции, когда готовы и свои картинки, и картинки «Дворов» (небо, дальний город). */
  apply() {
    if (this.state !== 'decoded' || S1Art.state !== 'ready' || !WORLD.surface) return;
    const old = [WORLD.sky, WORLD.ruins, WORLD.surface];
    const t0 = performance.now();
    Object.assign(WORLD, buildSurfaceArt(this.imgs, S1Art.imgs, WORLD.surface));
    for (const c of old) { c.width = 0; c.height = 0; }
    this.ms = Math.round(performance.now() - t0); this.state = 'ready';
  },
};

function buildSurfaceArt(I, S, procSurface) {
  const GY = surfRow(GROUND_Y);                                        // строка земли (бордюр) в слоях поверхности
  const ctx = c => { const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return g; };
  const fadeLeft = (im, n) => {
    const c = makeCanvas(im.width, im.height), g = ctx(c); g.drawImage(im, 0, 0);
    const gr = g.createLinearGradient(0, 0, n, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, im.width, im.height); return c;
  };
  const tile = (g, im, x1, y, overlap) => { const soft = fadeLeft(im, overlap); for (let x = 0, f = true; x < x1; x += im.width - overlap, f = false) g.drawImage(f ? im : soft, x, y); };
  const at = (g, im, x, flip = false, dy = 0) => {                     // нижний край картинки — на земле (строка GY − 1)
    const y = GY - im.height + dy;
    if (!flip) { g.drawImage(im, x, y); return; }
    g.save(); g.translate(x + im.width, y); g.scale(-1, 1); g.drawImage(im, 0, 0); g.restore();
  };
  // небо (параллакс SKY) и дальний город (RUINS) — из «Дворов»
  const sky = makeCanvas(1400, SURF_H), gs = ctx(sky); tile(gs, S.sky, sky.width, GY + 40 - S.sky.height, 80);
  const ruins = makeCanvas(W, SURF_H), gr = ctx(ruins); tile(gr, S.far, W, GY - 6 - S.far.height, 120);
  gr.globalCompositeOperation = 'source-atop'; gr.fillStyle = 'rgba(140,140,138,.18)'; gr.fillRect(0, 0, W, SURF_H); gr.globalCompositeOperation = 'source-over';
  // улица: подземный разрез и бордюр — прежние (строки от земли вниз), надземная часть — из рисунка
  const surf = makeCanvas(W, SURF_H), g = ctx(surf);
  g.drawImage(procSurface, 0, GY, W, SURF_H - GY, 0, GY, W, SURF_H - GY);
  at(g, I.long, 1134 - I.long.width);                                  // длинный дом: правый край у прохода
  at(g, S.rubble, 748, false, 3); at(g, S.rubble, 806, true, 4);      // завал перед закрытым павильоном
  at(g, I.closed, 880);                                                // закрытый павильон
  at(g, I.endhouse, 1136);                                             // торцевой дом за проходом
  const ox = 1650 - 133;                                               // рабочий павильон: середина двери (133 px от края) над спуском 1650
  at(g, I.open, ox);
  at(g, I.barrier, 1432); at(g, I.barrier, 1474, true); at(g, S.bags, 1494);   // разрыв между торцом и павильоном
  at(g, I.barrier, ox + I.open.width + 2, true);
  at(g, S.rubble, 1770, false, 3); at(g, S.rubble, 1850, true, 4); at(g, S.rubble, 1905, false, 2);   // завал до правой границы
  // точки поиска — прежние корпуса (створку гаража и канистры дорисовывает Render.drawScavenge)
  for (const [x0, x1, h] of [[1172, 1230, 37], [1414, 1472, 24], [1914, 1966, 18]]) g.drawImage(procSurface, x0, GY - h, x1 - x0, h + 2, x0, GY - h, x1 - x0, h + 2);
  return { sky, ruins, surface: surf };
}
